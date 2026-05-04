import React, { useState, useRef } from 'react';
import {
  Upload, Loader2, Download, X, Check, Wand2,
  Languages, Scissors, ZoomIn, RotateCcw, AlertTriangle
} from 'lucide-react';

// ===== Types =====
type AngleId = 'front' | 'frontside' | 'side' | 'backside' | 'back' | 'top' | 'bottom' | 'diagonal' | 'closeup';

interface ResultItem {
  id: string;
  label: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  imageUrl?: string;
  error?: string;
  originalUrl?: string; // for before/after
}

// ===== Constants =====
const PRESET_ANGLES: { id: AngleId; label: string; angle: string; prompt: string }[] = [
  { id: 'front',     label: '正前方',   angle: '0°',          prompt: 'exact front view, straight-on 0-degree, one-point perspective, perfectly centered and symmetric' },
  { id: 'frontside', label: '前侧方',   angle: '45°',         prompt: 'three-quarter front view, 45-degree angle, showing depth and dimension' },
  { id: 'side',      label: '侧面',     angle: '90°',         prompt: 'strict 90-degree side profile, exact lateral perspective' },
  { id: 'backside',  label: '后侧方',   angle: '135°',        prompt: 'three-quarter rear view, 135-degree back-side perspective' },
  { id: 'back',      label: '正后方',   angle: '180°',        prompt: 'exact rear view, 180-degree back perspective, straight-on back' },
  { id: 'top',       label: '俯视',     angle: '0°/55°',      prompt: "bird's eye overhead view, 55-degree top-down perspective looking down" },
  { id: 'bottom',    label: '仰视',     angle: '0°/-40°',     prompt: "worm's eye view, low-angle upward looking, -40 degree vertical tilt" },
  { id: 'diagonal',  label: '侧前斜角', angle: '45°/35°',     prompt: 'dynamic diagonal angle, 45-degree horizontal 35-degree vertical tilt' },
  { id: 'closeup',   label: '正面近景', angle: '0°/10°/1.6x', prompt: 'front close-up view, 10-degree slight upward tilt, 1.6x zoom magnification, emphasizing details and texture' },
];

const LANGUAGES = [
  { id: 'zh', label: '中文',     name: 'Simplified Chinese' },
  { id: 'en', label: '英语',     name: 'English' },
  { id: 'ja', label: '日语',     name: 'Japanese' },
  { id: 'ko', label: '韩语',     name: 'Korean' },
  { id: 'fr', label: '法语',     name: 'French' },
  { id: 'de', label: '德语',     name: 'German' },
  { id: 'es', label: '西班牙语', name: 'Spanish' },
  { id: 'ar', label: '阿拉伯语', name: 'Arabic' },
];

const REMOVE_BG_MODELS = [
  { id: 'bria-rmbg-2.0',     name: '快速去背景（默认）' },
  { id: 'birefnet',          name: 'BiRefNet 精细抠图' },
];

const UPSCALE_MODELS = [
  { id: 'clarity-upscaler',   name: '商品图增强（默认）' },
  { id: 'real-esrgan-x4plus', name: 'Real-ESRGAN 超分' },
];

// ===== Helper =====
const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ===== Shared Upload Area =====
function UploadArea({ images, onAdd, onRemove, maxCount = 5 }: {
  images: string[];
  onAdd: (imgs: string[]) => void;
  onRemove: (idx: number) => void;
  maxCount?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const processFiles = async (files: FileList | File[]) => {
    const remaining = maxCount - images.length;
    const arr = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, remaining);
    const results = await Promise.all(arr.map(readFileAsBase64));
    if (results.length) onAdd(results);
  };

  return (
    <div>
      {images.length === 0 ? (
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
        >
          <Upload size={28} className="mx-auto mb-2 text-slate-400" />
          <p className="text-sm font-medium text-slate-500">点击或拖拽上传图片</p>
          <p className="text-xs text-slate-400 mt-1">支持 JPG、PNG、WEBP，单张最大 10MB，最多 {maxCount} 张</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group aspect-square">
              <img src={img} alt="" className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
              <button
                onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
              ><X size={10} /></button>
            </div>
          ))}
          {images.length < maxCount && (
            <button
              onClick={() => inputRef.current?.click()}
              className="aspect-square border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-400 transition-colors"
            >
              <Upload size={18} />
            </button>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => { if (e.target.files) { await processFiles(e.target.files); e.target.value = ''; } }}
      />
    </div>
  );
}

