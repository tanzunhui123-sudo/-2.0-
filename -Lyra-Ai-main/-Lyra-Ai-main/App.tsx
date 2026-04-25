import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Image as ImageIcon, Settings, Sparkles, Box, Wind, 
  Loader2, Layout, Maximize2, X, Layers, Key, Download, Trash2,
  Palette, Pipette, Upload, History, Clock, ChevronLeft, ChevronRight,
  MonitorUp, MoveHorizontal, Scaling, Wand2, Plus, Cloud, RefreshCw, AlertTriangle,
  ImagePlus, Brush, Eraser, ShoppingBag, FileText, Store, ChevronDown
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import MessageBubble from './components/MessageBubble';
import InpaintingModal from './components/InpaintingModal';
import EcommerceTaskPanel from './components/EcommerceTaskPanel';

// ErrorBoundary to catch React DOM reconciliation errors gracefully
class EcommerceErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorKey: number }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorKey: 0 };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('[EcommerceErrorBoundary]', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-950">
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">渲染出错</h3>
            <p className="text-sm text-slate-400 mb-4">面板渲染遇到问题，请重试</p>
            <button
              onClick={() => this.setState(s => ({ hasError: false, errorKey: s.errorKey + 1 }))}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }
    return <React.Fragment key={this.state.errorKey}>{this.props.children}</React.Fragment>;
  }
}
import { 
  INITIAL_MESSAGE, ASPECT_RATIOS, 
  RESOLUTIONS, OUTPUT_FORMATS, DESIGN_COLORS,
  ECOMMERCE_PLATFORMS, MAIN_IMAGE_STYLES, DETAIL_PAGE_SECTIONS
} from './constants';
import { Message, Mode, EcommercePlatform, EcommerceTask } from './types';
import { 
  saveMessageToDB, getHistoryFromDB, clearHistoryDB,
  initGapiClient, initGisClient, requestAccessToken, 
  findHistoryFile, getFileContent, createHistoryFile, updateHistoryFile, DEFAULT_CLIENT_ID,
  compressImageForApi, convertImageFormat, extractTextureCrop, compressImagePreservePng,
  saveImageToDriveByDate
} from './utils';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [activeRequests, setActiveRequests] = useState(0);
  const [progress, setProgress] = useState(0); // Progress state
  const [mode, setMode] = useState<Mode>('architect');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('2K');
  const [outputFormat, setOutputFormat] = useState<'jpg' | 'png'>('jpg');
  
  // Changed from single string to array of strings for multi-upload support
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  // New state for Scene Reference Images (supports multiple)
  const [sceneRefImages, setSceneRefImages] = useState<string[]>([]);
  // Number of images to generate (Master mode)
  const [generateCount, setGenerateCount] = useState(1);
  
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

  // --- E-commerce Task Panel Persistent State ---
  const [ecommerceTasks, setEcommerceTasks] = useState<EcommerceTask[]>([]);
  const [ecommerceActiveTaskId, setEcommerceActiveTaskId] = useState<string | null>(null);

  // --- E-commerce State ---
  const [ecommercePlatform, setEcommercePlatform] = useState<EcommercePlatform>('taobao');
  const [selectedSizePresetIdx, setSelectedSizePresetIdx] = useState(0);
  const [mainImageStyle, setMainImageStyle] = useState('white_bg');
  const [selectedDetailSections, setSelectedDetailSections] = useState<string[]>(['hero', 'selling_points', 'scene_usage']);
  const [productName, setProductName] = useState('');
  const [productSellingPoints, setProductSellingPoints] = useState('');
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);

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

  // Compress base64 image only if over 30MB (KIE.AI limit)
  const compressImageForUpload = (base64DataUri: string): Promise<string> => {
    const sizeInMB = base64DataUri.length * 0.75 / (1024 * 1024); // base64 → actual bytes
    if (sizeInMB <= 28) return Promise.resolve(base64DataUri); // under 30MB, no compression needed
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.sqrt(28 / sizeInMB);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(base64DataUri); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.9);
        console.log(`Image compressed: ${sizeInMB.toFixed(1)}MB → ${(compressed.length * 0.75 / (1024*1024)).toFixed(1)}MB`);
        resolve(compressed);
      };
      img.onerror = () => resolve(base64DataUri);
      img.src = base64DataUri;
    });
  };

  // Upload base64 image to kie.ai and get URL
  const kieUploadImage = async (base64DataUri: string): Promise<string> => {
    const compressed = await compressImageForUpload(base64DataUri);
    const resp = await fetch('/kie-upload/api/file-base64-upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getKieApiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data: compressed, uploadPath: 'lyra/uploads' })
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`图片上传失败 (HTTP ${resp.status}): ${errText.slice(0, 200)}`);
    }
    const data = await resp.json();
    if (!data.success) throw new Error(data.msg || 'Image upload failed');
    return data.data.downloadUrl;
  };

  // Create async image task on kie.ai (with retry)
  const kieCreateTask = async (model: string, input: any, retries = 2): Promise<string> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const resp = await fetch('/kie-api/api/v1/jobs/createTask', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getKieApiKey()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input })
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          throw new Error(`KIE 任务创建失败 (HTTP ${resp.status}): ${errText.slice(0, 200)}`);
        }
        const data = await resp.json();
        if (data.code !== 200) throw new Error(data.msg || 'Task creation failed');
        return data.data.taskId;
      } catch (error: any) {
        if (i < retries && (error.message?.includes('503') || error.message?.includes('fetch'))) {
          console.warn(`kieCreateTask retry ${i + 1}/${retries}...`);
          await new Promise(r => setTimeout(r, 2000 * (i + 1)));
          continue;
        }
        throw error;
      }
    }
    throw new Error('KIE 任务创建失败');
  };

  // Poll kie.ai task until completion
  const kiePollTask = async (taskId: string, maxWait = 300000): Promise<string[]> => {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 4000));
      const resp = await fetch(`/kie-api/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
        headers: { 'Authorization': `Bearer ${getKieApiKey()}` }
      });
      if (!resp.ok) {
        console.warn(`Poll HTTP error: ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      if (data.code !== 200) throw new Error(data.msg || 'Task query failed');
      const state = data.data?.state;
      console.log(`Task ${taskId.slice(0,8)}... state: ${state}, elapsed: ${((Date.now()-start)/1000).toFixed(0)}s`);
      if (state === 'success') {
        const resultJson = JSON.parse(data.data.resultJson || '{}');
        return resultJson.resultUrls || [];
      }
      if (state === 'fail') throw new Error(data.data?.failMsg || 'Image generation failed');
    }
    throw new Error('任务超时（已等待5分钟）');
  };

  // Kie.ai text generation (chat completions)
  const kieTextGenerate = async (model: string, userContent: any[], systemPrompt?: string): Promise<string> => {
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userContent });
    const resp = await fetch(`/kie-api/${model}/v1/chat/completions`, {
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
    aspectRatio?: string; resolution?: string; isMask?: boolean; outputFormat?: string;
  } = {}): Promise<string | null> => {
    // KIE image models need short, descriptive prompts (max ~2000 chars recommended)
    // Strip long system instructions designed for LLMs like Gemini
    let kiePrompt = prompt;
    if (kiePrompt.length > 2000) {
      // Try to extract user's actual instruction from the long system prompt
      const userInstrMatch = kiePrompt.match(/USER INSTRUCTIONS:\s*"([^"]+)"/i) 
        || kiePrompt.match(/ADDITIONAL USER REQUIREMENTS:\s*(.+?)(?:\n|$)/i)
        || kiePrompt.match(/user requests:\s*"([^"]+)"/i);
      const userInstr = userInstrMatch?.[1]?.trim() || '';
      
      // Detect mode from prompt content and build a concise prompt
      if (kiePrompt.includes('RESKIN') || (kiePrompt.includes('MATERIAL') && kiePrompt.includes('REPLACEMENT'))) {
        // Reskin mode — clear, focused prompt
        kiePrompt = `RESKIN TASK: The FIRST input image is the ORIGINAL PRODUCT. The SECOND input image is the TARGET MATERIAL/FABRIC reference swatch.

Generate a NEW photo of the original product with its surface material replaced by the target material. Output a COMPLETE PRODUCT PHOTO, NOT a fabric swatch.

Requirements:
- Product shape, silhouette, angle, background, and non-surface elements stay IDENTICAL to the original
- Copy the exact color, weave pattern, and texture from the reference material onto the product
- Texture wraps naturally around the 3D form (stretch on curves, compress in folds)
- Realistic lighting interaction matching the new material's surface properties
- Preserve seams, stitching, and construction details
- Photorealistic output indistinguishable from a real photograph${userInstr ? `\n\nUser instruction: ${userInstr}` : ''}`;
      } else if (kiePrompt.includes('SCENE') && kiePrompt.includes('PRODUCT')) {
        // Master mode with scene reference — enhanced for material fidelity
        kiePrompt = `Product scene placement task.

Place the product from the input image(s) into a new photorealistic scene inspired by the style reference.

PRODUCT FIDELITY:
- The product must be pixel-perfect identical to the original: same shape, color, material, branding, and every surface detail
- Preserve the product's material textures exactly: fabric weave, leather grain, wood grain, metal finish, stitching, and seam lines
- Surface micro-details (thread patterns, material pores, surface roughness) must remain sharp and visible
- Do NOT smooth, blur, or simplify any product surface

SCENE INTEGRATION:
- Build a new scene AROUND the product inspired by the style reference's design aesthetic
- Lighting must be physically consistent: correct shadow direction, ambient occlusion under the product, realistic light falloff
- Material interactions: reflections on glossy floors, soft shadow on fabric surfaces, specular highlights on metal parts
- All scene materials (floor, walls, props) must also show realistic texture: wood grain, marble veining, carpet pile, concrete pores

OUTPUT: Professional commercial photograph. Shot on medium-format digital camera, natural lighting, RAW-quality detail.${userInstr ? `\n\nUser instruction: ${userInstr}` : ''}`;
      } else if (kiePrompt.includes('PERSPECTIVE') || kiePrompt.includes('SCENE SYNTHESIS')) {
        kiePrompt = `Scene perspective transformation task.

${userInstr ? `User request: ${userInstr}` : 'Re-render with enhanced composition and lighting.'}

REQUIREMENTS:
- Reconstruct the 3D space and re-project from the requested viewpoint with accurate parallax and occlusion
- All material textures must remain crisp and realistic: fabric weave, wood grain, stone texture, metal finish, carpet pile
- Surface micro-details must be preserved — do NOT smooth or simplify any texture
- Recalculate lighting for the new viewpoint: shadows, reflections, specular highlights, ambient occlusion
- Hidden areas revealed by the new angle must be filled with contextually accurate materials matching existing surfaces
- Architectural lines and vanishing points must be geometrically correct

OUTPUT: Photorealistic photograph with tangible material quality. Every surface must look real enough to touch.`;
      } else {
        // Generic: truncate at last complete sentence within 2000 chars
        const truncated = kiePrompt.slice(0, 2000);
        const lastPeriod = truncated.lastIndexOf('.');
        kiePrompt = lastPeriod > 500 ? truncated.slice(0, lastPeriod + 1) : truncated;
      }
      console.log(`KIE prompt shortened: ${prompt.length} → ${kiePrompt.length} chars`);
    }

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
        prompt: kiePrompt,
        image_urls: imageUrls,
        output_format: opts.outputFormat || 'jpg',
        aspect_ratio: opts.aspectRatio || '1:1',
        resolution: opts.resolution || '2K'
      };
    } else if (imageUrls.length > 0) {
      // Image-to-image
      model = userModel;
      input = {
        prompt: kiePrompt,
        image_input: imageUrls,
        output_format: opts.outputFormat || 'jpg',
        aspect_ratio: opts.aspectRatio || '1:1',
        resolution: opts.resolution || '2K'
      };
    } else {
      // Text-to-image
      model = userModel;
      input = {
        prompt: kiePrompt,
        output_format: opts.outputFormat || 'jpg',
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
  // Drive image save state
  const [isDriveImageSaving, setIsDriveImageSaving] = useState(false);
  const [driveImageSaveMsg, setDriveImageSaveMsg] = useState<string | null>(null);

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

    // 2. Load History from DB (with error recovery for Out of Memory)
    const loadHistory = async () => {
      try {
        const history = await getHistoryFromDB();
        if (history.length > 0) {
          setMessages(history);
        } else {
          saveMessageToDB(INITIAL_MESSAGE);
        }
      } catch (err) {
        console.error('History load failed, resetting:', err);
        try { await clearHistoryDB(); } catch (_) {}
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

  // Save a single image to Google Drive in LyraStudio/{year}/{month}/{day}/ folder
  const handleSaveImageToDrive = async (imageUrl: string) => {
      if (!isDriveConnected) {
          alert('请先连接 Google Drive 后再保存图片');
          return;
      }
      if (isDriveImageSaving) return;
      setIsDriveImageSaving(true);
      setDriveImageSaveMsg(null);
      try {
          // Ensure we have a data URI (fetch remote URLs first)
          let dataUri = imageUrl;
          if (!imageUrl.startsWith('data:')) {
              const resp = await fetch(imageUrl);
              const blob = await resp.blob();
              dataUri = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
              });
          }
          await saveImageToDriveByDate(dataUri);
          setDriveImageSaveMsg('✅ 已保存到 Google Drive');
      } catch (e: any) {
          console.error('Drive image save error:', e);
          setDriveImageSaveMsg(`❌ 保存失败: ${e.message || '未知错误'}`);
      } finally {
          setIsDriveImageSaving(false);
          setTimeout(() => setDriveImageSaveMsg(null), 3500);
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
                  { str: '2:3', val: 2/3 },
                  { str: '3:2', val: 3/2 },
                  { str: '4:5', val: 4/5 },
                  { str: '5:4', val: 5/4 },
                  { str: '21:9', val: 21/9 },
                  { str: '1:4', val: 1/4 },
                  { str: '4:1', val: 4 },
              ];
              const closest = supportedRatios.reduce((prev, curr) => 
                  Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev
              );
              resolve(closest.str);
          };
          img.src = src;
      });
  };

  // Ensure ratio string is a valid Gemini API aspect_ratio
  const VALID_API_RATIOS = new Set(['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9']);
  const toValidApiRatio = (ratio: string, width?: number, height?: number): string => {
      if (VALID_API_RATIOS.has(ratio)) return ratio;
      // Parse ratio string "W:H" to get actual aspect ratio value
      const ratioParts = ratio.split(':').map(Number);
      const w = (ratioParts.length === 2 && ratioParts[0] > 0 && ratioParts[1] > 0)
        ? ratioParts[0]
        : (width || 1);
      const h = (ratioParts.length === 2 && ratioParts[0] > 0 && ratioParts[1] > 0)
        ? ratioParts[1]
        : (height || 1);
      const actual = w / h;
      const supportedRatios = [
          { str: '1:1', val: 1 }, { str: '4:3', val: 4/3 }, { str: '3:4', val: 3/4 },
          { str: '16:9', val: 16/9 }, { str: '9:16', val: 9/16 }, { str: '2:3', val: 2/3 },
          { str: '3:2', val: 3/2 }, { str: '4:5', val: 4/5 }, { str: '5:4', val: 5/4 },
          { str: '21:9', val: 21/9 }, { str: '1:4', val: 1/4 }, { str: '4:1', val: 4 },
          { str: '1:8', val: 1/8 }, { str: '8:1', val: 8 },
      ];
      const closest = supportedRatios.reduce((prev, curr) =>
          Math.abs(curr.val - actual) < Math.abs(prev.val - actual) ? curr : prev
      );
      return closest.str;
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
                ? "Upscale this image to 4K resolution. Significantly enhance sharpness, texture micro-details, and clarity. Preserve the original subject, composition, and colors. Material surfaces must gain visible texture detail: fabric thread patterns, leather grain pores, wood grain lines, metal finish quality. Do NOT over-smooth — add natural surface detail and micro-texture. High Fidelity, photorealistic."
                : `Outpaint and expand this image to fit the ${targetRatio} aspect ratio. Generate coherent and realistic background content for the empty space. New content must have matching material textures with full micro-detail (fabric weave, floor grain, wall texture). Seamlessly match the original lighting, style, perspective, and material quality.`;
            const ratio = type === 'upscale' ? await getClosestAspectRatio(sourceImageUrl) : (targetRatio || '16:9');
            const res = type === 'upscale' ? '4K' : '2K';
            generatedImageUrl = await kieGenerateImage(prompt, [sourceImageUrl], { aspectRatio: ratio, resolution: res, outputFormat: outputFormat });
        } else {
            // === Google SDK path ===
            const ai = getAiClient();
            const compressed = await compressImageForApi(sourceImageUrl);
            const base64Data = compressed.split(',')[1];
            const mimeType = compressed.split(';')[0].split(':')[1];

            const parts: any[] = [
                { inlineData: { mimeType, data: base64Data } }
            ];

            let config = {};

            if (type === 'upscale') {
                parts.push({ text: "Upscale this image to 4K resolution. Significantly enhance sharpness, material texture micro-details, and clarity. Preserve the original subject, composition, and colors. Every material surface must gain visible texture detail: fabric must show thread weave patterns, leather must show grain pores, wood must show grain lines, metal must show finish quality. Do NOT over-smooth any surface — enhance natural micro-texture and surface variation. High Fidelity, photorealistic." });
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
                        const mime = part.inlineData.mimeType || 'image/png';
                        generatedImageUrl = `data:${mime};base64,${part.inlineData.data}`;
                    }
                }
            }
        }

        if (generatedImageUrl) {
            generatedImageUrl = await convertImageFormat(generatedImageUrl, outputFormat);
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


  const openInpainting = async (imageUrl: string) => {
    const dataUri = await fetchImageAsDataUri(imageUrl);
    setInpaintTargetImage(dataUri);
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
                finalPrompt = `MATERIAL TEXTURE REPLACEMENT in masked area: ${prompt}.

CRITICAL TEXTURE REQUIREMENTS:
- Replace the masked area's material with the EXACT texture from the reference image.
- COPY the reference material's weave/grain pattern exactly — same thread structure, fiber density, surface characteristics. Do NOT simplify or smooth.
- Color must have DEPTH and VARIATION matching the reference — real materials are never one flat color. Reproduce lighter/darker areas from fiber direction and light angle.
- Recalculate light interaction: matte fabrics absorb softly with gradual shadows, velvet/chenille show directional sheen, leather shows specular highlights.
- Texture must wrap around the object's 3D form naturally — stretched on curves, compressed in folds.
- Shadows in folds show DARKER tone of the material, not black voids.
- Do NOT smooth or flatten — maintain visible individual fibers/yarns/grain. Photorealistic, 8K.`;
            } else if (referenceImage) {
                allImages.push(referenceImage);
                finalPrompt = `INPAINT with reference: ${prompt}. Place the person/character from the reference into the masked area. Match lighting and perspective.`;
            } else {
                finalPrompt = `EDIT: ${prompt}. The second image is a MASK where white pixels indicate the area to modify.`;
            }
            generatedImageUrl = await kieGenerateImage(finalPrompt, allImages, { aspectRatio: targetAspectRatio, resolution: resolution, isMask: true, outputFormat: outputFormat });
        } else {
            // === Google SDK path ===
            const ai = getAiClient();
            const compressedOriginal = await compressImageForApi(inpaintTargetImage);
            const originalBase64 = compressedOriginal.split(',')[1];
            const maskData = maskBase64.split(',')[1];

            const parts: any[] = [
                { inlineData: { mimeType: 'image/jpeg', data: originalBase64 } },
                { inlineData: { mimeType: 'image/png', data: maskData } }
            ];

            let finalPrompt = '';

            if (materialImage) {
                 // Preserve PNG for texture reference quality
                 const compressedMat = await compressImagePreservePng(materialImage);
                 const matBase64 = compressedMat.split(',')[1];
                 const matMime = compressedMat.split(';')[0].split(':')[1];
                 parts.push({ inlineData: { mimeType: matMime, data: matBase64 } });
                 
                 // Add center crop for micro-texture detail
                 try {
                   const textureCrop = await extractTextureCrop(materialImage, 0.4);
                   const cropCompressed = await compressImagePreservePng(textureCrop);
                   const cropBase64 = cropCompressed.split(',')[1];
                   const cropMime = cropCompressed.split(';')[0].split(':')[1];
                   parts.push({ inlineData: { mimeType: cropMime, data: cropBase64 } });
                 } catch (e) { console.warn("Texture crop failed:", e); }
                 
                 finalPrompt = `MATERIAL TEXTURE REPLACEMENT IN MASKED AREA

IMAGES:
1. Target scene/product image
2. Mask (white = area to replace)
3. Material texture reference (full view)
4. Material texture close-up (zoomed center crop — study this for micro-texture detail)

INSTRUCTION: ${prompt}

TEXTURE REPRODUCTION (TOP PRIORITY):
- COPY the EXACT texture from the reference: same weave structure, yarn/fiber density, surface grain pattern. Do NOT simplify.
- Show INDIVIDUAL FIBER/YARN DETAIL — every thread crossing, fiber tuft, and surface irregularity from the reference.
- Color must have DEPTH and VARIATION matching the reference — lighter on raised fibers, darker in valleys. Never flat/uniform.
- Scale the texture pattern correctly relative to the object's real-world size.

LIGHT INTERACTION:
- Recalculate how the scene's lighting hits the new material's surface properties.
- Matte/plush: soft absorption, gradual shadow transitions, no sharp highlights.
- Velvet/chenille: directional sheen where fibers lean toward light.
- Shadows in folds: darker tone of same material (compressed fibers), not black.

3D MAPPING:
- Texture wraps around underlying geometry naturally.
- Stretched on convex surfaces, compressed in folds/creases.
- Preserve underlying form and fold structure, only replace the surface material.

Do NOT smooth or flatten. Do NOT over-simplify. Photorealistic, 8K. Every fiber must be visible.`;
            } else if (referenceImage) {
                 const compressedRef = await compressImageForApi(referenceImage);
                 const refBase64 = compressedRef.split(',')[1];
                 const refMime = compressedRef.split(';')[0].split(':')[1];
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
                        const mime = part.inlineData.mimeType || 'image/png';
                        generatedImageUrl = `data:${mime};base64,${part.inlineData.data}`;
                    }
                }
            }
        }

        if (generatedImageUrl) {
            generatedImageUrl = await convertImageFormat(generatedImageUrl, outputFormat);
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

    // Add Scene Reference Images to chat if present
    if (sceneRefImages.length > 0) {
        sceneRefImages.forEach(refImg => {
            addMessage({ id: timestamp + msgIdOffset++, role: 'user', type: 'image', content: refImg });
        });
    }

    // Add text to chat (once)
    let displayPrompt = inputText;
    if (mode === 'reskin' && pendingImages.length > 0 && sceneRefImages.length > 0) {
        displayPrompt = `[换色换料] ${inputText}`;
    } else if (mode === 'mainImage') {
        const platformName = ECOMMERCE_PLATFORMS[ecommercePlatform].name;
        displayPrompt = `[电商主图 — ${platformName}] ${inputText}`;
    } else if (mode === 'detailPage') {
        const platformName = ECOMMERCE_PLATFORMS[ecommercePlatform].name;
        displayPrompt = `[详情页 — ${platformName}] ${inputText}`;
    } else if (sceneRefImages.length > 0 && pendingImages.length > 0) {
        displayPrompt = `[参考场景复刻] ${inputText}`;
    }
    
    if (displayPrompt.trim()) {
      addMessage({ id: timestamp + msgIdOffset++, role: 'user', type: 'text', content: displayPrompt });
    }
    
    // Capture state for the generation process
    const currentInput = inputText;
    const currentImages = [...pendingImages];
    const currentSceneRefs = [...sceneRefImages];
    const currentSceneRef = currentSceneRefs.length > 0 ? currentSceneRefs[0] : null;
    const colorContext = accentColor ? `\n\nDESIGN CONSTRAINT: Use the color ${accentColor} as a primary accent or dominant tone.` : '';
    
    // Capture e-commerce state for async closures
    const currentPlatform = ecommercePlatform;
    const currentPlatformConfig = ECOMMERCE_PLATFORMS[ecommercePlatform];
    const currentSizePresets = mode === 'mainImage' ? currentPlatformConfig.mainImageSizes : currentPlatformConfig.detailPageSizes;
    const currentSizePreset = currentSizePresets[selectedSizePresetIdx] || currentSizePresets[0];
    const currentMainImageStyle = mainImageStyle;
    const currentDetailSections = [...selectedDetailSections];
    const currentProductName = productName;
    const currentSellingPoints = productSellingPoints;
    
    // Reset Input State logic:
    if (mode !== 'master' && mode !== 'reskin' && mode !== 'mainImage' && mode !== 'detailPage') {
        setInputText('');
        setPendingImages([]);
        setSceneRefImages([]);
    }

    // --- 2. Define Generation Logic ---
    // Master/Reskin/MainImage/DetailPage: generate `generateCount` images.
    // Architect mode: one task per image for individual analysis.
    const tasks: (string | null)[] = (mode === 'master' || mode === 'reskin' || mode === 'mainImage' || mode === 'detailPage')
      ? Array.from({ length: generateCount }, () => null)
      : (currentImages.length > 0 ? currentImages : [null]);
    
    setActiveRequests(prev => prev + tasks.length);
    if (progress > 90) setProgress(50); 
    else if (progress === 0) setProgress(2);

    const ai = apiProvider !== 'kie' ? getAiClient() : null;

    // API Retry Wrapper (Google SDK only)
    const generateWithRetry = async (model: string, params: any, retries = 5) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await ai!.models.generateContent({ model, ...params });
            } catch (error: any) {
                const isRetryable = error.message?.includes('503') || error.message?.includes('429') || error.message?.includes('Deadline expired') || error.message?.includes('UNAVAILABLE') || error.status === 503 || error.status === 429;
                if (isRetryable && i < retries - 1) {
                    const delay = 3000 * Math.pow(2, i); // 3s -> 6s -> 12s -> 24s
                    console.warn(`Request failed (${error.status || '503/Timeout'}). Retrying (${i + 1}/${retries}) after ${delay/1000}s...`);
                    await new Promise(r => setTimeout(r, delay));
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

                const systemPrompt = `# Role Definition (角色定义)
You are Lyra, an expert-level "E-commerce Visual Prompt Architect" (电商视觉提示词架构师) with 10+ years of experience as a senior commercial photography set designer and product photography director. Your core mission: transform the user's product images and style references into structurally rigorous, professionally photographed-level AI image generation prompts that directly boost conversion rates.

# Core Analysis Engines (核心解析引擎)

You MUST activate ALL 5 engines when analyzing any image:

## Engine 1: Reference Accuracy Lock (精准垫图视觉锁定引擎)
- FIRST PRIORITY: Lock the product's physical form, material texture, and camera perspective angle.
- Identify the EXACT camera angle using photography terminology: "Straight-on frontal zero distortion", "High-angle 3/4 perspective", "Strict 90-degree side profile", "Low-angle 3/4 front-side perspective", etc.
- Add MANDATORY instructions prohibiting AI from altering product design.

## Engine 2: Smart Scene Auto-Enrichment (智能布景与主动扩充引擎)
- NEVER be a passive translator. Like a top-tier interior stylist, based on the image style/mood, PROACTIVELY specify:
  - Hard furnishings (e.g., hand-plastered limewash walls, panoramic floor-to-ceiling windows, reclaimed oak flooring)
  - Soft furnishings (e.g., Berber rug, travertine coffee table, vintage record player, dried pampas grass in ceramic vase)
- Scenes MUST have "lived-in feel" and "story sense", NEVER empty or sterile.

## Engine 3: Immersive Lifestyle Narrative (沉浸式生活叙事引擎)
- If the image contains people OR the context suggests lifestyle use, MUST inject:
  - **Authentic Posture:** Replace "sitting" with "curled up", "sinking deeply", "lounging casually". NO stiff model posing.
  - **Body Weight Distribution:** Emphasize natural cushion deformation from body weight, showing product softness.
  - **Lived-in Details:** Casually draped throw blanket, slightly wrinkled pillows, half-drunk coffee cup — "candid shot" feeling.
- If pure product scene requested: specify "Pure product scene, NO HUMANS" explicitly.

## Engine 4: E-commerce Layout Negative Space (电商排版留白引擎)
- MUST specify ONE clear area of "negative space" for e-commerce typography and A+ content layout.
- Be specific about location: "top left wall area", "right side floor area", "upper half of frame", etc.

## Engine 5: Spatial Control & Anti-Distortion (空间结构与防翻车调度)
- **Open Layout Rule:** For large spaces, use "Open-concept Great room", "Panoramic floor-to-ceiling windows", furniture MUST be "Free-standing floating in the center" (NEVER pushed against walls).
- **Frontal Anti-Skew Rule:** For straight-on views, remove perspective-breaking foreground objects, use "One-point perspective" or "Wes Anderson flat style".
- **Side Profile Lock Rule:** For side views, enforce "Strict 90-degree side profile" with physical camera constraints.

# Anti-Plastic Realism Protocol (反塑料感真实摄影协议)
This is MANDATORY for ALL prompts. STRICTLY PROHIBIT "Unreal Engine", "3D render", "CGI" terminology.

1. **Real Optical Physics:** Use real medium-format camera parameters: "Shot on Hasselblad X1D II / Fujifilm GFX 100S, [focal length]mm lens, f/[aperture]". This forces AI to simulate real lens depth-of-field and bokeh.
2. **Micro-texture & Tactility:** PROHIBIT overly perfect smooth surfaces. Enforce tactile descriptors: "visible fabric weave", "matte finish", "subtle natural wrinkles", "porous", "hand-plastered texture".
3. **Light Falloff & Micro-imperfections:** Use "natural light falloff", "natural film grain", "un-retouched RAW photo" to break AI's over-polished look.

# STRICT OUTPUT FORMAT

You MUST output TWO physically separate sections: English prompt for AI generation, Chinese translation for team review. Each MUST contain ALL 8 modules in order.

### 1. 视觉深度解析 (Deep Visual Analysis)
[2-3 sentences in Chinese: identify the image's core style (e.g., Wabi-sabi, Japandi, Mid-century Modern), key visual elements, the "visual killer feature" that makes it compelling, and any spatial/lighting challenges for AI reproduction.]

### 2. 生成提示词 (Prompts)

**【English Prompt】(For AI Image Generation — copy this directly)**
\`\`\`markdown
(Core Subject)
[Product shape, color, material texture, specific design details. If reference image exists: "EXACTLY AS SHOWN IN REFERENCE IMAGE". Enforce micro-texture: visible weave/grain/matte finish.]

(Human Presence & Action)
[Specific ethnicity, outfit details, authentic posture with body weight interaction. OR "Pure product scene, NO HUMANS" if no people needed.]

(Camera & Composition)
[Exact camera angle with photography terminology. Lens focal length. Perspective type (one-point/two-point/3/4). Specific negative space location for e-commerce layout.]

(Environment)
[Architectural hard furnishings: wall material, floor material, window type, spatial layout. "Open-concept" or "Cozy apartment" etc.]

(Lighting)
[Light source, direction, quality. Light falloff behavior. How light interacts with material textures. Atmospheric mood.]

(Props)
[Specific soft furnishings with exact placement positions. Materials and colors. Items that add "lived-in" story feeling.]

(Quality & Render)
[RAW photo, un-retouched, specific camera body + lens + aperture. "Natural film grain", "STRICTLY NO CGI". Style reference magazine.]

[Control Strict Rules]
[4-5 numbered MANDATORY rules: perspective lock, product fidelity, negative space, spatial constraints, anti-distortion.]
\`\`\`

**【中文翻译与审阅版】(For Team Review)**
\`\`\`markdown
[将上述英文 Prompt 进行专业中文翻译，保持相同的 8 个模块结构。关键摄影与调度术语加粗标注。]
\`\`\`

### 3. 架构师调度简报 (Architect Dispatch Brief)
[1-2 sentences in Chinese: explain the KEY visual scheduling decision or "anti-distortion strategy" you applied (e.g., why you shifted the coffee table position, why you chose one-point vs two-point perspective, what spatial rule you enforced).]

**ABSOLUTE RULES:**
- English prompt MUST contain ALL 8 modules in exact order: Core Subject → Human Presence & Action → Camera & Composition → Environment → Lighting → Props → Quality & Render → Control Strict Rules.
- NEVER use "Unreal Engine", "3D render", "CGI", "octane render" in Quality section. Use REAL camera parameters.
- NEVER output generic/vague descriptions. Every detail must be specific and actionable.
- Ensure extreme fidelity to the input image's product, angle, and spatial relationships.`;

                let promptText = currentInput;
                const strictInstruction = "Activate ALL 5 core engines. Output MUST follow the 8-module architecture (Core Subject → Human Presence & Action → Camera & Composition → Environment → Lighting → Props → Quality & Render → Control Strict Rules) in BOTH English and Chinese. Use REAL camera parameters, STRICTLY NO CGI/UE5. Include Architect Dispatch Brief.";
                
                if (!promptText && image) {
                  promptText = `Analyze this image with ALL 5 engines and generate prompts using the full 8-module architecture. ${strictInstruction} ${colorContext}`;
                } else if (promptText) {
                  promptText = `${promptText}. (${strictInstruction}) ${colorContext}`;
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
                      const compressed = await compressImageForApi(image);
                      const base64Data = compressed.split(',')[1];
                      const mimeType = compressed.split(';')[0].split(':')[1];
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

            } else if (mode === 'reskin') {
                // --- Reskin Mode (换色换料) --- FIXED: interleave text labels with images
                const hasOriginal = currentImages.length > 0;
                const hasMaterialRef = currentSceneRefs.length > 0;
                const userInput = currentInput || "";

                // Thinking message
                let thinkingMsg = "🎨 正在换色换料处理中...";
                if (hasOriginal && hasMaterialRef) {
                    thinkingMsg = `🎨 [图 ${taskIndex + 1}/${generateCount}] 正在将产品材质替换为目标面料...`;
                } else if (hasOriginal) {
                    thinkingMsg = `🎨 [图 ${taskIndex + 1}/${generateCount}] 正在根据描述替换产品颜色/材质...`;
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

                // --- Step 1: Pre-analyze reference material texture (Google SDK only) ---
                // Use a concise analysis to avoid overwhelming the image model
                let textureAnalysis = "";
                if (hasOriginal && hasMaterialRef && apiProvider !== 'kie') {
                    try {
                        const refForAnalysis = await compressImageForApi(currentSceneRefs[0]);
                        const analysisBase64 = refForAnalysis.split(',')[1];
                        const analysisMime = refForAnalysis.split(';')[0].split(':')[1];
                        
                        const analysisResponse = await generateWithRetry(
                            selectedTextModel,
                            {
                                contents: { parts: [
                                    { inlineData: { mimeType: analysisMime, data: analysisBase64 } },
                                    { text: `Analyze this material/fabric swatch. Output a concise description (max 100 words) covering: material type, color, texture pattern, surface quality, and how light interacts with it. Be specific and technical. Output ONLY the description, no labels or formatting.` }
                                ] },
                                config: { systemInstruction: "You are a textile expert. Be concise and precise." }
                            }
                        );
                        textureAnalysis = analysisResponse?.text || "";
                        console.log("Texture analysis:", textureAnalysis);
                    } catch (e) {
                        console.warn("Texture pre-analysis failed, proceeding without it:", e);
                    }
                }

                let generatedImageUrl: string | null = null;
                let textResponse: string = "";

                if (apiProvider === 'kie') {
                    // --- KIE.ai path ---
                    let kieReskinPrompt = "";
                    if (hasOriginal && hasMaterialRef) {
                        kieReskinPrompt = `RESKIN TASK: Replace the surface material of the product.

The FIRST image is the ORIGINAL PRODUCT — keep its exact shape, silhouette, camera angle, background, and all non-surface elements (legs, frames, hardware) completely unchanged.

The SECOND image is the TARGET MATERIAL/FABRIC REFERENCE — extract the color, texture, weave pattern, and surface quality from this swatch.

Generate a NEW photo of the ORIGINAL PRODUCT with its fabric/surface replaced by the TARGET MATERIAL. The output must be a complete product photo, NOT a fabric swatch.

Requirements:
- Texture wraps naturally around the product's 3D form (stretched on curves, compressed in folds)
- Lighting interaction matches the new material (matte absorbs, velvet has directional sheen)
- Preserve all seams, stitching, and construction details
- Photorealistic quality, indistinguishable from a real photograph${userInput ? `\n\nAdditional instruction: ${userInput}` : ''}`;
                    } else if (hasOriginal) {
                        kieReskinPrompt = `Change the color/material of the product in this image.${userInput ? ` Instruction: ${userInput}` : ''} Keep shape, angle, background identical. Photorealistic.`;
                    } else {
                        kieReskinPrompt = `Please provide a product image to reskin.`;
                    }

                    const inputImages: string[] = [...currentImages];
                    currentSceneRefs.forEach(ref => inputImages.push(ref));
                    generatedImageUrl = await kieGenerateImage(kieReskinPrompt, inputImages, {
                        aspectRatio: aspectRatio,
                        resolution: resolution,
                        outputFormat: outputFormat
                    });
                } else {
                    // --- Google SDK path: interleave text labels with images ---
                    const parts: any[] = [];

                    if (hasOriginal && hasMaterialRef) {
                        // CRITICAL FIX: Label each image explicitly with text parts
                        // This prevents the model from confusing product vs reference
                        parts.push({ text: `[ORIGINAL PRODUCT PHOTO — this is the product to modify. Keep its exact shape, pose, angle, background, and all non-fabric elements identical:]` });
                        
                        for (const img of currentImages) {
                          const compressed = await compressImageForApi(img);
                          parts.push({ inlineData: { mimeType: compressed.split(';')[0].split(':')[1], data: compressed.split(',')[1] } });
                        }

                        parts.push({ text: `[TARGET MATERIAL/FABRIC REFERENCE — extract color, texture, and weave pattern from this swatch to apply onto the product above:]` });
                        
                        for (const ref of currentSceneRefs) {
                          const preserved = await compressImagePreservePng(ref);
                          parts.push({ inlineData: { mimeType: preserved.split(';')[0].split(':')[1], data: preserved.split(',')[1] } });
                        }

                        // Build a focused, clear prompt
                        parts.push({ text: `TASK: Generate a NEW image of the original product above, with its surface material REPLACED by the target material/fabric shown in the reference.
${textureAnalysis ? `\nMaterial description: ${textureAnalysis}\n` : ''}${userInput ? `\nUser instruction: "${userInput}"\n` : ''}
CRITICAL OUTPUT RULES:
1. Output must be a COMPLETE PRODUCT PHOTO showing the full product — NOT a fabric swatch, NOT just the material texture, NOT a close-up of fabric.
2. The product shape, silhouette, proportions, camera angle, background, and all non-surface elements (legs, frames, hardware, buttons, zippers) must be IDENTICAL to the original.
3. ONLY the fabric/surface material changes — everything else stays exactly the same.

TEXTURE REQUIREMENTS:
- Copy the reference material's exact color, weave pattern, and surface grain onto the product
- Texture must wrap naturally around the product's 3D form (stretch on curves, compress in folds)
- Color must have natural depth and variation — not flat or uniform
- Recalculate lighting interaction for the new material's surface properties
- Preserve seam lines and construction details

OUTPUT: One photorealistic product photo, 8K quality, indistinguishable from a real photograph.` });

                    } else if (hasOriginal && !hasMaterialRef) {
                        // Only product image, text-based color/material change
                        parts.push({ text: `[ORIGINAL PRODUCT PHOTO — modify its surface color/material as instructed:]` });
                        for (const img of currentImages) {
                          const compressed = await compressImageForApi(img);
                          parts.push({ inlineData: { mimeType: compressed.split(';')[0].split(':')[1], data: compressed.split(',')[1] } });
                        }
                        parts.push({ text: `TASK: ${userInput ? `"${userInput}" — Apply this color/material change to the product.` : 'Please describe the target color or material.'}

OUTPUT RULES:
1. Output a COMPLETE PRODUCT PHOTO with the new color/material applied — NOT a swatch or texture sample.
2. Keep shape, composition, background, camera angle, and non-surface elements identical.
3. New material must show realistic texture with natural color variation.
Photorealistic, 8K quality.` });
                    } else {
                        parts.push({ text: `请上传要换色的产品原图，以及目标颜色/面料的参考图。` });
                    }

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
                                const mime = part.inlineData.mimeType || 'image/png';
                                generatedImageUrl = `data:${mime};base64,${part.inlineData.data}`;
                            } else if (part.text) {
                                textResponse = part.text;
                            }
                        }
                    }
                }

                // Display result
                if (generatedImageUrl) {
                    generatedImageUrl = await convertImageFormat(generatedImageUrl, outputFormat);
                    addMessage({ id: baseId + 1, role: 'assistant', type: 'image', content: generatedImageUrl });
                }
                if (textResponse) {
                    addMessage({ id: baseId + 2, role: 'assistant', type: 'text', content: textResponse });
                }
                if (!generatedImageUrl && !textResponse) {
                    addMessage({ id: baseId + 1, role: 'assistant', type: 'text', content: "⚠️ 换色换料生成失败,请重试。" });
                }

            } else if (mode === 'mainImage') {
                // --- E-commerce Main Image Mode ---
                const hasProduct = currentImages.length > 0;
                const hasRef = currentSceneRefs.length > 0;
                const userInput = currentInput || "";
                const platformName = currentPlatformConfig.name;
                const sizeLabel = `${currentSizePreset.width}x${currentSizePreset.height}`;
                const styleObj = MAIN_IMAGE_STYLES.find(s => s.id === currentMainImageStyle);
                const styleName = styleObj?.label || '白底图';
                const styleDesc = styleObj?.description || '';

                let prompt = `You are an expert e-commerce product photographer and visual designer specializing in ${platformName} main product images (主图).

TARGET PLATFORM: ${platformName}
IMAGE DIMENSIONS: ${sizeLabel} (${currentSizePreset.ratio}) — ${currentSizePreset.description}
STYLE: ${styleName} — ${styleDesc}
${currentProductName ? `PRODUCT NAME: ${currentProductName}` : ''}
${currentSellingPoints ? `KEY SELLING POINTS: ${currentSellingPoints}` : ''}
${userInput ? `USER INSTRUCTIONS: "${userInput}"` : ''}

${hasProduct ? `INPUT IMAGES:
- Product image(s): ${currentImages.length} reference photo(s) showing the product. Preserve product appearance with 100% fidelity (shape, color, material, texture, branding).
${hasRef ? `- Reference image(s): ${currentSceneRefs.length} style/competitor reference(s) — use for inspiration ONLY, do NOT copy their products.` : ''}` : ''}

TASK: Generate a high-converting e-commerce main product image (主图) optimized for ${platformName}.

MAIN IMAGE REQUIREMENTS:
1. PRODUCT HERO: The product must be the absolute center of attention, occupying 60-80% of the frame.
2. CLEAN COMPOSITION: ${currentMainImageStyle === 'white_bg' ? 'Pure white (#FFFFFF) background with professional studio lighting. Subtle shadow for depth.' : currentMainImageStyle === 'scene' ? 'Natural lifestyle scene that contextualizes the product. Scene complements but never competes with the product.' : currentMainImageStyle === 'lifestyle' ? 'Lifestyle context showing the product in use. Natural, aspirational setting.' : currentMainImageStyle === 'creative' ? 'Creative, eye-catching composition with bold colors or unique angles. Must still clearly showcase the product.' : currentMainImageStyle === 'comparison' ? 'Before/after or comparison layout highlighting product advantages.' : 'Focus on key selling points with clear visual hierarchy.'}
3. LIGHTING: Professional studio-quality lighting — even illumination, accurate color rendering, subtle highlights showing material quality.
4. MATERIAL FIDELITY: Product texture must be razor-sharp — fabric weave, leather grain, metal finish, wood grain all clearly visible.
5. COLOR ACCURACY: Product colors must be true-to-life, suitable for customer purchase decisions.
6. E-COMMERCE OPTIMIZATION: 
   - Image must look compelling at thumbnail size (mobile browsing)
   - High contrast between product and background for visual pop
   - Leave appropriate space for any text overlays if needed
   - Aspect ratio must be exactly ${currentSizePreset.ratio}

PLATFORM-SPECIFIC RULES (${platformName}):
${currentPlatformConfig.mainImageTips.map((tip, i) => `${i + 1}. ${tip}`).join('\n')}

ABSOLUTE CONSTRAINTS:
- Product appearance (color, shape, material, texture, branding, logo) must be IDENTICAL to input.
- Do NOT add text, watermarks, price tags, or promotional overlays — generate clean image only.
- Do NOT distort product proportions or perspective.
- Photorealistic quality — indistinguishable from professional product photography.
- 8K resolution, professional color grading.
${colorContext}`;

                let thinkingMsg = `🛒 [图 ${taskIndex + 1}/${generateCount}] 正在生成${platformName}电商主图 (${styleName})...`;
                if (apiProvider === 'kie') thinkingMsg += ' (kie.ai 异步生成中...)';
                addMessage({ id: baseId, role: 'assistant', type: 'text', content: thinkingMsg });

                let generatedImageUrl: string | null = null;
                let textResponse = "";
                const validRatio = toValidApiRatio(currentSizePreset.ratio, currentSizePreset.width, currentSizePreset.height);

                if (apiProvider === 'kie') {
                    const inputImages = [...currentImages, ...currentSceneRefs];
                    generatedImageUrl = await kieGenerateImage(prompt, inputImages, {
                        aspectRatio: validRatio,
                        resolution: resolution,
                        outputFormat: outputFormat
                    });
                } else {
                    const parts: any[] = [];
                    for (const img of currentImages) {
                      const compressed = await compressImageForApi(img);
                      parts.push({ inlineData: { mimeType: compressed.split(';')[0].split(':')[1], data: compressed.split(',')[1] } });
                    }
                    for (const ref of currentSceneRefs) {
                      const compressed = await compressImageForApi(ref);
                      parts.push({ inlineData: { mimeType: compressed.split(';')[0].split(':')[1], data: compressed.split(',')[1] } });
                    }
                    parts.push({ text: prompt });

                    const response = await generateWithRetry(selectedImageModel, {
                        contents: { parts },
                        config: { imageConfig: { aspectRatio: validRatio, imageSize: resolution } }
                    });

                    if (response?.candidates?.[0]?.content?.parts) {
                        for (const part of response.candidates[0].content.parts) {
                            if (part.inlineData) {
                                generatedImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                            } else if (part.text) {
                                textResponse += part.text;
                            }
                        }
                    }
                }

                if (generatedImageUrl) {
                    generatedImageUrl = await convertImageFormat(generatedImageUrl, outputFormat);
                    addMessage({ id: baseId + 1, role: 'assistant', type: 'image', content: generatedImageUrl });
                    if (textResponse && textResponse.trim()) addMessage({ id: baseId + 2, role: 'assistant', type: 'text', content: textResponse });
                } else {
                    addMessage({ id: baseId + 1, role: 'assistant', type: 'text', content: textResponse || "⚠️ 电商主图生成失败，请重试。" });
                }

            } else if (mode === 'detailPage') {
                // --- E-commerce Detail Page Mode ---
                const hasProduct = currentImages.length > 0;
                const hasRef = currentSceneRefs.length > 0;
                const userInput = currentInput || "";
                const platformName = currentPlatformConfig.name;
                const sizeLabel = `${currentSizePreset.width}x${currentSizePreset.height}`;
                const selectedSectionObjs = DETAIL_PAGE_SECTIONS.filter(s => currentDetailSections.includes(s.id));
                const sectionNames = selectedSectionObjs.map(s => `${s.icon} ${s.label}: ${s.description}`).join('\n');

                let prompt = `You are an expert e-commerce detail page designer specializing in ${platformName} product detail pages (详情页).

TARGET PLATFORM: ${platformName}
IMAGE DIMENSIONS: ${sizeLabel} (${currentSizePreset.ratio}) — ${currentSizePreset.description}
${currentProductName ? `PRODUCT NAME: ${currentProductName}` : ''}
${currentSellingPoints ? `KEY SELLING POINTS: ${currentSellingPoints}` : ''}
${userInput ? `USER INSTRUCTIONS: "${userInput}"` : ''}

${hasProduct ? `INPUT IMAGES:
- Product image(s): ${currentImages.length} reference photo(s). Preserve product with 100% fidelity.
${hasRef ? `- Reference image(s): ${currentSceneRefs.length} style reference(s) for design inspiration.` : ''}` : ''}

TASK: Generate ONE section of a high-converting product detail page image for ${platformName}.

SECTION TO GENERATE:
${sectionNames}

DETAIL PAGE IMAGE REQUIREMENTS:
1. VISUAL STORYTELLING: Each section image must tell a compelling visual story about the product.
2. INFORMATION HIERARCHY: Clear visual flow — the most important information should be immediately apparent.
3. PRODUCT SHOWCASE: The product must be beautifully presented with professional lighting and accurate material rendering.
4. LIFESTYLE CONTEXT: Where appropriate, show the product in realistic use scenarios that resonate with the target audience.
5. MATERIAL DETAIL: Close-up shots must show fabric texture, material quality, craftsmanship details at maximum clarity.
6. CONSISTENT STYLE: Maintain a cohesive visual language — consistent color palette, typography style areas, spacing.
7. MOBILE-FIRST: Design must look excellent on mobile screens (primary browsing device).

LAYOUT GUIDELINES:
- Clean, modern layout with clear sections
- Use negative space effectively
- Product images must be high-quality and detailed
- Lifestyle/scene images must feel authentic and aspirational
- Leave appropriate areas for text overlay (selling points, specs, etc.) but do NOT add actual text
- Aspect ratio: ${currentSizePreset.ratio}

PLATFORM-SPECIFIC RULES (${platformName}):
${currentPlatformConfig.detailPageTips.map((tip, i) => `${i + 1}. ${tip}`).join('\n')}

ABSOLUTE CONSTRAINTS:
- Product appearance must be IDENTICAL to input images.
- Do NOT add text, watermarks, or promotional copy — generate clean imagery only.
- Do NOT distort product proportions.
- Photorealistic quality — professional product photography standard.
- 8K resolution detail, professional color grading.
${colorContext}`;

                let thinkingMsg = `📄 [图 ${taskIndex + 1}/${generateCount}] 正在生成${platformName}详情页图片...`;
                if (apiProvider === 'kie') thinkingMsg += ' (kie.ai 异步生成中...)';
                addMessage({ id: baseId, role: 'assistant', type: 'text', content: thinkingMsg });

                let generatedImageUrl: string | null = null;
                let textResponse = "";
                const validRatio = toValidApiRatio(currentSizePreset.ratio, currentSizePreset.width, currentSizePreset.height);

                if (apiProvider === 'kie') {
                    const inputImages = [...currentImages, ...currentSceneRefs];
                    generatedImageUrl = await kieGenerateImage(prompt, inputImages, {
                        aspectRatio: validRatio,
                        resolution: resolution,
                        outputFormat: outputFormat
                    });
                } else {
                    const parts: any[] = [];
                    for (const img of currentImages) {
                      const compressed = await compressImageForApi(img);
                      parts.push({ inlineData: { mimeType: compressed.split(';')[0].split(':')[1], data: compressed.split(',')[1] } });
                    }
                    for (const ref of currentSceneRefs) {
                      const compressed = await compressImageForApi(ref);
                      parts.push({ inlineData: { mimeType: compressed.split(';')[0].split(':')[1], data: compressed.split(',')[1] } });
                    }
                    parts.push({ text: prompt });

                    const response = await generateWithRetry(selectedImageModel, {
                        contents: { parts },
                        config: { imageConfig: { aspectRatio: validRatio, imageSize: resolution } }
                    });

                    if (response?.candidates?.[0]?.content?.parts) {
                        for (const part of response.candidates[0].content.parts) {
                            if (part.inlineData) {
                                generatedImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                            } else if (part.text) {
                                textResponse += part.text;
                            }
                        }
                    }
                }

                if (generatedImageUrl) {
                    generatedImageUrl = await convertImageFormat(generatedImageUrl, outputFormat);
                    addMessage({ id: baseId + 1, role: 'assistant', type: 'image', content: generatedImageUrl });
                    if (textResponse && textResponse.trim()) addMessage({ id: baseId + 2, role: 'assistant', type: 'text', content: textResponse });
                } else {
                    addMessage({ id: baseId + 1, role: 'assistant', type: 'text', content: textResponse || "⚠️ 详情页图片生成失败，请重试。" });
                }

            } else {
                // --- Master Mode ---
                // In master mode, use ALL product images as combined reference
                const hasProduct = currentImages.length > 0;
                const productCount = currentImages.length;
                let prompt = "";

                // Helper: detect if user mentioned perspective/angle keywords
                const userInput = currentInput || "";
                const hasPerspectiveHint = /透视|视角|俯视|仰视|平视|侧视|鸟瞰|低角度|高角度|正面|背面|45度|90度|top.?down|bird.?eye|low.?angle|high.?angle|eye.?level|front.?view|side.?view|aerial|isometric|perspective|angle|overhead/i.test(userInput);
                const hasQualityHint = /画质|质感|水彩|油画|插画|卡通|动漫|手绘|素描|像素|风格化|abstract|watercolor|oil.?paint|cartoon|anime|illustration|sketch|pixel|stylized|flat.?design|minimalist.?art/i.test(userInput);

                // Default photorealistic quality suffix (only if user didn't specify quality style)
                const qualitySuffix = hasQualityHint 
                  ? "" 
                  : "\n\nPHOTO QUALITY: Shot on Sony A7R V with 85mm f/1.4 GM lens. Natural ambient lighting with soft fill. RAW-quality color depth, fine grain texture, true-to-life skin tones and material rendering. 8K resolution, professional color grading. The final image must be indistinguishable from a real professional photograph.\n\nMATERIAL REALISM MANDATE: Every surface must show its real-world micro-texture at full resolution. Fabric must display individual thread weave patterns and fiber detail. Leather must show grain pores and natural surface variation. Wood must show grain lines. Metal must show finish quality (brushed, polished, matte). Carpet/rug must show pile direction and fiber density. Do NOT over-smooth, blur, or digitally flatten ANY material surface. Subtle surface imperfections (fabric pilling, grain variation, natural inconsistency) add realism and must be present.";

                // 3. Construct Prompt based on inputs
                const sceneRefCount = currentSceneRefs.length;
                if (hasProduct && currentSceneRef) {
                    // 场景参考 + 产品图：参考场景风格/环境/光照/装饰，生成新场景并放入产品
                    const productInputDesc = productCount > 1
                      ? `- Images 1-${productCount}: THE PRODUCT (${productCount} reference images showing different angles/views of the SAME product. Analyze ALL images together to understand the product's complete 3D form, texture, material, color, and branding. Preserve with 100% fidelity.)`
                      : `- Image 1: THE PRODUCT (absolute source of truth for product appearance — shape, texture, material, color, branding must be preserved with 100% fidelity).`;
                    const sceneStartIdx = productCount + 1;
                    const sceneInputDesc = sceneRefCount > 1
                      ? `- Images ${sceneStartIdx}-${productCount + sceneRefCount}: SCENE STYLE REFERENCES (${sceneRefCount} reference images — use them ONLY as style guides for environment aesthetics, decorative elements, color palette, lighting mood, and spatial composition. Do NOT copy the products/objects already present in these references.)`
                      : `- Image ${sceneStartIdx}: SCENE STYLE REFERENCE (use ONLY as a style guide — extract its interior design style, decorative elements, color palette, lighting mood, material textures, and spatial composition. Do NOT copy the products/objects already in this reference image).`;

                    prompt = `You are an elite commercial photographer and interior scene designer.

INPUTS:
${productInputDesc}
${sceneInputDesc}
${userInput ? `\n- USER INSTRUCTIONS: "${userInput}" (READ CAREFULLY — this is the user's specific request. Understand exactly what they are asking for before generating. Follow their instructions precisely.)` : ''}

PRIMARY TASK — SCENE-INSPIRED PRODUCT PLACEMENT (NOT product replacement):
${userInput ? `IMPORTANT: The user has provided specific instructions: "${userInput}". Read and understand these instructions FIRST. Your output must satisfy the user's request above all else, while following the guidelines below.` : `You must CREATE A NEW SCENE inspired by the style of the reference image(s), then place the Product into it as the hero subject.`}

Step 1: ANALYZE THE PRODUCT (PRIMARY PRIORITY)
${productCount > 1 ? `Study ALL ${productCount} product reference images together to build a complete understanding of the product's 3D form, materials, colors, textures, and branding details. ` : `Study the product image carefully to fully understand its shape, materials, colors, textures, and branding details. `}The product must be rendered with 100% visual fidelity — do NOT alter its color, shape, material, or any design detail.
Also analyze the product image's camera angle, perspective, and viewing direction — this will be the basis for the final output's perspective.

Step 2: EXTRACT SCENE STYLE (from reference${sceneRefCount > 1 ? 's' : ''} — SECONDARY REFERENCE ONLY)
${sceneRefCount > 1 
  ? `Analyze all ${sceneRefCount} scene style references and synthesize their best elements to understand:`
  : `Analyze the scene style reference to understand:`}
- Interior design style (e.g., modern minimalist, Japandi, Scandinavian, mid-century modern)
- Color palette and material palette (wall colors, floor materials, fabric textures)
- Decorative elements and accessories (plants, vases, art, rugs, cushions, etc.)
- Lighting mood and direction (warm natural light, studio lighting, golden hour, etc.)
- Spatial composition style (NOT to override the product's perspective)

Step 3: GENERATE NEW SCENE WITH PRODUCT
Create a brand-new photorealistic scene that:
- Features the Product as the HERO/MAIN SUBJECT — the product is the absolute center of the composition
- Embodies the design style, color palette, and decorative atmosphere extracted from the reference${sceneRefCount > 1 ? 's' : ''}
- Builds the entire scene AROUND the product, complementing it rather than competing with it
- Includes complementary furniture, decorations, and accessories that match the reference style
- Has lighting that matches the mood of the reference but is physically consistent with the new scene layout

CRITICAL RULES:
- The Product's appearance (color, shape, material, texture, branding) must be IDENTICAL to the input product image(s). Do NOT recolor, reshape, or alter the product in any way.
- The product image is the PRIMARY input. The scene reference is SECONDARY — only used for style/mood inspiration.
- The scene should be INSPIRED BY the reference style, not a pixel-for-pixel copy.
- Do NOT place the scene reference's existing products/objects into the output — only the user's Product.

PERSPECTIVE RULES:
${hasPerspectiveHint 
  ? `- The user has specified a camera angle: "${userInput}". Follow this angle PRECISELY.` 
  : `- STRICTLY maintain the same camera angle and perspective as seen in the PRODUCT image(s). The product was photographed from a specific viewpoint — the final scene must use that same viewpoint so the product looks natural and undistorted.
- Do NOT use the scene reference's camera angle. The scene reference is only for style — the perspective comes from the product image.`}

COMPOSITING & QUALITY:
- Lighting direction, intensity, and color temperature must be internally consistent within the new scene.
- Cast shadows and reflections must be physically accurate for the scene's light sources.
- Surface interactions (reflections on tables, soft shadows on fabric, etc.) must be realistic.
- ALL material textures must be rendered at maximum fidelity: product fabric weave, floor material grain, wall texture, prop surface details.
- Do NOT smooth, blur, or simplify any surface texture — every material must look tangible and tactile.
- Scene props and furniture must also show realistic material detail (wood grain, metal finish, glass clarity, textile patterns).
${userInput ? `- Follow all user instructions precisely: "${userInput}"` : `- Ensure the product looks naturally placed in the scene, as if photographed on location by a professional photographer.`}
${colorContext}${qualitySuffix}`;

                } else if (currentSceneRef && !hasProduct) {
                    // 只有场景参考图，无产品图：透视角度转换
                    const sceneInputLabel = sceneRefCount > 1
                      ? `- Images 1-${sceneRefCount}: SCENE REFERENCES (${sceneRefCount} reference scene photographs — synthesize their environment, style, and composition).`
                      : `- Image 1: THE SCENE (a reference scene/environment photograph).`;

                    prompt = `You are an expert 3D scene reconstruction and camera perspective specialist.

INPUT:
${sceneInputLabel}

TASK — ${sceneRefCount > 1 ? 'SCENE SYNTHESIS & TRANSFORMATION' : 'PERSPECTIVE TRANSFORMATION'}:
${hasPerspectiveHint
  ? `${sceneRefCount > 1 ? `Analyze all ${sceneRefCount} scene references and synthesize them into one cohesive scene, then t` : 'T'}ransform/re-render this scene from the following camera angle as specified by the user: "${userInput}". 
Reconstruct the 3D space of the scene and re-project it from the requested viewpoint with accurate parallax, occlusion, and foreshortening.`
  : `${sceneRefCount > 1 ? `Analyze all ${sceneRefCount} scene reference images and create a unified scene that combines the best elements (environment, lighting, atmosphere, composition) from each reference. ` : ''}${userInput || "Re-render this scene with enhanced composition and lighting."}`}

REQUIREMENTS:
- Maintain all scene elements (furniture, objects, materials, textures, colors) with full fidelity.
- ALL material textures must remain crisp and detailed: fabric weave patterns, wood grain, stone pores, metal finish, carpet pile, glass clarity.
- Do NOT smooth, blur, or simplify any surface — every material must retain its micro-texture detail.
- Lighting must be physically re-calculated for the new viewpoint: correct shadows, specular highlights, ambient occlusion.
- Hidden areas revealed by the new angle should be filled with materials that match existing surface textures exactly.
- Architectural lines and vanishing points must be geometrically correct.
- Surface interactions must be realistic: reflections, material-appropriate light absorption/scattering.
${colorContext}${qualitySuffix}`;

                } else if (hasProduct) {
                    // 只有产品图：分析透视并构建场景（多张产品图综合参考）
                    const productInputLabel = productCount > 1
                      ? `- Images 1-${productCount}: THE PRODUCT (${productCount} reference images showing different angles/views of the SAME product. Analyze ALL images together to fully understand the product's 3D form, texture, material, color, and branding. Preserve with 100% accuracy.)`
                      : `- Image 1: THE PRODUCT (preserve its shape, texture, material, branding, and every visual detail with 100% accuracy).`;
                    prompt = `You are an expert product photographer and visual designer.

INPUT:
${productInputLabel}

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
- Product material textures (fabric weave, leather grain, wood grain, metal finish) must be razor-sharp and fully detailed.
- Scene material textures (floor, walls, props) must also show full micro-texture: wood grain, carpet pile, concrete pores, marble veining.
- Do NOT over-smooth or digitally flatten any surface — tangible tactile quality on every material.
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
                if (hasProduct && currentSceneRef) {
                    thinkingMsg = `🎨 [图 ${taskIndex + 1}/${generateCount}] 正在参考场景风格，为${productCount}张产品图构建新场景...`;
                } else if (hasProduct) {
                    thinkingMsg = `🎨 [图 ${taskIndex + 1}/${generateCount}] 正在解析${productCount}张产品图透视并构建场景...`;
                } else {
                    thinkingMsg = generateCount > 1 ? `🎨 [图 ${taskIndex + 1}/${generateCount}] 正在生成效果图...` : "🎨 正在根据描述生成效果图...";
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
                    const inputImages: string[] = [...currentImages];
                    currentSceneRefs.forEach(ref => inputImages.push(ref));

                    generatedImageUrl = await kieGenerateImage(prompt, inputImages, {
                        aspectRatio: aspectRatio,
                        resolution: resolution,
                        outputFormat: outputFormat
                    });
                } else {
                    // === Google SDK (Master Mode) ===
                    const parts: any[] = [];
                    for (const img of currentImages) {
                      const compressed = await compressImageForApi(img);
                      const base64Data = compressed.split(',')[1];
                      const mimeType = compressed.split(';')[0].split(':')[1];
                      parts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
                    }
                    for (const ref of currentSceneRefs) {
                      const compressed = await compressImageForApi(ref);
                      const refBase64 = compressed.split(',')[1];
                      const refMime = compressed.split(';')[0].split(':')[1];
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
                                const mime = part.inlineData.mimeType || 'image/png';
                                generatedImageUrl = `data:${mime};base64,${part.inlineData.data}`;
                            } else if (part.text) {
                                textResponse += part.text;
                            }
                        }
                    }
                }

                if (generatedImageUrl) {
                    generatedImageUrl = await convertImageFormat(generatedImageUrl, outputFormat);
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
            
            let errMsg: string;
            if (isEntityNotFoundError) {
                errMsg = "⚠️ API Key 无效或未选择。请重新选择您的付费项目 API Key。";
            } else if (error.message?.includes("503") || error.message?.includes("UNAVAILABLE")) {
                errMsg = "⚠️ Gemini 服务端暂时不可用 (503)，已自动重试5次均失败。预览版模型（Preview）容量有限，建议：\n1. 等待1-2分钟后重试\n2. 切换到稳定版模型（如 Gemini 2.5 Flash Image）\n3. 减少同时生成的图片数量";
            } else {
                errMsg = `⚠️ 请求失败: ${error.message || '未知错误'}。请检查 API Key 或网络连接。`;
            }
            
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

    // --- 3. Execute Tasks (Sequential to avoid 503 overload) ---
    const executeTasksSequentially = async () => {
        for (let index = 0; index < tasks.length; index++) {
            await processTask(tasks[index], index);
            // Small delay between tasks to avoid rate limiting
            if (index < tasks.length - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    };
    executeTasksSequentially();
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
     const files = e.target.files;
     if (!files || files.length === 0) return;

     Array.from(files).forEach(file => {
       const reader = new FileReader();
       reader.onloadend = () => {
         if (reader.result) {
           setSceneRefImages(prev => [...prev, reader.result as string]);
         }
       };
       reader.readAsDataURL(file as Blob);
     });
     e.target.value = '';
  };

  // Remove individual image from pending list
  const handleRemoveImage = (indexToRemove: number) => {
      setPendingImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // === Drag & Drop / Reference helpers ===
  const handleImageToInput = async (imageUrl: string) => {
    const dataUri = await fetchImageAsDataUri(imageUrl);
    setPendingImages(prev => [...prev, dataUri]);
  };

  const handleImageToScene = async (imageUrl: string) => {
    const dataUri = await fetchImageAsDataUri(imageUrl);
    setSceneRefImages(prev => [...prev, dataUri]);
  };

  // Convert remote URL to data URI (for reusing KIE.ai generated images)
  const fetchImageAsDataUri = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) return url;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('fetchImageAsDataUri failed:', e);
      return url; // fallback: return original URL
    }
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
      setSceneRefImages(prev => [...prev, dataUri]);
      return;
    }
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result) setSceneRefImages(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        }
      });
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

  // ========== E-commerce Task Panel Callbacks ==========
  const ecommerceGenerateImage = async (prompt: string, images: string[], options: {
    aspectRatio: string; resolution: string; outputFormat: string; isMask?: boolean;
  }): Promise<string | null> => {
    const validRatio = toValidApiRatio(options.aspectRatio);
    if (apiProvider === 'kie') {
      return await kieGenerateImage(prompt, images, {
        aspectRatio: validRatio,
        resolution: options.resolution,
        outputFormat: options.outputFormat,
        ...(options.isMask ? { isMask: true } : {}),
      });
    } else {
      const ai = getAiClient();
      const parts: any[] = [];
      for (const img of images) {
        const compressed = await compressImageForApi(img);
        parts.push({ inlineData: { mimeType: compressed.split(';')[0].split(':')[1], data: compressed.split(',')[1] } });
      }
      parts.push({ text: prompt });
      const generateWithRetryLocal = async (model: string, params: any, retries = 5) => {
        for (let i = 0; i < retries; i++) {
          try { return await ai.models.generateContent({ model, ...params }); }
          catch (error: any) {
            const isRetryable = error.message?.includes('503') || error.message?.includes('429') || error.message?.includes('Deadline expired') || error.message?.includes('UNAVAILABLE') || error.status === 503 || error.status === 429;
            if (isRetryable && i < retries - 1) { await new Promise(r => setTimeout(r, 3000 * Math.pow(2, i))); continue; }
            throw error;
          }
        }
      };
      const response = await generateWithRetryLocal(selectedImageModel, {
        contents: { parts },
        config: { imageConfig: { aspectRatio: validRatio, imageSize: options.resolution } }
      });
      if (response?.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const mime = part.inlineData.mimeType || 'image/png';
            return `data:${mime};base64,${part.inlineData.data}`;
          }
        }
      }
      return null;
    }
  };

  const ecommerceGenerateText = async (prompt: string, images: string[]): Promise<string> => {
    if (apiProvider === 'kie') {
      const content: any[] = [];
      for (const img of images.slice(0, 3)) {
        try {
          const url = await kieUploadImage(img);
          content.push({ type: 'image_url', image_url: { url } });
        } catch { /* skip failed uploads */ }
      }
      content.push({ type: 'text', text: prompt });
      return await kieTextGenerate(selectedTextModel, content);
    } else {
      const ai = getAiClient();
      const parts: any[] = [];
      for (const img of images.slice(0, 3)) {
        const compressed = await compressImageForApi(img);
        parts.push({ inlineData: { mimeType: compressed.split(';')[0].split(':')[1], data: compressed.split(',')[1] } });
      }
      parts.push({ text: prompt });
      const response = await ai.models.generateContent({
        model: selectedTextModel,
        contents: { parts },
      });
      return response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    }
  };

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

      {/* Drive Save Status Toast */}
      {driveImageSaveMsg && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium animate-in slide-in-from-bottom-4 fade-in duration-300 ${driveImageSaveMsg.startsWith('✅') ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          <Cloud size={16} />
          {driveImageSaveMsg}
        </div>
      )}

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
              <button onClick={() => setMode('reskin')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${mode === 'reskin' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 shadow-sm ring-1 ring-amber-200 dark:ring-amber-700' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                <Palette size={20} /><div className="text-left hidden md:block"><div className="font-medium text-sm">换色换料</div><div className="text-xs opacity-70">Reskin Studio</div></div>
              </button>
            </div>

            {/* E-commerce Section */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2 hidden md:block">电商工具</div>
              <button onClick={() => setMode('mainImage')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${mode === 'mainImage' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-700' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                <ShoppingBag size={20} /><div className="text-left hidden md:block"><div className="font-medium text-sm">电商主图</div><div className="text-xs opacity-70">Main Image</div></div>
              </button>
              <button onClick={() => setMode('detailPage')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${mode === 'detailPage' ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 shadow-sm ring-1 ring-rose-200 dark:ring-rose-700' : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                <FileText size={20} /><div className="text-left hidden md:block"><div className="font-medium text-sm">详情页</div><div className="text-xs opacity-70">Detail Page</div></div>
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
           <button onClick={() => setMode(mode === 'architect' ? 'master' : mode === 'master' ? 'reskin' : 'architect')} className="text-xs bg-slate-100 px-3 py-1 rounded-full">{mode === 'architect' ? 'Architect' : mode === 'master' ? 'Master' : 'Reskin'}</button>
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

        {/* E-commerce Task Panel (mainImage / detailPage modes) */}
        {(mode === 'mainImage' || mode === 'detailPage') && (
          <EcommerceErrorBoundary>
            <EcommerceTaskPanel
              key="ecommerce-panel"
              onGenerateImage={ecommerceGenerateImage}
              onGenerateText={ecommerceGenerateText}
              apiProvider={apiProvider}
              tasks={ecommerceTasks}
              setTasks={setEcommerceTasks}
              activeTaskId={ecommerceActiveTaskId}
              setActiveTaskId={setEcommerceActiveTaskId}
            />
          </EcommerceErrorBoundary>
        )}
        {mode !== 'mainImage' && mode !== 'detailPage' && (
        <>
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
                    onSaveToDrive={isDriveConnected ? handleSaveImageToDrive : undefined}
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
          {(pendingImages.length > 0 || accentColor || sceneRefImages.length > 0) && (
            <div className="max-w-5xl mx-auto px-4 pt-4 pb-0 flex flex-col gap-2">
               
               {/* Pending Images List - Horizontal Scroll */}
               {(pendingImages.length > 0 || sceneRefImages.length > 0) && (
                   <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                       {/* In reskin mode: show 原图 FIRST (left), then 面料参考 (right) to match API order */}
                       {/* In other modes: show scene refs first, then products */}
                       
                       {mode === 'reskin' ? (
                         <>
                           {/* Reskin: Product/Original Images FIRST (left) */}
                           {pendingImages.map((img, idx) => (
                               <div key={idx} className="relative group flex-shrink-0 animate-in slide-in-from-bottom-2 fade-in duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                   <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-indigo-400 shadow-md bg-white">
                                      <img src={img} alt={`Original ${idx}`} className="w-full h-full object-contain" />
                                   </div>
                                   <button 
                                     onClick={() => handleRemoveImage(idx)} 
                                     className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-sm hover:bg-red-600 transition-colors z-10"
                                   >
                                      <X size={12} />
                                   </button>
                                   <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 text-[10px] text-white text-center py-0.5 font-medium">原图</div>
                               </div>
                           ))}

                           {/* Separator */}
                           {sceneRefImages.length > 0 && pendingImages.length > 0 && (
                              <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1 h-20 self-center"></div>
                           )}

                           {/* Reskin: Material Reference Images SECOND (right) */}
                           {sceneRefImages.map((refImg, idx) => (
                               <div key={`scene-${idx}`} className="relative group flex-shrink-0 animate-in slide-in-from-bottom-2 fade-in duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                   <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-amber-400 shadow-md bg-white relative">
                                      <img src={refImg} alt={`Material ${idx + 1}`} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-amber-500/10 pointer-events-none"></div>
                                   </div>
                                   <button 
                                     onClick={() => setSceneRefImages(prev => prev.filter((_, i) => i !== idx))} 
                                     className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-sm hover:bg-red-600 transition-colors z-10"
                                   >
                                      <X size={12} />
                                   </button>
                                   <div className="absolute bottom-0 left-0 right-0 bg-amber-600/90 text-[10px] text-white text-center py-0.5 font-medium">{sceneRefImages.length > 1 ? `面料 ${idx + 1}` : '面料参考'}</div>
                               </div>
                           ))}
                         </>
                       ) : (
                         <>
                           {/* Non-reskin: Scene refs first, then products (original order) */}
                           {sceneRefImages.map((refImg, idx) => (
                               <div key={`scene-${idx}`} className="relative group flex-shrink-0 animate-in slide-in-from-bottom-2 fade-in duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                   <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-purple-400 shadow-md bg-white relative">
                                      <img src={refImg} alt={`Ref ${idx + 1}`} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-purple-500/10 pointer-events-none"></div>
                                   </div>
                                   <button 
                                     onClick={() => setSceneRefImages(prev => prev.filter((_, i) => i !== idx))} 
                                     className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-sm hover:bg-red-600 transition-colors z-10"
                                   >
                                      <X size={12} />
                                   </button>
                                   <div className="absolute bottom-0 left-0 right-0 bg-purple-600/90 text-[10px] text-white text-center py-0.5 font-medium">{sceneRefImages.length > 1 ? `场景 ${idx + 1}` : '场景参考'}</div>
                               </div>
                           ))}

                           {/* Separator */}
                           {sceneRefImages.length > 0 && pendingImages.length > 0 && (
                              <div className="w-px bg-slate-300 dark:bg-slate-700 mx-1 h-20 self-center"></div>
                           )}

                           {/* Non-reskin: Product Images */}
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
                                   <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 text-[10px] text-white text-center py-0.5 font-medium">{`产品 ${idx + 1}`}</div>
                               </div>
                           ))}
                         </>
                       )}
                       
                       {/* Add more products button */}
                       <button 
                         onClick={() => fileInputRef.current?.click()}
                         className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all flex-shrink-0"
                         title={mode === 'reskin' ? "添加原图（要换色的产品图）" : "添加更多产品图"}
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
              <div className={`text-xs font-medium px-4 py-2 rounded-xl border shadow-sm transition-colors flex items-center gap-2 ${mode === 'master' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' : mode === 'reskin' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300' : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300'}`}>
                <span className={`w-2 h-2 rounded-full ${mode === 'master' ? 'bg-purple-500' : mode === 'reskin' ? 'bg-amber-500' : 'bg-indigo-500'} animate-pulse`}></span>
                {mode === 'master' ? '✨ 生图大师模式 (合成)' : mode === 'reskin' ? '🎨 换色换料模式 (替换产品面料/颜色)' : '📐 提示词架构师 (解析)'}
              </div>

              {/* Toolbar: For Master and Reskin Modes */}
              {(mode === 'master' || mode === 'reskin') && (
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
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-2 text-slate-400 flex items-center gap-1"><ImageIcon size={14} /><span className="text-[10px] font-bold uppercase hidden sm:inline">格式</span></div>
                    <div className="flex gap-1">
                        {OUTPUT_FORMATS.map((fmt) => (
                          <button key={fmt} onClick={() => setOutputFormat(fmt as 'jpg' | 'png')} className={`text-xs px-2 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium uppercase ${outputFormat === fmt ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>{fmt}</button>
                        ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-2 text-slate-400 flex items-center gap-1"><Layers size={14} /><span className="text-[10px] font-bold uppercase hidden sm:inline">生成</span></div>
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map((count) => (
                          <button key={count} onClick={() => setGenerateCount(count)} className={`text-xs px-2 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium ${generateCount === count ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>{count}张</button>
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
              <input type="file" ref={sceneRefInputRef} onChange={handleSceneRefUpload} accept="image/*" multiple className="hidden" />
              
              <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className={`p-3 rounded-xl transition-all shadow-sm border border-transparent relative ${pendingImages.length > 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200'}`} 
                    title={mode === 'reskin' ? "① 上传原图（要换色的产品图）" : "上传产品图 (支持多选)"}
                  >
                    {pendingImages.length > 0 ? <Layers size={20} /> : <ImageIcon size={20} />}
                    {pendingImages.length > 1 && (
                        <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                            {pendingImages.length}
                        </span>
                    )}
                  </button>

                  {/* Scene/Material Reference Upload Button - Master, Reskin and E-commerce Modes */}
                  {(mode === 'master' || mode === 'reskin') && (
                       <button 
                        onClick={() => sceneRefInputRef.current?.click()} 
                        onDrop={handleDropOnScene}
                        onDragOver={(e) => { preventDragDefault(e); e.currentTarget.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50'); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50'); }}
                        className={`p-3 rounded-xl transition-all shadow-sm border border-transparent relative ${sceneRefImages.length > 0 ? (mode === 'reskin' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-purple-50 text-purple-600 border-purple-200') : 'text-slate-500 hover:text-purple-600 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200'}`} 
                        title={mode === 'reskin' ? "② 上传面料参考图（要替换成的目标颜色/面料）" : "上传场景/风格参考图 (支持多张，可拖拽)"}
                       >
                        {mode === 'reskin' ? <Pipette size={20} /> : <ImagePlus size={20} />}
                        {sceneRefImages.length > 0 && (
                            <span className={`absolute -top-1 -right-1 ${mode === 'reskin' ? 'bg-amber-600' : 'bg-purple-600'} text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm`}>{sceneRefImages.length}</span>
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
                placeholder={mode === 'reskin' ? (pendingImages.length > 0 ? (sceneRefImages.length > 0 ? `已就绪：原图 + 面料参考。可输入额外说明（如指定替换区域）...` : `已上传原图。请再上传目标颜色/面料参考图...`) : "请先上传要换色的产品原图...") : mode === 'master' ? (pendingImages.length > 0 ? (sceneRefImages.length > 0 ? `已就绪：产品 + ${sceneRefImages.length}张场景参考。输入额外调整指令...` : `已就绪 ${pendingImages.length} 张产品图。输入场景描述...`) : "请先上传白底产品图，可选择上传场景参考图...") : "上传图片分析提示词..."}
                className="flex-1 max-h-[50vh] min-h-[160px] py-3 px-2 bg-transparent border-none focus:ring-0 resize-y text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-medium leading-relaxed custom-scrollbar"
                rows={6}
              />
              {(inputText || pendingImages.length > 0 || sceneRefImages.length > 0) && (
                <button 
                  onClick={() => {
                    setInputText('');
                    setPendingImages([]);
                    setSceneRefImages([]);
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
        </>
        )}
      </div>
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
                  {isDriveConnected && (
                    <button
                      onClick={() => handleSaveImageToDrive(previewImageUrl!)}
                      disabled={isDriveImageSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/80 hover:bg-blue-500 backdrop-blur-md text-white rounded-full transition-all border border-blue-400/30 disabled:opacity-60"
                    >
                      {isDriveImageSaving ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
                      <span className="text-sm font-medium">保存到Drive</span>
                    </button>
                  )}
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
