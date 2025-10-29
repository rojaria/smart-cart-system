import React, { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "./firebase";

// 포인트 페이지 컴포넌트
export default function PointsPage({ user }) {
  const [points, setPoints] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [pointHistory, setPointHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let loadedCount = 0;
    const totalLoaders = 4; // points, distance, history, transactions

    const checkLoadingComplete = () => {
      loadedCount++;
      if (loadedCount >= totalLoaders) {
        setLoading(false);
      }
    };

    // 포인트 실시간 감지
    const pointsRef = ref(database, `users/${user.uid}/points`);
    const unsubPoints = onValue(pointsRef, (snapshot) => {
      setPoints(snapshot.val() || 0);
      checkLoadingComplete();
    }, (error) => {
      console.log("포인트 데이터 로드 실패:", error);
      checkLoadingComplete();
    });

    // 총 이동거리 실시간 감지
    const distanceRef = ref(database, `users/${user.uid}/totalDistance`);
    const unsubDistance = onValue(distanceRef, (snapshot) => {
      setTotalDistance(snapshot.val() || 0);
      checkLoadingComplete();
    }, (error) => {
      console.log("거리 데이터 로드 실패:", error);
      checkLoadingComplete();
    });

    // 포인트 내역 실시간 감지 (pointHistory + pointTransactions 통합)
    const historyRef = ref(database, `users/${user.uid}/pointHistory`);
    const transactionsRef = ref(database, 'pointTransactions');
    
    const processHistory = (historyData) => {
      return historyData ? Object.keys(historyData).map(key => ({ id: key, ...historyData[key] })) : [];
    };
    
    const processTransactions = (transactionsData) => {
      if (!transactionsData) return [];
      // 현재 사용자의 트랜잭션만 필터링
      return Object.keys(transactionsData)
        .map(key => ({ id: key, ...transactionsData[key] }))
        .filter(item => item.userId === user.uid);
    };
    
    let historyData = null;
    let transactionsData = null;
    
    const updateHistory = () => {
      const historyArray = processHistory(historyData);
      const transactionsArray = processTransactions(transactionsData);
      
      // 두 배열 병합
      const allHistory = [...historyArray, ...transactionsArray];
      
      // 최신순 정렬
      allHistory.sort((a, b) => b.timestamp - a.timestamp);
      
      setPointHistory(allHistory);
    };
    
    const unsubHistory = onValue(historyRef, (snapshot) => {
      historyData = snapshot.val();
      updateHistory();
      checkLoadingComplete();
    }, (error) => {
      console.log("포인트 내역 데이터 로드 실패:", error);
      checkLoadingComplete();
    });
    
    const unsubTransactions = onValue(transactionsRef, (snapshot) => {
      transactionsData = snapshot.val();
      updateHistory();
      checkLoadingComplete();
    }, (error) => {
      console.log("트랜잭션 데이터 로드 실패:", error);
      checkLoadingComplete();
    });

    return () => {
      unsubPoints();
      unsubDistance();
      unsubHistory();
      unsubTransactions();
    };
  }, [user]);

  // 포인트를 원화로 환산
  const pointsToWon = (pts) => {
    return pts * 10; // 1포인트 = 10원
  };

  // 타임스탬프를 날짜 문자열로 변환
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // 포인트 이유 한글 변환
  const getReasonText = (reason) => {
    const reasonMap = {
      "distance": "거리 적립",
      "location_event": "이벤트 적립",
      "purchase": "구매 사용",
      "earned": "적립",
      "used": "사용"
    };
    return reasonMap[reason] || reason;
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto px-6 sm:px-6 py-6 sm:py-6">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500">포인트 정보를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto px-6 sm:px-6 py-6 sm:py-6 space-y-6">
      {/* 포인트 요약 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white shadow-lg">
        <h2 className="text-xl font-bold mb-4"> 내 포인트</h2>
        
        <div className="flex justify-between items-end">
          <div>
            <p className="text-sm opacity-90 mb-1">보유 포인트</p>
            <p className="text-4xl font-bold">{points.toLocaleString()} P</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90 mb-1">현금 환산</p>
            <p className="text-2xl font-semibold">{pointsToWon(points).toLocaleString()}원</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white border-opacity-30">
          <p className="text-sm opacity-90">
          </p>
        </div>
      </div>

      {/* 포인트 적립 안내 */}
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-lg font-bold mb-4">📌 포인트 적립 방법</h3>
        <div className="space-y-3">
          <div className="flex items-start">
            <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0 mr-3">
              1
            </div>
            <div>
              <p className="font-semibold">이동 거리 적립</p>
              <p className="text-sm text-gray-600">매장 내 10m 이동 시 1포인트 적립</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mr-3">
              2
            </div>
            <div>
              <p className="font-semibold">이벤트 구역 방문</p>
              <p className="text-sm text-gray-600">특정 상품 구역 방문 시 보너스 포인트</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mr-3">
              3
            </div>
            <div>
              <p className="font-semibold">포인트 사용</p>
              <p className="text-sm text-gray-600">결제 시 1포인트 = 10원으로 사용 가능</p>
            </div>
          </div>
        </div>
      </div>

      {/* 포인트 내역 */}
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-lg font-bold mb-4">📋 포인트 내역</h3>
        
        {pointHistory.length === 0 ? (
          <p className="text-center text-gray-500 py-8">포인트 내역이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {pointHistory.map((item) => (
              <div 
                key={item.id} 
                className="flex justify-between items-center border-b pb-3 last:border-b-0"
              >
                <div>
                  <p className="font-medium">
                    {item.eventName || getReasonText(item.reason)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(item.timestamp)}
                  </p>
                  {item.distance && (
                    <p className="text-xs text-gray-400">
                      이동거리: {item.distance.toFixed(1)}m
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p 
                    className={`text-lg font-bold ${
                      item.amount > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {item.amount > 0 ? "+" : ""}{item.amount.toLocaleString()} P
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.type === "earned" ? "적립" : "사용"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 테스트 버튼 (개발용) - 주석처리됨 */}
      {/* 
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-gray-700 mb-3">
          🧪 <strong>테스트 기능</strong> (개발용)
        </p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                // Firebase에 직접 거리 데이터 추가 (테스트용)
                const { ref: dbRef, push, set } = await import("firebase/database");
                
                // 거리 데이터 추가
                const distanceRef = ref(database, `users/${user.uid}/totalDistance`);
                const currentDistance = totalDistance || 0;
                const newDistance = currentDistance + 50;
                await set(distanceRef, newDistance);
                
                // 포인트 추가 (50m = 10포인트)
                const pointsRef = ref(database, `users/${user.uid}/points`);
                const currentPoints = points || 0;
                await set(pointsRef, currentPoints + 10);
                
                // 포인트 내역 추가
                const pointHistoryRef = push(ref(database, `users/${user.uid}/pointHistory`));
                await set(pointHistoryRef, {
                  amount: 10,
                  type: "earned",
                  reason: "distance",
                  description: "50m 이동",
                  timestamp: Date.now()
                });
                
                alert("50m 이동 시뮬레이션 완료! +10포인트");
              } catch (error) {
                alert("오류: " + error.message);
              }
            }}
            className="px-4 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600"
          >
            50m 이동 시뮬레이션
          </button>
          
          <button
            onClick={async () => {
              // 임시로 Firebase에 직접 추가 (테스트용)
              const { ref: dbRef, push, set } = await import("firebase/database");
              const pointHistoryRef = push(dbRef(database, `users/${user.uid}/pointHistory`));
              await set(pointHistoryRef, {
                amount: 100,
                type: "earned",
                reason: "location_event",
                eventName: "신선식품 코너 방문",
                timestamp: Date.now()
              });
              
              const userPointsRef = dbRef(database, `users/${user.uid}/points`);
              const { get } = await import("firebase/database");
              const snapshot = await get(userPointsRef);
              const currentPoints = snapshot.val() || 0;
              await set(userPointsRef, currentPoints + 100);
              
              alert("이벤트 포인트 100점이 적립되었습니다!");
            }}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            이벤트 포인트 적립
          </button>
        </div>
      </div>
      */}
      </div>
    </div>
  );
}