// ===== Shared Result Card =====
function ResultCard({ item, angleDef }: { item: ResultItem; angleDef?: { angle: string } }) {
  return (
    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden group">
      <div className="aspect-square relative bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        {item.status === 'done' && item.imageUrl ? (
          <>
            <img src={item.imageUrl} alt={item.label} className="w-full h-full object-contain" />
            <a
              href={item.imageUrl}
              download={`${item.label}.jpg`}
              target="_blank"
              rel="noreferrer"
              className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => e.stopPropagation()}
            ><Download size={14} /></a>
          </>
        ) : item.status === 'generating' ? (
          <div className="flex flex-col items-center gap-2 text-indigo-500">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-xs font-medium">生成中...</span>
          </div>
        ) : item.status === 'error' ? (
          <div className="text-center px-3 py-4">
            <AlertTriangle size={24} className="mx-auto text-red-400 mb-1" />
            <p className="text-xs text-red-500 leading-snug">{item.error || '生成失败'}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <Loader2 size={14} className="text-slate-300" />
            </div>
            <span className="text-xs text-slate-400">等待中</span>
          </div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.label}</div>
          {angleDef && <div className="text-[10px] text-slate-400">{angleDef.angle}</div>}
        </div>
        {item.status === 'done' && item.imageUrl && (
          <a href={item.imageUrl} download={`${item.label}.jpg`} target="_blank" rel="noreferrer"
            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
            <Download size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

// ===== Shared Before/After Card =====
function BeforeAfterCard({ item }: { item: ResultItem }) {
  return (
    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex gap-0 divide-x divide-slate-200 dark:divide-slate-800">
        {/* Before */}
        <div className="flex-1 relative">
          <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">原图</div>
          <img src={item.originalUrl} alt="原图" className="w-full aspect-square object-contain bg-slate-50 dark:bg-slate-900" />
        </div>
        {/* After */}
        <div className="flex-1 relative">
          <div className="absolute top-2 left-2 bg-indigo-600/80 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">处理后</div>
          {item.status === 'done' && item.imageUrl ? (
            <>
              <img src={item.imageUrl} alt="结果" className="w-full aspect-square object-contain bg-slate-50 dark:bg-slate-900" />
              <a href={item.imageUrl} download={`${item.label}.png`} target="_blank" rel="noreferrer"
                className="absolute bottom-2 right-2 p-2 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 transition-colors">
                <Download size={14} />
              </a>
            </>
          ) : item.status === 'generating' ? (
            <div className="w-full aspect-square bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-indigo-500">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-xs">处理中...</span>
              </div>
            </div>
          ) : item.status === 'error' ? (
            <div className="w-full aspect-square bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
              <div className="text-center px-3">
                <AlertTriangle size={20} className="mx-auto text-red-400 mb-1" />
                <p className="text-xs text-red-500">{item.error}</p>
              </div>
            </div>
          ) : (
            <div className="w-full aspect-square bg-slate-50 dark:bg-slate-900" />
          )}
        </div>
      </div>
      <div className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">{item.label}</div>
    </div>
  );
}

// ===== Main Props =====
export interface ImageToolsPanelProps {
  mode: 'multiAngle' | 'imageTranslate' | 'removeBg' | 'upscale';
  apiProvider: 'google' | 'kie' | 'custom';
  imageModels: { id: string; name: string }[];
  selectedImageModel: string;
  onImageModelChange: (modelId: string) => void;
  onGenerateImage: (prompt: string, images: string[], options: { aspectRatio: string; resolution: string; outputFormat: string; isMask?: boolean }) => Promise<string | null>;
  onGenerateText: (prompt: string, images: string[]) => Promise<string>;
  onKieTask: (model: string, input: any) => Promise<string[] | null>;
  onKieUpload: (base64: string) => Promise<string>;
}

// ===== Page Shell =====
function PageShell({ title, icon, description, left, right }: {
  title: string; icon: React.ReactNode; description: string;
  left: React.ReactNode; right: React.ReactNode;
}) {
  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900">
      <div className="w-80 flex-shrink-0 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-y-auto">
        <div className="p-5 flex-1 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {icon} {title}
            </h2>
            <p className="text-xs text-slate-400 mt-1">{description}</p>
          </div>
          {left}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">{right}</div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="mb-4 opacity-20">{icon}</div>
        <p className="text-slate-400 text-sm">{text}</p>
      </div>
    </div>
  );
}

// ===== 1. Multi-Angle Tool =====
function MultiAngleTool(props: ImageToolsPanelProps) {
  const { imageModels, selectedImageModel, onImageModelChange, onGenerateImage, apiProvider } = props;
  const [images, setImages] = useState<string[]>([]);
  // Default: no angles selected — user explicitly picks what they want
  const [selectedAngles, setSelectedAngles] = useState<AngleId[]>([]);
  const [resolution, setResolution] = useState<string>('2K');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleAngle = (id: AngleId) =>
    setSelectedAngles(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);

  const handleGenerate = async () => {
    if (!images.length || !selectedAngles.length) return;
    setIsGenerating(true);

    // Snapshot the selected angles at click time to avoid stale closure
    const angleDefs = PRESET_ANGLES.filter(a => selectedAngles.includes(a.id));

    // Initialise all as pending
    setResults(angleDefs.map(a => ({ id: a.id, label: a.label, status: 'pending' })));

    // Fire all requests concurrently
    await Promise.all(
      angleDefs.map(async (a) => {
        setResults(prev => prev.map(r => r.id === a.id ? { ...r, status: 'generating' } : r));
        try {
          const prompt = `Generate a photorealistic product photograph from this exact camera angle.

CAMERA ANGLE: ${a.prompt}

PRODUCT REQUIREMENTS:
- Product must be IDENTICAL to the reference image(s): same model, color, material, branding, design
- Only the camera perspective changes — nothing else about the product
- Preserve all surface textures, materials, labels, and product features exactly

SCENE: Clean white or light gray studio background, professional even lighting, no harsh shadows
OUTPUT: Commercial product photograph, high resolution, photorealistic`;

          const url = await onGenerateImage(prompt, images, { aspectRatio, resolution, outputFormat: 'jpg' });
          setResults(prev => prev.map(r => r.id === a.id
            ? { ...r, status: url ? 'done' : 'error', imageUrl: url || undefined, error: url ? undefined : '生成失败' }
            : r));
        } catch (e: any) {
          setResults(prev => prev.map(r => r.id === a.id ? { ...r, status: 'error', error: e.message || '生成失败' } : r));
        }
      })
    );

    setIsGenerating(false);
  };

  const ratios = ['1:1', '3:4', '4:3', '9:16', '16:9'];

  return (
    <PageShell
      title="多角度生成"
      icon={<RotateCcw size={18} className="text-sky-500" />}
      description="勾选需要的角度，点击「开始生成」，所有角度并发生成"
      left={
        <>
          <UploadArea
            images={images}
            onAdd={imgs => setImages(prev => [...prev, ...imgs].slice(0, 5))}
            onRemove={i => setImages(prev => prev.filter((_, idx) => idx !== i))}
            maxCount={5}
          />

          {apiProvider === 'kie' && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">模型</div>
              <select value={selectedImageModel} onChange={e => onImageModelChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200">
                {imageModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">分辨率</div>
            <div className="flex gap-2">
              {(['1K', '2K', '4K'] as const).map(r => (
                <button key={r} onClick={() => setResolution(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${resolution === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">尺寸比例</div>
            <div className="grid grid-cols-3 gap-1.5">
              {ratios.map(r => (
                <button key={r} onClick={() => setAspectRatio(r)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${aspectRatio === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                选择角度
                <span className="ml-2 font-normal text-indigo-600">
                  {selectedAngles.length > 0 ? `已选 ${selectedAngles.length} 个` : '点击勾选'}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedAngles(PRESET_ANGLES.map(a => a.id))} className="text-[10px] text-indigo-600 hover:underline font-medium">全选</button>
                <span className="text-slate-300">·</span>
                <button onClick={() => setSelectedAngles([])} className="text-[10px] text-slate-400 hover:underline">清空</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_ANGLES.map(a => {
                const sel = selectedAngles.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAngle(a.id)}
                    className={`relative p-2 rounded-lg border-2 text-center transition-all select-none ${
                      sel
                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    {sel && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-white/30 rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                    <div className={`text-xs font-semibold ${sel ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{a.label}</div>
                    <div className={`text-[10px] mt-0.5 ${sel ? 'text-indigo-100' : 'text-slate-400'}`}>{a.angle}</div>
                  </button>
                );
              })}
            </div>
            {selectedAngles.length === 0 && (
              <p className="text-[10px] text-amber-500 mt-2 text-center">请至少选择 1 个角度</p>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={!images.length || !selectedAngles.length || isGenerating}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            {isGenerating
              ? <><Loader2 size={16} className="animate-spin" />并发生成中...</>
              : <><Wand2 size={16} />生成 {selectedAngles.length} 张角度图</>
            }
          </button>
        </>
      }
      right={
        results.length === 0
          ? <EmptyState icon={<RotateCcw size={56} />} text="上传产品图，勾选所需角度后点击「生成」" />
          : (
            <div className="grid grid-cols-3 gap-4">
              {results.map(r => (
                <ResultCard key={r.id} item={r} angleDef={PRESET_ANGLES.find(a => a.id === r.id)} />
              ))}
            </div>
          )
      }
    />
  );
}

// ===== 2. Image Translate Tool =====
function ImageTranslateTool(props: ImageToolsPanelProps) {
  const { imageModels, selectedImageModel, onImageModelChange, onGenerateImage, onGenerateText, apiProvider } = props;
  const [images, setImages] = useState<string[]>([]);
  const [targetLang, setTargetLang] = useState('en');
  const [resolution, setResolution] = useState('2K');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleTranslate = async () => {
    if (!images.length) return;
    setIsGenerating(true);
    const items: ResultItem[] = images.map((_, i) => ({
      id: genId(), label: `图片 ${i + 1}`, status: 'pending', originalUrl: images[i]
    }));
    setResults(items);

    const langName = LANGUAGES.find(l => l.id === targetLang)?.name || targetLang;

    for (let i = 0; i < images.length; i++) {
      const item = items[i];
      setResults(prev => prev.map(r => r.id === item.id ? { ...r, status: 'generating' } : r));
      try {
        // Step 1: Analyze image text
        let textAnalysis = '';
        try {
          textAnalysis = await onGenerateText(
            `Analyze this image and identify ALL visible text content. List each text element with its approximate position, font style, and color. Return concise structured info.`,
            [images[i]]
          );
        } catch (_) { /* ok to fail, use generic prompt */ }

        // Step 2: Generate translated image
        const prompt = `You are translating a product/marketing image. Keep the EXACT same visual layout, design, and style.

TARGET LANGUAGE: ${langName}

TRANSLATION TASK:
- Replace ALL visible text in the image with accurate ${langName} translations
- Keep exactly the same font style, size proportions, color, and positioning for each text element
- Keep all visual elements (images, backgrounds, icons, borders, decorations) completely unchanged
- Translations must sound natural and professional in ${langName}
- Preserve text hierarchy: headings stay as headings, body text stays as body text${textAnalysis ? `\n\nText elements identified:\n${textAnalysis.slice(0, 600)}` : ''}

OUTPUT: Photorealistic recreation of the exact same image with translated text`;

        const url = await onGenerateImage(prompt, [images[i]], { aspectRatio: 'auto', resolution, outputFormat: 'jpg' });
        setResults(prev => prev.map(r => r.id === item.id
          ? { ...r, status: url ? 'done' : 'error', imageUrl: url || undefined, error: url ? undefined : '翻译失败' }
          : r));
      } catch (e: any) {
        setResults(prev => prev.map(r => r.id === item.id ? { ...r, status: 'error', error: e.message || '翻译失败' } : r));
      }
    }
    setIsGenerating(false);
  };

  return (
    <PageShell
      title="图片翻译"
      icon={<Languages size={18} className="text-violet-500" />}
      description="识别图片中的文案，保持排版不变，翻译为目标语言"
      left={
        <>
          <UploadArea
            images={images}
            onAdd={imgs => setImages(prev => [...prev, ...imgs].slice(0, 20))}
            onRemove={i => setImages(prev => prev.filter((_, idx) => idx !== i))}
            maxCount={20}
          />

          {apiProvider === 'kie' && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">模型</div>
              <select value={selectedImageModel} onChange={e => onImageModelChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200">
                {imageModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">分辨率</div>
            <div className="flex gap-2">
              {(['1K', '2K', '4K'] as const).map(r => (
                <button key={r} onClick={() => setResolution(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${resolution === r ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 hover:border-violet-300'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">目标语言</div>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map(l => (
                <button key={l.id} onClick={() => setTargetLang(l.id)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${targetLang === l.id ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300'}`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleTranslate}
            disabled={!images.length || isGenerating}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            {isGenerating ? <><Loader2 size={16} className="animate-spin" />翻译中...</> : <><Languages size={16} />开始翻译</>}
          </button>
        </>
      }
      right={
        results.length === 0
          ? <EmptyState icon={<Languages size={56} />} text="上传图片并选择目标语言后，点击「开始翻译」" />
          : (
            <div className="grid grid-cols-2 gap-5">
              {results.map(r => <BeforeAfterCard key={r.id} item={r} />)}
            </div>
          )
      }
    />
  );
}

// ===== 3. Remove Background Tool =====
function RemoveBgTool(props: ImageToolsPanelProps) {
  const { onKieTask, onKieUpload, apiProvider } = props;
  const [images, setImages] = useState<string[]>([]);
  const [model, setModel] = useState(REMOVE_BG_MODELS[0].id);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleRemoveBg = async () => {
    if (!images.length) return;
    if (apiProvider !== 'kie') {
      alert('去除背景功能需要使用 KIE.ai API，请在设置中切换至 KIE.ai Provider');
      return;
    }
    setIsGenerating(true);
    const items: ResultItem[] = images.map((_, i) => ({
      id: genId(), label: `图片 ${i + 1}`, status: 'pending', originalUrl: images[i]
    }));
    setResults(items);

    for (let i = 0; i < images.length; i++) {
      const item = items[i];
      setResults(prev => prev.map(r => r.id === item.id ? { ...r, status: 'generating' } : r));
      try {
        const imageUrl = await onKieUpload(images[i]);
        const urls = await onKieTask(model, { image_url: imageUrl, output_format: 'png' });
        const result = urls?.[0] || null;
        setResults(prev => prev.map(r => r.id === item.id
          ? { ...r, status: result ? 'done' : 'error', imageUrl: result || undefined, error: result ? undefined : '去除背景失败，请重试' }
          : r));
      } catch (e: any) {
        setResults(prev => prev.map(r => r.id === item.id ? { ...r, status: 'error', error: e.message || '去除背景失败' } : r));
      }
    }
    setIsGenerating(false);
  };

  return (
    <PageShell
      title="去除背景"
      icon={<Scissors size={18} className="text-emerald-500" />}
      description="AI 智能抠图，精准去除背景，保留产品主体，输出 PNG 透明图"
      left={
        <>
          <UploadArea
            images={images}
            onAdd={imgs => setImages(prev => [...prev, ...imgs].slice(0, 5))}
            onRemove={i => setImages(prev => prev.filter((_, idx) => idx !== i))}
            maxCount={5}
          />

          {apiProvider !== 'kie' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">此功能需要 KIE.ai API，请在设置中切换 Provider</p>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">抠图模型</div>
            <select value={model} onChange={e => setModel(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-200">
              {REMOVE_BG_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">输出格式固定为 PNG（透明背景）</p>
          </div>

          <button
            onClick={handleRemoveBg}
            disabled={!images.length || isGenerating || apiProvider !== 'kie'}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            {isGenerating ? <><Loader2 size={16} className="animate-spin" />处理中...</> : <><Scissors size={16} />去除背景</>}
          </button>
        </>
      }
      right={
        results.length === 0
          ? <EmptyState icon={<Scissors size={56} />} text="上传图片后点击「去除背景」，产品主体将以 PNG 格式保留" />
          : (
            <div className="grid grid-cols-2 gap-5">
              {results.map(r => <BeforeAfterCard key={r.id} item={r} />)}
            </div>
          )
      }
    />
  );
}

// ===== 4. Upscale Tool =====
function UpscaleTool(props: ImageToolsPanelProps) {
  const { onKieTask, onKieUpload, apiProvider } = props;
  const [images, setImages] = useState<string[]>([]);
  const [model, setModel] = useState(UPSCALE_MODELS[0].id);
  const [scale, setScale] = useState<2 | 4>(4);
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpeg'>('jpeg');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleUpscale = async () => {
    if (!images.length) return;
    if (apiProvider !== 'kie') {
      alert('图片放大功能需要使用 KIE.ai API，请在设置中切换至 KIE.ai Provider');
      return;
    }
    setIsGenerating(true);
    const items: ResultItem[] = images.map((_, i) => ({
      id: genId(), label: `图片 ${i + 1}`, status: 'pending', originalUrl: images[i]
    }));
    setResults(items);

    for (let i = 0; i < images.length; i++) {
      const item = items[i];
      setResults(prev => prev.map(r => r.id === item.id ? { ...r, status: 'generating' } : r));
      try {
        const imageUrl = await onKieUpload(images[i]);
        const urls = await onKieTask(model, {
          image_url: imageUrl,
          scale,
          output_format: outputFormat,
        });
        const result = urls?.[0] || null;
        setResults(prev => prev.map(r => r.id === item.id
          ? { ...r, status: result ? 'done' : 'error', imageUrl: result || undefined, error: result ? undefined : '放大失败，请重试' }
          : r));
      } catch (e: any) {
        setResults(prev => prev.map(r => r.id === item.id ? { ...r, status: 'error', error: e.message || '放大失败' } : r));
      }
    }
    setIsGenerating(false);
  };

  return (
    <PageShell
      title="图片放大"
      icon={<ZoomIn size={18} className="text-orange-500" />}
      description="AI 高清修复与放大，提升分辨率，保留产品细节不变形"
      left={
        <>
          <UploadArea
            images={images}
            onAdd={imgs => setImages(prev => [...prev, ...imgs].slice(0, 5))}
            onRemove={i => setImages(prev => prev.filter((_, idx) => idx !== i))}
            maxCount={5}
          />

          {apiProvider !== 'kie' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">此功能需要 KIE.ai API，请在设置中切换 Provider</p>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">增强模型</div>
            <select value={model} onChange={e => setModel(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-slate-700 dark:text-slate-200">
              {UPSCALE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">放大倍率</div>
            <div className="flex gap-2">
              {([2, 4] as const).map(s => (
                <button key={s} onClick={() => setScale(s)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors ${scale === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 hover:border-orange-300'}`}>
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">输出格式</div>
            <div className="flex gap-2">
              {(['png', 'jpeg'] as const).map(f => (
                <button key={f} onClick={() => setOutputFormat(f)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border uppercase transition-colors ${outputFormat === f ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 hover:border-orange-300'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleUpscale}
            disabled={!images.length || isGenerating || apiProvider !== 'kie'}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            {isGenerating ? <><Loader2 size={16} className="animate-spin" />放大中...</> : <><ZoomIn size={16} />开始放大</>}
          </button>
        </>
      }
      right={
        results.length === 0
          ? <EmptyState icon={<ZoomIn size={56} />} text="上传图片并选择放大倍率，点击「开始放大」" />
          : (
            <div className="grid grid-cols-2 gap-5">
              {results.map(r => <BeforeAfterCard key={r.id} item={r} />)}
            </div>
          )
      }
    />
  );
}

// ===== Router =====
export default function ImageToolsPanel(props: ImageToolsPanelProps) {
  switch (props.mode) {
    case 'multiAngle':     return <MultiAngleTool {...props} />;
    case 'imageTranslate': return <ImageTranslateTool {...props} />;
    case 'removeBg':       return <RemoveBgTool {...props} />;
    case 'upscale':        return <UpscaleTool {...props} />;
    default:               return null;
  }
}
