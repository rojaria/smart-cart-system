# Node.js 18 Alpine 기반 이미지
FROM node:18-alpine AS base

WORKDIR /app

# 종속성 설치를 위한 패키지 파일만 먼저 복사
COPY package*.json ./

# 모든 의존성 설치 (ESM 모듈을 위해 devDependencies도 필요할 수 있음)
RUN npm ci

# 애플리케이션 소스 복사
COPY . .

# 환경 변수 및 포트 설정
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# 서버 실행
CMD ["node", "mysql-api-server.js"]


