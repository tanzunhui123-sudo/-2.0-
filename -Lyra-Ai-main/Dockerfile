# 生产构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY -Lyra-Ai-main/package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY -Lyra-Ai-main/ ./

# 构建应用
ARG VITE_GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

RUN npm run build

# 生产镜像
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置（含 KIE.AI 反向代理）
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    client_max_body_size 50M; \
    \
    location /kie-upload/ { \
        proxy_pass https://kieai.redpandaai.co/; \
        proxy_set_header Host kieai.redpandaai.co; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_ssl_server_name on; \
    } \
    \
    location /kie-api/ { \
        proxy_pass https://api.kie.ai/; \
        proxy_set_header Host api.kie.ai; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_ssl_server_name on; \
    } \
    \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
