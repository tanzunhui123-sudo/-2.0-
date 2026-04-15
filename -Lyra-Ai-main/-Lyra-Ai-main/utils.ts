/**
 * Generates a mock analysis response based on selected parameters.
 */
export const generateMockAnalysisResponse = (mode: string, aspectRatio: string, resolution: string, viewAngle: string) => `### 1. 视觉深度解析 (Deep Visual Analysis)
识别为一款**现代侘寂风 (Wabi-sabi)** L型落地沙发场景。核心视觉杀手锏：**宽条纹灯芯绒的极致触感纹理**与**斑驳自然光影**形成的张力。AI复刻挑战点：需锁定灯芯绒的坑条纹理细节与金属框架的哑光质感，防止AI生成"塑料感"。

### 2. 生成提示词 (Prompts)

**【English Prompt】(For AI Image Generation — copy this directly)**
\`\`\`markdown
(Core Subject)
Large L-shaped modular sofa, wide-wale grey corduroy fabric, extremely plush and tactile texture with visible ribbed weave, matte finish. Back cushions with classic tufting design. Distinctive dark metallic tubular frame wrapping around the armrests, with functional side storage pockets. EXACTLY AS SHOWN IN REFERENCE IMAGE.

(Human Presence & Action)
Candid lifestyle snapshot: A young Caucasian woman in an oversized cream knit sweater, casually curled up on the chaise section, body weight naturally sinking into the plush cushion creating realistic deformation. She is lazily reading a magazine with a warm ceramic mug nearby. Unposed, effortless, authentic lived-in feel.

(Camera & Composition)
Eye-level mid-wide shot, ${viewAngle}, 3/4 front-side perspective. Clean expansive negative space on the upper left wall area for e-commerce A+ typography. --ar ${aspectRatio}

(Environment)
${mode === 'remix' ? 'Maintain product as-is, replace background with sunlit conservatory.' : 'Open-concept modern apartment, warm sand-colored hand-plastered limewash walls with subtle micro-texture, natural light oak wide-plank flooring, panoramic windows on the right.'}

(Lighting)
Warm afternoon natural sunlight streaming diagonally, casting dappled tree-branch shadows on the textured wall. Natural light falloff gently brushing across the corduroy ribs, emphasizing plush volume. Atmospheric dust motes slightly visible.

(Props)
Minimalist travertine round coffee table to the right foreground (shifted to avoid blocking sofa). Fluffy cream Berber rug under the sofa. A rustic ceramic vase with dried pampas grass in the background. Casually draped knit throw blanket on the armrest.

(Quality & Render)
RAW photo, un-retouched, shot on Fujifilm GFX 100S, 50mm lens, f/4.0 aperture, ultra-photorealistic, Architectural Digest style. Natural film grain, extremely sharp focus on fabric weave and metal frame. STRICTLY NO CGI.

[Control Strict Rules]: 1. MANDATORY ${viewAngle} perspective lock; 2. Strictly preserve corduroy texture and metallic frame details; 3. MANDATORY negative space on upper left wall; 4. Foreground props MUST NOT obstruct core product; 5. STRICTLY NO plastic/CGI look.
\`\`\`

**【中文翻译与审阅版】(For Team Review)**
\`\`\`markdown
(核心主体) 大型L型模块沙发，宽条纹灰色灯芯绒面料，**肉眼可见的坑条编织纹理，哑光质感**。靠背带拉扣设计。**独特深色金属管状框架**环绕扶手，带侧面储物袋。**完全与参考图一致**。

(人物与动作) 真实抓拍：年轻欧美女性，穿宽松奶油色针织毛衣，**随意蜷缩在贵妃榻上，身体重量自然下沉产生坐垫凹陷**。慵懒地翻阅杂志，旁边放着陶瓷马克杯。松弛、自然、不做作。

(镜头与构图) **平视中远景**，${viewAngle}，3/4前侧透视。**左上方墙面大面积留白**供电商排版。--ar ${aspectRatio}

(环境硬装) ${mode === 'remix' ? '保持产品不变，背景替换为阳光房。' : '开放式现代公寓，温暖的沙色**手工灰泥水洗墙面**带微肌理，天然浅色橡木宽板地板，右侧全景窗。'}

(光影氛围) 午后暖阳斜射，**在纹理墙面投射斑驳树影**。自然光衰减柔和地扫过灯芯绒坑条，凸显蓬松体积感。大气尘埃微粒隐约可见。

(软装道具) 极简洞石圆形茶几偏右前方（**刻意避开沙发正面视线**）。沙发下铺蓬松奶油色柏柏尔地毯。背景有质朴陶瓷花瓶插干芦苇草。扶手上随意搭放针织毯。

(画质与渲染) **RAW原片，未精修，富士GFX 100S中画幅，50mm镜头，f/4.0**。Architectural Digest杂志风。自然胶片颗粒感，**严禁CGI**。

[严苛控制规则]: 1. **强制锁定${viewAngle}透视**；2. 严格还原灯芯绒纹理与金属框架；3. **强制左上方大面积留白**；4. 前景道具不可遮挡产品主体；5. 严禁塑料感/CGI渲染。
\`\`\`

### 3. 架构师调度简报
启用了**"反塑料感引擎"**将画质参数从UE5切换为中画幅实拍参数；同时启用**"留白引擎"**在左上方预留A+排版空间，**"防翻车引擎"**将茶几偏移至右前方以防遮挡产品正面视线。
`;

