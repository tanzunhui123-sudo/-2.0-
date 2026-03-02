#!/bin/bash

# Lyra AI 应用启动脚本

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR/-Lyra-Ai-main"

echo "╔════════════════════════════════════════════╗"
echo "║     Lyra AI - 快速启动脚本                 ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请访问 https://nodejs.org 安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    echo ""
fi

# 检查 .env.local
if [ ! -f ".env.local" ]; then
    echo "⚠️  缺少 .env.local 文件"
    echo "正在创建配置文件..."
    cat > .env.local << 'EOF'
# Gemini API Key (必需)
# 获取 API 密钥：https://aistudio.google.com/app/apikey
VITE_GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
EOF
    echo "✅ 已创建 .env.local"
    echo "⚠️  请编辑 .env.local 并设置你的 Gemini API 密钥"
    echo ""
fi

# 选择运行模式
echo "请选择运行模式:"
echo ""
echo "1) 开发模式 (npm run dev) - 热重载"
echo "2) 生产构建 (npm run build) - 构建优化版本"
echo "3) 预览构建 (npm run preview) - 预览生产版本"
echo ""

read -p "请输入选项 (1-3, 默认: 1): " choice
choice=${choice:-1}

echo ""

case $choice in
    1)
        echo "🚀 启动开发服务器..."
        echo "访问地址: http://localhost:3000"
        echo ""
        npm run dev
        ;;
    2)
        echo "🔨 构建生产版本..."
        npm run build
        echo ""
        echo "✅ 构建完成！"
        echo "📁 输出目录: ./dist"
        echo ""
        echo "接下来可以："
        echo "  - npm run preview (预览构建)"
        echo "  - 部署 dist/ 目录到任何静态托管服务"
        echo "  - 参考 DEPLOYMENT_GUIDE.md 查看详细部署步骤"
        ;;
    3)
        echo "📺 预览生产版本..."
        echo "访问地址: http://localhost:4173"
        echo ""
        npm run preview
        ;;
    *)
        echo "❌ 无效选项，请输入 1-3"
        exit 1
        ;;
esac
