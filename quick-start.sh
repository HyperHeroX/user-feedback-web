#!/bin/bash

################################################################################
# Quick Start Script - Download and Run
# 一鍵下載並運行
################################################################################

set -e

# 顏色
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "================================================================================"
echo "  🚀 User-Feedback Web - Quick Start"
echo "================================================================================"
echo -e "${NC}"
echo ""

# 檢查 Node.js
echo -e "${BLUE}→${NC} 檢查 Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗${NC} 找不到 Node.js"
    echo ""
    echo "請從以下位置下載並安裝 Node.js 18 或以上版本："
    echo "  https://nodejs.org"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node --version) 已安裝"
echo ""

# 檢查 Git
echo -e "${BLUE}→${NC} 檢查 Git..."
if ! command -v git &> /dev/null; then
    echo -e "${RED}✗${NC} 找不到 Git"
    exit 1
fi
echo -e "${GREEN}✓${NC} Git 已安裝"
echo ""

# 建立工作目錄
APP_DIR="$HOME/user-feedback-web"
echo -e "${BLUE}→${NC} 工作目錄：$APP_DIR"
mkdir -p "$APP_DIR"
cd "$APP_DIR"
echo ""

# 克隆倉庫
echo -e "${BLUE}→${NC} 克隆倉庫..."
if [ -d ".git" ]; then
    git pull origin main
else
    git clone https://github.com/HyperHeroX/user-feedback-web.git . --depth 1
fi
echo -e "${GREEN}✓${NC} 倉庫已準備"
echo ""

# 安裝依賴
echo -e "${BLUE}→${NC} 安裝依賴（可能需要幾分鐘）..."
npm install --production
echo -e "${GREEN}✓${NC} 依賴安裝完成"
echo ""

# 構建
echo -e "${BLUE}→${NC} 構建項目..."
npm run build
echo -e "${GREEN}✓${NC} 構建完成"
echo ""

# 啟動
echo -e "${BLUE}"
echo "================================================================================"
echo "  🚀 啟動系統..."
echo "================================================================================"
echo -e "${NC}"
echo ""
echo "💡 提示："
echo "  - 系統將在 http://localhost:3000 啟動"
echo "  - 按 Ctrl+C 停止運行"
echo "  - 下次運行：cd $APP_DIR && node dist/cli.js start"
echo ""

node dist/cli.js start
