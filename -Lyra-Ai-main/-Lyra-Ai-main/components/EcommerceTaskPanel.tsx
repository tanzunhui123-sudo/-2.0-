import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Search, Copy, ChevronLeft, ChevronRight, X, Download,
  Upload, Image as ImageIcon, Loader2, Check, RefreshCw, Edit3,
  Eye, History, GripHorizontal, Maximize2, ZoomIn, ZoomOut, RotateCcw,
  ShoppingBag, FileText, Store, ChevronDown, Send, Lock, Unlock,
  ArrowUp, ArrowDown, Trash2, Settings, Layers, ImagePlus,
  Paintbrush, Type
} from 'lucide-react';
import {
  EcommerceTask, TaskType, TaskStatus, FloorImage, TaskPlan, AgentMessage, EcommercePlatform
} from '../types';
import { ECOMMERCE_PLATFORMS, DETAIL_PAGE_SECTIONS, PLATFORM_FLOOR_RATIOS } from '../constants';
import InpaintingModal from './InpaintingModal';
import { TextEditorModal } from './TextEditorModal';

// ========== Helper: Generate unique ID ==========
const genId = () => `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let _floorSeq = 0;
const genFloorId = () => `floor_${Date.now()}_${++_floorSeq}_${Math.random().toString(36).slice(2, 6)}`;

// ========== Default task template ==========
const createEmptyTask = (type: TaskType): EcommerceTask => ({
  id: genId(),
  type,
  status: 'draft',
  name: type === 'mainImage' ? '新主图任务' : '新详情页任务',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  productName: '',
  productInfo: '',
  productImages: [],
  referenceImages: [],
  floorCount: 'auto',
  floorRatio: 'auto',
  resolution: '2K',
  language: '中文',
  platform: 'taobao',
  designRequirements: '',
  plans: [],
  selectedPlanId: null,
  agentMessages: [],
  agentLocked: false,
  floors: [],
});

// ========== Props ==========
interface EcommerceTaskPanelProps {
  onGenerateImage: (prompt: string, images: string[], options: {
    aspectRatio: string;
    resolution: string;
    outputFormat: string;
    isMask?: boolean;
  }) => Promise<string | null>;
  onGenerateText: (prompt: string, images: string[]) => Promise<string>;
  apiProvider: 'google' | 'kie' | 'custom';
}

// ========== Main Component ==========
export default function EcommerceTaskPanel({ onGenerateImage, onGenerateText, apiProvider }: EcommerceTaskPanelProps) {
  // Task Management State
  const [tasks, setTasks] = useState<EcommerceTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewTaskMenu, setShowNewTaskMenu] = useState(false);

  // UI State
  const [activeFloorIdx, setActiveFloorIdx] = useState<number>(-1);
  const [showFloorHistory, setShowFloorHistory] = useState(false);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [previewLongImage, setPreviewLongImage] = useState(false);
  const [agentInput, setAgentInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showFloorModify, setShowFloorModify] = useState(false);
  const [modifyInput, setModifyInput] = useState('');
  const [showInsertMenu, setShowInsertMenu] = useState<{idx: number, position: 'before' | 'after'} | null>(null);
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);
  const [downloadUnlocked, setDownloadUnlocked] = useState(false);

  // Inpainting & Text Editor State
  const [inpaintFloorIdx, setInpaintFloorIdx] = useState<number | null>(null);
  const [isInpaintLoading, setIsInpaintLoading] = useState(false);
  const [textEditorFloorIdx, setTextEditorFloorIdx] = useState<number | null>(null);

  // Refs
  const productImgRef = useRef<HTMLInputElement>(null);
  const refImgRef = useRef<HTMLInputElement>(null);
  const insertImgRef = useRef<HTMLInputElement>(null);
  const agentScrollRef = useRef<HTMLDivElement>(null);
  const insertTargetRef = useRef<{idx: number, position: 'before' | 'after'} | null>(null);

  // Active task
  const activeTask = tasks.find(t => t.id === activeTaskId) || null;

  // Update task helper
  const updateTask = useCallback((taskId: string, updates: Partial<EcommerceTask>) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, ...updates, updatedAt: Date.now() } : t
    ));
  }, []);

  // Scroll agent messages to bottom
  useEffect(() => {
    if (agentScrollRef.current) {
      agentScrollRef.current.scrollTop = agentScrollRef.current.scrollHeight;
    }
  }, [activeTask?.agentMessages]);

  // ==================== TASK MANAGEMENT ====================
  
  const handleCreateTask = (type: TaskType) => {
    const newTask = createEmptyTask(type);
    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
    setShowNewTaskMenu(false);
  };

  const handleCopyTask = (taskId: string) => {
    const source = tasks.find(t => t.id === taskId);
    if (!source) return;
    const newTask: EcommerceTask = {
      ...source,
      id: genId(),
      name: `${source.name} (副本)`,
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      plans: [],
      selectedPlanId: null,
      agentMessages: [],
      agentLocked: false,
      floors: [],
      longImageUrl: undefined,
    };
    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
  };

  // ==================== IMAGE UPLOAD ====================

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !activeTask) return;
    const taskId = activeTask.id;
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, productImages: [...t.productImages, reader.result as string], updatedAt: Date.now() } : t
          ));
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !activeTask) return;
    const taskId = activeTask.id;
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, referenceImages: [...t.referenceImages, reader.result as string], updatedAt: Date.now() } : t
          ));
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleInsertImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !activeTask || !insertTargetRef.current) return;
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && insertTargetRef.current) {
        const { idx, position } = insertTargetRef.current;
        const newFloor: FloorImage = {
          id: genFloorId(),
          url: reader.result as string,
          history: [reader.result as string],
          ratio: '2:3',
          selected: true,
        };
        const currentFloors = [...(tasks.find(t => t.id === activeTask.id)?.floors || [])];
        const insertIdx = position === 'before' ? idx : idx + 1;
        currentFloors.splice(insertIdx, 0, newFloor);
        updateTask(activeTask.id, { floors: currentFloors });
        setShowInsertMenu(null);
        insertTargetRef.current = null;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ==================== AGENT COMMUNICATION ====================

  const addAgentMessage = (taskId: string, role: 'user' | 'agent', content: string) => {
    const newMsg: AgentMessage = {
      id: Date.now() + Math.random(),
      role,
      content,
      timestamp: Date.now(),
    };
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, agentMessages: [...t.agentMessages, newMsg], updatedAt: Date.now() } : t
    ));
  };

  const handleSubmitPlan = async () => {
    if (!activeTask || activeTask.status !== 'draft') return;
    
    // Validate
    if (activeTask.productImages.length === 0) {
      alert('请至少上传1张商品图片');
      return;
    }
    if (!activeTask.productName.trim()) {
      alert('请填写商品名称');
      return;
    }

    // Update status
    updateTask(activeTask.id, { status: 'planning' });
    setIsThinking(true);

    const platformConfig = ECOMMERCE_PLATFORMS[activeTask.platform];
    const taskTypeLabel = activeTask.type === 'mainImage' ? '主图' : '详情页';
    
    // Build requirement summary for agent
    const requirementSummary = `
