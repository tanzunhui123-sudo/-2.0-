/**
 * Generates a mock analysis response based on selected parameters.
 */
export const generateMockAnalysisResponse = (mode: string, aspectRatio: string, resolution: string, viewAngle: string) => `### Step 1: 视觉解析 (Visual Analysis)
基于您上传的图片，我已完成深度拆解：

1. **核心主体 (The Subject):** 识别为一款现代 L 型落地沙发。材质为极具触感的**宽条纹灰色灯芯绒 (Wide-wale Grey Corduroy)**，纹理清晰立体。
2. **关键细节:** 靠背带有经典的拉扣 (Tufting) 设计；扶手外侧包裹着独特的**纤细金属框架**，且侧面设计有实用的**储物口袋**。
3. **风格定位:** 结合了现代工业风的利落与复古居家风的慵懒，适合营造 Modern Cozy 氛围。

### Step 2: 生成结构化提示词

\`\`\`markdown
专业室内摄影，现代舒适居家风格，${resolution}超清画质，光影质感。

(核心主体)：一款大型 L 型转角沙发，全包覆宽条纹灰色灯芯绒面料，质感蓬松柔软。靠垫带有拉扣 tufting 设计。独特的深色细金属框架包裹扶手外侧，扶手侧面带有实用的储物口袋细节。

(构图与视角)：35mm 镜头，${viewAngle}，聚焦沙发材质细节与整体形态。 --ar ${aspectRatio}

(环境背景)：${mode === 'remix' ? '保持产品主体不变，将背景替换为阳光房。' : '构建一个温暖的现代客厅场景。浅色橡木地板，米灰色微水泥墙面，大落地窗配白色透光纱帘。'}

(氛围与照明系统)：温暖的午后侧逆光 (Side-back lighting)，强调灯芯绒的绒毛感与金属框架的哑光光泽。

(配套软装)：圆形实木茶几，极简陶瓷花瓶，一本翻开的杂志，背景处有一株琴叶榕绿植。
\`\`\`
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

// --- IndexedDB History Management ---
import { Message } from './types';

const DB_NAME = 'LyraStudioDB';
const STORE_NAME = 'messages';
const DB_VERSION = 2; // Bump version to ensure store creation logic runs if needed

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
        // Sort by ID to ensure chronological order
        if (results) {
            results.sort((a, b) => a.id - b.id);
            resolve(results);
        } else {
            resolve([]);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load history', err);
    return [];
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
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

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
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

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