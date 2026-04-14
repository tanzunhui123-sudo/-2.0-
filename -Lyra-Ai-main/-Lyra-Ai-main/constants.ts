import { Message, ViewAngle } from './types';

export const INITIAL_MESSAGE: Message = {
  id: 1,
  role: 'assistant',
  type: 'text',
  content: "**Lyra 已就位。**\n\n我是您的专业室内家居摄影导演。请上传**白底产品图**，我将为您保留主体并生成新的家居场景。"
};

export const MOCK_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1000&auto=format&fit=crop", // Minimal Living Room
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?q=80&w=1000&auto=format&fit=crop", // Warm Wood
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1000&auto=format&fit=crop", // Modern White
  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1000&auto=format&fit=crop", // Concrete Dark
  "https://images.unsplash.com/photo-1595515106968-b43729abb1a6?q=80&w=1000&auto=format&fit=crop"  // Greenery
];

export const ASPECT_RATIOS = ['1:1', '4:3', '3:4', '9:16', '16:9', '2:3', '3:2', '4:5', '5:4', '21:9', '1:4', '4:1'];
export const RESOLUTIONS = ['1K', '2K', '4K'];
export const OUTPUT_FORMATS = ['jpg', 'png'];
export const VIEW_ANGLES: ViewAngle[] = [
  { label: '正面', value: '正面视图' },
  { label: '侧面', value: '侧面视图' },
  { label: '俯视', value: '高角度俯视图' },
  { label: '鸟瞰', value: '鸟瞰图' }
];

export const DESIGN_COLORS = [
  { name: 'Warm White', hex: '#F5F5F0' },
  { name: 'Japandi Beige', hex: '#E5DACE' },
  { name: 'Sage Green', hex: '#8DA399' },
  { name: 'Terracotta', hex: '#C27A68' },
  { name: 'Charcoal', hex: '#36454F' },
  { name: 'Navy', hex: '#2C3E50' },
  { name: 'Mustard', hex: '#E1AD01' },
  { name: 'Olive', hex: '#808000' }
];