/**
 * Mocks the image composition process by placing a product image onto a background.
 * Note: This uses Canvas API and might be subject to CORS restrictions depending on the image source.
 */
export const compositeImages = async (productBase64: string, backgroundUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        resolve(backgroundUrl);
        return;
    }

    // Standard canvas size
    canvas.width = 1024;
    canvas.height = 768;

    const bgImg = new Image();
    bgImg.crossOrigin = "Anonymous"; // Attempt to handle CORS
    
    bgImg.onload = () => {
      // 1. Draw Background (Cover mode)
      const hRatio = canvas.width / bgImg.width;
      const vRatio = canvas.height / bgImg.height;
      const ratio = Math.max(hRatio, vRatio);
      const centerShift_x = (canvas.width - bgImg.width * ratio) / 2;
      const centerShift_y = (canvas.height - bgImg.height * ratio) / 2; 
      ctx.drawImage(bgImg, 0, 0, bgImg.width, bgImg.height, centerShift_x, centerShift_y, bgImg.width * ratio, bgImg.height * ratio);

      // 2. Draw Product (Centered, bottom aligned)
      const productImg = new Image();
      productImg.onload = () => {
        // Product scale (approx 60% of canvas width)
        const pScale = (canvas.width * 0.6) / productImg.width;
        const pWidth = productImg.width * pScale;
        const pHeight = productImg.height * pScale;
        
        // Position: Horizontally centered, bottom aligned with 10% padding
        const x = (canvas.width - pWidth) / 2;
        const y = canvas.height - pHeight - (canvas.height * 0.1);

        // Simple shadow simulation
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.filter = "blur(20px)";
        ctx.beginPath();
        ctx.ellipse(x + pWidth/2, y + pHeight - 20, pWidth * 0.8, 40, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();

        // Draw Product
        ctx.drawImage(productImg, x, y, pWidth, pHeight);
        
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(dataUrl);
        } catch (e) {
          console.error("Canvas export failed (likely CORS)", e);
          resolve(backgroundUrl); // Fallback: return only background if tainted
        }
      };
      
      productImg.onerror = () => resolve(backgroundUrl);
      productImg.src = productBase64;
    };
    
    bgImg.onerror = () => {
      // If background fails, return product only or fallback
      resolve(productBase64);
    };

    bgImg.src = backgroundUrl;
  });
};

/**
 * Convert a base64 data URI to the specified output format (jpg or png).
 * If already in the target format, returns as-is.
 */