【任务类型】${taskTypeLabel}制作
【商品名称】${activeTask.productName}
【商品信息】${activeTask.productInfo || '未填写'}
【楼层数量】${activeTask.floorCount === 'auto' ? '智能规划' : activeTask.floorCount + '层'}
【楼层比例】${activeTask.floorRatio === 'auto' ? '智能规划' : activeTask.floorRatio}
【图片分辨率】${activeTask.resolution}
【语言】${activeTask.language}
【平台】${platformConfig.name}
【设计要求】${activeTask.designRequirements || '无特殊要求'}
【商品图片】${activeTask.productImages.length}张
【参考图片】${activeTask.referenceImages.length}张
`.trim();

    addAgentMessage(activeTask.id, 'user', requirementSummary);

    try {
      // Call AI to analyze requirements and generate plans
      const prompt = `你是一个专业的电商${taskTypeLabel}设计Agent。用户提交了以下${taskTypeLabel}制作需求：

${requirementSummary}

请根据用户需求：
1. 分析商品图片和需求信息
2. 如果信息不够完整，请列出需要补充的问题
3. 如果信息足够，请直接生成3个设计方案(A/B/C)

每个方案请包含：
- 方案标题（简短描述设计风格）
- 方案描述（详细的设计思路说明）
- 楼层规划（每个楼层的内容安排）

请用以下JSON格式返回方案（如果需要补充信息则不返回方案，直接提问）：

如果需要补充信息，直接用文字回复提问。

如果信息足够，用以下格式回复：
---PLANS_START---
[
  {
    "id": "A",
    "title": "方案A: xxx风格",
    "description": "设计说明...",
    "floorPlan": ["楼层1: xxx", "楼层2: xxx", ...]
  },
  {
    "id": "B", 
    "title": "方案B: xxx风格",
    "description": "设计说明...",
    "floorPlan": ["楼层1: xxx", "楼层2: xxx", ...]
  },
  {
    "id": "C",
    "title": "方案C: xxx风格",
    "description": "设计说明...",
    "floorPlan": ["楼层1: xxx", "楼层2: xxx", ...]
  }
]
---PLANS_END---`;

      const response = await onGenerateText(prompt, activeTask.productImages);
      
      // Parse response
      const plansMatch = response.match(/---PLANS_START---([\s\S]*?)---PLANS_END---/);
      
      if (plansMatch) {
        try {
          const plans: TaskPlan[] = JSON.parse(plansMatch[1].trim());
          updateTask(activeTask.id, { 
            plans,
            status: 'confirming' 
          });
          addAgentMessage(activeTask.id, 'agent', `已为您生成3个设计方案，请选择一个满意的方案：\n\n${plans.map(p => 
            `**${p.title}**\n${p.description}\n\n楼层规划：\n${p.floorPlan.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}`
          ).join('\n\n---\n\n')}`);
        } catch {
          // Plans parsing failed, treat as question
          addAgentMessage(activeTask.id, 'agent', response.replace(/---PLANS_START---[\s\S]*?---PLANS_END---/, '').trim() || response);
          updateTask(activeTask.id, { status: 'planning' });
        }
      } else {
        // Agent is asking for more info
        addAgentMessage(activeTask.id, 'agent', response);
        updateTask(activeTask.id, { status: 'planning' });
      }
    } catch (error: any) {
      addAgentMessage(activeTask.id, 'agent', `⚠️ 方案生成出错：${error.message || '请重试'}`);
      updateTask(activeTask.id, { status: 'draft' });
    } finally {
      setIsThinking(false);
    }
  };

  const handleAgentReply = async () => {
    if (!activeTask || !agentInput.trim() || activeTask.agentLocked) return;
    
    const userMsg = agentInput.trim();
    setAgentInput('');
    addAgentMessage(activeTask.id, 'user', userMsg);
    setIsThinking(true);

    try {
      const taskTypeLabel = activeTask.type === 'mainImage' ? '主图' : '详情页';
      const historyContext = activeTask.agentMessages.slice(-6).map(m => 
        `${m.role === 'user' ? '用户' : 'Agent'}: ${m.content}`
      ).join('\n\n');

      const prompt = `你是一个专业的电商${taskTypeLabel}设计Agent。以下是之前的对话记录：

${historyContext}

用户最新回复: ${userMsg}

