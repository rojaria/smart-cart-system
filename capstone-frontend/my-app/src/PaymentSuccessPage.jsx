import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ref, set, update, remove, push, get } from "firebase/database";
import { database, auth } from "./firebase";
import { signOut } from "firebase/auth";

// 결제 성공 페이지
export default function PaymentSuccessPage({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    let isProcessing = false; // 중복 실행 방지 플래그
    let processedOrderId = null; // 처리된 주문 ID 저장

    const processPayment = async () => {
      // URL 파라미터에서 주문 ID 가져오기
      const orderId = searchParams.get("orderId");
      
      // URL 파라미터가 없으면 홈으로 리다이렉트
      if (!orderId) {
                navigate("/", { replace: true });
        return;
      }

      // URL 파라미터는 결제 처리 완료 후에 제거
      
      // 이미 처리된 주문이면 무시
      if (processedOrderId === orderId) {
                navigate("/", { replace: true });
        return;
      }
      
      // 이미 처리 중이면 무시
      if (isProcessing) {
                navigate("/", { replace: true });
        return;
      }

      // 🔥 주문 ID가 현재 사용자의 것인지 확인
      if (!orderId.includes(user.uid.slice(0, 8))) {
                navigate("/", { replace: true });
        return;
      }

            isProcessing = true;
      processedOrderId = orderId;

      try {
        // URL 파라미터에서 결제 정보 가져오기
        const orderId = searchParams.get("orderId");
        const paymentKey = searchParams.get("paymentKey");
        const amount = searchParams.get("amount");

        if (!orderId || !paymentKey || !amount) {
                    navigate("/", { replace: true });
          return;
        }

        // 주문 ID가 현재 사용자의 것인지 확인
        if (!orderId.includes(user.uid.slice(0, 8))) {
                    navigate("/", { replace: true });
          return;
        }

                // 먼저 Firebase에서 주문 상태 확인
        const orderRef = ref(database, `users/${user.uid}/orderHistory/${orderId}`);
        const orderSnapshot = await get(orderRef);
        
        if (orderSnapshot.exists()) {
          const existingOrder = orderSnapshot.val();
          if (existingOrder.status === "completed") {
                        setOrderData({ ...existingOrder, orderId });
            setLoading(false);
            return;
          }
        }

        // 토스페이먼츠 결제 승인 API 호출
        const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa((import.meta.env.VITE_TOSS_SECRET_KEY || "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6") + ":")}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            orderId,
            paymentKey,
            amount: parseInt(amount)
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "결제 승인에 실패했습니다.");
        }

        const paymentData = await response.json();
                // Firebase에서 주문 정보 재조회 (토스페이먼츠 승인 후)
        const orderSnapshot2 = await get(orderRef);

        if (!orderSnapshot2.exists()) {
          throw new Error("주문 정보를 찾을 수 없습니다.");
        }

        const order = orderSnapshot2.val();

        // 주문 상태 업데이트
        await update(orderRef, {
          status: "completed",
          paymentKey: paymentKey,
          paymentMethod: paymentData.method,
          completedAt: Date.now(),
          tossPaymentData: paymentData
        });

        // 🔐 Firebase에 결제 로그 저장 (사용자별로 저장)
        try {
          const paymentLogRef = ref(database, `users/${user.uid}/paymentLogs/${orderId}`);
          await set(paymentLogRef, {
            orderId: orderId,
            userId: user.uid,
            paymentKey: paymentKey,
            amount: parseInt(amount),
            discount: order.discount || 0,
            finalAmount: order.finalAmount,
            usedPoints: order.usedPoints || 0,
            paymentMethod: paymentData.method || 'CARD',
            status: 'completed',
            tossData: paymentData,
            items: order.items,
            createdAt: Date.now()
          });
          
          console.log("✅ Firebase에 결제 로그 저장 완료");
        } catch (firebaseError) {
          console.error("❌ Firebase 결제 로그 저장 오류:", firebaseError);
        }

        // 🔐 MySQL에도 결제 로그 저장
        try {
          const apiUrl = "https://smart-cart-api-1060519036613.asia-northeast1.run.app";
          
          // order.items를 배열로 변환하고 바코드 매핑
          let itemsArray = [];
          if (Array.isArray(order.items)) {
            itemsArray = order.items.map(item => ({
              ...item,
              barcode: item.barcode || item.id  // barcode가 없으면 id 사용
            }));
          } else if (order.items && typeof order.items === 'object') {
            // 객체인 경우 배열로 변환
            itemsArray = Object.keys(order.items).map(key => ({
              ...order.items[key],
              id: key,
              barcode: order.items[key].barcode || key  // barcode가 없으면 키 사용
            }));
          }
          
          console.log("📊 MySQL로 전송할 items 배열:", itemsArray);
          
          // 결제 데이터 준비
          const mysqlPaymentData = {
            orderId: orderId,
            userId: user.uid,
            paymentKey: paymentKey,
            amount: parseInt(amount),
            discount: order.discount || 0,
            finalAmount: order.finalAmount,
            usedPoints: order.usedPoints || 0,
            paymentMethod: paymentData.method || 'CARD',
            status: 'completed',
            tossData: paymentData,
            items: itemsArray
          };
          
          const mysqlResponse = await fetch(`${apiUrl}/api/payment/save`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(mysqlPaymentData)
          });

          if (mysqlResponse.ok) {
            const result = await mysqlResponse.json();
            console.log("✅ MySQL에 결제 로그 저장 완료:", result);
          } else {
            console.error("❌ MySQL 저장 실패:", await mysqlResponse.text());
          }
        } catch (mysqlError) {
          console.error("❌ MySQL 저장 오류:", mysqlError);
          // MySQL 저장 실패해도 결제는 이미 완료된 상태이므로 계속 진행
        }

        // 재고 감소 처리
        console.log("📦 재고 차감 시작 - 주문 아이템:", order.items);
        
        for (const item of order.items) {
          // 바코드가 있으면 바코드로, 없으면 id로 처리
          const productKey = item.barcode || item.id;
          
          if (productKey) {
            console.log(`📦 상품 처리: ${item.name} (키: ${productKey}) - 수량: ${item.quantity}`);
            
            const productRef = ref(database, `products/${productKey}`);
            const productSnapshot = await get(productRef);

            if (productSnapshot.exists()) {
              const productData = productSnapshot.val();
              const currentStock = productData.stock || 0;
              const newStock = currentStock - item.quantity;
              
              console.log(`📦 ${item.name} 재고 정보:`);
              console.log(`  - 현재 재고: ${currentStock}`);
              console.log(`  - 차감 수량: ${item.quantity}`);
              console.log(`  - 차감 후 재고: ${newStock}`);

              await update(productRef, {
                stock: Math.max(0, newStock),
                inStock: newStock > 0,
                updatedAt: Date.now()
              });
              
              console.log(`✅ ${item.name} 재고 업데이트 완료 - 최종 재고: ${Math.max(0, newStock)}`);
            } else {
              console.warn(`⚠️ 상품을 찾을 수 없음: ${productKey} (${item.name})`);
            }
          } else {
            console.warn(`⚠️ 바코드나 ID가 없는 상품: ${item.name}`);
          }
        }
        
        console.log("✅ 재고 차감 처리 완료");

        // 포인트 차감
        if (order.usedPoints > 0) {
          const userPointsRef = ref(database, `users/${user.uid}/points`);
          const pointsSnapshot = await get(userPointsRef);
          const currentPoints = pointsSnapshot.val() || 0;

          await set(userPointsRef, currentPoints - order.usedPoints);

          // 포인트 사용 내역 저장
          const pointHistoryRef = push(ref(database, `users/${user.uid}/pointHistory`));
          await set(pointHistoryRef, {
            amount: -order.usedPoints,
            type: "used",
            reason: "purchase",
            orderId: orderId,
            timestamp: Date.now()
          });
        }

        // 카트 비우기
        const cartNumberRef = ref(database, `users/${user.uid}/cartNumber`);
        const cartNumberSnapshot = await get(cartNumberRef);
        const cartNumber = cartNumberSnapshot.val();

        if (cartNumber) {
          const cartRef = ref(database, `carts/${cartNumber}/items`);
          await remove(cartRef);
          console.log("✅ 카트 비우기 완료");
        } else {
          console.log("ℹ️ 카트 넘버가 없어서 카트 비우기 건너뜀");
        }

        setOrderData({ ...order, orderId, paymentData });
        setLoading(false);

        // 🔥 결제 처리 완료 후 URL 파라미터 제거
        window.history.replaceState({}, document.title, window.location.pathname);
              } catch (err) {
        console.error("결제 처리 오류:", err);
        
        // S008 오류(중복 요청)는 이미 처리된 것이므로 성공으로 간주
        if (err.message && (err.message.includes("[S008]") || err.message.includes("이미 처리된 결제"))) {
                    
          // Firebase에서 주문 정보 조회
          try {
            const orderId = searchParams.get("orderId");
            const orderRef = ref(database, `users/${user.uid}/orderHistory/${orderId}`);
            const orderSnapshot = await get(orderRef);
            
            if (orderSnapshot.exists()) {
              const order = orderSnapshot.val();
                            setOrderData({ ...order, orderId });
              setLoading(false);
              return; // 성공으로 처리
            } else {
                            setError("주문 정보를 찾을 수 없습니다.");
              setLoading(false);
              return;
            }
          } catch (queryError) {
            console.error("주문 조회 오류:", queryError);
            setError("주문 정보 조회 중 오류가 발생했습니다.");
            setLoading(false);
            return;
          }
        }
        
        // 오류 발생 시에도 사용자에게 알림
        console.error("결제 성공 페이지 오류:", err);
        alert(`결제 처리 중 오류가 발생했습니다: ${err.message}`);
        
        setError(err.message);
        setLoading(false);
      }
    };

    if (user) {
      processPayment();
    }

    // cleanup 함수
    return () => {
      isProcessing = false;
    };
  }, [user, searchParams]);

  // 자동 로그아웃 카운트다운
  useEffect(() => {
    if (!loading && !error && orderData) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // 자동 로그아웃 실행
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [loading, error, orderData]);

  const handleComplete = async () => {
    try {
      // 카트 정리
      const cartNumberRef = ref(database, `users/${user.uid}/cartNumber`);
      const cartNumberSnapshot = await get(cartNumberRef);
      const cartNumber = cartNumberSnapshot.val();

      if (cartNumber) {
        const cartRef = ref(database, `carts/${cartNumber}`);
        await update(cartRef, {
          inUse: false,
          userId: null,
          releasedAt: Date.now()
        });

        await set(cartNumberRef, null);
      }

      // 로그아웃
      await signOut(auth);
    } catch (error) {
      console.error("로그아웃 오류:", error);
      await signOut(auth);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">결제 처리 중...</p>
          <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex items-center justify-center p-4 py-20">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-red-500 rounded-full mx-auto flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">결제 실패</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate("/checkout")}
              className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex items-center justify-center p-4 bg-gray-50 fixed inset-0 z-50">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-6">
        <div className="text-center">
          {/* 성공 아이콘 */}
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-500 rounded-full mx-auto flex items-center justify-center animate-bounce">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">결제 완료!</h2>
          <p className="text-gray-600 mb-4">
            이용해주셔서 감사합니다
          </p>

          {/* 간단한 결제 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">
              {orderData?.finalAmount?.toLocaleString()}원
            </div>
            <div className="text-sm text-gray-600">
              주문번호: {orderData?.orderId}
            </div>
          </div>

          {/* 자동 로그아웃 카운트다운 */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4 text-center">
            <p className="text-sm text-blue-800">
              ⏰ <span className="font-bold text-lg">{countdown}</span>초 후 자동 로그아웃
            </p>
          </div>

          {/* 확인 버튼 */}
          <button
            onClick={async () => {
              // URL 파라미터 제거
              window.history.replaceState({}, document.title, window.location.pathname);
              
              // 기존 로그아웃 처리
              await handleComplete();
            }}
            className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
          >
            지금 로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}

