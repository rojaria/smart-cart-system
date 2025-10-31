# 임베디드 시스템 데이터 구조 가이드

이 문서는 임베디드 시스템(ESP32 등)이 Firebase Realtime Database와 상호작용할 때 알아야 하는 데이터 구조를 설명합니다.

---

## 📱 **바코드 스캔 시 장바구니 데이터 구조**

### **1. 상품 정보 저장 (products/{barcode})**

상품이 처음 스캔될 때 Firebase에 저장되는 기본 상품 정보입니다.

```json
{
  "products": {
    "8801234567890": {
      "name": "신라면",
      "price": 3500,
      "inStock": 100,
      "imageUrl": "https://example.com/shinramyun.jpg"
    },
    "8801234567891": {
      "name": "콜라",
      "price": 1500,
      "inStock": 50,
      "imageUrl": "https://example.com/coke.jpg"
    },
    "8801234567892": {
      "name": "사과",
      "price": 2000,
      "inStock": 30,
      "imageUrl": "https://example.com/apple.jpg"
    }
  }
}
```

**필드 설명:**
- `barcode`: 상품 바코드 (고유키, 문자열)
- `name`: 상품명 (문자열)
- `price`: 가격 (숫자, 원 단위)
- `inStock`: 재고 수량 (숫자)
- `imageUrl`: 상품 이미지 URL (문자열, 선택사항)

### **2. 카트에 상품 추가 (carts/{cartNumber}/items/{barcode})**

바코드 스캔 시 카트에 상품이 추가되는 구조입니다.

```json
{
  "carts": {
    "001": {
      "inUse": true,
      "userId": "user_UID_123",
      "assignedAt": 1703123400000,
      "lastUpdated": 1703123450000,
      "items": {
        "8801234567890": {
          "name": "신라면",
          "price": 3500,
          "quantity": 2,
          "detectedAt": 1703123450000
        },
        "8801234567891": {
          "name": "콜라", 
          "price": 1500,
          "quantity": 1,
          "detectedAt": 1703123451000
        }
      }
    },
    "002": {
      "inUse": false,
      "userId": null,
      "assignedAt": null,
      "lastUpdated": 1703123400000,
      "items": {}
    }
  }
}
```

**카트 메타데이터:**
- `inUse`: 카트 사용 중 여부 (boolean)
- `userId`: 현재 사용자 ID (문자열 또는 null)
- `assignedAt`: 카트 할당 시간 (timestamp)
- `lastUpdated`: 마지막 업데이트 시간 (timestamp)

**카트 아이템 데이터:**
- `name`: 상품명 (products에서 복사)
- `price`: 가격 (products에서 복사)
- `quantity`: 수량 (숫자, 스캔할 때마다 증가)
- `detectedAt`: 마지막 스캔 시간 (timestamp)

### **3. 사용자 카트 할당 (users/{userId})**

사용자가 카트를 등록했을 때의 정보입니다.

```json
{
  "users": {
    "user_UID_123": {
      "email": "user@example.com",
      "points": 150,
      "totalDistance": 1200,
      "cartNumber": "001",
      "createdAt": 1678886400000,
      "lastUpdated": 1703123450000
    }
  }
}
```

**사용자 데이터:**
- `email`: 사용자 이메일 (문자열)
- `points`: 현재 포인트 (숫자)
- `totalDistance`: 총 이동거리 (숫자, 미터 단위)
- `cartNumber`: 현재 할당된 카트 번호 (문자열)
- `createdAt`: 계정 생성 시간 (timestamp)
- `lastUpdated`: 마지막 업데이트 시간 (timestamp)

---

## 🎯 **포인트 이벤트 데이터 구조**

### **1. 포인트 이벤트 저장 (users/{userId}/pointEvents/{eventId})**

포인트가 적립되거나 사용될 때 생성되는 이벤트입니다.

```json
{
  "users": {
    "user_UID_123": {
      "pointEvents": {
        "event_001": {
          "amount": 50,
          "type": "earned",
          "reason": "location_event",
          "zoneId": "zone1",
          "description": "이벤트 구역 방문",
          "timestamp": 1703123456789,
          "processed": false
        },
        "event_002": {
          "amount": 3,
          "type": "earned", 
          "reason": "distance",
          "description": "이동거리 적립",
          "timestamp": 1703123457000,
          "processed": false
        },
        "event_003": {
          "amount": -20,
          "type": "used",
          "reason": "purchase",
          "orderId": "ORDER_123456",
          "description": "포인트 사용",
          "timestamp": 1703123458000,
          "processed": false
        },
        "event_004": {
          "amount": 0,
          "type": "system",
          "reason": "signup",
          "description": "회원가입 완료",
          "timestamp": 1703123459000,
          "processed": false
        }
      }
    }
  }
}
```

