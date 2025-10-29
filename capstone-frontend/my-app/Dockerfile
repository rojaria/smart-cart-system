# Google Cloud Run용 Dockerfile
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치 (프로덕션만)
RUN npm ci --only=production && npm cache clean --force

# 애플리케이션 코드 복사
COPY mysql-api-server.js ./

# 포트 설정 (Cloud Run은 PORT 환경변수 사용)
ENV PORT=8080
EXPOSE 8080

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# 애플리케이션 실행
CMD ["node", "mysql-api-server.js"]

