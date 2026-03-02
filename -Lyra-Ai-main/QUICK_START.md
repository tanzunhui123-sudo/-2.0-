# 🚀 Lyra AI - 快速开始指南

## ⚡ 30 秒快速启动

### **方式 1：使用启动脚本（推荐）**

#### 🐧 Linux / macOS:
```bash
cd -Lyra-Ai-main
bash ../start.sh
```

#### 🪟 Windows:
```bash
cd -Lyra-Ai-main
..\start.bat
```

### **方式 2：手动命令**

```bash
cd -Lyra-Ai-main/-Lyra-Ai-main

# 1️⃣ 安装依赖（如果未安装）
npm install

# 2️⃣ 配置 API 密钥
# 编辑 .env.local 文件，设置你的 Gemini API 密钥

# 3️⃣ 启动开发服务器
npm run dev

# 4️⃣ 在浏览器中打开
# 访问 http://localhost:3000
```

---

## 📋 前提条件

- ✅ **Node.js 16+** （[下载](https://nodejs.org)）
- ✅ **Gemini API 密钥** （[获取](https://aistudio.google.com/app/apikey)）

---

## 🔑 配置 Gemini API 密钥

1. 访问 https://aistudio.google.com/app/apikey
2. 创建 API 密钥
3. 编辑项目中的 `.env.local` 文件：
   ```env
   VITE_GEMINI_API_KEY=your_key_here
   GEMINI_API_KEY=your_key_here
   ```
4. 保存并重启服务器

---

## 📦 项目已部署准备

| 检查项 | 状态 | 说明 |
|------|------|------|
| ✅ 依赖安装 | 完成 | 148 个包 |
| ✅ 构建配置 | 完成 | Vite 已配置 |
| ✅ 环境文件 | 完成 | `.env.local` 已创建 |
| ✅ 生产构建 | 完成 | `dist/` 已生成 |
| ⏳ 开发服务器 | 运行中 | http://localhost:3000 |
| ⚠️  API 密钥 | **待配置** | 编辑 `.env.local` |

---

## 📚 常用命令

```bash
# 开发（热重载）
npm run dev

# 生产构建
npm run build

# 预览生产版本
npm run preview

# 检查依赖
npm list

# 更新依赖
npm update
```

---

## 🌐 部署选项

| 平台 | 难度 | 时间 | 说明 |
|------|------|------|------|
| **[Vercel](https://vercel.com)** | 🟢 简易 | 2 分钟 | 推荐，自动 CI/CD |
| **[Netlify](https://netlify.com)** | 🟢 简易 | 3 分钟 | 拖放部署 |
| **[CloudFlare Pages](https://pages.cloudflare.com)** | 🟢 简易 | 3 分钟 | 快速全球 CDN |
| **[GitHub Pages](https://pages.github.com)** | 🟡 中等 | 5 分钟 | 免费静态托管 |
| **[Docker](https://docker.com)** | 🟡 中等 | 10 分钟 | 容器化部署 |
| **[AWS S3 + CloudFront](https://aws.amazon.com)** | 🔴 复杂 | 15 分钟 | 企业级方案 |

### 快速 Vercel 部署：
```bash
npm install -g vercel
vercel
```

详见 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

## 🛠️ 技术栈

```
├── React 19          (UI 框架)
├── Vite 6            (构建工具)
├── TypeScript        (类型安全)
├── Tailwind CSS      (样式)
├── Google Gemini API (AI)
└── Lucide React      (图标)
```

---

## 🆘 故障排查

### 问题：开发服务器无法启动

**解决：**
```bash
# 清空缓存
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### 问题：API 密钥无效

**检查清单：**
- [ ] `.env.local` 文件存在
- [ ] 密钥正确复制（无空格）
- [ ] 服务器已重启
- [ ] API 密钥未过期

### 问题：端口 3000 已被占用

**解决：**
```bash
# 使用不同端口
npm run dev -- --port 3001
```

---

## 📞 获取帮助

- 📖 [Vite 文档](https://vitejs.dev)
- 🔗 [React 文档](https://react.dev)
- 🤖 [Google Gemini API](https://ai.google.dev)
- 🎨 [Tailwind CSS](https://tailwindcss.com)

---

## 📄 许可证

本项目遵循原许可证。

---

**祝你使用愉快！🎉**
