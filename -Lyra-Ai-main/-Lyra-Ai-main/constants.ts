import { Message, ViewAngle, EcommercePlatform, PlatformConfig } from './types';

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

// ========== E-commerce Platform Configurations ==========
export const ECOMMERCE_PLATFORMS: Record<EcommercePlatform, PlatformConfig> = {
  taobao: {
    name: '淘宝/天猫',
    icon: '🛒',
    mainImageSizes: [
      { label: '主图标准', width: 800, height: 800, ratio: '1:1', description: '淘宝标准主图 800x800' },
      { label: '主图高清', width: 1500, height: 1500, ratio: '1:1', description: '天猫高清主图 1500x1500' },
      { label: '3:4主图', width: 900, height: 1200, ratio: '3:4', description: '搜索结果3:4竖图' },
      { label: '9:16主图', width: 720, height: 1280, ratio: '9:16', description: '短视频/竖屏封面' },
    ],
    detailPageSizes: [
      { label: '详情页标准', width: 790, height: 1200, ratio: '790宽', description: '标准详情页宽度790px' },
      { label: '详情页窄版', width: 750, height: 1200, ratio: '750宽', description: '手机端详情页750px' },
      { label: '详情页长图', width: 790, height: 2000, ratio: '790宽长', description: '详情页超长展示' },
    ],
    mainImageTips: [
      '主图尺寸建议800x800，至少700x700',
      '第一张主图是白底图，有利于搜索曝光',
      '图片大小不超过3MB',
      '最多5张主图，第5张建议为白底图',
      '突出卖点，避免牛皮癣和过多文字',
    ],
    detailPageTips: [
      '宽度统一790px，高度不限',
      '手机端详情页宽度750px',
      '前3屏重点展示核心卖点',
      '建议10-15张详情图',
      '包含尺寸参数、材质说明、场景图',
    ],
  },
  jd: {
    name: '京东',
    icon: '🏬',
    mainImageSizes: [
      { label: '主图标准', width: 800, height: 800, ratio: '1:1', description: '京东标准主图' },
      { label: '主图高清', width: 1500, height: 1500, ratio: '1:1', description: '京东高清大图' },
      { label: 'SKU图', width: 800, height: 800, ratio: '1:1', description: 'SKU属性图' },
    ],
    detailPageSizes: [
      { label: '详情页标准', width: 990, height: 1400, ratio: '990宽', description: 'PC端详情宽度990px' },
      { label: '详情页移动', width: 750, height: 1200, ratio: '750宽', description: '移动端详情750px' },
    ],
    mainImageTips: [
      '主图尺寸800x800以上，正方形',
      '主图至少1张白底图',
      '不允许有拼接、边框、水印',
      '最多8张主图',
      '图片不超过5MB',
    ],
    detailPageTips: [
      'PC端宽度990px，移动端750px',
      '突出品质感和参数',
      '建议加入对比图和认证信息',
    ],
  },
  pdd: {
    name: '拼多多',
    icon: '🍊',
    mainImageSizes: [
      { label: '主图标准', width: 750, height: 750, ratio: '1:1', description: '拼多多标准主图' },
      { label: '主图高清', width: 1200, height: 1200, ratio: '1:1', description: '拼多多高清主图' },
      { label: '轮播长图', width: 750, height: 1000, ratio: '3:4', description: '轮播长图展示' },
    ],
    detailPageSizes: [
      { label: '详情页标准', width: 750, height: 1200, ratio: '750宽', description: '拼多多详情页标准' },
      { label: '详情页长图', width: 750, height: 1500, ratio: '750宽长', description: '长屏详情展示' },
    ],
    mainImageTips: [
      '主图750x750以上',
      '第一张白底图有助于推荐流量',
      '图片文件不超过2MB',
      '拼多多更注重性价比展示',
      '最多10张主图',
    ],
    detailPageTips: [
      '宽度750px',
      '重点突出性价比和实物效果',
      '建议加入买家秀展示',
    ],
  },
  douyin: {
    name: '抖音电商',
    icon: '🎵',
    mainImageSizes: [
      { label: '主图标准', width: 800, height: 800, ratio: '1:1', description: '抖音商品主图' },
      { label: '主图竖版', width: 750, height: 1000, ratio: '3:4', description: '抖音商品竖版图' },
      { label: '短视频封面', width: 1080, height: 1920, ratio: '9:16', description: '短视频/直播封面' },
    ],
    detailPageSizes: [
      { label: '详情页标准', width: 750, height: 1200, ratio: '750宽', description: '抖音详情页标准' },
      { label: '详情页竖版', width: 750, height: 1600, ratio: '750宽长', description: '竖版详情展示' },
    ],
    mainImageTips: [
      '主图800x800，视觉冲击力强',
      '支持短视频作为主图',
      '白底图可获得更多推荐',
      '图片风格要年轻化、潮流化',
    ],
    detailPageTips: [
      '宽度750px，简洁明了',
      '适合快速浏览，减少文字',
      '多用场景图和效果对比',
    ],
  },
  xiaohongshu: {
    name: '小红书',
    icon: '📕',
    mainImageSizes: [
      { label: '正方形', width: 1080, height: 1080, ratio: '1:1', description: '小红书方图' },
      { label: '竖版3:4', width: 1080, height: 1440, ratio: '3:4', description: '小红书竖版推荐' },
      { label: '竖版2:3', width: 1080, height: 1620, ratio: '2:3', description: '小红书长图' },
    ],
    detailPageSizes: [
      { label: '笔记详情图', width: 1080, height: 1440, ratio: '3:4', description: '笔记配图标准' },
      { label: '商品详情', width: 750, height: 1200, ratio: '750宽', description: '商品详情页' },
    ],
    mainImageTips: [
      '推荐竖版3:4比例，占屏更大',
      '封面要有吸引力，文字简洁',
      '小红书风格偏精致生活感',
      '图片质感要高级，滤镜统一',
    ],
    detailPageTips: [
      '笔记最多18张图',
      '第一张图决定点击率',
      '内容要有种草感和教程感',
    ],
  },
  amazon: {
    name: 'Amazon',
    icon: '📦',
    mainImageSizes: [
      { label: 'Main Image', width: 2000, height: 2000, ratio: '1:1', description: 'Amazon主图2000x2000' },
      { label: 'Standard', width: 1500, height: 1500, ratio: '1:1', description: 'Amazon标准图' },
      { label: 'A+竖版', width: 970, height: 600, ratio: '970宽', description: 'A+ Content Banner' },
    ],
    detailPageSizes: [
      { label: 'A+ Standard', width: 970, height: 600, ratio: '970宽', description: 'A+ Content标准模块' },
      { label: 'A+ Full Width', width: 1464, height: 600, ratio: '1464宽', description: 'A+ Content全宽' },
      { label: 'A+ Square', width: 300, height: 300, ratio: '1:1', description: 'A+ Content方图模块' },
    ],
    mainImageTips: [
      '主图必须纯白底(RGB 255,255,255)',
      '产品占图片面积85%以上',
      '最小1000px，推荐2000px',
      '不允许任何文字、Logo、水印',
      '最多9张图片',
    ],
    detailPageTips: [
      'A+ Content有固定模块尺寸',
      '图片+文字组合排版',
      '重点展示品牌故事和产品优势',
    ],
  },
  custom: {
    name: '自定义',
    icon: '⚙️',
    mainImageSizes: [
      { label: '自定义尺寸', width: 800, height: 800, ratio: '1:1', description: '自定义主图尺寸' },
    ],
    detailPageSizes: [
      { label: '自定义尺寸', width: 750, height: 1200, ratio: '750宽', description: '自定义详情页尺寸' },
    ],
    mainImageTips: ['按照目标平台要求设置尺寸'],
    detailPageTips: ['按照目标平台要求设置尺寸'],
  },
};

