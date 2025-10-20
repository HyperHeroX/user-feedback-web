#!/bin/bash

################################################################################
# User-Feedback Web Launcher
# 使用者反饋收集器啟動器
################################################################################

# 設定顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 設定符號
CHECK="✓"
CROSS="✗"
ARROW="→"

# 函數：打印帶顏色的訊息
print_info() {
    echo -e "${BLUE}${ARROW}${NC} $1"
}

print_success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

print_error() {
    echo -e "${RED}${CROSS}${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

# 清除終端
clear

echo ""
echo "================================================================================"
echo "  🚀 User-Feedback Web Launcher"
echo "================================================================================"
echo ""

# 檢查 Node.js 是否安裝
print_info "檢查 Node.js..."
if ! command -v node &> /dev/null; then
    print_error "找不到 Node.js"
    echo ""
    echo "請從以下位置下載並安裝 Node.js 18 或以上版本："
    echo "  https://nodejs.org"
    echo ""
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js 已安裝"
echo "  版本：$NODE_VERSION"
echo ""

# 檢查 npm 是否安裝
print_info "檢查 npm..."
if ! command -v npm &> /dev/null; then
    print_error "找不到 npm"
    exit 1
fi

NPM_VERSION=$(npm --version)
print_success "npm 已安裝"
echo "  版本：$NPM_VERSION"
echo ""

# 設定當前目錄
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"
print_info "工作目錄：$(pwd)"
echo ""

# 如果 node_modules 不存在，則安裝依賴
if [ ! -d "node_modules" ]; then
    print_info "首次啟動，正在安裝依賴..."
    echo "  這可能需要幾分鐘時間..."
    echo ""
    npm install --production
    if [ $? -ne 0 ]; then
        print_error "安裝依賴失敗"
        echo ""
        exit 1
    fi
    print_success "依賴安裝完成"
    echo ""
else
    print_success "依賴已安裝"
    echo ""
fi

# 如果 dist 不存在，則構建項目
if [ ! -d "dist" ]; then
    print_info "首次啟動，正在構建項目..."
    npm run build
    if [ $? -ne 0 ]; then
        print_error "構建失敗"
        echo ""
        exit 1
    fi
    print_success "構建完成"
    echo ""
else
    print_success "項目已構建"
    echo ""
fi

# 啟動系統
echo "================================================================================"
echo "  🚀 正在啟動 User-Feedback Web..."
echo "================================================================================"
echo ""
echo "💡 提示："
echo "  - 系統將在 http://localhost:3000 啟動"
echo "  - 按 Ctrl+C 停止運行"
echo ""

sleep 2

node dist/cli.js start

echo ""
echo "================================================================================"
echo "  已停止"
echo "================================================================================"
