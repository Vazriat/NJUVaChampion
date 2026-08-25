# ---- 构建阶段 ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# rewrites 在构建时写入 routes-manifest，代理地址必须在构建期注入
ARG BACKEND_URL=http://backend:8080
ARG OCR_URL=http://ocr:3200
ENV BACKEND_URL=${BACKEND_URL} OCR_URL=${OCR_URL}
RUN npm run build

# ---- 运行阶段 ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
EXPOSE 3000
CMD ["npm", "run", "start"]