请继续对话。如果用户说"继续"或信息已足够，请生成3个设计方案(A/B/C)。格式同上，用 ---PLANS_START--- 和 ---PLANS_END--- 包裹JSON。
如果还需要信息，继续提问。`;

      const response = await onGenerateText(prompt, activeTask.productImages);
      
      const plansMatch = response.match(/---PLANS_START---([\s\S]*?)---PLANS_END---/);
      
      if (plansMatch) {
        try {
          const plans: TaskPlan[] = JSON.parse(plansMatch[1].trim());
          updateTask(activeTask.id, { plans, status: 'confirming' });
          addAgentMessage(activeTask.id, 'agent', `已为您生成3个设计方案，请选择一个满意的方案：\n\n${plans.map(p => 
            `**${p.title}**\n${p.description}\n\n楼层规划：\n${p.floorPlan.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}`
          ).join('\n\n---\n\n')}`);
        } catch {
          addAgentMessage(activeTask.id, 'agent', response.replace(/---PLANS_START---[\s\S]*?---PLANS_END---/, '').trim() || response);
        }
      } else {
        addAgentMessage(activeTask.id, 'agent', response);
      }
    } catch (error: any) {
      addAgentMessage(activeTask.id, 'agent', `⚠️ 出错：${error.message || '请重试'}`);
    } finally {
      setIsThinking(false);
    }
  };

  // ==================== PLAN SELECTION & GENERATION ====================

  const handleSelectPlan = (planId: string) => {
    if (!activeTask) return;
    updateTask(activeTask.id, { selectedPlanId: planId });
    addAgentMessage(activeTask.id, 'user', `我选择 ${planId} 方案`);
    addAgentMessage(activeTask.id, 'agent', `好的，您选择了方案${planId}。请确认是否开始生成？\n\n点击【确认并继续】开始生成图片，生成过程约需8分钟。`);
  };

  const handleConfirmAndGenerate = async () => {
    if (!activeTask || !activeTask.selectedPlanId) return;
    
    const selectedPlan = activeTask.plans.find(p => p.id === activeTask.selectedPlanId);
    if (!selectedPlan) return;

    // Capture values before state changes to avoid stale closures
    const taskId = activeTask.id;
    const taskType = activeTask.type;
    const productName = activeTask.productName;
    const productInfo = activeTask.productInfo;
    const productImages = [...activeTask.productImages];
    const designRequirements = activeTask.designRequirements;
    const language = activeTask.language;
    const resolution = activeTask.resolution;
    const platform = activeTask.platform;
    const taskName = activeTask.productName || activeTask.name;
    const floorPlan = [...selectedPlan.floorPlan];

    // Lock agent, start generation, and add message in one batch
    const confirmMsg: AgentMessage = {
      id: Date.now() + Math.random(),
      role: 'agent',
      content: `✅ 方案已确认，正在开始生成图片...\n\n预计需要8分钟左右，您可以稍后回来查看结果。`,
      timestamp: Date.now(),
    };
    
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { 
        ...t, 
        status: 'generating' as TaskStatus, 
        agentLocked: true, 
        name: taskName,
        agentMessages: [...t.agentMessages, confirmMsg],
        updatedAt: Date.now() 
      } : t
    ));

    const platformConfig = ECOMMERCE_PLATFORMS[platform];
    const sizePresets = taskType === 'mainImage' 
      ? platformConfig.mainImageSizes 
      : platformConfig.detailPageSizes;
    const sizePreset = sizePresets[0];

    // ── Scene consistency: analyse the first product image and derive a shared scene ──
    let sceneContext = '';
    if (productImages.length > 0) {
      try {
        const sceneAnalysis = await onGenerateText(
          `请分析这张商品图片，判断：
1. 商品是否在纯白/纯色/简单背景上？
2. 或者商品已经有场景/环境背景（如室内、生活场景等）？

请用以下格式回答（JSON）：
{"hasScene": true/false, "sceneDescription": "如果有场景，详细描述场景的环境、光线、氛围，如无场景则为空字符串"}

只输出 JSON，不要额外解释。`,
          [productImages[0]]
        );
        const jsonMatch = sceneAnalysis.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.hasScene && parsed.sceneDescription) {
            sceneContext = parsed.sceneDescription;
          } else {
            // White background product — generate a consistent scene for this series
            const sceneSuggestion = await onGenerateText(
              `这是一款商品（${productName}）。请为其电商${taskType === 'mainImage' ? '主图' : '详情页'}系列图片推荐一个统一的高品质场景设定。
要求：
- 场景与商品品类搭配
- 适合电商平台风格
- 光线、背景、氛围描述清晰，易于图像生成复现

只输出场景描述（1-3句，英文），不要解释。`,
              [productImages[0]]
            );
            sceneContext = sceneSuggestion.trim();
          }
        }
      } catch (e) {
        // Scene analysis is best-effort; don't block generation
        console.warn('Scene analysis failed, proceeding without scene context', e);
      }
    }
    // Save sceneContext to task for reference
    if (sceneContext) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, sceneContext } : t));
    }
    
    // Generate each floor
    const newFloors: FloorImage[] = [];
    
    for (let i = 0; i < floorPlan.length; i++) {
      const floorDesc = floorPlan[i];
      const taskTypeLabel = taskType === 'mainImage' ? '电商主图' : '详情页';

      // Add progress message
      const progressMsg: AgentMessage = {
        id: Date.now() + Math.random(),
        role: 'agent',
        content: `🎨 正在生成第 ${i + 1}/${floorPlan.length} 张：${floorDesc}`,
        timestamp: Date.now(),
      };
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, agentMessages: [...t.agentMessages, progressMsg], updatedAt: Date.now() } : t
      ));
      
      const prompt = `你是一个专业的${taskTypeLabel}设计师。
平台：${platformConfig.name}
商品名称：${productName}
商品信息：${productInfo}
设计要求：${designRequirements || '无'}
语言：${language}
${sceneContext ? `\n【场景一致性要求】本系列所有图片必须使用同一场景设定：${sceneContext}\n请严格保持该场景的环境、光线、氛围与整个系列一致。` : ''}

当前要生成的是第${i + 1}层楼层图：${floorDesc}

请生成一张高质量的${taskTypeLabel}图片，要求：
1. 产品外观必须与上传的商品图100%一致
2. 图片尺寸比例 ${sizePreset.ratio}
3. 专业级摄影品质，8K分辨率
4. ${platformConfig.name}平台风格优化
5. 楼层内容：${floorDesc}

ABSOLUTE CONSTRAINTS:
- Product appearance must be IDENTICAL to input images
- Photorealistic quality
- Do NOT add watermarks or text unless the floor plan specifically requires it
- ${resolution} resolution`;

      try {
        const imageUrl = await onGenerateImage(prompt, productImages, {
          aspectRatio: sizePreset.ratio,
          resolution: resolution,
          outputFormat: 'png',
        });

        if (imageUrl) {
          newFloors.push({
            id: genFloorId(),
            url: imageUrl,
            history: [imageUrl],
            ratio: sizePreset.ratio,
            sectionType: floorDesc,
            sectionLabel: `楼层 ${i + 1}`,
            selected: true,
          });
        }
      } catch (err: any) {
        console.error(`Floor ${i + 1} generation failed:`, err);
      }

      // Auto-select first floor when it appears
      if (newFloors.length === 1) {
        setActiveFloorIdx(0);
      }
      // Skip per-iteration update on last floor; completion update below will include final floors
      if (i < floorPlan.length - 1) {
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, floors: [...newFloors], updatedAt: Date.now() } : t
        ));
      }
    }

    // Allow React to flush pending renders before changing status
    await new Promise(r => requestAnimationFrame(r));

    // Mark as completed (or failed if no floors generated)
    if (newFloors.length === 0) {
      const failMsg: AgentMessage = {
        id: Date.now() + Math.random(),
        role: 'agent',
        content: `⚠️ 图片生成失败，所有楼层都未能成功生成。请检查API配置后重试。`,
        timestamp: Date.now(),
      };
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { 
          ...t, 
          status: 'confirming' as TaskStatus, 
          agentLocked: false,
          selectedPlanId: null,
          agentMessages: [...t.agentMessages, failMsg],
          updatedAt: Date.now() 
        } : t
      ));
      return;
    }

    const failedCount = floorPlan.length - newFloors.length;
    const doneMsg: AgentMessage = {
      id: Date.now() + Math.random(),
      role: 'agent',
      content: failedCount > 0
        ? `⚠️ 图片生成部分完成！成功 ${newFloors.length} 张，失败 ${failedCount} 张。\n\n您可以点击楼层的"重新生成"按钮重试失败的楼层。`
        : `🎉 图片生成完成！共生成 ${newFloors.length} 个楼层图片。\n\n您可以在右侧预览和管理楼层图片。`,
      timestamp: Date.now(),
    };
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { 
        ...t, 
        status: 'completed' as TaskStatus, 
        floors: newFloors,
        agentMessages: [...t.agentMessages, doneMsg],
        updatedAt: Date.now() 
      } : t
    ));
  };

  // ==================== FLOOR OPERATIONS ====================

  const handleFloorRegenerate = async (floorIdx: number) => {
    if (!activeTask) return;
    const floor = activeTask.floors[floorIdx];
    if (!floor) return;

    const platformConfig = ECOMMERCE_PLATFORMS[activeTask.platform];
    const taskTypeLabel = activeTask.type === 'mainImage' ? '电商主图' : '详情页';

    const prompt = `重新生成这个${taskTypeLabel}楼层图片。
