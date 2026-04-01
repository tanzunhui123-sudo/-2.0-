import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Image as ImageIcon, Settings, Sparkles, Box, Wind, 
  Loader2, Layout, Maximize2, X, Layers, Key, Download, Trash2,
  Palette, Pipette, Upload, History, Clock, ChevronLeft, ChevronRight,
  MonitorUp, MoveHorizontal, Scaling, Wand2, Plus, Cloud, RefreshCw, AlertTriangle,
  ImagePlus, Brush, Eraser
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import MessageBubble from './components/MessageBubble';
import InpaintingModal from './components/InpaintingModal';
import { 
  INITIAL_MESSAGE, ASPECT_RATIOS, 
  RESOLUTIONS, DESIGN_COLORS 
} from './constants';
import { Message, Mode } from './types';
import { 
  saveMessageToDB, getHistoryFromDB, clearHistoryDB,
  initGapiClient, initGisClient, requestAccessToken, 
  findHistoryFile, getFileContent, createHistoryFile, updateHistoryFile, DEFAULT_CLIENT_ID
} from './utils';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [activeRequests, setActiveRequests] = useState(0);
  const [progress, setProgress] = useState(0); // Progress state
  const [mode, setMode] = useState<Mode>('architect');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('2K');
  
  // Changed from single string to array of strings for multi-upload support
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  // New state for Scene Reference Image
  const [sceneRefImage, setSceneRefImage] = useState<string | null>(null);
  
  const [hasApiKey, setHasApiKey] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // Color Palette State
  const [accentColor, setAccentColor] = useState<string>('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Inpainting State
  const [isInpainting, setIsInpainting] = useState(false);
  const [inpaintTargetImage, setInpaintTargetImage] = useState<string | null>(null);

  // Expand State
  const [showExpandMenu, setShowExpandMenu] = useState(false);

  // --- API Configuration ---
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('lyra_api_key') || '');
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('lyra_api_base_url') || '');
  const [apiProvider, setApiProvider] = useState<'google' | 'kie' | 'custom'>(() => (localStorage.getItem('lyra_api_provider') as any) || 'google');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // --- 模型配置 ---
  // Google 原生模型
  const googleTextModels = [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview ⭐' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  ];
  const googleImageModels = [
    { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image Preview ⭐' },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
  ];
  // Kie.ai 模型
  const kieTextModels = [
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro ⭐' },
    { id: 'gemini-3-pro', name: 'Gemini 3 Pro' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  ];
  const kieImageModels = [
    { id: 'nano-banana-2', name: 'Nano Banana 2 ⭐' },
    { id: 'nano-banana-pro', name: 'Nano Banana Pro' },
  ];

  const textModelOptions = apiProvider === 'kie' ? kieTextModels : googleTextModels;
  const imageModelOptions = apiProvider === 'kie' ? kieImageModels : googleImageModels;

  const [selectedTextModel, setSelectedTextModel] = useState(() => {
    const c = localStorage.getItem('lyra_text_model');
    const provider = localStorage.getItem('lyra_api_provider') || 'google';
    const opts = provider === 'kie' ? kieTextModels : googleTextModels;
    return (c && opts.some(m => m.id === c)) ? c : opts[0].id;
  });
  const [selectedImageModel, setSelectedImageModel] = useState(() => {
    const c = localStorage.getItem('lyra_image_model');
    const provider = localStorage.getItem('lyra_api_provider') || 'google';
    const opts = provider === 'kie' ? kieImageModels : googleImageModels;
    return (c && opts.some(m => m.id === c)) ? c : opts[0].id;
  });

  // 切换 Provider 时重置模型选择
  const handleProviderChange = (newProvider: 'google' | 'kie' | 'custom') => {
    setApiProvider(newProvider);
    const tOpts = newProvider === 'kie' ? kieTextModels : googleTextModels;
    const iOpts = newProvider === 'kie' ? kieImageModels : googleImageModels;
    setSelectedTextModel(tOpts[0].id);
    setSelectedImageModel(iOpts[0].id);
  };

  // Helper to get initialized AI client (Google SDK)
  const getAiClient = () => {
    const key = userApiKey || process.env.API_KEY || '';
    const options: any = { apiKey: key };
    if (apiProvider === 'custom' && apiBaseUrl) {
        options.httpOptions = { baseUrl: apiBaseUrl };
    }
    return new GoogleGenAI(options);
  }

  // ===== Kie.ai Helper Functions =====
  const getKieApiKey = () => userApiKey || '';

  // Upload base64 image to kie.ai and get URL
  const kieUploadImage = async (base64DataUri: string): Promise<string> => {
    const resp = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getKieApiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data: base64DataUri, uploadPath: 'lyra/uploads' })
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.msg || 'Image upload failed');
    return data.data.downloadUrl;
  };

  // Create async image task on kie.ai
  const kieCreateTask = async (model: string, input: any): Promise<string> => {
    const resp = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getKieApiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input })
    });
    const data = await resp.json();
    if (data.code !== 200) throw new Error(data.msg || 'Task creation failed');
    return data.data.taskId;
  };

  // Poll kie.ai task until completion
  const kiePollTask = async (taskId: string, maxWait = 120000): Promise<string[]> => {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 3000));
      const resp = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
        headers: { 'Authorization': `Bearer ${getKieApiKey()}` }
      });
      const data = await resp.json();
      if (data.code !== 200) throw new Error(data.msg || 'Task query failed');
      const state = data.data?.state;
      if (state === 'success') {
        const resultJson = JSON.parse(data.data.resultJson || '{}');
        return resultJson.resultUrls || [];
      }
      if (state === 'fail') throw new Error(data.data?.failMsg || 'Image generation failed');
    }
    throw new Error('Task timed out');
  };

  // Kie.ai text generation (chat completions)
  const kieTextGenerate = async (model: string, userContent: any[], systemPrompt?: string): Promise<string> => {
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userContent });
    const resp = await fetch(`https://api.kie.ai/${model}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getKieApiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream: false, include_thoughts: false })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Kie.ai chat error:', resp.status, errText);
      throw new Error(`Kie.ai API error ${resp.status}: ${errText.slice(0, 200)}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  };

  // Kie.ai full image generation flow: upload images → create task → poll → get URLs
  const kieGenerateImage = async (prompt: string, imageBase64s: string[], opts: {
    aspectRatio?: string; resolution?: string; isMask?: boolean;
  } = {}): Promise<string | null> => {
    // Upload images if provided
    const imageUrls: string[] = [];
    for (const img of imageBase64s) {
      const url = await kieUploadImage(img);
      imageUrls.push(url);
    }

    let model: string;
    let input: any;
    const userModel = selectedImageModel; // 用户在设置中选的模型

    if (opts.isMask && imageUrls.length >= 2) {
      // Inpainting/Edit mode
      model = userModel;
      input = {
        prompt,
        image_urls: imageUrls,
        output_format: 'png',
        aspect_ratio: opts.aspectRatio || '1:1',
        resolution: opts.resolution || '2K'
      };
    } else if (imageUrls.length > 0) {
      // Image-to-image
      model = userModel;
      input = {
        prompt,
        image_input: imageUrls,
        output_format: 'png',
        aspect_ratio: opts.aspectRatio || '1:1',
        resolution: opts.resolution || '2K'
      };
    } else {
      // Text-to-image
      model = userModel;
      input = {
        prompt,
        output_format: 'png',
        aspect_ratio: opts.aspectRatio || '1:1',
        resolution: opts.resolution || '2K'
      };
    }

    const taskId = await kieCreateTask(model, input);
    const urls = await kiePollTask(taskId);
    return urls[0] || null;
  };

  // --- Drive State ---
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>(() => localStorage.getItem('google_client_id') || '');
  const [showClientIdInput, setShowClientIdInput] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sceneRefInputRef = useRef<HTMLInputElement>(null);
  const swatchInputRef = useRef<HTMLInputElement>(null);
  const standaloneInpaintInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Initialization & History Loading ---
  useEffect(() => {
    // 1. Check API Key
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasSelected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasSelected);
      } else {
        // Check if user has a saved API key or .env key
        const savedKey = localStorage.getItem('lyra_api_key') || '';
        const envKey = process.env.API_KEY || '';
        setHasApiKey(!!(savedKey || envKey));
      }
    };
    checkApiKey();

    // 2. Load History from DB
    const loadHistory = async () => {
      const history = await getHistoryFromDB();
      if (history.length > 0) {
        setMessages(history);
      } else {
        // Save initial message if DB is empty
        saveMessageToDB(INITIAL_MESSAGE);
      }
    };
    loadHistory();

    // 3. Init GAPI if client ID is present
    if (clientId) {
        initializeDriveApi(clientId);
    }
  }, []);

  // --- Drive Logic ---

  const initializeDriveApi = async (cid: string) => {
    try {
        // Use the same Gemini Key for GAPI discovery/init if possible, or fallback
        // Note: Drive API needs OAuth, apiKey is for discovery quota usually
        const apiKey = process.env.API_KEY || ''; 
        await initGapiClient(apiKey);
        
        initGisClient(cid, async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                setIsDriveConnected(true);
                handleDriveSync(true); // Initial sync on connect
            }
        });
    } catch (e) {
        console.error("Failed to init Drive API", e);
    }
  };

  const handleDriveConnect = () => {
      if (!clientId) {
          setShowClientIdInput(true);
          return;
      }
      if (!isDriveConnected) {
          initializeDriveApi(clientId).then(() => {
               requestAccessToken();
          });
      } else {
          // Trigger manual sync
          handleDriveSync(true);
      }
  };

  const handleDriveSync = async (isPull = false) => {
      if (isSyncing) return;
      setIsSyncing(true);
      try {
          let fid = driveFileId;
          if (!fid) {
              const file = await findHistoryFile();
              if (file) {
                  fid = file.id;
                  setDriveFileId(fid);
              }
          }

          if (isPull && fid) {
              // Pull from Drive (Cloud is Truth logic for "every time I open it")
              const cloudMessages = await getFileContent(fid);
              if (Array.isArray(cloudMessages) && cloudMessages.length > 0) {
                  // Merge logic: For now, replace local with cloud if cloud has data,
                  // but maybe we should ensure we don't lose local-only unsaved stuff?
                  // For simplicity: Replace local state with Cloud history.
                  setMessages(cloudMessages);
                  // Also update DB
                  await clearHistoryDB();
                  for (const msg of cloudMessages) {
                      await saveMessageToDB(msg);
                  }
              }
          } else {
              // Push to Drive
              const content = JSON.stringify(messages, null, 2);
              if (fid) {
                  await updateHistoryFile(fid, content);
              } else {
                  const newId = await createHistoryFile(content);
                  setDriveFileId(newId);
              }
          }
      } catch (e) {
          console.error("Sync failed", e);
          alert("同步到 Google Drive 失败，请检查网络或授权。");
      } finally {
          setIsSyncing(false);
      }
  };

  // Debounced Auto-Save to Drive
  useEffect(() => {
      if (isDriveConnected && messages.length > 1) {
          const timer = setTimeout(() => {
              handleDriveSync(false); // Push
          }, 2000); // 2s debounce
          return () => clearTimeout(timer);
      }
  }, [messages, isDriveConnected]);


  const saveClientId = () => {
      if (clientId.trim()) {
          localStorage.setItem('google_client_id', clientId.trim());
          setShowClientIdInput(false);
          handleDriveConnect();
      }
  };

  // --- Helper to add message and save to DB ---
  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
    saveMessageToDB(msg);
  };

  const handleClearHistory = async () => {
    if (confirm('确定要清除所有历史记录吗？此操作不可恢复。')) {
        await clearHistoryDB();
        setMessages([INITIAL_MESSAGE]);
        saveMessageToDB(INITIAL_MESSAGE);
        // Also clear Drive? Maybe not, safety first.
    }
  };

  // Progress Bar Simulation Effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let timer: NodeJS.Timeout | null = null;
    
    if (activeRequests > 0) {
      if (progress === 0) setProgress(2);

      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return prev;
          const remaining = 98 - prev;
          const increment = Math.max(0.2, remaining * 0.05 * Math.random());
          return Math.min(98, prev + increment);
        });
      }, 150);
    } else {
      if (progress > 0) {
        setProgress(100);
        timer = setTimeout(() => {
          setProgress(0);
        }, 800);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, [activeRequests, progress]);

  const handleSelectApiKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeRequests]);

  // --- Color Logic ---
  const handleColorPick = async () => {
    if ('EyeDropper' in window) {
      try {
        // @ts-ignore
        const eyeDropper = new window.EyeDropper();
        // @ts-ignore
        const result = await eyeDropper.open();
        setAccentColor(result.sRGBHex);
      } catch (e) {
        console.log('EyeDropper failed or cancelled');
      }
    } else {
      setShowColorPicker(!showColorPicker);
    }
  };

  const handleSwatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = 1;
        canvas.height = 1;
        ctx.drawImage(img, 0, 0, 1, 1);
        
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        setAccentColor(hex.toUpperCase());
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleStandaloneInpaintUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0] as File | undefined;
     if (!file) return;
     const reader = new FileReader();
     reader.onload = (event) => {
       const res = event.target?.result as string;
       setInpaintTargetImage(res);
       setIsInpainting(true);
     };
     reader.readAsDataURL(file);
     e.target.value = '';
  };

  const getClosestAspectRatio = (src: string): Promise<string> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
              const ratio = img.width / img.height;
              const supportedRatios = [
                  { str: '1:1', val: 1 },
                  { str: '4:3', val: 4/3 },
                  { str: '3:4', val: 3/4 },
                  { str: '16:9', val: 16/9 },
                  { str: '9:16', val: 9/16 },
              ];
              const closest = supportedRatios.reduce((prev, curr) => 
                  Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev
              );
              resolve(closest.str);
          };
          img.src = src;
      });
  };

  const handleQuotePrompt = (text: string) => {
    setInputText(text);
    setTimeout(() => {
        textareaRef.current?.focus();
    }, 50);
  };

  // --- Image Enhancement Logic ---
  const handleImageEnhance = async (sourceImageUrl: string, type: 'upscale' | 'expand', targetRatio?: string) => {
    if (!sourceImageUrl) return;
    setPreviewImageUrl(null);
    setShowExpandMenu(false);

    const actionDesc = type === 'upscale' ? '✨ 4K 超清放大' : `↔️ 扩展比例至 ${targetRatio}`;

    addMessage({
        id: Date.now(),
        role: 'user',
        type: 'text',
        content: `🛠️ 图像编辑: ${actionDesc}`
    });

    setActiveRequests(prev => prev + 1);

    try {
        addMessage({
            id: Date.now() + 1,
            role: 'assistant',
            type: 'text',
            content: type === 'upscale' 
                ? "🚀 正在进行 4K 超分处理，增强细节..." 
                : "🎨 正在智能扩展画幅 (Outpainting)..."
        });

        let generatedImageUrl: string | null = null;

        if (apiProvider === 'kie') {
            // === Kie.ai path ===
            const prompt = type === 'upscale'
                ? "Upscale this image to 4K resolution. Improve sharpness, texture details, and clarity while preserving the original subject, composition, and colors. High Fidelity."
                : `Outpaint and expand this image to fit the ${targetRatio} aspect ratio. Generate coherent and realistic background content for the empty space that seamlessly matches the original lighting, style, and perspective.`;
            const ratio = type === 'upscale' ? await getClosestAspectRatio(sourceImageUrl) : (targetRatio || '16:9');
            const res = type === 'upscale' ? '4K' : '2K';
            generatedImageUrl = await kieGenerateImage(prompt, [sourceImageUrl], { aspectRatio: ratio, resolution: res });
        } else {
            // === Google SDK path ===
            const ai = getAiClient();
            const base64Data = sourceImageUrl.split(',')[1];
            const mimeType = sourceImageUrl.split(';')[0].split(':')[1];

            const parts: any[] = [
                { inlineData: { mimeType, data: base64Data } }
            ];

            let config = {};

            if (type === 'upscale') {
                parts.push({ text: "Upscale this image to 4K resolution. Significantly improve sharpness, texture details, and clarity while strictly preserving the original subject, composition, and colors. High Fidelity." });
                const ratio = await getClosestAspectRatio(sourceImageUrl);
                config = {
                    imageConfig: { imageSize: '4K', aspectRatio: ratio }
                };
            } else {
                parts.push({ text: `Outpaint and expand this image to fit the ${targetRatio} aspect ratio. Generate coherent and realistic background content for the empty space that seamlessly matches the original lighting, style, and perspective.` });
                config = {
                    imageConfig: { imageSize: '2K', aspectRatio: targetRatio }
                };
            }

            const response = await ai.models.generateContent({
                model: selectedImageModel,
                contents: { parts },
                config
            });

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
            }
        }

        if (generatedImageUrl) {
            addMessage({ id: Date.now() + 11, role: 'assistant', type: 'image', content: generatedImageUrl });
        } else {
             addMessage({ id: Date.now() + 11, role: 'assistant', type: 'text', content: "⚠️ 处理失败，未能生成图像。" });
        }

    } catch (error: any) {
        console.error("Enhance Error:", error);
        addMessage({ id: Date.now() + 10, role: 'assistant', type: 'text', content: "⚠️ 图像处理发生错误，请重试。" });
    } finally {
        setActiveRequests(prev => Math.max(0, prev - 1));
    }
  };


  const openInpainting = (imageUrl: string) => {
    setInpaintTargetImage(imageUrl);
    setIsInpainting(true);
  };

  const handleInpaintSubmit = async (maskBase64: string, prompt: string, referenceImage?: string, materialImage?: string) => {
     if (!inpaintTargetImage) return;

     setActiveRequests(prev => prev + 1);
     
     let msgPrefix = "🖌️ [局部重绘] ";
     if (referenceImage) msgPrefix = "🖌️ [人物置换] ";
     if (materialImage) msgPrefix = "🧬 [材质置换] ";

     addMessage({ id: Date.now(), role: 'user', type: 'text', content: `${msgPrefix} 指令: ${prompt}` });

     try {
        let statusMsg = "🎨 正在进行局部重绘...";
        if (referenceImage) statusMsg = "🎨 正在进行人物一致性置换...";
        if (materialImage) statusMsg = "🧬 正在进行材质物理属性置换...";

        addMessage({ id: Date.now() + 1, role: 'assistant', type: 'text', content: statusMsg });

        const targetAspectRatio = await getClosestAspectRatio(inpaintTargetImage);

        let generatedImageUrl: string | null = null;

        if (apiProvider === 'kie') {
            // === Kie.ai path ===
            let finalPrompt = prompt;
            const allImages = [inpaintTargetImage, maskBase64];
            if (materialImage) {
                allImages.push(materialImage);
                finalPrompt = `MATERIAL REPLACEMENT: ${prompt}. Replace the masked area material with the texture from the reference image. Photorealistic.`;
            } else if (referenceImage) {
                allImages.push(referenceImage);
                finalPrompt = `INPAINT with reference: ${prompt}. Place the person/character from the reference into the masked area. Match lighting and perspective.`;
            } else {
                finalPrompt = `EDIT: ${prompt}. The second image is a MASK where white pixels indicate the area to modify.`;
            }
            generatedImageUrl = await kieGenerateImage(finalPrompt, allImages, { aspectRatio: targetAspectRatio, resolution: resolution, isMask: true });
        } else {
            // === Google SDK path ===
            const ai = getAiClient();
            const originalBase64 = inpaintTargetImage.split(',')[1];
            const maskData = maskBase64.split(',')[1];

            const parts: any[] = [
                { inlineData: { mimeType: 'image/jpeg', data: originalBase64 } },
                { inlineData: { mimeType: 'image/png', data: maskData } }
            ];

            let finalPrompt = '';

            if (materialImage) {
                 const matBase64 = materialImage.split(',')[1];
                 const matMime = materialImage.split(';')[0].split(':')[1];
                 parts.push({ inlineData: { mimeType: matMime, data: matBase64 } });
                 finalPrompt = `MATERIAL REPLACEMENT TASK:
                 
                 IMAGES:
                 1. Target Image (Scene/Object)
                 2. Mask Image (White = Area to replace)
                 3. TEXTURE REFERENCE (Material Swatch/Photo)
                 
                 INSTRUCTION: ${prompt}
                 
                 CRITICAL PHYSICS SIMULATION:
                 - Replace the material in the masked area with the EXACT material from Image 3.
                 - Synthesize the new material's physical properties: Diffuse reflection, Specularity, Roughness, and Micro-texture (e.g. fabric weave, wood grain).
                 - The new material must interact realistically with the existing lighting environment of Image 1 (Shadows, Highlights, AO).
                 - Preserve the underlying geometry and folds if applicable, but fully replace the surface shader.
                 - High Fidelity, 8k Resolution, Photorealistic.`;
            } else if (referenceImage) {
                 const refBase64 = referenceImage.split(',')[1];
                 const refMime = referenceImage.split(';')[0].split(':')[1];
                 parts.push({ inlineData: { mimeType: refMime, data: refBase64 } });
                 finalPrompt = `EDITING TASK: Inpaint the masked area using the provided reference image.
                 
                 IMAGES PROVIDED:
                 1. Target Image (to be edited)
                 2. Mask Image (White = edit area)
                 3. REFERENCE IMAGE (Character/Person)
                 
                 INSTRUCTION: ${prompt}
                 
                 CRITICAL CONSTRAINT: You MUST generate the person/character from the Reference Image (Image 3) into the masked area of the Target Image (Image 1). 
                 Maintain high fidelity to the reference character's facial features, hair, clothing style, and body type. 
                 Ensure lighting and perspective match the Target Image scene.`;
            } else {
                 finalPrompt = `EDITING TASK: Modify the first image based on the instructions.
                 INSTRUCTIONS: ${prompt}
                 CONSTRAINT: The second image provided is a MASK. WHITE pixels indicate area to modify.`;
            }

            parts.push({ text: finalPrompt });

            const response = await ai.models.generateContent({
              model: selectedImageModel, 
              contents: { parts },
              config: { imageConfig: { aspectRatio: targetAspectRatio, imageSize: '2K' } }
            });

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
            }
        }

        if (generatedImageUrl) {
            addMessage({ id: Date.now() + 11, role: 'assistant', type: 'image', content: generatedImageUrl });
        } else {
             addMessage({ id: Date.now() + 11, role: 'assistant', type: 'text', content: "⚠️ 重绘失败，未能生成图像。" });
        }

     } catch (error: any) {
        console.error("Inpainting Error:", error);
        addMessage({ id: Date.now() + 10, role: 'assistant', type: 'text', content: "⚠️ 重绘过程中发生错误，请重试。" });
     } finally {
        setActiveRequests(prev => Math.max(0, prev - 1));
     }
  };


  const handleSendMessage = async () => {
    if (!inputText.trim() && pendingImages.length === 0) return;

    // --- 1. Update Chat History with User Input ---
    const timestamp = Date.now();
    let msgIdOffset = 0;

    // Add images to chat (Product Images)
    if (pendingImages.length > 0) {
        pendingImages.forEach((img, idx) => {
             addMessage({ id: timestamp + msgIdOffset++, role: 'user', type: 'image', content: img });
        });
    }

    // Add Scene Reference Image to chat if present
    if (sceneRefImage) {
        addMessage({ id: timestamp + msgIdOffset++, role: 'user', type: 'image', content: sceneRefImage });
    }

    // Add text to chat (once)
    let displayPrompt = inputText;
    if (sceneRefImage && pendingImages.length > 0) {
        displayPrompt = `[参考场景复刻] ${inputText}`;
    }
    
    if (displayPrompt.trim()) {
      addMessage({ id: timestamp + msgIdOffset++, role: 'user', type: 'text', content: displayPrompt });
    }
    
    // Capture state for the generation process
    const currentInput = inputText;
    const currentImages = [...pendingImages];
    const currentSceneRef = sceneRefImage;
    const colorContext = accentColor ? `\n\nDESIGN CONSTRAINT: Use the color ${accentColor} as a primary accent or dominant tone.` : '';
    
    // Reset Input State logic:
    if (mode !== 'master') {
        setInputText('');
        setPendingImages([]);
        setSceneRefImage(null);
    }

    // --- 2. Define Generation Logic ---
    // If no images, we execute once with null image. If images, we execute for EACH image (Concurrent/Batch).
    const tasks = currentImages.length > 0 ? currentImages : [null];
    
    setActiveRequests(prev => prev + tasks.length);
    if (progress > 90) setProgress(50); 
    else if (progress === 0) setProgress(2);

    const ai = apiProvider !== 'kie' ? getAiClient() : null;

    // API Retry Wrapper (Google SDK only)
    const generateWithRetry = async (model: string, params: any, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await ai!.models.generateContent({ model, ...params });
            } catch (error: any) {
                const isRetryable = error.message?.includes('503') || error.message?.includes('Deadline expired') || error.status === 503;
                if (isRetryable && i < retries - 1) {
                    console.warn(`Request failed with 503/Timeout. Retrying (${i + 1}/${retries})...`);
                    await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i))); // Exponential backoff
                    continue;
                }
                throw error;
            }
        }
    };

    const processTask = async (image: string | null, taskIndex: number) => {
        // Use a unique offset for ID generation to prevent collision in async returns
        const baseId = timestamp + 1000 + (taskIndex * 100); 

        try {
            if (mode === 'architect') {
                // --- Architect Mode ---

                const systemPrompt = `You are Lyra, a professional "Prompt Architect" and visual director.
Your core function is to execute the **"DETAIL MODE"** protocol for image analysis and prompt engineering.

**STRICT OUTPUT PROTOCOL: DETAIL MODE**

You MUST structure your response exactly as follows:

### 1. 视觉解析 (Visual Analysis)
[Provide a deep, professional breakdown of the image in Chinese. Focus on Subject, Material, Lighting, Composition, and Mood.]

### 2. 生成提示词 (Prompts)

**English Prompt (Midjourney/MJ Style):**
\`\`\`markdown
[Insert English Prompt Here - highly detailed, comma-separated keywords, technical parameters like --ar 16:9 --v 6.0]
\`\`\`

**Chinese Prompt (Structured Architecture):**
\`\`\`markdown
[Header Line: Photography Style, Style (e.g. Japandi), Resolution, Details (e.g. 8K超清, 杂志级构图).]

(核心主体)
[Detailed description of the core subject, including shape, color, materials, and specific design details like tufting or frame types.]

(构图与视角)
[Description of camera angle, lens choice (e.g. 35mm), and visual focus/framing.]

(环境背景)
[Description of the room architecture, windows, floor material, and wall details.]

(氛围与照明系统)
[Description of the light source (e.g., natural light, golden hour), light direction, shadows, and overall atmosphere.]

(配套软装)
[Description of carpets, rugs, art, plants, and other accessories in the scene.]
\`\`\`

**RULES:**
- **CRITICAL:** The Chinese Prompt MUST strictly follow the exact section headers in order: "(核心主体)", "(构图与视角)", "(环境背景)", "(氛围与照明系统)", and "(配套软装)".
- Do not use generic paragraphs for the Chinese prompt; use the defined structure.
- Ensure high fidelity to the input image.`;

                let promptText = currentInput;
                const strictInstruction = "Strictly follow 'DETAIL MODE' protocol. The Chinese prompt MUST follow the specific 6-part architecture (Header + 5 sections) defined in system instructions.";
                
                if (!promptText && image) {
                  promptText = `Please analyze this image using DETAIL MODE. ${strictInstruction} ${colorContext}`;
                } else if (promptText) {
                  promptText = `${promptText}. (Use DETAIL MODE: ${strictInstruction}) ${colorContext}`;
                }

                let responseText = '';

                if (apiProvider === 'kie') {
                    // === Kie.ai text generation ===
                    const content: any[] = [];
                    if (image) {
                        // Must upload image first, then pass URL — kie.ai chat doesn't accept data URIs
                        const imageUrl = await kieUploadImage(image);
                        content.push({ type: 'image_url', image_url: { url: imageUrl } });
                    }
                    content.push({ type: 'text', text: promptText });
                    responseText = await kieTextGenerate(selectedTextModel, content, systemPrompt);
                } else {
                    // === Google SDK ===
                    const parts: any[] = [];
                    if (image) {
                      const base64Data = image.split(',')[1];
                      const mimeType = image.split(';')[0].split(':')[1];
                      parts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
                    }
                    parts.push({ text: promptText });

                    const response = await generateWithRetry(
                        selectedTextModel, 
                        {
                            contents: { parts },
                            config: { systemInstruction: systemPrompt }
                        }
                    );
                    responseText = response?.text || '';
                }

                addMessage({ 
                  id: baseId, 
                  role: 'assistant', 
                  type: 'text', 
                  content: responseText || "解析失败，未能生成内容。"
                });

            } else {
                // --- Master Mode ---
                let prompt = "";

                // Helper: detect if user mentioned perspective/angle keywords
                const userInput = currentInput || "";
                const hasPerspectiveHint = /透视|视角|俯视|仰视|平视|侧视|鸟瞰|低角度|高角度|正面|背面|45度|90度|top.?down|bird.?eye|low.?angle|high.?angle|eye.?level|front.?view|side.?view|aerial|isometric|perspective|angle|overhead/i.test(userInput);
                const hasQualityHint = /画质|质感|水彩|油画|插画|卡通|动漫|手绘|素描|像素|风格化|abstract|watercolor|oil.?paint|cartoon|anime|illustration|sketch|pixel|stylized|flat.?design|minimalist.?art/i.test(userInput);

                // Default photorealistic quality suffix (only if user didn't specify quality style)
                const qualitySuffix = hasQualityHint 
                  ? "" 
                  : "\n\nPHOTO QUALITY: Shot on Sony A7R V with 85mm f/1.4 GM lens. Natural ambient lighting with soft fill. RAW-quality color depth, fine grain texture, true-to-life skin tones and material rendering. 8K resolution, professional color grading. The final image must be indistinguishable from a real professional photograph.";

                // 3. Construct Prompt based on inputs
                if (image && currentSceneRef) {
                    // 场景参考 + 产品图：替换场景中的产品为上传的产品
                    prompt = `You are an elite commercial photographer and compositing specialist.

INPUTS:
- Image 1: THE PRODUCT (absolute source of truth for product appearance — shape, texture, material, color, branding must be preserved with 100% fidelity).
- Image 2: THE SCENE REFERENCE (defines the target environment, lighting, composition, and camera angle).

PRIMARY TASK — PRODUCT REPLACEMENT:
Replace any existing product/object in the Scene Reference (Image 2) with the Product (Image 1). 
The Product must be seamlessly composited into the exact position and scale where the original product was in the scene.

PERSPECTIVE RULES:
${hasPerspectiveHint 
  ? `- The user has specified a camera angle: "${userInput}". Follow this angle PRECISELY for the final composite.` 
  : `- Match the EXACT camera angle and perspective of the Scene Reference (Image 2). The Product must be re-rendered from the same viewing angle as the scene.`}

COMPOSITING REQUIREMENTS:
- Lighting direction, intensity, color temperature must match Image 2 exactly.
- Cast shadows and reflections must be physically accurate for the scene's light sources.
- Depth of field and focus plane must match Image 2.
- Surface interactions (reflections on tables, soft shadows on fabric, etc.) must be realistic.
- ${userInput || "Ensure a seamless, photorealistic integration where the product looks native to the scene."}
${colorContext}${qualitySuffix}`;

                } else if (currentSceneRef && !image) {
                    // 只有场景参考图，无产品图：透视角度转换
                    prompt = `You are an expert 3D scene reconstruction and camera perspective specialist.

INPUT:
- Image 1: THE SCENE (a reference scene/environment photograph).

TASK — PERSPECTIVE TRANSFORMATION:
${hasPerspectiveHint
  ? `Transform/re-render this scene from the following camera angle as specified by the user: "${userInput}". 
Reconstruct the 3D space of the scene and re-project it from the requested viewpoint with accurate parallax, occlusion, and foreshortening.`
  : `${userInput || "Re-render this scene with enhanced composition and lighting."}`}

REQUIREMENTS:
- Maintain all scene elements (furniture, objects, materials, textures, colors) with full fidelity.
- Lighting must be physically re-calculated for the new viewpoint.
- Hidden areas revealed by the new angle should be filled with contextually appropriate content.
- Architectural lines and vanishing points must be geometrically correct.
${colorContext}${qualitySuffix}`;

                } else if (image) {
                    // 只有产品图：分析透视并构建场景
                    prompt = `You are an expert product photographer and visual designer.

INPUT:
- Image 1: THE PRODUCT (preserve its shape, texture, material, branding, and every visual detail with 100% accuracy).

TASK:
1. **Analyze Product Perspective**: Identify the exact camera angle, focal length, and viewing direction of the product in Image 1.
2. **Scene Construction**: Generate a complete environment/scene.
3. **Product Integration**: Place the product naturally into the generated scene.

PERSPECTIVE RULES:
${hasPerspectiveHint
  ? `- The user has specified a desired camera angle: "${userInput}". Generate the scene AND re-render the product from this specific viewpoint.`
  : `- STRICTLY maintain the original camera angle detected from the product image. The generated scene must match this exact perspective — same vanishing points, same horizon line, same focal length feel.`}

SCENE DESCRIPTION:
${userInput || "A modern, high-end interior or commercial setting that naturally complements the product's category and style. Soft, directional natural lighting from a large window source."}
${colorContext}

INTEGRATION REQUIREMENTS:
- Product must cast realistic shadows consistent with the scene's light sources.
- Scale must be physically accurate relative to surrounding objects.
- Material reflections and surface interactions must be realistic.
${qualitySuffix}`;

                } else {
                    // 纯文生图：无产品无场景参考
                    prompt = `Generate a professional-grade image based on this description:

${userInput}
${colorContext}
${qualitySuffix}`;
                }

                // Add "Thinking" message
                let thinkingMsg = "🎨 正在生成...";
                if (image && currentSceneRef) {
                    thinkingMsg = `🎨 [图 ${taskIndex + 1}] 正在参考场景风格复刻并植入产品...`;
                } else if (image) {
                    thinkingMsg = `🎨 [图 ${taskIndex + 1}] 正在解析产品透视并构建场景...`;
                } else {
                    thinkingMsg = "🎨 正在根据描述生成效果图...";
                }
                if (apiProvider === 'kie') {
                    thinkingMsg += ' (kie.ai 异步生成中，请稍候...)';
                }

                addMessage({ 
                   id: baseId, 
                   role: 'assistant', 
                   type: 'text', 
                   content: thinkingMsg
                });

                let generatedImageUrl: string | null = null;
                let textResponse: string = "";

                if (apiProvider === 'kie') {
                    // === Kie.ai image generation ===
                    const inputImages: string[] = [];
                    if (image) inputImages.push(image);
                    if (currentSceneRef) inputImages.push(currentSceneRef);

                    generatedImageUrl = await kieGenerateImage(prompt, inputImages, {
                        aspectRatio: aspectRatio,
                        resolution: resolution
                    });
                } else {
                    // === Google SDK ===
                    const parts: any[] = [];
                    if (image) {
                      const base64Data = image.split(',')[1];
                      const mimeType = image.split(';')[0].split(':')[1];
                      parts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
                    }
                    if (currentSceneRef) {
                      const refBase64 = currentSceneRef.split(',')[1];
                      const refMime = currentSceneRef.split(';')[0].split(':')[1];
                      parts.push({ inlineData: { mimeType: refMime, data: refBase64 } });
                    }
                    parts.push({ text: prompt });

                    const response = await generateWithRetry(
                        selectedImageModel,
                        {
                            contents: { parts },
                            config: {
                                imageConfig: {
                                    aspectRatio: aspectRatio,
                                    imageSize: resolution 
                                }
                            }
                        }
                    );

                    if (response?.candidates?.[0]?.content?.parts) {
                        for (const part of response.candidates[0].content.parts) {
                            if (part.inlineData) {
                                generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
                            } else if (part.text) {
                                textResponse += part.text;
                            }
                        }
                    }
                }

                if (generatedImageUrl) {
                    addMessage({ 
                        id: baseId + 1, 
                        role: 'assistant', 
                        type: 'image', 
                        content: generatedImageUrl 
                    });
                    
                    if (textResponse && textResponse.length < 200 && textResponse.trim() !== '') {
                       addMessage({
                          id: baseId + 2,
                          role: 'assistant',
                          type: 'text',
                          content: textResponse
                       });
                    }
                } else {
                     addMessage({ 
                        id: baseId + 1, 
                        role: 'assistant', 
                        type: 'text', 
                        content: textResponse || "⚠️ 生成失败，请重试。" 
                    });
                }
            }
        } catch (error: any) {
            console.error(`Error in task ${taskIndex}:`, error);
            const isEntityNotFoundError = error.message?.includes("Requested entity was not found");
            
            const errMsg = isEntityNotFoundError 
                ? "⚠️ API Key 无效或未选择。请重新选择您的付费项目 API Key。" 
                : (error.message?.includes("503") ? "⚠️ 服务器繁忙 (503)，已自动重试多次失败。请稍后再试。" : "⚠️ 连接 Lyra 视觉中心失败。请检查您的 API Key 或网络连接。");
            
            if (isEntityNotFoundError && window.aistudio) {
                setHasApiKey(false); 
            }

            addMessage({ 
              id: baseId + 10, 
              role: 'assistant', 
              type: 'text', 
              content: errMsg
            });
        } finally {
            setActiveRequests(prev => Math.max(0, prev - 1));
        }
    };

    // --- 3. Execute Tasks ---
    tasks.forEach((img, index) => {
        // Stagger execution slightly to ensure state/id uniqueness and reduce instant load burst
        setTimeout(() => {
            processTask(img, index);
        }, index * 200);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Handle multiple files
    const fileArray = Array.from(files);
    
    // Process each file
    fileArray.forEach((file: any) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setPendingImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file as Blob);
    });
    
    e.target.value = '';
  };

  const handleSceneRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;

     const reader = new FileReader();
     reader.onloadend = () => {
       if (reader.result) {
         setSceneRefImage(reader.result as string);
       }
     };
     reader.readAsDataURL(file as Blob);
     e.target.value = '';
  };

  // Remove individual image from pending list
  const handleRemoveImage = (indexToRemove: number) => {
      setPendingImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // === Drag & Drop / Reference helpers ===
  const handleImageToInput = (imageUrl: string) => {
    setPendingImages(prev => [...prev, imageUrl]);
  };

  const handleImageToScene = (imageUrl: string) => {
    setSceneRefImage(imageUrl);
  };

  // Convert remote URL to data URI for drag-drop from kie.ai images
  const fetchImageAsDataUri = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) return url;
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const handleDropOnInput = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const imageData = e.dataTransfer.getData('application/x-lyra-image');
    if (imageData) {
      const dataUri = await fetchImageAsDataUri(imageData);
      setPendingImages(prev => [...prev, dataUri]);
      return;
    }
    // Also handle file drops
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result) setPendingImages(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  const handleDropOnScene = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const imageData = e.dataTransfer.getData('application/x-lyra-image');
    if (imageData) {
      const dataUri = await fetchImageAsDataUri(imageData);
      setSceneRefImage(dataUri);
      return;
    }
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) setSceneRefImage(reader.result as string);
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const preventDragDefault = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  // Auto-cleanup: Remove old messages when history gets too large (limit to 100 messages)
  useEffect(() => {
    if (messages.length > 100) {
      // Keep the initial message and last 99 messages
      setMessages(prev => {
        if (prev.length <= 1) return prev;
        return [INITIAL_MESSAGE, ...prev.slice(-(99))];
      });
    }
  }, [messages.length]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile() as File | null;
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result) {
              setPendingImages(prev => [...prev, reader.result as string]);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleDownload = async (imageUrl: string) => {
    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Lyra_Generated_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  // Helper to extract generated images for the sidebar gallery (limit to last 20 to prevent memory overflow)
  const generatedImages = messages.filter(m => m.type === 'image' && m.role === 'assistant').slice(-20);

  // Settings modal JSX (shared between gate page and main app)
  const settingsModalJsx = showSettingsModal ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Settings size={20} className="text-indigo-500"/> API Configuration
                    </h3>
                    
                    <div className="space-y-4">
                        {/* Provider Selection */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">API Provider</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => handleProviderChange('google')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-xs font-medium ${apiProvider === 'google' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}>
                                    <Sparkles size={18}/> Google AI
                                </button>
                                <button onClick={() => handleProviderChange('kie')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-xs font-medium ${apiProvider === 'kie' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}>
                                    <Cloud size={18}/> Kie.ai
                                </button>
                                <button onClick={() => handleProviderChange('custom')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-xs font-medium ${apiProvider === 'custom' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}>
                                    <Layers size={18}/> Custom Proxy
                                </button>
                            </div>
                        </div>

                        {/* Provider-specific settings - keyed to force full remount */}
                        <div key={apiProvider}>
                            {apiProvider === 'custom' && (
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                        Proxy Base URL
                                    </label>
                                    <input 
                                        type="text"
                                        value={apiBaseUrl}
                                        onChange={(e) => setApiBaseUrl(e.target.value)}
                                        placeholder="https://your-proxy.example.com/v1beta"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Enter the base URL of your third-party proxy</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    API Key {apiProvider === 'google' ? '(Optional Override)' : ''}
                                </label>
                                <input 
                                    type="password"
                                    value={userApiKey}
                                    onChange={(e) => setUserApiKey(e.target.value)}
                                    placeholder={apiProvider === 'google' ? 'Starts with AIza... (leave empty to use .env key)' : 'Enter your API key'}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {apiProvider === 'google' ? 'Leave empty to use .env key' : apiProvider === 'kie' ? 'Enter your api.kie.ai API key' : 'Enter your API key'}
                                </p>
                            </div>

                            {/* 文本模型选择 */}
                            <div className="mt-4">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">📝 文本分析模型 (提示词架构师)</label>
                                <select
                                    value={selectedTextModel}
                                    onChange={(e) => setSelectedTextModel(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white"
                                >
                                    {textModelOptions.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">用于「提示词架构师」模式的文本解析</p>
                            </div>

                            {/* 图像模型选择 */}
                            <div className="mt-4">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">🎨 图像生成模型 (生图/重绘/扩展)</label>
                                <select
                                    value={selectedImageModel}
                                    onChange={(e) => setSelectedImageModel(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white"
                                >
                                    {imageModelOptions.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">用于「生图大师」、局部重绘、图像扩展等功能</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button 
                            onClick={() => setShowSettingsModal(false)}
                            className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                localStorage.setItem('lyra_api_key', userApiKey);
                                localStorage.setItem('lyra_api_base_url', apiBaseUrl);
                                localStorage.setItem('lyra_api_provider', apiProvider);
                                localStorage.setItem('lyra_text_model', selectedTextModel);
                                localStorage.setItem('lyra_image_model', selectedImageModel);
                                const envKey = process.env.API_KEY || '';
                                setHasApiKey(!!(userApiKey || envKey));
                                setShowSettingsModal(false);
                                alert('Settings saved!');
                            }}
                            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all"
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
  ) : null;

  if (!hasApiKey) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-900 relative">
        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md mx-4">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
             <Key size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">需要 API Key 授权</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            请先在设置中填写 API Key 才能使用 Lyra Studio 的所有功能。
          </p>
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2"
          >
            <Settings size={18} />
            打开设置
          </button>
        </div>
        {settingsModalJsx}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-20 md:w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between hidden md:flex z-20 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-8">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><Sparkles size={24} /></div>
            <span className="font-bold text-xl tracking-tight hidden md:block">Lyra Studio</span>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2 hidden md:block">Mode Selection</div>
              <button onClick={() => setMode('architect')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${mode === 'architect' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-700' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                <Box size={20} /><div className="text-left hidden md:block"><div className="font-medium text-sm">提示词架构师</div><div className="text-xs opacity-70">Prompt Architect</div></div>
              </button>
              <button onClick={() => setMode('master')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${mode === 'master' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 shadow-sm ring-1 ring-purple-200 dark:ring-purple-700' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                <Wind size={20} /><div className="text-left hidden md:block"><div className="font-medium text-sm">生图大师</div><div className="text-xs opacity-70">Generation Master</div></div>
              </button>
            </div>

            {/* Google Drive Sync Section */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between px-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:block">Cloud Sync</div>
                    {isSyncing && <Loader2 size={12} className="animate-spin text-indigo-500" />}
                </div>

                {!isDriveConnected ? (
                    <div className="px-1">
                        <button 
                            onClick={handleDriveConnect}
                            className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm text-sm"
                        >
                            <Cloud size={16} />
                            <span className="hidden md:inline">Connect Drive</span>
                        </button>
                    </div>
                ) : (
                    <div className="px-1 space-y-2">
                         <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs">
                             <Cloud size={14} className="flex-shrink-0" />
                             <span className="truncate">Drive Connected</span>
                         </div>
                         <button 
                             onClick={() => handleDriveSync(true)}
                             className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                         >
                             <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                             Sync Now
                         </button>
                    </div>
                )}
            </div>

            {/* Color Studio Section - Compacted */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
               <div className="flex items-center justify-between px-2">
                 <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:block">Color Studio</div>
                 {accentColor && (
                   <button onClick={() => setAccentColor('')} className="text-[10px] text-red-500 hover:underline">Clear</button>
                 )}
               </div>
               
               {/* Preset Colors Grid - Compact */}
               <div className="grid grid-cols-5 gap-1.5 px-1">
                  {DESIGN_COLORS.map(c => (
                    <button 
                      key={c.hex}
                      onClick={() => setAccentColor(c.hex)}
                      className={`w-full aspect-square rounded-full border-2 transition-all ${accentColor === c.hex ? 'border-indigo-600 scale-110 shadow-sm' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
               </div>

               {/* Custom Color Tools - Compact Rows */}
               <div className="flex flex-col gap-1.5 px-1 mt-1">
                  <div className="flex gap-1.5">
                     <div className="relative flex-1 group">
                        <input 
                          type="color" 
                          value={accentColor || '#ffffff'}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                           <Palette size={12} /> Custom
                        </button>
                     </div>
                     <button 
                       onClick={handleColorPick}
                       className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                       title="Pick from Screen"
                     >
                        <Pipette size={12} /> Pick
                     </button>
                  </div>
                  
                  {/* Upload Swatch */}
                  <div className="relative">
                      <input 
                        ref={swatchInputRef}
                        type="file" 
                        accept="image/*"
                        onChange={handleSwatchUpload}
                        className="hidden" 
                      />
                      <button 
                        onClick={() => swatchInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                         <Upload size={12} /> Swatch
                      </button>
                  </div>
               </div>
               
               {accentColor && (
                 <div className="mt-1 p-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: accentColor }}></div>
                    <span className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300">{accentColor.toUpperCase()}</span>
                 </div>
               )}
            </div>

            {/* Standalone Inpainting Section */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
               <div className="flex items-center justify-between px-2">
                 <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:block">Magic Editor</div>
               </div>
               <div className="px-1">
                   <input 
                     ref={standaloneInpaintInputRef}
                     type="file" 
                     accept="image/*"
                     onChange={handleStandaloneInpaintUpload}
                     className="hidden" 
                   />
                   <button 
                     onClick={() => standaloneInpaintInputRef.current?.click()}
                     className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:border-purple-400 transition-all shadow-sm text-sm group"
                   >
                      <Brush size={16} className="group-hover:scale-110 transition-transform"/>
                      <span className="hidden md:inline font-medium">局部重绘</span>
                      <span className="md:hidden">重绘</span>
                   </button>
                   <div className="mt-2 text-[10px] text-slate-400 text-center hidden md:block">
                      上传任意图片进行编辑
                   </div>
               </div>
            </div>

            {/* History Gallery Section */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
               <div className="flex items-center justify-between px-2">
                 <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <History size={12} />
                    <span className="hidden md:block">History Gallery</span>
                 </div>
                 {generatedImages.length > 0 && (
                   <button onClick={handleClearHistory} className="text-[10px] text-red-500 hover:underline">Clear All</button>
                 )}
               </div>
               
               {generatedImages.length === 0 ? (
                  <div className="px-2 py-4 text-center text-xs text-slate-400 italic">No history yet</div>
               ) : (
                  <div className="grid grid-cols-3 gap-2 px-1">
                    {generatedImages.slice().reverse().map(img => (
                        <div 
                          key={img.id} 
                          onClick={() => setPreviewImageUrl(img.content)}
                          className="aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all relative group"
                        >
                           <img 
                             src={img.content} 
                             className="w-full h-full object-cover" 
                             loading="lazy" 
                             draggable="true"
                             onDragStart={(e) => {
                               e.dataTransfer.setData('text/plain', img.content);
                               e.dataTransfer.setData('application/x-lyra-image', img.content);
                               e.dataTransfer.effectAllowed = 'copy';
                             }}
                           />
                           {/* Quick action overlay */}
                           <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end justify-center opacity-0 group-hover:opacity-100 pb-1 gap-1">
                             <button
                               onClick={(e) => { e.stopPropagation(); handleImageToInput(img.content); }}
                               className="p-1 bg-indigo-600 text-white rounded-md text-[9px] hover:bg-indigo-700 transition-colors"
                               title="发送到产品图输入"
                             >
                               <Layers size={12} />
                             </button>
                             <button
                               onClick={(e) => { e.stopPropagation(); handleImageToScene(img.content); }}
                               className="p-1 bg-purple-600 text-white rounded-md text-[9px] hover:bg-purple-700 transition-colors"
                               title="设为场景参考"
                             >
                               <ImagePlus size={12} />
                             </button>
                           </div>
                        </div>
                    ))}
                  </div>
               )}
            </div>

          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
           <div className="flex items-center gap-3 px-3 py-2 text-sm text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setShowSettingsModal(true)}><Settings size={18} /><span className="hidden md:block">Configuration</span></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-10">
           <div className="flex items-center gap-2 font-bold text-indigo-600"><Sparkles size={20} /><span>Lyra</span></div>
           <button onClick={() => setMode(mode === 'architect' ? 'master' : 'architect')} className="text-xs bg-slate-100 px-3 py-1 rounded-full">{mode === 'architect' ? 'Architect' : 'Master'}</button>
        </div>

        {/* Client ID Input Modal */}
        {showClientIdInput && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                        <Key size={20} className="text-indigo-500"/> Configure Drive
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        To enable Cloud Sync, please enter your Google OAuth 2.0 Client ID. 
                        You can find this in your Google Cloud Console.
                    </p>
                    <input 
                        type="text"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="apps.googleusercontent.com"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mb-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setShowClientIdInput(false)}
                            className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={saveClientId}
                            disabled={!clientId.trim()}
                            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50 transition-all"
                        >
                            Save & Connect
                        </button>
                    </div>
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-800 flex gap-2">
                        <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[10px] text-yellow-700 dark:text-yellow-400 leading-tight">
                            Ensure your OAuth Client is configured with "https://www.googleapis.com/auth/drive.file" scope and the correct Authorized Origin.
                        </span>
                    </div>
                </div>
            </div>
        )}

        {/* Settings Modal */}
        {settingsModalJsx}

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
           <div className="max-w-4xl mx-auto">
             {messages.map(msg => (
                <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    onImageClick={setPreviewImageUrl} 
                    onEditClick={msg.type === 'image' && msg.role === 'assistant' ? openInpainting : undefined}
                    onQuoteClick={handleQuotePrompt}
                    onSendToInput={handleImageToInput}
                    onSendToScene={handleImageToScene}
                />
             ))}
             
             {/* Progress Bar UI */}
             {(activeRequests > 0 || progress > 0) && (
               <div className="flex flex-col gap-2 mb-6 px-5 py-4 bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] md:max-w-md animate-in slide-in-from-bottom-2 fade-in duration-300">
                 <div className="flex items-center justify-between text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    <div className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span>正在生成任务...</span>
                    </div>
                    <span>{Math.round(progress)}%</span>
                 </div>
                 <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                 </div>
                 {activeRequests > 1 && (
                   <div className="text-xs text-slate-400 text-right">
                     {activeRequests} 个任务正在排队中
                   </div>
                 )}
               </div>
             )}
             
             <div ref={messagesEndRef} />
           </div>
        </div>

        {/* Input & Control Area */}
        <div className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 transition-all shadow-lg z-30">
          
          {/* Active Color Preview & Pending Images */}
          {(pendingImages.length > 0 || accentColor || sceneRefImage) && (
            <div className="max-w-5xl mx-auto px-4 pt-4 pb-0 flex flex-col gap-2">
               
               {/* Pending Images List - Horizontal Scroll */}
               {(pendingImages.length > 0 || sceneRefImage) && (
                   <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                       {/* Scene Reference Image Preview */}
                       {sceneRefImage && (
                           <div className="relative group flex-shrink-0 animate-in slide-in-from-bottom-2 fade-in duration-300">
                               <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-purple-400 shadow-md bg-white relative">
                                  <img src={sceneRefImage} alt="Reference" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-purple-500/10 pointer-events-none"></div>
                               </div>
                               <button 
                                 onClick={() => setSceneRefImage(null)} 
                                 className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-sm hover:bg-red-600 transition-colors z-10"
                               >
                                  <X size={12} />
                               </button>
                               <div className="absolute bottom-0 left-0 right-0 bg-purple-600/90 text-[10px] text-white text-center py-0.5 font-medium">场景参考</div>
                           </div>
                       )}

                       {/* Separator if both exist */}
                       {sceneRefImage && pendingImages.length > 0 && (
                          <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1 h-20 self-center"></div>
                       )}

                       {/* Product Images */}
                       {pendingImages.map((img, idx) => (
                           <div key={idx} className="relative group flex-shrink-0 animate-in slide-in-from-bottom-2 fade-in duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                               <div className="w-20 h-20 rounded-xl overflow-hidden border border-indigo-200 shadow-md bg-white">
                                  <img src={img} alt={`Pending ${idx}`} className="w-full h-full object-contain" />
                               </div>
                               <button 
                                 onClick={() => handleRemoveImage(idx)} 
                                 className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-sm hover:bg-red-600 transition-colors z-10"
                               >
                                  <X size={12} />
                               </button>
                               <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 text-[10px] text-white text-center py-0.5 font-medium">产品 {idx + 1}</div>
                           </div>
                       ))}
                       
                       {/* Add more products button */}
                       <button 
                         onClick={() => fileInputRef.current?.click()}
                         className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all flex-shrink-0"
                         title="添加更多产品图"
                       >
                           <Plus size={24} />
                       </button>
                   </div>
               )}

               {/* Accent Color Badge */}
               {accentColor && (
                  <div className="inline-flex relative group w-fit animate-in slide-in-from-bottom-2 fade-in duration-300 delay-75">
                     <div className="w-20 h-20 rounded-xl border border-slate-200 shadow-md flex flex-col items-center justify-center gap-1" style={{ backgroundColor: accentColor }}>
                        <div className="bg-black/20 text-white text-[10px] font-mono px-1 rounded backdrop-blur-sm">{accentColor}</div>
                     </div>
                     <button onClick={() => setAccentColor('')} className="absolute -top-2 -right-2 p-1 bg-slate-500 text-white rounded-full shadow-sm hover:bg-slate-600 transition-colors"><X size={12} /></button>
                     <div className="absolute bottom-0 left-0 right-0 bg-slate-700/80 text-[10px] text-white text-center py-0.5 font-medium">色调锁定</div>
                  </div>
               )}
            </div>
          )}

          <div className="max-w-5xl mx-auto p-4 md:p-6 md:pb-6">
            <div className="flex flex-col xl:flex-row gap-4 mb-4 items-start xl:items-center justify-between">
              <div className={`text-xs font-medium px-4 py-2 rounded-xl border shadow-sm transition-colors flex items-center gap-2 ${mode === 'master' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300'}`}>
                <span className={`w-2 h-2 rounded-full ${mode === 'master' ? 'bg-purple-500' : 'bg-indigo-500'} animate-pulse`}></span>
                {mode === 'master' ? '✨ 生图大师模式 (合成)' : '📐 提示词架构师 (解析)'}
              </div>

              {/* Toolbar: Only for Master Mode */}
              {mode === 'master' && (
                <div className="flex flex-wrap gap-3 w-full xl:w-auto animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-2 text-slate-400 flex items-center gap-1"><Layout size={14} /><span className="text-[10px] font-bold uppercase hidden sm:inline">Ratio</span></div>
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide max-w-[200px] sm:max-w-none">
                        {ASPECT_RATIOS.map((ratio) => (
                          <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`text-xs px-2 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium ${aspectRatio === ratio ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>{ratio}</button>
                        ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex-1">
                    <div className="px-2 text-slate-400 flex items-center gap-1"><Maximize2 size={14} /><span className="text-[10px] font-bold uppercase hidden sm:inline">Res</span></div>
                    <div className="flex gap-1">
                        {RESOLUTIONS.map((res) => (
                          <button key={res} onClick={() => setResolution(res)} className={`text-xs px-2 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium ${resolution === res ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>{res}</button>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div 
              className="flex items-end gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-2 shadow-inner focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all"
              onDrop={handleDropOnInput}
              onDragOver={preventDragDefault}
              onDragEnter={preventDragDefault}
            >
              {/* Product Upload Input */}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />
              {/* Reference Upload Input */}
              <input type="file" ref={sceneRefInputRef} onChange={handleSceneRefUpload} accept="image/*" className="hidden" />
              
              <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className={`p-3 rounded-xl transition-all shadow-sm border border-transparent relative ${pendingImages.length > 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200'}`} 
                    title="上传产品图 (支持多选)"
                  >
                    {pendingImages.length > 0 ? <Layers size={20} /> : <ImageIcon size={20} />}
                    {pendingImages.length > 1 && (
                        <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                            {pendingImages.length}
                        </span>
                    )}
                  </button>

                  {/* Scene Reference Upload Button - Only in Master Mode */}
                  {mode === 'master' && (
                       <button 
                        onClick={() => sceneRefInputRef.current?.click()} 
                        onDrop={handleDropOnScene}
                        onDragOver={(e) => { preventDragDefault(e); e.currentTarget.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50'); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50'); }}
                        className={`p-3 rounded-xl transition-all shadow-sm border border-transparent relative ${sceneRefImage ? 'bg-purple-50 text-purple-600 border-purple-200' : 'text-slate-500 hover:text-purple-600 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200'}`} 
                        title="上传场景/风格参考图 (可拖拽图片到此)"
                       >
                        <ImagePlus size={20} />
                        {sceneRefImage && (
                            <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">1</span>
                        )}
                      </button>
                  )}
              </div>

              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                onPaste={handlePaste}
                placeholder={mode === 'master' ? (pendingImages.length > 0 ? (sceneRefImage ? "已就绪：产品 + 场景参考。输入额外调整指令..." : `已就绪 ${pendingImages.length} 张产品图。输入场景描述...`) : "请先上传白底产品图，可选择上传场景参考图...") : "上传图片分析提示词..."}
                className="flex-1 max-h-[50vh] min-h-[160px] py-3 px-2 bg-transparent border-none focus:ring-0 resize-y text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-medium leading-relaxed custom-scrollbar"
                rows={6}
              />
              {(inputText || pendingImages.length > 0 || sceneRefImage) && (
                <button 
                  onClick={() => {
                    setInputText('');
                    setPendingImages([]);
                    setSceneRefImage(null);
                  }}
                  className="p-3 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                  title="清空所有输入"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button onClick={handleSendMessage} disabled={!inputText.trim() && pendingImages.length === 0} className={`p-3 rounded-xl transition-all shadow-md ${(inputText.trim() || pendingImages.length > 0) ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 transform' : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'}`}>
                <Send size={20} />
              </button>
            </div>
            
            <div className="flex justify-center mt-3"><span className="text-[10px] text-slate-400 flex items-center gap-1"><Sparkles size={10} /> Powered by Lyra Architecture v2.0 (Gemini 3.0 Pro)</span></div>
          </div>
        </div>
      </div>

      {/* Full Screen Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300"
          onClick={() => {
            setPreviewImageUrl(null);
            setShowExpandMenu(false);
          }}
        >
            <button 
              className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all z-50"
              onClick={() => {
                setPreviewImageUrl(null);
                setShowExpandMenu(false);
              }}
            >
                <X size={24} />
            </button>
            
            <div className="relative max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
               <img 
                 src={previewImageUrl} 
                 alt="Preview" 
                 className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
               />
               
               {/* --- Image Enhancement Toolbar --- */}
               <div className="absolute bottom-24 right-4 flex flex-col items-end gap-3 hidden md:flex">
                  
                  {/* Expand Menu (Popover) */}
                  {showExpandMenu && (
                     <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-2 mb-1 flex flex-col gap-1 shadow-2xl animate-in slide-in-from-bottom-2 fade-in">
                        <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">Target Ratio</div>
                        {ASPECT_RATIOS.map(ratio => (
                           <button
                             key={ratio}
                             onClick={() => handleImageEnhance(previewImageUrl!, 'expand', ratio)}
                             className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg text-white text-sm transition-colors text-left"
                           >
                              <Scaling size={14} />
                              <span>{ratio}</span>
                           </button>
                        ))}
                     </div>
                  )}

                  <div className="flex items-center gap-2">
                     <button
                        onClick={() => handleImageEnhance(previewImageUrl!, 'upscale')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-md text-white rounded-full transition-all shadow-lg hover:shadow-indigo-500/20 group"
                        title="Upscale to 4K"
                     >
                        <MonitorUp size={18} />
                        <span className="font-medium text-sm">4K Upscale</span>
                     </button>

                     <button
                        onClick={() => setShowExpandMenu(!showExpandMenu)}
                        className={`flex items-center gap-2 px-4 py-2.5 backdrop-blur-md text-white rounded-full transition-all shadow-lg border border-white/10 ${showExpandMenu ? 'bg-white/20' : 'bg-black/40 hover:bg-white/10'}`}
                        title="Expand Image"
                     >
                        <MoveHorizontal size={18} />
                        <span className="font-medium text-sm">Expand</span>
                     </button>
                  </div>
               </div>

               {/* Gallery Navigation Controls */}
               {(() => {
                 const currentIndex = generatedImages.findIndex(img => img.content === previewImageUrl);
                 if (currentIndex !== -1) {
                   return (
                     <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-xl transition-transform hover:scale-105 animate-in slide-in-from-bottom-4 fade-in duration-300">
                        <button 
                          onClick={(e) => {
                             e.stopPropagation();
                             const prevIndex = currentIndex > 0 ? currentIndex - 1 : generatedImages.length - 1;
                             setPreviewImageUrl(generatedImages[prevIndex].content);
                          }}
                          className="p-2 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                          title="上一张 (Previous)"
                        >
                           <ChevronLeft size={24} />
                        </button>
                        
                        <span className="text-xs font-mono text-white/60 px-2 min-w-[60px] text-center select-none">
                          {currentIndex + 1} / {generatedImages.length}
                        </span>

                        <button 
                          onClick={(e) => {
                             e.stopPropagation();
                             const nextIndex = currentIndex < generatedImages.length - 1 ? currentIndex + 1 : 0;
                             setPreviewImageUrl(generatedImages[nextIndex].content);
                          }}
                          className="p-2 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                          title="下一张 (Next)"
                        >
                           <ChevronRight size={24} />
                        </button>
                     </div>
                   );
                 }
                 return null;
               })()}

               <div className="absolute bottom-8 right-4 hidden md:flex gap-2">
                  <button 
                    onClick={() => { handleImageToInput(previewImageUrl!); setPreviewImageUrl(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/80 hover:bg-indigo-500 backdrop-blur-md text-white rounded-full transition-all border border-indigo-400/30"
                    title="发送到产品图输入"
                  >
                    <Layers size={18} />
                    <span className="text-sm font-medium">产品图</span>
                  </button>
                  <button 
                    onClick={() => { handleImageToScene(previewImageUrl!); setPreviewImageUrl(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500/80 hover:bg-purple-500 backdrop-blur-md text-white rounded-full transition-all border border-purple-400/30"
                    title="设为场景参考"
                  >
                    <ImagePlus size={18} />
                    <span className="text-sm font-medium">场景参考</span>
                  </button>
                  <button 
                    onClick={() => handleDownload(previewImageUrl!)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full transition-all border border-white/20"
                  >
                    <Download size={18} />
                    <span className="text-sm font-medium">下载原图</span>
                  </button>
               </div>
            </div>
        </div>
      )}

      {/* Inpainting Modal */}
      {inpaintTargetImage && (
        <InpaintingModal 
            isOpen={isInpainting} 
            imageUrl={inpaintTargetImage} 
            onClose={() => {
                setIsInpainting(false);
                setInpaintTargetImage(null);
            }} 
            onGenerate={handleInpaintSubmit}
        />
      )}
    </div>
  );
}
