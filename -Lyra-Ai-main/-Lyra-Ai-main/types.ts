export type Role = 'user' | 'assistant';
export type MessageType = 'text' | 'image';

export interface Message {
  id: number;
  role: Role;
  type: MessageType;
  content: string;
}

export type Mode = 'architect' | 'master' | 'reskin' | 'mainImage' | 'detailPage';

export type EcommercePlatform = 'taobao' | 'jd' | 'pdd' | 'douyin' | 'xiaohongshu' | 'amazon' | 'custom';

export interface PlatformSizePreset {
  label: string;
  width: number;
  height: number;
  ratio: string;
  description: string;
}

export interface PlatformConfig {
  name: string;
  icon: string;
  mainImageSizes: PlatformSizePreset[];
  detailPageSizes: PlatformSizePreset[];
  mainImageTips: string[];
  detailPageTips: string[];
}

export interface ViewAngle {
  label: string;
  value: string;
}

// ========== E-commerce Task System Types ==========

export type TaskType = 'mainImage' | 'detailPage';

export type TaskStatus = 'draft' | 'planning' | 'confirming' | 'generating' | 'completed';

export interface FloorImage {
  id: string;
  url: string;
  history: string[];      // 历史版本
  ratio: string;          // 图片比例
  sectionType?: string;   // 对应的板块类型 (详情页)
  sectionLabel?: string;  // 板块显示名
  selected: boolean;      // 是否选中用于长图合成
}

export interface TaskPlan {
  id: string;             // A / B / C
  title: string;
  description: string;
  floorPlan: string[];    // 楼层规划描述
}

export interface AgentMessage {
  id: number;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

export interface EcommerceTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  name: string;                     // 任务名称（商品名称）
  createdAt: number;
  updatedAt: number;
  // 需求信息
  productName: string;
  productInfo: string;              // 商品信息
  productImages: string[];          // 商品图片（base64）
  referenceImages: string[];        // 参考图片
  floorCount: number | 'auto';     // 楼层数量 (auto=智能规划)
  floorRatio: string | 'auto';    // 楼层比例 (auto=智能规划)
  resolution: string;              // 图片分辨率
  language: string;                // 语言
  platform: EcommercePlatform;     // 平台
  designRequirements: string;      // 设计要求
  // 方案相关
  plans: TaskPlan[];               // A/B/C 方案
  selectedPlanId: string | null;   // 选中的方案
  agentMessages: AgentMessage[];   // Agent 对话记录
  agentLocked: boolean;            // 确认后锁定对话
  // 生成结果
  floors: FloorImage[];            // 楼层图片
  longImageUrl?: string;           // 合成长图
}