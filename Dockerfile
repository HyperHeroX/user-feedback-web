FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 設定標籤
LABEL maintainer="User-Feedback Team"
LABEL description="MCP User Feedback Collector - Based on Node.js"
LABEL version="2.1.3"

# 複製項目文件
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# 安裝生產依賴
RUN npm ci --production

# 構建應用
RUN npm run build

# 暴露埠
EXPOSE 3000 5555

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# 設定環境變數
ENV NODE_ENV=production

# 啟動應用
CMD ["node", "dist/cli.js", "start"]
