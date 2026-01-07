FROM node:20-alpine AS builder

# 設定工作目錄
WORKDIR /app

# 複製項目文件
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# 安裝所有依賴（包含開發依賴，用於構建）
RUN npm install

# 構建應用
RUN npm run build

# 生產階段
FROM node:20-alpine

# 設定工作目錄
WORKDIR /app

# 設定標籤
LABEL maintainer="User-Feedback Team"
LABEL description="MCP User Feedback Collector - Based on Node.js"
LABEL version="2.3.0"

# 複製 package 文件
COPY package*.json ./

# 僅安裝生產依賴
RUN npm install --omit=dev

# 從構建階段複製編譯後的文件
COPY --from=builder /app/dist ./dist

# 暴露埠
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# 設定環境變數
ENV NODE_ENV=production
ENV MCP_TRANSPORT=sse
ENV MCP_WEB_PORT=3000
ENV MCP_DIALOG_TIMEOUT=60000

# 啟動應用（使用 SSE 傳輸模式）
CMD ["node", "dist/cli.js", "start", "--transport", "sse"]
