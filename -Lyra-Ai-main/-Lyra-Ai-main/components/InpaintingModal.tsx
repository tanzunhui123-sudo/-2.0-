import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, Brush, Undo, Check, Sliders, Palette, Upload, User, Trash2, Layers } from 'lucide-react';

interface InpaintingModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onGenerate: (maskBase64: string, prompt: string, referenceImage?: string, materialImage?: string) => void;
}

const MASK_COLORS = [
  { hex: '#ef4444', name: 'Red' },    // Red
  { hex: '#3b82f6', name: 'Blue' },   // Blue
  { hex: '#22c55e', name: 'Green' },  // Green
  { hex: '#eab308', name: 'Yellow' }, // Yellow
  { hex: '#a855f7', name: 'Purple' }, // Purple
  { hex: '#ffffff', name: 'White' },  // White
];

const InpaintingModal: React.FC<InpaintingModalProps> = ({ isOpen, onClose, imageUrl, onGenerate }) => {
  const [prompt, setPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(40);
  const [brushColor, setBrushColor] = useState('#ef4444'); // Default to Red for high visibility
  const [isEraser, setIsEraser] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Reference Images State (Character)
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [selectedRefIndex, setSelectedRefIndex] = useState<number | null>(null);

  // Reference Images State (Material)
  const [materialImages, setMaterialImages] = useState<string[]>([]);
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const matInputRef = useRef<HTMLInputElement>(null);

  // Initialize canvas resolution when image loads
  const initCanvas = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    // Set internal resolution to match natural image size 1:1
    // This allows drawing at full resolution regardless of display size
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
    }

    // Clear canvas (transparent)
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }
  };

  useEffect(() => {
     if (isOpen && imgRef.current && imgRef.current.complete) {
         initCanvas();
     }
  }, [isOpen, imageUrl]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const hexToRgba = (hex: string, alpha: number) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      draw(e);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      ctx.lineWidth = brushSize * (canvasRef.current.width / 1000 * 2.5); // Scale brush relative to image size
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Use 50% opacity (0.5 alpha) as requested to see underlying image
      ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : hexToRgba(brushColor, 0.5); 
      
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.closePath();
  };

  const handleClear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // --- Character Reference Handlers ---
  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    fileArray.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setReferenceImages(prev => {
                const newArr = [...prev, reader.result as string];
                // Auto-select if none selected and no material selected
                if (selectedRefIndex === null && selectedMaterialIndex === null) {
                    setSelectedRefIndex(newArr.length - 1);
                }
                return newArr;
            });
            // Clear material selection to avoid conflict
            setSelectedMaterialIndex(null);
        };
        reader.readAsDataURL(file as any);
    });
    e.target.value = '';
  };

  const removeReference = (idx: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setReferenceImages(prev => prev.filter((_, i) => i !== idx));
      if (selectedRefIndex === idx) setSelectedRefIndex(null);
  };

  // --- Material Reference Handlers ---
  const handleMaterialUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    fileArray.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setMaterialImages(prev => {
                const newArr = [...prev, reader.result as string];
                // Auto-select
                if (selectedMaterialIndex === null) {
                    setSelectedMaterialIndex(newArr.length - 1);
                }
                return newArr;
            });
            // Clear character selection to avoid conflict (mutually exclusive usually)
            setSelectedRefIndex(null);
        };
        reader.readAsDataURL(file as any);
    });
    e.target.value = '';
  };

  const removeMaterial = (idx: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setMaterialImages(prev => prev.filter((_, i) => i !== idx));
      if (selectedMaterialIndex === idx) setSelectedMaterialIndex(null);
  };

  const handleSubmit = () => {
    if (!canvasRef.current || !prompt.trim()) return;
    
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // 1. Create a "Shape" canvas: Convert user's multicolor drawing to pure White (Mask)
    const shapeCanvas = document.createElement('canvas');
    shapeCanvas.width = width;
    shapeCanvas.height = height;
    const shapeCtx = shapeCanvas.getContext('2d');
    
    if (shapeCtx) {
        // Draw the current artwork
        shapeCtx.drawImage(canvasRef.current, 0, 0);
        
        // Use composite operation to turn ALL opaque pixels (regardless of color) to White
        shapeCtx.globalCompositeOperation = 'source-in';
        shapeCtx.fillStyle = '#FFFFFF';
        shapeCtx.fillRect(0, 0, width, height);
    }

    // 2. Composite the White Shape onto a Black Background
    const finalMaskCanvas = document.createElement('canvas');
    finalMaskCanvas.width = width;
    finalMaskCanvas.height = height;
    const finalCtx = finalMaskCanvas.getContext('2d');
    if (finalCtx) {
        // Black Background (Keep area)
        finalCtx.fillStyle = '#000000';
        finalCtx.fillRect(0, 0, width, height);
        
        // Draw the white shape (Modify area)
        // Draw multiple times to ensure high contrast/opacity if original strokes were semi-transparent
        if (shapeCanvas) {
            finalCtx.drawImage(shapeCanvas, 0, 0);
            finalCtx.drawImage(shapeCanvas, 0, 0);
            finalCtx.drawImage(shapeCanvas, 0, 0);
            // Draw a few more times because the source was 50% opacity
            finalCtx.drawImage(shapeCanvas, 0, 0);
            finalCtx.drawImage(shapeCanvas, 0, 0);
        }
    }

    // Get selected reference images
    const activeCharRef = selectedRefIndex !== null ? referenceImages[selectedRefIndex] : undefined;
    const activeMatRef = selectedMaterialIndex !== null ? materialImages[selectedMaterialIndex] : undefined;

    onGenerate(finalMaskCanvas.toDataURL('image/png'), prompt, activeCharRef, activeMatRef);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-white">
            <Brush className="text-indigo-400" size={20} />
            <h2 className="font-semibold text-lg">Magic Editor - 局部重绘 & 材质置换</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={24} />
        </button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden w-full h-full relative">
         <div className="relative inline-flex shadow-2xl rounded-lg overflow-hidden border border-slate-700/50">
            {/* Background Image */}
            <img 
                ref={imgRef}
                src={imageUrl} 
                alt="Target" 
                className="max-w-full max-h-[70vh] w-auto h-auto block select-none"
                draggable={false}
                onLoad={initCanvas}
            />
            {/* Drawing Canvas Overlay */}
            <canvas 
                ref={canvasRef}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
         </div>
      </div>

      {/* Controls Footer */}
      <div className="bg-slate-900 border-t border-slate-800 p-6 pb-8">
         <div className="max-w-6xl mx-auto flex flex-col gap-6">
            
            {/* Reference Area (Split) */}
            <div className="flex flex-col md:flex-row gap-6">
                
                {/* Character Ref */}
                <div className="flex-1 flex flex-col gap-2">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <User size={14} /> 人物参照 (Character)
                        </span>
                     </div>
                     <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide min-h-[80px]">
                        <input type="file" ref={refInputRef} onChange={handleReferenceUpload} className="hidden" accept="image/*" multiple />
                        <button 
                            onClick={() => refInputRef.current?.click()}
                            className="w-16 h-16 rounded-lg border border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-800 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-indigo-400 transition-all flex-shrink-0"
                        >
                            <Upload size={16} /><span className="text-[9px]">添加</span>
                        </button>
                        {referenceImages.map((img, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => { setSelectedRefIndex(idx); setSelectedMaterialIndex(null); }}
                                className={`relative w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 group ${selectedRefIndex === idx ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-700 hover:border-slate-500'}`}
                            >
                                <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                                <button onClick={(e) => removeReference(idx, e)} className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl opacity-0 group-hover:opacity-100"><X size={10} /></button>
                            </div>
                        ))}
                     </div>
                </div>

                {/* Vertical Divider */}
                <div className="w-px bg-slate-800 hidden md:block"></div>

                {/* Material Ref */}
                <div className="flex-1 flex flex-col gap-2">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Layers size={14} /> 材质参照 (Material Texture)
                        </span>
                     </div>
                     <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide min-h-[80px]">
                        <input type="file" ref={matInputRef} onChange={handleMaterialUpload} className="hidden" accept="image/*" multiple />
                        <button 
                            onClick={() => matInputRef.current?.click()}
                            className="w-16 h-16 rounded-lg border border-dashed border-slate-700 hover:border-pink-500 hover:bg-slate-800 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-pink-400 transition-all flex-shrink-0"
                        >
                            <Upload size={16} /><span className="text-[9px]">材质</span>
                        </button>
                        {materialImages.map((img, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => { setSelectedMaterialIndex(idx); setSelectedRefIndex(null); }}
                                className={`relative w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 group ${selectedMaterialIndex === idx ? 'border-pink-500 ring-2 ring-pink-500/30' : 'border-slate-700 hover:border-slate-500'}`}
                            >
                                <img src={img} alt={`Mat ${idx}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-pink-500/10 pointer-events-none"></div>
                                <button onClick={(e) => removeMaterial(idx, e)} className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl opacity-0 group-hover:opacity-100"><X size={10} /></button>
                            </div>
                        ))}
                     </div>
                </div>

            </div>

            <div className="h-px bg-slate-800 w-full" />

            {/* Bottom Row: Brush Tools & Prompt */}
            <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-center xl:justify-start">
                    {/* Tool Toggle */}
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button 
                            onClick={() => setIsEraser(false)}
                            className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition-all ${!isEraser ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Brush size={16} /> <span className="hidden sm:inline">涂抹</span>
                        </button>
                        <button 
                            onClick={() => setIsEraser(true)}
                            className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition-all ${isEraser ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Eraser size={16} /> <span className="hidden sm:inline">擦除</span>
                        </button>
                    </div>

                    {/* Color Palette */}
                    <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-2 border border-slate-700">
                       {MASK_COLORS.map(c => (
                         <button
                           key={c.hex}
                           onClick={() => { setBrushColor(c.hex); setIsEraser(false); }}
                           className={`w-6 h-6 rounded-full border-2 transition-all shadow-sm ${brushColor === c.hex && !isEraser ? 'border-white scale-110' : 'border-transparent hover:scale-110'}`}
                           style={{ backgroundColor: c.hex }}
                           title={c.name}
                         />
                       ))}
                    </div>

                    {/* Brush Size */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 min-w-[120px]">
                        <Sliders size={16} className="text-slate-400" />
                        <input 
                            type="range" 
                            min="5" 
                            max="100" 
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            className="w-24 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>

                    <button onClick={handleClear} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg" title="Clear Mask">
                        <Undo size={20} />
                    </button>
                </div>
                
                {/* Prompt Input Group */}
                <div className="flex gap-3 w-full xl:w-auto flex-1 xl:max-w-2xl">
                    <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={selectedRefIndex !== null ? "人物模式: 描述动作 (如 '站立')..." : (selectedMaterialIndex !== null ? "材质模式: 描述材质 (如 '红色天鹅绒')..." : "局部重绘: 描述修改内容...")}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                    <button 
                        onClick={handleSubmit}
                        disabled={!prompt.trim()}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
                    >
                        <Check size={18} />
                        <span className="whitespace-nowrap hidden sm:inline">生成</span>
                        <span className="sm:hidden">GO</span>
                    </button>
                </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export default InpaintingModal;