# Firebase Hosting 배포 전 체크리스트

## ✅ 확인 사항

### 1. 환경 변수 설정 (중요!)
Firebase Hosting은 클라이언트 사이드만 배포하므로 `.env` 파일은 사용할 수 없습니다.
빌드 시점에 환경 변수를 설정해야 합니다.

**필요한 환경 변수:**
- `VITE_API_BASE_URL`: API 서버 URL (기본값 있음)
- `VITE_TOSS_CLIENT_KEY`: 토스페이먼츠 클라이언트 키 (기본값 있음)
- `VITE_TOSS_SECRET_KEY`: 토스페이먼츠 시크릿 키 (기본값 있음)

### 2. 현재 상황
- ✅ API_BASE_URL: 기본값이 설정되어 있음
- ✅ TOSS_CLIENT_KEY: 기본값이 설정되어 있음
- ✅ TOSS_SECRET_KEY: 기본값이 설정되어 있음
- ⚠️ Admin Panel의 API_BASE: 기본값이 비어있음!

### 3. Admin Panel 문제
`admin-panel/src/components/RefundManagement.jsx`에서:
```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
```
기본값이 빈 문자열이므로 환경 변수가 없으면 API 호출이 실패합니다.

## 🔧 해결 방법

### Option 1: .env 파일 생성 (로컬 빌드)
배포 전에 `.env.production` 파일 생성:
```env
VITE_API_BASE_URL=https://smartcart-api-1060519036613.asia-northeast3.run.app
VITE_TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm
VITE_TOSS_SECRET_KEY=test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6
```

그 다음:
```bash
npm run build
firebase deploy --only hosting
```

### Option 2: Firebase CLI로 환경 변수 설정 (권장)
Firebase Hosting은 환경 변수를 지원하지 않으므로, 빌드 전에 설정해야 합니다.

PowerShell에서:
```powershell
$env:VITE_API_BASE_URL = "https://smartcart-api-1060519036613.asia-northeast3.run.app"
$env:VITE_TOSS_CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm"
$env:VITE_TOSS_SECRET_KEY = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6"
npm run build
firebase deploy --only hosting
```

### Option 3: Admin Panel 코드 수정 (완료)
RefundManagement.jsx에서 기본값 추가됨 ✅

## ⚠️ 주의사항
1. 토스페이먼츠 키는 테스트 키가 기본값으로 설정되어 있으므로 결제는 테스트 모드로 동작합니다.
2. 프로덕션 환경에서는 실제 결제 키로 변경해야 합니다.
3. Admin Panel은 별도의 URL로 배포되어야 합니다 (my-app과 분리).

## 📝 배포 순서
1. Admin Panel API_BASE 기본값 수정 또는 환경 변수 설정
2. `npm run build` 실행
3. `firebase deploy --only hosting` 실행

