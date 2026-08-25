# Node 服务；Python 子进程由宿主机 Miniconda 的 valorant-ocr 环境挂载提供（见 docker-compose.yml）
FROM node:22-bookworm-slim
# 国内部署：Debian 源换腾讯云镜像，安装 PaddleOCR/OpenCV 所需系统库
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g; s|security.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV TZ=Asia/Shanghai
EXPOSE 3200
CMD ["node", "server.js"]