export const convertImageFormat = (dataUri: string, format: 'jpg' | 'png'): Promise<string> => {
  const targetMime = format === 'png' ? 'image/png' : 'image/jpeg';
  // If already correct format, return as-is
  if (dataUri.startsWith(`data:${targetMime}`)) return Promise.resolve(dataUri);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUri); return; }
      ctx.drawImage(img, 0, 0);
      try {
        const converted = canvas.toDataURL(targetMime, format === 'jpg' ? 0.92 : undefined);
        resolve(converted);
      } catch {
        resolve(dataUri);
      }
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
};

/**
 * Extract the center region of an image for texture detail emphasis.
 * Returns a cropped PNG data URI of the center portion at full resolution.
 */
export const extractTextureCrop = (dataUri: string, cropRatio = 0.4): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cropW = Math.round(img.width * cropRatio);
      const cropH = Math.round(img.height * cropRatio);
      const x = Math.round((img.width - cropW) / 2);
      const y = Math.round((img.height - cropH) / 2);
      
      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUri); return; }
      
      ctx.drawImage(img, x, y, cropW, cropH, 0, 0, cropW, cropH);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUri);
      }
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
};

/**
 * Compress image for API while preserving PNG format for texture references.
 * Uses PNG compression for material swatches to avoid JPEG texture degradation.
 */
export const compressImagePreservePng = (dataUri: string, maxSizeBytes = 7 * 1024 * 1024): Promise<string> => {
  const base64Part = dataUri.split(',')[1] || '';
  const estimatedBytes = Math.round(base64Part.length * 3 / 4);
  if (estimatedBytes <= maxSizeBytes) return Promise.resolve(dataUri);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Scale down if needed rather than lossy JPEG compression
      let w = img.width, h = img.height;
      const ratio = Math.sqrt(maxSizeBytes / estimatedBytes) * 0.9;
      if (ratio < 1) { w = Math.round(w * ratio); h = Math.round(h * ratio); }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUri); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const result = canvas.toDataURL('image/png');
        resolve(result);
      } catch {
        resolve(dataUri);
      }
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
};

/**
 * Ensure a base64 data URI image is under the API size limit (7MB).
 * Only compresses if the image exceeds the limit; preserves original dimensions.
 */
export const compressImageForApi = (dataUri: string, maxSizeBytes = 7 * 1024 * 1024): Promise<string> => {
  // Quick check: estimate base64 decoded size (base64 is ~4/3 of raw)
  const base64Part = dataUri.split(',')[1] || '';
  const estimatedBytes = Math.round(base64Part.length * 3 / 4);
  if (estimatedBytes <= maxSizeBytes) {
    return Promise.resolve(dataUri); // Already under limit, no compression needed
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUri); return; }
      ctx.drawImage(img, 0, 0);

      // Progressively reduce JPEG quality until under limit
      let quality = 0.92;
      let result = dataUri;
      try {
        while (quality >= 0.3) {
          result = canvas.toDataURL('image/jpeg', quality);
          const resultBase64 = result.split(',')[1] || '';
          const resultBytes = Math.round(resultBase64.length * 3 / 4);
          if (resultBytes <= maxSizeBytes) {
            console.log(`Image compressed to fit API limit: ${Math.round(estimatedBytes / 1024)}KB -> ${Math.round(resultBytes / 1024)}KB (quality=${quality.toFixed(2)}, ${img.width}x${img.height})`);
            resolve(result);
            return;
          }
          quality -= 0.1;
        }
        // Last resort: return whatever we got at lowest quality
        console.warn(`Image still over ${maxSizeBytes / (1024*1024)}MB after max compression, sending anyway.`);
        resolve(result);
      } catch {
        resolve(dataUri);
      }
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
};

// --- IndexedDB History Management ---
import { Message } from './types';

const DB_NAME = 'LyraStudioDB';
const STORE_NAME = 'messages';
const DB_VERSION = 2; // Bump version to ensure store creation logic runs if needed
const MAX_HISTORY_MESSAGES = 80; // Limit to prevent Out of Memory crashes

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveMessageToDB = async (message: Message) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(message);
    
    // Explicitly return a promise that resolves when the transaction completes
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save message to DB', err);
  }
};

