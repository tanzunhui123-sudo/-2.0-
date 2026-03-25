@echo off
REM Lyra AI Application Launcher for Windows

setlocal enabledelayedexpansion

cd /d "%~dp0-Lyra-Ai-main"

echo.
echo ╔════════════════════════════════════════════╗
echo ║     Lyra AI - Windows 快速启动             ║
echo ╚════════════════════════════════════════════╝
echo.

REM Check Node.js
where node >nul 2>nul
if !errorlevel! neq 0 (
    echo ❌ 错误: 未找到 Node.js
    echo 请访问 https://nodejs.org 安装 Node.js
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js 版本: %NODE_VERSION%

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✅ npm 版本: %NPM_VERSION%
echo.

REM Check dependencies
if not exist "node_modules\" (
    echo 📦 安装依赖...
    call npm install
    echo.
)

REM Check .env.local
if not exist ".env.local" (
    echo ⚠️  缺少 .env.local 文件
    echo 正在创建配置文件...
    (
        echo # Gemini API Key (必需^)
        echo # 获取 API 密钥：https://aistudio.google.com/app/apikey
        echo VITE_GEMINI_API_KEY=your_gemini_api_key_here
        echo GEMINI_API_KEY=your_gemini_api_key_here
    ) > .env.local
    echo ✅ 已创建 .env.local
    echo ⚠️  请编辑 .env.local 并设置你的 Gemini API 密钥
    echo.
)

REM Menu
echo 请选择运行模式:
echo.
echo 1) 开发模式 (npm run dev) - 热重载
echo 2) 生产构建 (npm run build) - 构建优化版本
echo 3) 预览构建 (npm run preview) - 预览生产版本
echo.

set /p choice="请输入选项 (1-3, 默认: 1): "
if "%choice%"=="" set choice=1

echo.

if "%choice%"=="1" (
    echo 🚀 启动开发服务器...
    echo 访问地址: http://localhost:3000
    echo.
    call npm run dev
) else if "%choice%"=="2" (
    echo 🔨 构建生产版本...
    call npm run build
    echo.
    echo ✅ 构建完成！
    echo 📁 输出目录: .\dist
    echo.
    echo 接下来可以：
    echo   - npm run preview (预览构建^)
    echo   - 部署 dist\ 目录到任何静态托管服务
    echo   - 参考 DEPLOYMENT_GUIDE.md 查看详细部署步骤
) else if "%choice%"=="3" (
    echo 📺 预览生产版本...
    echo 访问地址: http://localhost:4173
    echo.
    call npm run preview
) else (
    echo ❌ 无效选项，请输入 1-3
    pause
    exit /b 1
)

pause
