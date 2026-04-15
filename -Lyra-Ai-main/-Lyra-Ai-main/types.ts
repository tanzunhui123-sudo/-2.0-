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