**포인트 이벤트 필드:**
- `amount`: 포인트 양 (숫자, 양수: 적립, 음수: 사용, 0: 시스템 이벤트)
- `type`: 이벤트 타입 ("earned" | "used" | "system")
- `reason`: 이벤트 사유 ("distance" | "location_event" | "purchase" | "signup")
- `zoneId`: 이벤트 구역 ID (문자열, location_event일 때만)
- `orderId`: 주문 ID (문자열, purchase일 때만)
- `description`: 이벤트 설명 (문자열)
- `timestamp`: 발생 시간 (timestamp)
- `processed`: 프론트엔드 처리 여부 (boolean, 초기값: false)

### **2. 사용자 총 포인트 업데이트 (users/{userId}/points)**

포인트 이벤트 발생 시 사용자의 총 포인트를 업데이트합니다.

```json
{
  "users": {
    "user_UID_123": {
      "points": 133,  // 현재 총 포인트
      "totalDistance": 1200  // 총 이동거리 (미터)
    }
  }
}
```

---

## 🔧 **임베디드 시스템 작업 가이드**

### **바코드 스캔 시 처리 과정:**

1. **상품 존재 확인**
   ```javascript
   // Firebase 경로: products/{barcode}
   // 상품이 없으면 새로 생성, 있으면 기존 정보 사용
   ```

2. **카트에 상품 추가**
   ```javascript
   // Firebase 경로: carts/{cartNumber}/items/{barcode}
   // 기존 상품이면 quantity++, 없으면 새로 추가
   // detectedAt을 현재 시간으로 설정
   ```

3. **카트 메타데이터 업데이트**
   ```javascript
   // Firebase 경로: carts/{cartNumber}
   // lastUpdated를 현재 시간으로 업데이트
   ```

### **포인트 이벤트 발생 시 처리 과정:**

1. **이벤트 생성**
   ```javascript
   // Firebase 경로: users/{userId}/pointEvents/{newEventId}
   // 새로운 이벤트 ID로 데이터 추가
   // processed: false로 설정
   ```

2. **사용자 포인트 업데이트**
   ```javascript
   // Firebase 경로: users/{userId}/points
   // earned 타입이면 증가, used 타입이면 감소
   ```

3. **이동거리 업데이트 (distance 이벤트인 경우)**
   ```javascript
   // Firebase 경로: users/{userId}/totalDistance
   // 이동거리 누적
   ```

---

## 📋 **이벤트 타입별 상세 가이드**

### **1. 이동거리 포인트 (distance)**
```json
{
  "amount": 3,  // 10m당 1포인트 (예: 30m 이동 = 3포인트)
  "type": "earned",
  "reason": "distance",
  "description": "이동거리 적립",
  "timestamp": 1703123457000,
  "processed": false
}
```

### **2. 이벤트 구역 방문 (location_event)**
```json
{
  "amount": 50,  // 고정 보너스 포인트
  "type": "earned",
  "reason": "location_event",
  "zoneId": "zone1",  // 구역 ID
  "description": "이벤트 구역 방문",
  "timestamp": 1703123456789,
  "processed": false
}
```

### **3. 구매 포인트 사용 (purchase)**
```json
{
  "amount": -20,  // 음수 (사용)
  "type": "used",
  "reason": "purchase",
  "orderId": "ORDER_123456",  // 주문 ID
  "description": "포인트 사용",
  "timestamp": 1703123458000,
  "processed": false
}
```

### **4. 시스템 이벤트 (signup)**
```json
{
  "amount": 0,  // 포인트 변화 없음
  "type": "system",
  "reason": "signup",
  "description": "회원가입 완료",
  "timestamp": 1703123459000,
  "processed": false
}
```

---

## 🚨 **주의사항**

1. **타임스탬프**: 모든 시간은 JavaScript `Date.now()` 형식 (밀리초 단위)
2. **고유 ID**: 이벤트 ID는 고유해야 하므로 `Date.now() + Math.random()` 사용 권장
3. **트랜잭션**: 포인트 업데이트와 이벤트 생성은 원자적으로 처리
4. **에러 처리**: Firebase 연결 실패 시 재시도 로직 구현
5. **프론트엔드 처리**: `processed: false`로 설정된 이벤트만 Toast 알림 표시

---

## 📞 **문의사항**

데이터 구조나 구현에 대한 문의사항이 있으시면 개발팀에 연락해주세요.

**Firebase 프로젝트**: capstone-765-bd2ce  
**데이터베이스 URL**: https://capstone-765-bd2ce-default-rtdb.firebaseio.com