export const getHistoryFromDB = async (): Promise<Message[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result as Message[];
        if (results && results.length > 0) {
            // Sort by ID to ensure chronological order
            results.sort((a, b) => a.id - b.id);
            // Only return the most recent messages to prevent Out of Memory
            if (results.length > MAX_HISTORY_MESSAGES) {
                const trimmed = results.slice(-MAX_HISTORY_MESSAGES);
                // Clean up old entries from DB asynchronously
                pruneOldMessages(results.slice(0, results.length - MAX_HISTORY_MESSAGES).map(m => m.id));
                resolve(trimmed);
            } else {
                resolve(results);
            }
        } else {
            resolve([]);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load history, clearing corrupted DB', err);
    // If loading fails (e.g., corrupted data), clear DB to recover
    try { await clearHistoryDB(); } catch (_) {}
    return [];
  }
};

// Remove old messages from DB to free storage
const pruneOldMessages = async (idsToRemove: number[]) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const id of idsToRemove) {
      store.delete(id);
    }
  } catch (err) {
    console.error('Failed to prune old messages', err);
  }
};

export const clearHistoryDB = async () => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to clear history', err);
  }
};

// --- Google Drive Integration ---

// Declare global Google API variables
declare var gapi: any;
declare var google: any;

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FILE_NAME = 'lyra_chat_history.json';

// NOTE: We need a placeholder here. In a real app, you'd use a real Client ID.
// For the user's specific request, we will allow them to input it in the UI or use a stored one.
export const DEFAULT_CLIENT_ID = ''; 

export interface DriveFile {
  id: string;
  name: string;
}

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

/**
 * Initialize Google API Client (GAPI)
 */
export const initGapiClient = async (apiKey: string) => {
    if (gapiInited) return;
    return new Promise<void>((resolve, reject) => {
        // @ts-ignore
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: apiKey,
                    discoveryDocs: [DISCOVERY_DOC],
                });
                gapiInited = true;
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    });
};

/**
 * Initialize Google Identity Services (GIS)
 */
export const initGisClient = (clientId: string, callback: (response: any) => void) => {
    if (gisInited && tokenClient) return tokenClient;
    
    // @ts-ignore
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (resp: any) => {
             if (resp.error) {
                 console.error("GIS Error:", resp);
                 throw resp;
             }
             callback(resp);
        },
    });
    gisInited = true;
    return tokenClient;
};

/**
 * Trigger the Auth flow
 */
export const requestAccessToken = () => {
    if (!tokenClient) throw new Error("Token Client not initialized");
    tokenClient.requestAccessToken({ prompt: 'consent' });
};

/**
 * Find the history file in Drive
 */
export const findHistoryFile = async (): Promise<DriveFile | null> => {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name = '${DRIVE_FILE_NAME}' and trashed = false`,
            fields: 'files(id, name)',
        });
        const files = response.result.files;
        if (files && files.length > 0) {
            return files[0] as DriveFile;
        }
        return null;
    } catch (err) {
        console.error("Error finding file:", err);
        return null;
    }
};

/**
 * Create a new history file in Drive
 */
export const createHistoryFile = async (content: string): Promise<string> => {
    const fileContent = new Blob([content], { type: 'application/json' });
    const metadata = {
        name: DRIVE_FILE_NAME,
        mimeType: 'application/json',
    };

    const accessToken = gapi.client.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }) as any);
    form.append('file', fileContent as any);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
        body: form,
    });
    const val = await res.json();
    return val.id;
};

/**
 * Update existing file in Drive
 */
export const updateHistoryFile = async (fileId: string, content: string) => {
    const fileContent = new Blob([content], { type: 'application/json' });
    const metadata = {
        mimeType: 'application/json',
    };

    const accessToken = gapi.client.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }) as any);
    form.append('file', fileContent as any);

    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
        method: 'PATCH',
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
        body: form,
    });
};

/**
 * Read file content
 */
export const getFileContent = async (fileId: string): Promise<Message[]> => {
    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
    });
    return response.result as Message[];
};