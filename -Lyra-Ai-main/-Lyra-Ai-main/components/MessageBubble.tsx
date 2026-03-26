import React, { useState } from 'react';
import { User, Aperture, Copy, Check, Download, Brush, Quote, ImagePlus, Layers } from 'lucide-react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  onImageClick?: (url: string) => void;
  onEditClick?: (url: string) => void;
  onQuoteClick?: (text: string) => void;
  onSendToInput?: (url: string) => void;
  onSendToScene?: (url: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onImageClick, onEditClick, onQuoteClick, onSendToInput, onSendToScene }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showRefMenu, setShowRefMenu] = useState(false);

  const handleCopy = (text: string) => {
    // Compatible copy logic
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => fallbackCopyTextToClipboard(text));
    } else {
      fallbackCopyTextToClipboard(text);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      if(document.execCommand('copy')) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) { console.error('Copy failed', err); }
    document.body.removeChild(textArea);
  };

  const handleDownload = async (imageUrl: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const renderContent = (content: string) => {
    if (message.type === 'image') {
      return (
        <div 
          className="relative group rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 max-w-sm transition-all hover:shadow-md bg-slate-100 dark:bg-slate-900 cursor-zoom-in"
          onClick={() => onImageClick && onImageClick(content)}
        >
           <img 
             src={content} 
             alt="Content" 
             className="w-full h-auto object-cover" 
             draggable="true"
             onDragStart={(e) => {
               e.dataTransfer.setData('text/plain', content);
               e.dataTransfer.setData('application/x-lyra-image', content);
               e.dataTransfer.effectAllowed = 'copy';
             }}
           />
           
           {/* Image Actions Overlay */}
           <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
             {/* Reference Menu Button */}
             <div className="relative">
               <button 
                 onClick={(e) => { e.stopPropagation(); setShowRefMenu(!showRefMenu); }}
                 className="p-2 bg-black/50 hover:bg-indigo-600 text-white rounded-full backdrop-blur-sm transition-colors"
                 title="引用到..."
               >
                 <Quote size={16} />
               </button>
               {showRefMenu && (
                 <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 min-w-[140px] z-50 animate-in fade-in slide-in-from-top-1 duration-150" onClick={(e) => e.stopPropagation()}>
                   {onSendToInput && (
                     <button 
                       onClick={() => { onSendToInput(content); setShowRefMenu(false); }}
                       className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                     >
                       <Layers size={14} className="text-indigo-500"/> 产品图输入
                     </button>
                   )}
                   {onSendToScene && (
                     <button 
                       onClick={() => { onSendToScene(content); setShowRefMenu(false); }}
                       className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                     >
                       <ImagePlus size={14} className="text-purple-500"/> 场景参考
                     </button>
                   )}
                 </div>
               )}
             </div>
             {onEditClick && (
               <button 
                 onClick={(e) => { e.stopPropagation(); onEditClick(content); }}
                 className="p-2 bg-black/50 hover:bg-indigo-600 text-white rounded-full backdrop-blur-sm transition-colors"
                 title="局部重绘 (Inpaint)"
               >
                 <Brush size={16} />
               </button>
             )}
             <button 
               onClick={(e) => handleDownload(content, e)}
               className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"
               title="下载图片"
             >
               <Download size={16} />
             </button>
           </div>
        </div>
      );
    }
    
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const codeContent = part.replace(/```markdown|```/g, '').trim();
        return (
          <div key={index} className="my-3 bg-slate-900 text-slate-100 rounded-lg overflow-hidden text-sm group/code">
            <div className="flex justify-between items-center px-4 py-2 bg-slate-800 border-b border-slate-700">
              <span className="text-xs font-mono text-slate-400">PROMPT BLOCK</span>
              <div className="flex items-center gap-2">
                {onQuoteClick && (
                  <button 
                    onClick={() => onQuoteClick(codeContent)} 
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                    title="引用此提示词到输入框"
                  >
                    <Quote size={12} />
                    <span>Quote</span>
                  </button>
                )}
                <button onClick={() => handleCopy(codeContent)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="p-4 font-mono whitespace-pre-wrap overflow-x-auto">{codeContent}</div>
          </div>
        );
      }
      return <p key={index} className="whitespace-pre-wrap leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: part.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />;
    });
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} group/bubble`}>
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${isUser ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-indigo-600 border border-indigo-100'}`}>
          {isUser ? <User size={18} /> : <Aperture size={20} />}
        </div>
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}>
          <div className={`relative px-5 py-4 rounded-2xl shadow-sm group ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-none'}`}>
            {renderContent(message.content)}
            
            {/* Action Buttons for Text Messages */}
            {message.type === 'text' && (
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 {onQuoteClick && (
                    <button 
                      onClick={() => onQuoteClick(message.content)}
                      className={`p-1.5 rounded-lg transition-all ${
                        isUser 
                          ? 'text-indigo-100 hover:bg-indigo-500 hover:text-white' 
                          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-indigo-500 dark:text-slate-500'
                      }`}
                      title="引用内容 (Quote)"
                    >
                      <Quote size={14} />
                    </button>
                 )}
                 <button 
                    onClick={() => handleCopy(message.content)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isUser 
                        ? 'text-indigo-100 hover:bg-indigo-500 hover:text-white' 
                        : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-500'
                    }`}
                    title="复制内容 (Copy)"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
              </div>
            )}
          </div>
          <span className="text-xs text-slate-400 mt-1 px-1">{isUser ? 'You' : 'Lyra AI'} • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;