import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Plus, Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Check, Type, ChevronDown, MoveHorizontal
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextLayer {
  id: string;
  text: string;
  xPct: number;      // 0–100  (% of image width)
  yPct: number;      // 0–100  (% of image height)
  fontSize: number;  // px relative to 1000px reference width
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;    // multiplier, e.g. 1.4
  letterSpacing: number; // em, e.g. 0.05
  opacity: number;       // 0–100
}

interface TextEditorModalProps {
  imageUrl: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  { label: '无衬线 (Default)', value: 'sans-serif' },
  { label: '衬线 (Serif)', value: 'serif' },
  { label: '等宽 (Mono)', value: 'monospace' },
  { label: '微软雅黑', value: '"Microsoft YaHei", "微软雅黑", sans-serif' },
  { label: '宋体', value: '"SimSun", "宋体", serif' },
  { label: '黑体', value: '"SimHei", "黑体", sans-serif' },
  { label: '楷体', value: '"KaiTi", "楷体", serif' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
];

const PRESET_COLORS = [
  '#ffffff', '#000000', '#1a1a1a', '#555555', '#ff0000',
  '#ff6b35', '#ffd700', '#22c55e', '#3b82f6', '#a855f7',
  '#ec4899', '#f97316', '#06b6d4', '#84cc16',
];

const genId = () => `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const makeDefaultLayer = (): TextLayer => ({
  id: genId(),
  text: '在此输入文字',
  xPct: 50,
  yPct: 20,
  fontSize: 48,
  fontFamily: 'sans-serif',
  color: '#ffffff',
  bold: true,
  italic: false,
  textAlign: 'center',
  lineHeight: 1.3,
  letterSpacing: 0.02,
  opacity: 100,
});

// ─── Component ────────────────────────────────────────────────────────────────

export const TextEditorModal: React.FC<TextEditorModalProps> = ({ imageUrl, onSave, onClose }) => {
  const [layers, setLayers] = useState<TextLayer[]>([makeDefaultLayer()]);
  const [selectedId, setSelectedId] = useState<string | null>(layers[0].id);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  const previewRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const selected = layers.find(l => l.id === selectedId) || null;

  // ── Layer updates ─────────────────────────────────────────────────────────

  const updateLayer = useCallback(<K extends keyof TextLayer>(id: string, key: K, value: TextLayer[K]) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));
  }, []);

  const addLayer = () => {
    const nl = makeDefaultLayer();
    nl.yPct = Math.min(80, (layers.length * 12) + 10);
    setLayers(prev => [...prev, nl]);
    setSelectedId(nl.id);
  };

  const removeLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(layers.find(l => l.id !== id)?.id ?? null);
  };

  // ── Drag to reposition ────────────────────────────────────────────────────

  const handleTextMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    const rect = previewRef.current!.getBoundingClientRect();
    const layer = layers.find(l => l.id === id)!;
    const layerX = (layer.xPct / 100) * rect.width;
    const layerY = (layer.yPct / 100) * rect.height;
    setDragOffset({ dx: e.clientX - rect.left - layerX, dy: e.clientY - rect.top - layerY });
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !selectedId || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left - dragOffset.dx;
    const rawY = e.clientY - rect.top - dragOffset.dy;
    const xPct = Math.max(0, Math.min(100, (rawX / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, (rawY / rect.height) * 100));
    setLayers(prev => prev.map(l => l.id === selectedId ? { ...l, xPct, yPct } : l));
  }, [isDragging, selectedId, dragOffset]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const img = imgRef.current;
      if (!img) return;

      const w = img.naturalWidth;
      const h = img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // Draw base image
      ctx.drawImage(img, 0, 0, w, h);

      // Scale factor: fontSize is defined relative to 1000px width reference
      const scale = w / 1000;

      for (const layer of layers) {
        ctx.save();
        ctx.globalAlpha = layer.opacity / 100;
        ctx.textAlign = layer.textAlign as CanvasTextAlign;
        ctx.textBaseline = 'top';

        const scaledSize = Math.round(layer.fontSize * scale);
        const weight = layer.bold ? 'bold' : 'normal';
        const style = layer.italic ? 'italic' : 'normal';
        ctx.font = `${style} ${weight} ${scaledSize}px ${layer.fontFamily}`;
        ctx.fillStyle = layer.color;
        ctx.letterSpacing = `${layer.letterSpacing}em`;

        const x = (layer.xPct / 100) * w;
        const y = (layer.yPct / 100) * h;

        const lineH = scaledSize * layer.lineHeight;
        const lines = layer.text.split('\n');
        lines.forEach((line, i) => {
          ctx.fillText(line, x, y + i * lineH);
        });
        ctx.restore();
      }

      onSave(canvas.toDataURL('image/png'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Preview font size in display px (relative to preview container) ───────

  const getDisplayFontSize = (layer: TextLayer) => {
    if (!previewRef.current) return layer.fontSize * 0.3;
    const previewW = previewRef.current.clientWidth || 600;
    return (layer.fontSize / 1000) * previewW;
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2 text-white">
          <Type className="text-indigo-400" size={20} />
          <h2 className="font-semibold text-lg">文字编辑器</h2>
          <span className="text-xs text-slate-400 ml-2">拖拽文字块调整位置</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || layers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all"
          >
            {isSaving ? (
              <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />保存中...</span>
            ) : (
              <><Check size={16} />保存图片</>
            )}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT: Layer list ──────────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col">
          <div className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">文字图层 ({layers.length})</span>
            <button
              onClick={addLayer}
              className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs transition-colors"
            >
              <Plus size={12} />新增
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {layers.map(layer => (
              <div
                key={layer.id}
                onClick={() => setSelectedId(layer.id)}
                className={`group relative px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                  selectedId === layer.id
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-transparent bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border border-slate-600 flex-shrink-0" style={{ backgroundColor: layer.color }} />
                  <span className="text-xs text-white truncate flex-1" title={layer.text}>
                    {layer.text.slice(0, 20) || '(空)'}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-300 rounded transition-all flex-shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 pl-5">
                  {layer.fontSize}px · {layer.bold ? 'B' : ''}{layer.italic ? 'I' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER: Preview canvas ────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-slate-950">
          <div
            ref={previewRef}
            className="relative inline-block shadow-2xl rounded-lg overflow-hidden select-none"
            style={{ maxWidth: '100%', maxHeight: '100%', cursor: isDragging ? 'grabbing' : 'default' }}
            onClick={() => setSelectedId(null)}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="编辑背景"
              className="block max-w-full max-h-[75vh] object-contain"
              draggable={false}
            />
            {/* Text overlays */}
            {layers.map(layer => (
              <div
                key={layer.id}
                onMouseDown={(e) => handleTextMouseDown(e, layer.id)}
                className={`absolute pointer-events-auto cursor-grab ${isDragging && selectedId === layer.id ? 'cursor-grabbing' : ''}`}
                style={{
                  left: `${layer.xPct}%`,
                  top: `${layer.yPct}%`,
                  transform: layer.textAlign === 'center' ? 'translateX(-50%)' : layer.textAlign === 'right' ? 'translateX(-100%)' : 'none',
                  fontFamily: layer.fontFamily,
                  fontSize: `${getDisplayFontSize(layer)}px`,
                  fontWeight: layer.bold ? 'bold' : 'normal',
                  fontStyle: layer.italic ? 'italic' : 'normal',
                  color: layer.color,
                  textAlign: layer.textAlign,
                  lineHeight: layer.lineHeight,
                  letterSpacing: `${layer.letterSpacing}em`,
                  opacity: layer.opacity / 100,
                  whiteSpace: 'pre-wrap',
                  outline: selectedId === layer.id ? '2px dashed rgba(99,102,241,0.8)' : '2px dashed transparent',
                  padding: '2px 4px',
                  borderRadius: '2px',
                  userSelect: 'none',
                  textShadow: selectedId === layer.id ? '0 0 6px rgba(0,0,0,0.6)' : 'none',
                }}
                title="拖拽移动"
              >
                {layer.text || '(空)'}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Properties panel ───────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 border-l border-slate-800 bg-slate-900 overflow-y-auto">
          {selected ? (
            <div className="p-4 space-y-5">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">文字属性</div>

              {/* Text content */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">文案内容</label>
                <textarea
                  value={selected.text}
                  onChange={(e) => updateLayer(selected.id, 'text', e.target.value)}
                  rows={4}
                  placeholder="输入文字内容（换行符支持多行）"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Font family */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">字体</label>
                <div className="relative">
                  <button
                    onClick={() => setShowFontDropdown(!showFontDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white hover:border-slate-500 transition-colors"
                  >
                    <span style={{ fontFamily: selected.fontFamily }}>
                      {FONT_FAMILIES.find(f => f.value === selected.fontFamily)?.label ?? '自定义'}
                    </span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                  {showFontDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                      {FONT_FAMILIES.map(f => (
                        <button
                          key={f.value}
                          onClick={() => { updateLayer(selected.id, 'fontFamily', f.value); setShowFontDropdown(false); }}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors ${selected.fontFamily === f.value ? 'text-indigo-400 bg-indigo-500/10' : 'text-white'}`}
                          style={{ fontFamily: f.value }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Font size */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  字号 <span className="text-slate-500">({selected.fontSize}px)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={12} max={200} value={selected.fontSize}
                    onChange={(e) => updateLayer(selected.id, 'fontSize', +e.target.value)}
                    className="flex-1 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <input
                    type="number" min={8} max={400} value={selected.fontSize}
                    onChange={(e) => updateLayer(selected.id, 'fontSize', Math.max(8, +e.target.value))}
                    className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Style toggles */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">样式 & 对齐</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateLayer(selected.id, 'bold', !selected.bold)}
                    className={`p-2 rounded-lg border transition-all font-bold text-sm ${selected.bold ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'}`}
                    title="粗体"
                  ><Bold size={14} /></button>
                  <button
                    onClick={() => updateLayer(selected.id, 'italic', !selected.italic)}
                    className={`p-2 rounded-lg border transition-all text-sm italic ${selected.italic ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'}`}
                    title="斜体"
                  ><Italic size={14} /></button>
                  <div className="w-px bg-slate-700" />
                  {(['left', 'center', 'right'] as const).map(align => (
                    <button
                      key={align}
                      onClick={() => updateLayer(selected.id, 'textAlign', align)}
                      className={`p-2 rounded-lg border transition-all ${selected.textAlign === align ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'}`}
                    >
                      {align === 'left' ? <AlignLeft size={14} /> : align === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">颜色</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => updateLayer(selected.id, 'color', c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${selected.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c, boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : undefined }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selected.color}
                    onChange={(e) => updateLayer(selected.id, 'color', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={selected.color}
                    onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && updateLayer(selected.id, 'color', e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Line height */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  行距 <span className="text-slate-500">({selected.lineHeight.toFixed(1)}x)</span>
                </label>
                <input
                  type="range" min={1} max={3} step={0.1} value={selected.lineHeight}
                  onChange={(e) => updateLayer(selected.id, 'lineHeight', +e.target.value)}
                  className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Letter spacing */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  字间距 <span className="text-slate-500">({selected.letterSpacing.toFixed(2)}em)</span>
                </label>
                <input
                  type="range" min={-0.1} max={0.5} step={0.01} value={selected.letterSpacing}
                  onChange={(e) => updateLayer(selected.id, 'letterSpacing', +e.target.value)}
                  className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Opacity */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  不透明度 <span className="text-slate-500">({selected.opacity}%)</span>
                </label>
                <input
                  type="range" min={10} max={100} value={selected.opacity}
                  onChange={(e) => updateLayer(selected.id, 'opacity', +e.target.value)}
                  className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Position */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                  <MoveHorizontal size={12} /> 位置（也可直接拖拽）
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">水平 X ({Math.round(selected.xPct)}%)</div>
                    <input
                      type="range" min={0} max={100} value={Math.round(selected.xPct)}
                      onChange={(e) => updateLayer(selected.id, 'xPct', +e.target.value)}
                      className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">垂直 Y ({Math.round(selected.yPct)}%)</div>
                    <input
                      type="range" min={0} max={100} value={Math.round(selected.yPct)}
                      onChange={(e) => updateLayer(selected.id, 'yPct', +e.target.value)}
                      className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500">
              <div>
                <Type size={32} className="mx-auto mb-3 text-slate-600" />
                <p className="text-sm">从左侧选择图层<br />或点击"新增"添加文字</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TextEditorModal;