平台：${platformConfig.name}
商品名称：${activeTask.productName}
楼层内容：${floor.sectionType || `楼层 ${floorIdx + 1}`}
分辨率：${activeTask.resolution}
比例：${floor.ratio}

要求产品外观与商品图100%一致，专业摄影品质。`;

    try {
      const newUrl = await onGenerateImage(prompt, activeTask.productImages, {
        aspectRatio: floor.ratio,
        resolution: activeTask.resolution,
        outputFormat: 'png',
      });

      if (newUrl) {
        const updatedFloors = [...activeTask.floors];
        updatedFloors[floorIdx] = {
          ...floor,
          url: newUrl,
          history: [...floor.history, newUrl],
        };
        updateTask(activeTask.id, { floors: updatedFloors });
      }
    } catch (err) {
      console.error('Regeneration failed:', err);
    }
  };

  const handleFloorModify = async (floorIdx: number) => {
    if (!activeTask || !modifyInput.trim()) return;
    const floor = activeTask.floors[floorIdx];
    if (!floor) return;

    const prompt = `修改这张图片：${modifyInput}
保持产品外观不变，仅按照修改意见调整。
分辨率：${activeTask.resolution}，比例：${floor.ratio}`;

    try {
      const newUrl = await onGenerateImage(prompt, [floor.url, ...activeTask.productImages], {
        aspectRatio: floor.ratio,
        resolution: activeTask.resolution,
        outputFormat: 'png',
      });

      if (newUrl) {
        const updatedFloors = [...activeTask.floors];
        updatedFloors[floorIdx] = {
          ...floor,
          url: newUrl,
          history: [...floor.history, newUrl],
        };
        updateTask(activeTask.id, { floors: updatedFloors });
        setModifyInput('');
        setShowFloorModify(false);
      }
    } catch (err) {
      console.error('Modification failed:', err);
    }
  };

  // Floor inpainting via brush mask
  const handleFloorInpaintGenerate = async (
    maskBase64: string, prompt: string, referenceImage?: string, materialImage?: string
  ) => {
    if (inpaintFloorIdx === null || !activeTask) return;
    const floor = activeTask.floors[inpaintFloorIdx];
    if (!floor) return;

    setIsInpaintLoading(true);
    try {
      const extraImages: string[] = [];
      if (referenceImage) extraImages.push(referenceImage);
      if (materialImage) extraImages.push(materialImage);

      const newUrl = await onGenerateImage(
        prompt || `对画面中已涂抹区域进行局部重绘，保持其余区域不变。`,
        [floor.url, maskBase64, ...extraImages],
        { aspectRatio: floor.ratio, resolution: activeTask.resolution, outputFormat: 'png', isMask: true }
      );

      if (newUrl) {
        const updatedFloors = [...activeTask.floors];
        updatedFloors[inpaintFloorIdx] = {
          ...floor,
          url: newUrl,
          history: [...floor.history, newUrl],
        };
        updateTask(activeTask.id, { floors: updatedFloors });
        setInpaintFloorIdx(null);
      }
    } catch (err) {
      console.error('Inpainting failed:', err);
    } finally {
      setIsInpaintLoading(false);
    }
  };

  // Text editor: save composited image back to floor
  const handleTextEditorSave = (dataUrl: string) => {
    if (textEditorFloorIdx === null || !activeTask) return;
    const floor = activeTask.floors[textEditorFloorIdx];
    if (!floor) return;
    const updatedFloors = [...activeTask.floors];
    updatedFloors[textEditorFloorIdx] = {
      ...floor,
      url: dataUrl,
      history: [...floor.history, dataUrl],
    };
    updateTask(activeTask.id, { floors: updatedFloors });
    setTextEditorFloorIdx(null);
  };

  const handleFloorReorder = (fromIdx: number, toIdx: number) => {
    if (!activeTask) return;
    const floors = [...activeTask.floors];
    const [moved] = floors.splice(fromIdx, 1);
    floors.splice(toIdx, 0, moved);
    updateTask(activeTask.id, { floors });
  };

  const handleFloorHistorySwitch = (floorIdx: number, historyIndex: number) => {
    if (!activeTask) return;
    const floor = activeTask.floors[floorIdx];
    if (!floor || !floor.history[historyIndex]) return;
    
    const updatedFloors = [...activeTask.floors];
    updatedFloors[floorIdx] = {
      ...floor,
      url: floor.history[historyIndex],
    };
    updateTask(activeTask.id, { floors: updatedFloors });
    setHistoryIdx(historyIndex);
  };

  const handleFloorToggleSelect = (floorIdx: number) => {
    if (!activeTask) return;
    const updatedFloors = [...activeTask.floors];
    updatedFloors[floorIdx] = {
      ...updatedFloors[floorIdx],
      selected: !updatedFloors[floorIdx].selected,
    };
    updateTask(activeTask.id, { floors: updatedFloors });
  };

  // ==================== DOWNLOAD ====================

  const handleDownloadSingle = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleDownloadAll = () => {
    if (!activeTask) return;
    activeTask.floors.forEach((floor, idx) => {
      if (floor.selected) {
        setTimeout(() => {
          handleDownloadSingle(floor.url, `${activeTask.productName || '图片'}_楼层${idx + 1}.png`);
        }, idx * 300);
      }
    });
  };

  // ==================== RENDER: Task List Sidebar ====================
  
  const filteredTasks = tasks.filter(t => 
    !searchQuery || t.name.includes(searchQuery) || t.productName.includes(searchQuery)
  );

  const statusLabel = (status: TaskStatus) => {
    switch (status) {
      case 'draft': return { text: '草稿', color: 'text-slate-400 bg-slate-100 dark:bg-slate-800' };
      case 'planning': return { text: '规划中', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' };
      case 'confirming': return { text: '待确认', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30' };
      case 'generating': return { text: '生成中', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30' };
      case 'completed': return { text: '已完成', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' };
    }
  };

  // ==================== RENDER ====================

  // Compute view mode for stable rendering
  const viewMode: 'empty' | 'form' | 'floors' = !activeTask ? 'empty' :
    (activeTask.status === 'generating' || activeTask.status === 'completed') ? 'floors' : 'form';

  // Bottom bar content for agent area (rendered as single element to avoid sibling conditional issues)
  const renderAgentBottomBar = () => {
    if (!activeTask) return null;
    
    // Plan selection
    if (activeTask.status === 'confirming' && activeTask.plans.length > 0 && !activeTask.selectedPlanId) {
      return (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="text-xs font-semibold text-slate-500 mb-2">请选择方案：</div>
          <div className="flex gap-2">
            {activeTask.plans.map(plan => (
              <button
                key={plan.id}
                onClick={() => handleSelectPlan(plan.id)}
                className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left group"
              >
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 mb-0.5">
                  方案 {plan.id}
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-2">{plan.title}</div>
              </button>
            ))}
          </div>
        </div>
      );
    }
    
    // Confirm button
    if (activeTask.status === 'confirming' && activeTask.selectedPlanId && !activeTask.agentLocked) {
      return (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <button
            onClick={handleConfirmAndGenerate}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2"
          >
            <Check size={18} />
            确认并继续（开始生成图片）
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            ⚠️ 确认后将锁定Agent对话，不能再调整方案
          </p>
        </div>
      );
    }
    
    // Chat input
    if (!activeTask.agentLocked && activeTask.status !== 'draft') {
      return (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAgentReply(); } }}
              placeholder={activeTask.status === 'confirming' ? '对方案有调整意见？在此输入...' : '补充更多信息或输入"继续"...'}
              disabled={isThinking}
              className="flex-1 px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
            />
            <button
              onClick={handleAgentReply}
              disabled={!agentInput.trim() || isThinking}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-all"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-slate-900">
      {/* Hidden file inputs */}
      <input type="file" ref={productImgRef} onChange={handleProductImageUpload} accept="image/*" multiple className="hidden" />
      <input type="file" ref={refImgRef} onChange={handleRefImageUpload} accept="image/*" multiple className="hidden" />
      <input type="file" ref={insertImgRef} onChange={handleInsertImageUpload} accept="image/*" className="hidden" />

      {/* ===== LEFT: Task Sidebar ===== */}
      <div className="w-60 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0">
        {/* New Task Button */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <button
              onClick={() => setShowNewTaskMenu(!showNewTaskMenu)}
              className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-xs transition-all shadow-lg hover:shadow-indigo-500/25"
            >
              <Plus size={14} />
              新增任务
            </button>
            {showNewTaskMenu ? (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => handleCreateTask('mainImage')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-left"
                >
                  <ShoppingBag size={14} className="text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">主图任务</div>
                    <div className="text-[10px] text-slate-400">电商主图制作</div>
                  </div>
                </button>
                <button
                  onClick={() => handleCreateTask('detailPage')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors text-left border-t border-slate-100 dark:border-slate-800"
                >
                  <FileText size={14} className="text-rose-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">详情页任务</div>
                    <div className="text-[10px] text-slate-400">商品详情页制作</div>
                  </div>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Layers size={24} className="text-slate-300" />
              </div>
              暂无任务，点击"新增任务"开始
            </div>
          ) : (
            filteredTasks.map(task => {
              const sl = statusLabel(task.status);
              const isActive = task.id === activeTaskId;
              return (
                <div
                  key={task.id}
                  onClick={() => setActiveTaskId(task.id)}
                  className={`group px-3 py-2.5 border-b border-slate-50 dark:border-slate-800/50 cursor-pointer transition-all ${
                    isActive 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {task.type === 'mainImage' ? (
                          <ShoppingBag size={11} className="text-emerald-500 flex-shrink-0" />
                        ) : (
                          <FileText size={11} className="text-rose-500 flex-shrink-0" />
                        )}
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                          {task.productName || task.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 pl-[17px]">
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 ${sl.color}`}>
                          <Loader2 size={7} className={`animate-spin ${task.status === 'generating' ? 'inline' : 'hidden'}`} />
                          <span>{sl.text}</span>
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(task.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyTask(task.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-all flex-shrink-0"
                      title="复制任务"
                    >
                      <Copy size={11} className="text-slate-400" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Search */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索任务..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* ===== MAIN: Content Area - key forces full remount on view change ===== */}
      <div key={viewMode} className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'empty' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Layers size={36} className="text-indigo-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">电商图片制作工作台</h2>
              <p className="text-sm text-slate-400 mb-6">
                创建主图或详情页任务，通过AI智能生成高转化率的电商图片
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handleCreateTask('mainImage')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all shadow-lg"
                >
                  <ShoppingBag size={16} />
                  新增主图任务
                </button>
                <button
                  onClick={() => handleCreateTask('detailPage')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium text-sm transition-all shadow-lg"
                >
                  <FileText size={16} />
                  新增详情页任务
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'form' && activeTask && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Requirement Form */}
            <div className="w-[380px] flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-white dark:bg-slate-950 p-4">
              <div className="space-y-5">
                {/* Task type badge */}
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                    activeTask.type === 'mainImage' 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' 
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                  }`}>
                    {activeTask.type === 'mainImage' ? <ShoppingBag size={14} /> : <FileText size={14} />}
                    {activeTask.type === 'mainImage' ? '主图制作' : '详情页制作'}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${statusLabel(activeTask.status).color}`}>
                    {statusLabel(activeTask.status).text}
                  </span>
                </div>

                {/* Product Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    商品名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={activeTask.productName}
                    onChange={(e) => updateTask(activeTask.id, { productName: e.target.value })}
                    placeholder="如：北欧实木餐桌 / 真皮沙发"
                    disabled={activeTask.agentLocked}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
                  />
                </div>

                {/* Product Images */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    商品图片 <span className="text-red-500">*</span>
                    <span className="font-normal text-slate-400 ml-1">（建议至少3张，含正面图）</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeTask.productImages.map((img, idx) => (
                      <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white">
                        <img src={img} alt={`商品图${idx + 1}`} className="w-full h-full object-contain" />
                        {!activeTask.agentLocked ? (
                          <button
                            onClick={() => updateTask(activeTask.id, { 
                              productImages: activeTask.productImages.filter((_, i) => i !== idx) 
                            })}
                            className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={10} />
                          </button>
                        ) : null}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[9px] text-white text-center py-0.5">{idx + 1}</div>
                      </div>
                    ))}
                    {!activeTask.agentLocked ? (
                      <button
                        onClick={() => productImgRef.current?.click()}
                        className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-400 transition-all"
                      >
                        <Upload size={16} />
                        <span className="text-[9px] mt-1">上传</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Product Info */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    商品信息
                    <span className="font-normal text-slate-400 ml-1">（材质、尺寸、特点等）</span>
                  </label>
                  <textarea
                    value={activeTask.productInfo}
                    onChange={(e) => updateTask(activeTask.id, { productInfo: e.target.value })}
                    placeholder="请描述商品的材质、尺寸、功能特点、目标人群等信息..."
                    disabled={activeTask.agentLocked}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none h-16 disabled:opacity-50"
                  />
                </div>

                {/* Floor Count & Ratio */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">楼层数量</label>
                    <select
                      value={String(activeTask.floorCount)}
                      onChange={(e) => updateTask(activeTask.id, { 
                        floorCount: e.target.value === 'auto' ? 'auto' : parseInt(e.target.value) 
                      })}
                      disabled={activeTask.agentLocked}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none disabled:opacity-50"
                    >
                      <option value="auto">🤖 智能规划</option>
                      {[3, 4, 5, 6, 7, 8, 9, 10, 12, 15].map(n => (
                        <option key={n} value={n}>{n} 层</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">楼层比例</label>
                    <select
                      value={String(activeTask.floorRatio)}
                      onChange={(e) => updateTask(activeTask.id, { floorRatio: e.target.value })}
                      disabled={activeTask.agentLocked}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none disabled:opacity-50"
                    >
                      <option value="auto">🤖 智能规划</option>
                      {(activeTask.type === 'mainImage'
                        ? PLATFORM_FLOOR_RATIOS[activeTask.platform].mainImage
                        : PLATFORM_FLOOR_RATIOS[activeTask.platform].detailPage
                      ).map((preset, idx) => (
                        <option key={`${preset.value}-${idx}`} value={preset.value}>
                          {preset.label} {preset.pixels}{preset.recommended ? ' ⭐' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Resolution & Language */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">图片分辨率</label>
                    <select
                      value={activeTask.resolution}
                      onChange={(e) => updateTask(activeTask.id, { resolution: e.target.value })}
                      disabled={activeTask.agentLocked}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none disabled:opacity-50"
                    >
                      <option value="1K">1K</option>
                      <option value="2K">2K（推荐）</option>
                      <option value="4K">4K 高清</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">语言</label>
                    <select
                      value={activeTask.language}
                      onChange={(e) => updateTask(activeTask.id, { language: e.target.value })}
                      disabled={activeTask.agentLocked}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none disabled:opacity-50"
                    >
                      <option value="中文">中文</option>
                      <option value="English">English</option>
                      <option value="日本語">日本語</option>
                      <option value="한국어">한국어</option>
                    </select>
                  </div>
                </div>

                {/* Platform */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">平台类型</label>
                  <div className="relative">
                    <button
                      onClick={() => !activeTask.agentLocked && setShowPlatformDropdown(!showPlatformDropdown)}
                      disabled={activeTask.agentLocked}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2">
                        <Store size={14} />
                        {ECOMMERCE_PLATFORMS[activeTask.platform].icon} {ECOMMERCE_PLATFORMS[activeTask.platform].name}
                      </span>
                      <ChevronDown size={14} />
                    </button>
                    {showPlatformDropdown ? (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
                        {(Object.keys(ECOMMERCE_PLATFORMS) as EcommercePlatform[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => {
                              const ratios = activeTask.type === 'mainImage'
                                ? PLATFORM_FLOOR_RATIOS[p].mainImage
                                : PLATFORM_FLOOR_RATIOS[p].detailPage;
                              const recommended = ratios.find(r => r.recommended) || ratios[0];
                              updateTask(activeTask.id, { platform: p, floorRatio: recommended?.value || 'auto' });
                              setShowPlatformDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 ${
                              activeTask.platform === p ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30' : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <span>{ECOMMERCE_PLATFORMS[p].icon}</span>
                            <span>{ECOMMERCE_PLATFORMS[p].name}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Reference Images */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    参考{activeTask.type === 'mainImage' ? '主图' : '详情页长图'}
                    <span className="font-normal text-slate-400 ml-1">（可选）</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeTask.referenceImages.map((img, idx) => (
                      <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-purple-200 dark:border-purple-700 bg-white">
                        <img src={img} alt={`参考${idx + 1}`} className="w-full h-full object-cover" />
                        {!activeTask.agentLocked ? (
                          <button
                            onClick={() => updateTask(activeTask.id, { 
                              referenceImages: activeTask.referenceImages.filter((_, i) => i !== idx) 
                            })}
                            className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X size={10} />
                          </button>
                        ) : null}
                        <div className="absolute bottom-0 left-0 right-0 bg-purple-600/70 text-[9px] text-white text-center py-0.5">参考</div>
                      </div>
                    ))}
                    {!activeTask.agentLocked ? (
                      <button
                        onClick={() => refImgRef.current?.click()}
                        className="w-16 h-16 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-600 flex flex-col items-center justify-center text-purple-400 hover:text-purple-500 hover:border-purple-400 transition-all"
                      >
                        <ImagePlus size={16} />
                        <span className="text-[9px] mt-1">参考图</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Design Requirements */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    设计要求
                    <span className="font-normal text-slate-400 ml-1">（可选）</span>
                  </label>
                  <textarea
                    value={activeTask.designRequirements}
                    onChange={(e) => updateTask(activeTask.id, { designRequirements: e.target.value })}
                    placeholder="如：使用原图模特，保持简约风格，突出产品质感..."
                    disabled={activeTask.agentLocked}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none h-16 disabled:opacity-50"
                  />
                </div>

                {/* Submit Button */}
                {activeTask.status === 'draft' ? (
                  <button
                    onClick={handleSubmitPlan}
                    disabled={activeTask.productImages.length === 0 || !activeTask.productName.trim()}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2"
                  >
                    <Send size={16} />
                    制作方案
                  </button>
                ) : null}

                {/* Platform Tips */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-semibold text-slate-500 mb-2">
                    💡 {ECOMMERCE_PLATFORMS[activeTask.platform].name} {activeTask.type === 'mainImage' ? '主图' : '详情页'}建议
                  </div>
                  {(activeTask.type === 'mainImage' 
                    ? ECOMMERCE_PLATFORMS[activeTask.platform].mainImageTips 
                    : ECOMMERCE_PLATFORMS[activeTask.platform].detailPageTips
                  ).map((tip, idx) => (
                    <div key={idx} className="text-[10px] text-slate-400 py-0.5">• {tip}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Agent Communication Area */}
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900">
              {/* Header */}
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Layers size={16} className="text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">AI设计Agent</div>
                    <div className="text-[10px] text-slate-400">
                      {isThinking ? '正在思考中...' : activeTask.agentLocked ? '对话已锁定' : '等待输入'}
                    </div>
                  </div>
                </div>
                {activeTask.agentLocked ? (
                  <div className="flex items-center gap-1 text-xs text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
                    <Lock size={12} />
                    已锁定
                  </div>
                ) : null}
              </div>

              {/* Messages */}
              <div ref={agentScrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeTask.agentMessages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Send size={24} className="text-slate-300" />
                    </div>
                    <p className="text-sm mb-1">填写左侧需求信息</p>
                    <p className="text-xs">点击"制作方案"后，AI Agent将为您智能规划设计方案</p>
                  </div>
                ) : (
                  activeTask.agentMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-br-md' 
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-md shadow-sm border border-slate-100 dark:border-slate-700'
                      }`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ))
                )}
                {isThinking ? (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 size={14} className="animate-spin" />
                        Agent 正在思考中...（预计20-40秒）
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Bottom bar: single element, no sibling conditionals */}
              {renderAgentBottomBar()}
            </div>
          </div>
        )}

        {viewMode === 'floors' && activeTask && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Floor Thumbnails */}
            <div className="w-52 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-white dark:bg-slate-950">
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  楼层 ({activeTask.floors.length})
                </span>
                {activeTask.status === 'generating' ? (
                  <span className="flex items-center gap-1 text-[10px] text-purple-500">
                    <Loader2 size={10} className="animate-spin" />
                    生成中
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">
                    已选 {activeTask.floors.filter(f => f.selected).length}
                  </span>
                )}
              </div>

              <div className="p-1.5 space-y-1">
                {activeTask.floors.map((floor, idx) => (
                  <div
                    key={floor.id}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null && dragIdx !== idx) {
                        handleFloorReorder(dragIdx, idx);
                      }
                      setDragIdx(null);
                    }}
                    onClick={() => { setActiveFloorIdx(idx); setShowFloorModify(false); }}
                    className={`group relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      activeFloorIdx === idx 
                        ? 'border-indigo-500 shadow-md shadow-indigo-500/10' 
                        : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                    } ${dragIdx === idx ? 'opacity-50' : ''}`}
                  >
                    {/* Floor header */}
                    <div className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-800 text-[10px]">
                      <div className="flex items-center gap-1">
                        <GripHorizontal size={9} className="text-slate-400 cursor-grab" />
                        <span className="font-semibold text-slate-600 dark:text-slate-300">{idx + 1}F</span>
                        {floor.history.length > 1 ? (
                          <span className="text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1 rounded text-[9px]">
                            v{floor.history.length}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[9px]">{floor.ratio}</span>
                        <input
                          type="checkbox"
                          checked={floor.selected}
                          onChange={() => handleFloorToggleSelect(idx)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Floor image thumbnail */}
                    <div className="relative aspect-[3/4] bg-white dark:bg-slate-900">
                      <img src={floor.url} alt={`楼层${idx + 1}`} className="w-full h-full object-contain" />
                      
                      {/* Insert buttons - always in DOM, hidden via CSS when not completed */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          insertTargetRef.current = { idx, position: 'before' };
                          insertImgRef.current?.click();
                        }}
                        className={`absolute top-1 left-1 w-4 h-4 bg-indigo-600/80 text-white rounded-full flex items-center justify-center transition-opacity ${
                          activeTask.status === 'completed' ? 'opacity-0 group-hover:opacity-100' : 'hidden'
                        }`}
                        title="在前面插入"
                      >
                        <ArrowUp size={8} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          insertTargetRef.current = { idx, position: 'after' };
                          insertImgRef.current?.click();
                        }}
                        className={`absolute top-1 right-1 w-4 h-4 bg-indigo-600/80 text-white rounded-full flex items-center justify-center transition-opacity ${
                          activeTask.status === 'completed' ? 'opacity-0 group-hover:opacity-100' : 'hidden'
                        }`}
                        title="在后面插入"
                      >
                        <ArrowDown size={8} />
                      </button>

                      {/* Hover action overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveFloorIdx(idx); setShowFloorHistory(true); setHistoryIdx(floor.history.indexOf(floor.url)); }}
                          className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg transition-colors" title="预览"
                        >
                          <Eye size={11} className="text-white" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFloorRegenerate(idx); }}
                          className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg transition-colors" title="重新生成"
                        >
                          <RefreshCw size={11} className="text-white" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveFloorIdx(idx); setShowFloorModify(true); }}
                          className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg transition-colors" title="修改"
                        >
                          <Edit3 size={11} className="text-white" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setInpaintFloorIdx(idx); }}
                          className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg transition-colors" title="局部重绘"
                        >
                          <Paintbrush size={11} className="text-white" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveFloorIdx(idx); setTextEditorFloorIdx(idx); }}
                          className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg transition-colors" title="文字编辑"
                        >
                          <Type size={11} className="text-white" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadSingle(floor.url, `楼层${idx + 1}.png`); }}
                          className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg transition-colors" title="下载"
                        >
                          <Download size={11} className="text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: Active Floor Detail */}
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden min-w-0">
              {activeFloorIdx >= 0 && activeFloorIdx < activeTask.floors.length ? (
                <>
                  {/* Top toolbar */}
                  <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        楼层 {activeFloorIdx + 1}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded whitespace-nowrap">
                        {activeTask.floors[activeFloorIdx].ratio}
                      </span>
                      {activeTask.floors[activeFloorIdx].history.length > 1 ? (
                        <span className="text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {activeTask.floors[activeFloorIdx].history.length}个版本
                        </span>
                      ) : null}
                      <span
                        className={`text-[10px] text-slate-400 truncate ${activeTask.floors[activeFloorIdx].sectionType ? '' : 'hidden'}`}
                        title={activeTask.floors[activeFloorIdx].sectionType || ''}
                      >
                        {activeTask.floors[activeFloorIdx].sectionType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setShowFloorHistory(true); setHistoryIdx(activeTask.floors[activeFloorIdx].history.indexOf(activeTask.floors[activeFloorIdx].url)); }}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors" title="预览/历史版本"
                      >
                        <History size={15} />
                      </button>
                      <button
                        onClick={() => handleFloorRegenerate(activeFloorIdx)}
                        className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors" title="重新生成"
                      >
                        <RefreshCw size={15} />
                      </button>
                      <button
                        onClick={() => setShowFloorModify(!showFloorModify)}
                        className={`p-1.5 rounded-lg transition-colors ${showFloorModify ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`} title="修改图片"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => setInpaintFloorIdx(activeFloorIdx)}
                        className={`p-1.5 rounded-lg transition-colors ${inpaintFloorIdx === activeFloorIdx ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20'}`} title="局部重绘（画笔遮罩）"
                      >
                        <Paintbrush size={15} />
                      </button>
                      <button
                        onClick={() => setTextEditorFloorIdx(activeFloorIdx)}
                        className={`p-1.5 rounded-lg transition-colors ${textEditorFloorIdx === activeFloorIdx ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`} title="文字编辑"
                      >
                        <Type size={15} />
                      </button>
                      <button
                        onClick={() => handleDownloadSingle(activeTask.floors[activeFloorIdx].url, `${activeTask.productName}_楼层${activeFloorIdx + 1}.png`)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="下载此楼层"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Image preview area */}
                  <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                    <img
                      src={activeTask.floors[activeFloorIdx].url}
                      alt={`楼层${activeFloorIdx + 1}预览`}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                  </div>

                  {/* Modify input panel */}
                  {showFloorModify ? (
                    <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={modifyInput}
                          onChange={(e) => setModifyInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleFloorModify(activeFloorIdx); }}
                          placeholder="输入修改意见，如：调整背景颜色为暖色调..."
                          className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                        <button
                          onClick={() => handleFloorModify(activeFloorIdx)}
                          disabled={!modifyInput.trim()}
                          className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-medium text-xs rounded-lg transition-all whitespace-nowrap"
                        >
                          提交修改
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <Eye size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">点击左侧楼层查看详情</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Preview & Download */}
            <div className="w-56 flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col overflow-hidden">
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-500">
                  {activeTask.type === 'mainImage' ? '主图预览' : '长图预览'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {activeTask.floors.filter(f => f.selected).length} / {activeTask.floors.length} 层已选
                </div>
              </div>

              {/* Stacked preview */}
              <div className="flex-1 overflow-y-auto p-2">
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {activeTask.floors.filter(f => f.selected).map((floor, idx) => (
                    <img
                      key={floor.id}
                      src={floor.url}
                      alt={`预览${idx + 1}`}
                      className="w-full block"
                    />
                  ))}
                  {activeTask.floors.filter(f => f.selected).length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-slate-400">
                      请勾选楼层以预览
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Download buttons */}
              <div className="p-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <button
                  onClick={handleDownloadAll}
                  disabled={activeTask.floors.filter(f => f.selected).length === 0}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Download size={12} />
                  下载选中楼层图
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => {/* TODO: compose long image */}}
                    className="flex-1 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 font-medium text-[10px] rounded-md hover:bg-emerald-100 transition-colors"
                  >
                    拼接长图
                  </button>
                  <button
                    onClick={handleDownloadAll}
                    className="flex-1 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 font-medium text-[10px] rounded-md hover:bg-purple-100 transition-colors"
                  >
                    批量下载
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== MODALS ===== */}

      {/* Floor History/Preview Modal */}
      {showFloorHistory && activeFloorIdx >= 0 && activeTask && activeTask.floors[activeFloorIdx] && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowFloorHistory(false)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            {/* Close */}
            <button
              onClick={() => setShowFloorHistory(false)}
              className="absolute -top-2 -right-2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white z-50"
            >
              <X size={20} />
            </button>

            {/* Image */}
            <div className="flex items-center justify-center mb-4">
              <img
                src={activeTask.floors[activeFloorIdx].history[historyIdx] || activeTask.floors[activeFloorIdx].url}
                alt="预览"
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl"
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  const newIdx = historyIdx > 0 ? historyIdx - 1 : activeTask.floors[activeFloorIdx].history.length - 1;
                  setHistoryIdx(newIdx);
                  handleFloorHistorySwitch(activeFloorIdx, newIdx);
                }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-white/70 font-mono min-w-[80px] text-center">
                {historyIdx + 1} / {activeTask.floors[activeFloorIdx].history.length}
              </span>
              <button
                onClick={() => {
                  const newIdx = historyIdx < activeTask.floors[activeFloorIdx].history.length - 1 ? historyIdx + 1 : 0;
                  setHistoryIdx(newIdx);
                  handleFloorHistorySwitch(activeFloorIdx, newIdx);
                }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <p className="text-center text-xs text-white/40 mt-3">
              切换到的图片将作为该楼层的当前图片 · 按键盘左右键可切换
            </p>
          </div>
        </div>
      )}

      {/* ── Inpainting Modal ─────────────────────────────────────────── */}
      {inpaintFloorIdx !== null && activeTask && activeTask.floors[inpaintFloorIdx] && (
        <div className="fixed inset-0 z-50">
          {isInpaintLoading && (
            <div className="absolute inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
              <div className="flex items-center gap-3 px-6 py-4 bg-slate-800 rounded-2xl shadow-2xl">
                <Loader2 size={20} className="text-violet-400 animate-spin" />
                <span className="text-white text-sm font-medium">局部重绘中...</span>
              </div>
            </div>
          )}
          <InpaintingModal
            isOpen={true}
            onClose={() => setInpaintFloorIdx(null)}
            imageUrl={activeTask.floors[inpaintFloorIdx].url}
            onGenerate={handleFloorInpaintGenerate}
          />
        </div>
      )}

      {/* ── Text Editor Modal ────────────────────────────────────────── */}
      {textEditorFloorIdx !== null && activeTask && activeTask.floors[textEditorFloorIdx] && (
        <TextEditorModal
          imageUrl={activeTask.floors[textEditorFloorIdx].url}
          onSave={handleTextEditorSave}
          onClose={() => setTextEditorFloorIdx(null)}
        />
      )}
    </div>
  );
}
