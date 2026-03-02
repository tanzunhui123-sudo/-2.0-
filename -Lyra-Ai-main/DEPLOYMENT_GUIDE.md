# Lyra AI 应用部署指南

## 项目状态 ✅

已完成以下部署准备步骤：

- ✅ 安装 npm 依赖（148 个包）
- ✅ 创建 `.env.local` 配置文件
- ✅ 生产构建成功
- ✅ 开发服务器启动成功

---

## 运行应用

### 1️⃣ 本地开发模式

开发服务器已运行在：**http://localhost:3000**

```bash
npm run dev
```

### 2️⃣ 生产构建

构建产物位置：`./dist/`

```bash
npm run build
```

### 3️⃣ 预览生产版本

```bash
npm run preview
```

---

## 🔑 配置 Gemini API 密钥

### 步骤：

1. **获取 API 密钥**
   - 访问：https://aistudio.google.com/app/apikey
   - 创建一个新的 API 密钥

2. **更新 `.env.local` 文件**
   
   编辑项目根目录的 `.env.local` 文件：
   ```env
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **重启开发服务器**
   ```bash
   npm run dev
   ```

---

## 🚀 部署选项

### 选项 1：Vercel（推荐）
```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 部署项目
vercel
```

**环境变量配置：**
- 在 Vercel 项目设置中添加 `VITE_GEMINI_API_KEY`

### 选项 2：Netlify
```bash
# 1. 安装 Netlify CLI
npm install -g netlify-cli

# 2. 部署
netlify deploy --prod --dir=dist
```

### 选项 3：用 Docker 部署

创建 `Dockerfile`：
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

RUN npm run build

FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

构建和运行：
```bash
docker build --build-arg VITE_GEMINI_API_KEY=your_key -t lyra-ai .
docker run -p 80:80 lyra-ai
```

### 选项 4：静态托管（GitHub Pages、AWS S3 等）

1. 构建项目：
   ```bash
   npm run build
   ```

2. 上传 `dist/` 文件夹到你的托管服务

---

## 📋 项目结构

```
-Lyra-Ai-main/
├── App.tsx              # 主应用组件
├── components/          # React 组件
│   ├── InpaintingModal.tsx
│   └── MessageBubble.tsx
├── constants.ts         # 常量定义
├── types.ts             # TypeScript 类型
├── utils.ts             # 工具函数
├── index.tsx            # React 入口
├── index.html           # HTML 主页
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
├── package.json         # 项目依赖
├── .env.local           # ⚠️ API 密钥配置（不要提交到 Git）
└── dist/                # 构建输出（生产部署）
```

---

## ⚠️ 安全提示

1. **不要提交 `.env.local`**
   ```bash
   echo ".env.local" >> .gitignore
   ```

2. **保护 API 密钥**
   - 不要在代码中硬编码 API 密钥
   - 使用环境变量管理敏感信息
   - 定期轮换 API 密钥

3. **生产环保**
   - 使用服务端代理 API 调用（推荐）
   - 实施请求限流和身份验证

---

## 🛠️ 技术栈

- **前端框架**：React 19
- **构建工具**：Vite 6
- **语言**：TypeScript
- **样式**：Tailwind CSS
- **AI API**：Google Gemini
- **UI 组件库**：Lucide React

---

## 📞 常见问题

### Q: API 密钥不生效？
**A**: 确保：
- `.env.local` 文件存在且格式正确
- 重启开发服务器
- 检查 API 密钥是否有效

### Q: 构建失败？
**A**: 尝试：
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Q: 端口 3000 已被占用？
**A**: 修改 `vite.config.ts` 中的端口设置，或：
```bash
# 使用不同端口
VITE_PORT=3001 npm run dev
```

---

## 📚 更多资源

- [React 官方文档](https://react.dev)
- [Vite 官方文档](https://vitejs.dev)
- [Google Gemini API](https://ai.google.dev/docs)
- [Tailwind CSS](https://tailwindcss.com)
