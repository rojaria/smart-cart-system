# Firebase 데이터 구조 설계

## 포인트 이벤트 감지를 위한 데이터 구조

### 1. 사용자 포인트 (기존)
```
users/{userId}/points: number
```

### 2. 포인트 히스토리 (기존)
```
users/{userId}/pointHistory/{historyId}: {
  amount: number,        // 포인트 양 (양수: 적립, 음수: 사용)
  type: string,          // "earned" | "used"
  reason: string,        // "distance" | "location_event" | "purchase" | "test"
  zoneId?: string,       // 이벤트 구역 ID (location_event일 때)
  timestamp: number      // 이벤트 발생 시간
}
```

### 3. 실시간 포인트 이벤트 (새로 추가)
```
users/{userId}/pointEvents/{eventId}: {
  amount: number,        // 포인트 양
  type: string,          // "earned" | "used"
  reason: string,        // "distance" | "location_event" | "purchase"
  zoneId?: string,       // 이벤트 구역 ID
  timestamp: number,     // 이벤트 발생 시간
  processed: boolean     // 프론트엔드에서 처리 완료 여부
}
```

## 임베디드에서 포인트 저장 방법

### 거리 이동으로 포인트 적립
```javascript
// ESP32에서 10m 이동 감지 시
const addDistancePoints = async (userId, distance) => {
  const earnedPoints = Math.floor(distance / 10); // 10m당 1포인트
  
  if (earnedPoints > 0) {
    // 1. 포인트 이벤트 생성
    const eventRef = push(ref(database, `users/${userId}/pointEvents`));
    await set(eventRef, {
      amount: earnedPoints,
      type: "earned",
      reason: "distance",
      timestamp: Date.now(),
      processed: false
    });
    
    // 2. 사용자 포인트 업데이트
    const userPointsRef = ref(database, `users/${userId}/points`);
    const currentPoints = await get(userPointsRef).val() || 0;
    await set(userPointsRef, currentPoints + earnedPoints);
    
    // 3. 포인트 히스토리 저장
    const historyRef = push(ref(database, `users/${userId}/pointHistory`));
    await set(historyRef, {
      amount: earnedPoints,
      type: "earned",
      reason: "distance",
      timestamp: Date.now()
    });
  }
};
```

### 이벤트 구역 방문으로 포인트 적립
```javascript
// ESP32에서 특정 구역 방문 감지 시
const addLocationEventPoints = async (userId, zoneId) => {
  const bonusPoints = 50; // 이벤트 구역 보너스 포인트
  
  // 1. 포인트 이벤트 생성
  const eventRef = push(ref(database, `users/${userId}/pointEvents`));
  await set(eventRef, {
    amount: bonusPoints,
    type: "earned",
    reason: "location_event",
    zoneId: zoneId,
    timestamp: Date.now(),
    processed: false
  });
  
  // 2. 사용자 포인트 업데이트
  const userPointsRef = ref(database, `users/${userId}/points`);
  const currentPoints = await get(userPointsRef).val() || 0;
  await set(userPointsRef, currentPoints + bonusPoints);
  
  // 3. 포인트 히스토리 저장
  const historyRef = push(ref(database, `users/${userId}/pointHistory`));
  await set(historyRef, {
    amount: bonusPoints,
    type: "earned",
    reason: "location_event",
    zoneId: zoneId,
    timestamp: Date.now()
  });
};
```


