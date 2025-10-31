# 🛒 스마트 쇼핑카트 시스템

바코드 스캔을 통한 자동 결제 시스템으로, 사용자가 스마트폰으로 상품을 스캔하고 간편하게 결제할 수 있는 웹 애플리케이션입니다.

## ✨ 주요 기능

### 🛍️ 쇼핑카트 관리
- **바코드 스캔**: 상품 자동 인식 및 장바구니 추가
- **품절 상품 처리**: 품절 상품 자동 감지 및 제외
- **실시간 가격 계산**: 품절 상품 제외한 정확한 가격 계산
- **수량 조정**: 직관적인 +/- 버튼으로 수량 변경

### 💳 결제 시스템
- **토스페이먼츠 연동**: 안전한 결제 처리
- **포인트 시스템**: 적립 및 사용 가능
- **결제 내역 저장**: Cloud SQL에 안전하게 저장
- **실시간 로그**: 모든 결제 내역 실시간 추적

### 🔐 사용자 인증
- **Firebase Auth**: 구글 계정으로 간편 로그인
- **사용자별 데이터**: 개인별 결제 내역 관리
- **보안**: SSL 암호화 통신

## 🏗️ 시스템 아키텍처

```
React 앱 (프론트엔드) → MySQL API 서버 → Cloud SQL (데이터베이스)
```

### 기술 스택
- **프론트엔드**: React.js, Vite, Tailwind CSS
- **백엔드**: Node.js, Express.js
- **데이터베이스**: Google Cloud SQL (MySQL)
- **인증**: Firebase Authentication
- **결제**: 토스페이먼츠 API
- **배포**: Firebase Hosting

## 🚀 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd capstone-frontend/my-app
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 설정
```bash
# .env 파일 생성 (필요시)
# Firebase 설정은 이미 구성되어 있습니다
```

### 4. 서버 실행

#### 방법 1: 자동화 스크립트 사용 (권장)
```bash
# Windows
demo-start.bat

# 또는 수동으로
```

#### 방법 2: 수동 실행
```bash
# 터미널 1: MySQL API 서버
node mysql-api-server.js

# 터미널 2: React 앱
npm run dev
```

### 5. 접속
- **웹 애플리케이션**: http://localhost:5173
- **API 서버**: https://smartcart-api-1060519036613.asia-northeast3.run.app

## 📊 데이터베이스 구조

### Cloud SQL 테이블
- **payment_transactions**: 결제 트랜잭션 정보
- **payment_items**: 결제 상품 상세 정보

### Firebase Realtime Database
- **cart_items**: 장바구니 상품 정보
- **product_stock**: 상품 재고 상태

## 🔧 개발 환경 설정

### 필수 요구사항
- Node.js 18+
- npm 또는 yarn
- Google Cloud SQL 접근 권한
- Firebase 프로젝트 설정

### API 엔드포인트
- `POST /api/payment/save`: 결제 데이터 저장
- `GET /api/payment/history/:userId`: 결제 내역 조회

## 📱 사용 방법

1. **로그인**: 구글 계정으로 로그인
2. **상품 스캔**: 바코드 스캔으로 상품 추가
3. **장바구니 확인**: 품절 상품 자동 제외
4. **결제**: 토스페이먼츠로 안전한 결제
5. **완료**: 결제 내역 자동 저장

## 🛡️ 보안 기능

- **SSL 암호화**: 모든 통신 암호화
- **데이터 검증**: 서버에서 모든 데이터 검증
- **SQL 인젝션 방지**: 파라미터화된 쿼리 사용
- **CORS 정책**: 안전한 크로스 오리진 요청

## 🚀 배포

### 현재 배포 상태
- **프론트엔드**: Firebase Hosting
- **데이터베이스**: Google Cloud SQL
- **API 서버**: Google Cloud Run (24/7 자동 가동)

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해주세요.

## 📄 라이선스

이 프로젝트는 교육 목적으로 개발되었습니다.