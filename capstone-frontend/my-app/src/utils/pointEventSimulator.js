// 임베디드 개발자를 위한 포인트 이벤트 시뮬레이터
import { ref, push, set, get } from "firebase/database";
import { database } from "../firebase";

// 거리 이동으로 포인트 적립 시뮬레이션
export const simulateDistancePoints = async (userId, distance) => {
  const earnedPoints = Math.floor(distance / 10); // 10m당 1포인트
  
  if (earnedPoints > 0) {
    console.log(`🚶‍♂️ 거리 이동: ${distance}m → ${earnedPoints}포인트 적립`);
    
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
    const currentPoints = await get(userPointsRef).then(snapshot => snapshot.val()) || 0;
    await set(userPointsRef, currentPoints + earnedPoints);
    
    // 3. 포인트 히스토리 저장
    const historyRef = push(ref(database, `users/${userId}/pointHistory`));
    await set(historyRef, {
      amount: earnedPoints,
      type: "earned",
      reason: "distance",
      timestamp: Date.now()
    });
    
    return earnedPoints;
  }
  return 0;
};

// 이벤트 구역 방문으로 포인트 적립 시뮬레이션
export const simulateLocationEventPoints = async (userId, zoneId) => {
  const bonusPoints = 50; // 이벤트 구역 보너스 포인트
  
  console.log(`🎯 이벤트 구역 방문: ${zoneId} → ${bonusPoints}포인트 적립`);
  
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
  const currentPoints = await get(userPointsRef).then(snapshot => snapshot.val()) || 0;
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
  
  return bonusPoints;
};

// 구매로 포인트 적립 시뮬레이션
export const simulatePurchasePoints = async (userId, amount) => {
  const earnedPoints = Math.floor(amount * 0.01); // 구매 금액의 1%
  
  if (earnedPoints > 0) {
    console.log(`🛒 구매: ${amount}원 → ${earnedPoints}포인트 적립`);
    
    // 1. 포인트 이벤트 생성
    const eventRef = push(ref(database, `users/${userId}/pointEvents`));
    await set(eventRef, {
      amount: earnedPoints,
      type: "earned",
      reason: "purchase",
      timestamp: Date.now(),
      processed: false
    });
    
    // 2. 사용자 포인트 업데이트
    const userPointsRef = ref(database, `users/${userId}/points`);
    const currentPoints = await get(userPointsRef).then(snapshot => snapshot.val()) || 0;
    await set(userPointsRef, currentPoints + earnedPoints);
    
    // 3. 포인트 히스토리 저장
    const historyRef = push(ref(database, `users/${userId}/pointHistory`));
    await set(historyRef, {
      amount: earnedPoints,
      type: "earned",
      reason: "purchase",
      timestamp: Date.now()
    });
    
    return earnedPoints;
  }
  return 0;
};

// 테스트용 함수들 (개발자 콘솔에서 사용)
window.simulateDistancePoints = simulateDistancePoints;
window.simulateLocationEventPoints = simulateLocationEventPoints;
window.simulatePurchasePoints = simulatePurchasePoints;