export const MAIN_IMAGE_STYLES = [
  { id: 'white_bg', label: '白底图', icon: '⬜', description: '纯白背景，突出产品' },
  { id: 'scene', label: '场景图', icon: '🏠', description: '产品放置在使用场景中' },
  { id: 'lifestyle', label: '生活方式', icon: '✨', description: '模特/场景搭配展示' },
  { id: 'creative', label: '创意图', icon: '🎨', description: '创意排版/设计感主图' },
  { id: 'comparison', label: '对比图', icon: '⚖️', description: '前后/规格对比展示' },
  { id: 'selling_point', label: '卖点图', icon: '💡', description: '核心卖点文案+视觉' },
];

export const DETAIL_PAGE_SECTIONS = [
  { id: 'hero', label: '首屏大图', icon: '🎯', description: '吸引注意力的首屏展示' },
  { id: 'selling_points', label: '卖点展示', icon: '💎', description: '核心卖点逐条展示' },
  { id: 'specs', label: '参数规格', icon: '📐', description: '产品尺寸/材质/参数' },
  { id: 'scene_usage', label: '场景展示', icon: '🏡', description: '产品使用场景展示' },
  { id: 'details_closeup', label: '细节特写', icon: '🔍', description: '产品细节/工艺展示' },
  { id: 'comparison', label: '对比展示', icon: '📊', description: '竞品对比/升级对比' },
  { id: 'package', label: '包装清单', icon: '📦', description: '包装内容和配件展示' },
  { id: 'brand_story', label: '品牌故事', icon: '📖', description: '品牌理念和故事' },
];