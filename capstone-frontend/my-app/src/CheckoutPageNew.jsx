import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, set, push, remove, update, onValue } from "firebase/database";
import { database, auth } from "./firebase";
import { signOut } from "firebase/auth";
import { loadTossPayments } from "@tosspayments/payment-sdk";

// 실제 결제 페이지 컴포넌트
export default function CheckoutPageNew({ user }) {
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [points, setPoints] = useState(0);
  const [usedPoints, setUsedPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [outOfStockItems, setOutOfStockItems] = useState([]); // 재고 없는 상품들
  const [paymentSuccess, setPaymentSuccess] = useState(false); // 결제 완료 모달
  const [orderId, setOrderId] = useState(""); // 주문 번호
  const [cartNumber, setCartNumber] = useState(() => {
    const saved = localStorage.getItem('cartNumber');
    console.log("🔄 CheckoutPage 초기화 - localStorage에서 카트넘버 불러오기:", saved);
    return saved || null;
  }); // 카트 번호
  const [tossPayments, setTossPayments] = useState(null); // 토스페이먼츠 객체
  const [useRealPayment, setUseRealPayment] = useState(false); // 실제 결제 사용 여부
  const [paymentMethod] = useState("카드"); // 결제 방법 (고정)

  // 토스페이먼츠 초기화
  useEffect(() => {
    const initTossPayments = async () => {
      try {
        const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
        console.log("토스페이먼츠 클라이언트 키:", clientKey);
        const tossPaymentsInstance = await loadTossPayments(clientKey);
        setTossPayments(tossPaymentsInstance);
        console.log("토스페이먼츠 초기화 완료:", tossPaymentsInstance);
      } catch (error) {
        console.error("토스페이먼츠 초기화 실패:", error);
        alert("결제 시스템 초기화에 실패했습니다. 페이지를 새로고침해주세요.");
      }
    };

    initTossPayments();
  }, []);

  useEffect(() => {
    // Firebase 인증이 아직 로딩 중이면 대기
    if (user === undefined) {
      console.log("⏳ CheckoutPage Firebase 인증 로딩 중...");
      return;
    }
    
    if (!user) return;

    console.log("🔍 CheckoutPage 시작:", user.uid);

    const fetchCartNumber = async () => {
      try {
        // 1. 카트 번호 조회
        const cartNumberRef = ref(database, `users/${user.uid}/cartNumber`);
        const cartNumberSnapshot = await get(cartNumberRef);
        const userCartNumber = cartNumberSnapshot.val();
        
        console.log("📋 CheckoutPage Firebase에서 카트넘버 조회:", userCartNumber);
        
        if (userCartNumber) {
          setCartNumber(userCartNumber);
          // localStorage에도 저장
          localStorage.setItem('cartNumber', userCartNumber);
          localStorage.setItem('userId', user.uid);
          console.log("💾 CheckoutPage 카트넘버 localStorage 저장:", userCartNumber);
          return userCartNumber;
        } else {
          // Firebase에 없으면 localStorage에서 복원 시도
          const savedCartNumber = localStorage.getItem('cartNumber');
          const savedUserId = localStorage.getItem('userId');
          
          if (savedCartNumber && savedUserId === user.uid) {
            console.log("🔄 CheckoutPage localStorage에서 카트넘버 복원:", savedCartNumber);
            setCartNumber(savedCartNumber);
            return savedCartNumber;
          } else {
            alert("카트 번호가 등록되지 않았습니다.");
            navigate("/");
            return null;
          }
        }
      } catch (error) {
        console.error("카트 번호 조회 오류:", error);
        alert("카트 정보를 불러오는 중 오류가 발생했습니다.");
        setLoading(false);
        return null;
      }
    };

    const setupRealtimeListeners = async () => {
      const userCartNumber = await fetchCartNumber();
      if (!userCartNumber) return;

      // 2. 카트 데이터 실시간 감지
      const cartRef = ref(database, `carts/${userCartNumber}/items`);
      const cartUnsubscribe = onValue(cartRef, async (cartSnapshot) => {
        const cartData = cartSnapshot.val();
        console.log("📦 CheckoutPage 받은 원본 데이터:", JSON.stringify(cartData, null, 2));
        
        const cartItems = cartData 
          ? Object.keys(cartData).map(key => {
              console.log(`🔑 CheckoutPage Firebase 키: ${key}, 데이터:`, cartData[key]);
              return { 
                id: key, // Firebase 키를 id로 사용 (barcode가 키로 사용됨)
                ...cartData[key] 
              };
            })
          : [];
        
        // 🔍 각 상품의 재고 상태 확인
        const outOfStock = [];
        const cartWithStock = await Promise.all(
          cartItems.map(async (item) => {
            if (item.barcode) {
              // 상품 DB에서 재고 확인
              const productRef = ref(database, `products/${item.barcode}`);
              const productSnapshot = await get(productRef);
              
              if (productSnapshot.exists()) {
                const productData = productSnapshot.val();
                item.inStock = productData.inStock;
                
                // 재고가 없으면 목록에 추가
                if (!productData.inStock) {
                  outOfStock.push(item.name);
                }
              } else {
                // 상품 DB에 없으면 재고 없음으로 처리
                item.inStock = false;
                outOfStock.push(item.name);
              }
            }
            return item;
          })
        );

        setCart(cartWithStock);
        setOutOfStockItems(outOfStock);
        setLoading(false);
      });

      // 3. 사용자 포인트 실시간 감지
      const pointsRef = ref(database, `users/${user.uid}/points`);
      const pointsUnsubscribe = onValue(pointsRef, (pointsSnapshot) => {
        const userPoints = pointsSnapshot.val() || 0;
        setPoints(userPoints);
      });

      // cleanup 함수
      return () => {
        cartUnsubscribe();
        pointsUnsubscribe();
      };
    };

    setupRealtimeListeners();
  }, [user, navigate]);

  // 장바구니가 비어있으면 자동으로 장바구니 페이지로 리다이렉트
  useEffect(() => {
    if (cart.length === 0 && !loading) {
      console.log("⚠️ 장바구니가 비어있어 장바구니 페이지로 리다이렉트");
      navigate("/", { replace: true });
    }
  }, [cart.length, loading, navigate]);

  // 총 금액 계산
  const total = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);

  // 사용 가능한 최대 포인트 계산
  const maxUsablePoints = Math.min(points, Math.floor(total / 10)); // 포인트는 전체 금액의 일부만 사용 가능

  // 포인트 할인 금액
  const discount = usedPoints * 10; // 1포인트 = 10원

  // 최종 결제 금액
  const finalAmount = total - discount;

  // 포인트 사용량 변경
  const handlePointsChange = (value) => {
    const numValue = parseInt(value) || 0;
    if (numValue < 0) {
      setUsedPoints(0);
    } else if (numValue > maxUsablePoints) {
      setUsedPoints(maxUsablePoints);
    } else {
      setUsedPoints(numValue);
    }
  };

  // 실제 토스페이먼츠 결제 처리
  const handleRealPayment = async () => {
    if (cart.length === 0) {
      alert("장바구니가 비어있습니다.");
      return;
    }

    if (outOfStockItems.length > 0) {
      alert(`품절 상품이 있어 결제할 수 없습니다.\n품절: ${outOfStockItems.join(', ')}`);
      return;
    }

    if (!tossPayments) {
      alert("결제 시스템을 초기화하는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setProcessing(true);

    try {
      // 🔍 결제 전 필수 값 검증
      console.log("=== 결제 전 데이터 검증 ===");
      console.log("finalAmount:", finalAmount);
      console.log("cart:", cart);
      console.log("user:", user);
      console.log("tossPayments:", tossPayments);

      // finalAmount 검증
      if (!finalAmount || finalAmount <= 0) {
        alert("결제 금액이 올바르지 않습니다.");
        setProcessing(false);
        return;
      }

      // 토스페이먼츠 최소 결제 금액 검증 (100원 이상)
      if (finalAmount < 100) {
        alert("결제 금액은 최소 100원 이상이어야 합니다.");
        setProcessing(false);
        return;
      }

      // 1. 주문 생성
      const newOrderId = `ORDER_${Date.now()}_${user.uid.slice(0, 8)}`;
      const orderRef = ref(database, `users/${user.uid}/orderHistory/${newOrderId}`);
      
      await set(orderRef, {
        items: cart,
        total: total,
        usedPoints: usedPoints,
        discount: discount,
        finalAmount: finalAmount,
        paymentMethod: paymentMethod,
        status: "pending", // 결제 대기 상태
        createdAt: Date.now()
      });

      console.log("✅ Firebase 주문 생성 완료:", newOrderId);

      // 2. 토스페이먼츠 결제창 호출
      console.log("결제 요청 시작:", {
        paymentMethod,
        amount: finalAmount,
        orderId: newOrderId,
        cart: cart.length
      });

      // 상품명 생성
      const orderName = cart.length === 1 
        ? cart[0].name 
        : `${cart[0].name} 외 ${cart.length - 1}건`;

      // 결제 수단을 토스페이먼츠에서 선택하도록 설정
      const paymentType = "CARD";

      // customerName 안전하게 생성
      const customerName = user.email ? user.email.split("@")[0] : "고객";

      console.log("토스페이먼츠 호출:", {
        paymentType,
        amount: finalAmount,
        orderId: newOrderId,
        orderName,
        customerName
      });

      // 결제수단별 설정
      const paymentConfig = {
        amount: finalAmount,
        orderId: newOrderId,
        orderName: orderName,
        customerName: customerName,
        successUrl: `${window.location.origin}/payment-success`,
        failUrl: `${window.location.origin}/payment-fail?cartNumber=${cartNumber}`,
      };

      console.log("=== 최종 결제 설정 ===", paymentConfig);

      // 결제 수단은 토스페이먼츠에서 사용자가 직접 선택
      await tossPayments.requestPayment(paymentType, paymentConfig);
      
      console.log("✅ 토스페이먼츠 결제창 호출 성공");

    } catch (error) {
      console.error("❌ 결제 오류 상세:", error);
      console.error("에러 타입:", typeof error);
      console.error("에러 메시지:", error.message);
      console.error("에러 스택:", error.stack);
      
      // 토스페이먼츠 특정 에러 메시지 파싱
      let errorMessage = "결제 중 오류가 발생했습니다";
      
      if (error.message) {
        if (error.message.includes("INVALID_PARAMETER")) {
          errorMessage = "결제 파라미터가 올바르지 않습니다. 다시 시도해주세요.";
        } else if (error.message.includes("UNAUTHORIZED")) {
          errorMessage = "결제 권한이 없습니다. 키 설정을 확인해주세요.";
        } else if (error.message.includes("USER_CANCEL")) {
          errorMessage = "결제를 취소하셨습니다.";
        } else if (error.message.includes("NETWORK")) {
          errorMessage = "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.";
        } else {
          errorMessage = `결제 오류: ${error.message}`;
        }
      }
      
      alert(errorMessage);
      setProcessing(false);
      // 결제 실패 시 장바구니 유지 (아무것도 하지 않음)
    }
  };

  // 테스트 결제 처리 (기존 로직) - 주석처리됨
  /* 
  const handleTestPayment = async () => {
    if (cart.length === 0) {
      alert("장바구니가 비어있습니다.");
      return;
    }

    // 🚨 재고 확인
    if (outOfStockItems.length > 0) {
      alert(`품절 상품이 있어 결제할 수 없습니다.\n품절: ${outOfStockItems.join(', ')}`);
      return;
    }

    if (!confirm(`${finalAmount.toLocaleString()}원을 결제하시겠습니까? (테스트 결제)`)) {
      return;
    }

    setProcessing(true);

    try {
      // 1. 주문 생성
      const orderId = `ORDER_${Date.now()}_${user.uid.slice(0, 8)}`;
      const orderRef = ref(database, `users/${user.uid}/orderHistory/${orderId}`);
      
      await set(orderRef, {
        items: cart,
        total: total,
        usedPoints: usedPoints,
        discount: discount,
        finalAmount: finalAmount,
        paymentMethod: paymentMethod,
        status: "completed",
        createdAt: Date.now(),
        completedAt: Date.now()
      });

      // 2. 재고 감소 처리 (구매한 상품만큼 재고 차감)
      for (const item of cart) {
        if (item.barcode) {
          const productRef = ref(database, `products/${item.barcode}`);
          const productSnapshot = await get(productRef);
          
          if (productSnapshot.exists()) {
            const productData = productSnapshot.val();
            const newStock = (productData.stock || 0) - item.quantity;
            
            // 재고 업데이트
            await update(productRef, {
              stock: Math.max(0, newStock),  // 음수 방지
              inStock: newStock > 0,  // 재고 0이면 자동 품절
              updatedAt: Date.now()
            });
          }
        }
      }

      // 3. 포인트 차감
      if (usedPoints > 0) {
        const userPointsRef = ref(database, `users/${user.uid}/points`);
        await set(userPointsRef, points - usedPoints);

        // 포인트 사용 내역 저장
        const pointHistoryRef = push(ref(database, `users/${user.uid}/pointHistory`));
        await set(pointHistoryRef, {
          amount: -usedPoints,
          type: "used",
          reason: "purchase",
          orderId: orderId,
          timestamp: Date.now()
        });
      }

      // 4. 카트의 센서 데이터 비우기 (주석처리 - 결제 후에도 장바구니 유지)
      // if (cartNumber) {
      //   const cartRef = ref(database, `carts/${cartNumber}/items`);
      //   await remove(cartRef);
      // }

      // 5. 주문 번호 저장
      setOrderId(orderId);
      
      // 6. 결제 완료 모달 표시
      setPaymentSuccess(true);

    } catch (error) {
      console.error("결제 오류:", error);
      alert("결제 중 오류가 발생했습니다: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 결제 방식에 따라 분기
  const handlePayment = () => {
    if (useRealPayment) {
      handleRealPayment();
    } else {
      handleTestPayment();
    }
  };
  */

  // 결제 처리 (실제 결제만)
  const handlePayment = () => {
    handleRealPayment();
  };



  if (loading) {
    return (
      <div className="max-w-2xl mx-auto mt-10 text-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 헤더 */}
      <div className="w-full border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition flex-shrink-0"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg sm:text-xl font-bold">주문/결제</h1>
            <div className="w-8 sm:w-10"></div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pb-32 sm:pb-36">
        {/* 카트 정보 박스 */}
        {cartNumber && (
          <div className="mt-4 sm:mt-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-center text-base sm:text-base gap-4">
                <span className="text-gray-600 whitespace-nowrap text-lg font-medium">카트 번호</span>
                <span className="font-mono font-bold text-2xl">{cartNumber}</span>
              </div>
            </div>
          </div>
        )}

        {/* 재고 부족 알림 */}
        {outOfStockItems.length > 0 && (
          <div className="mt-4 sm:mt-6 border border-black p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-semibold mb-1">
              품절 상품: {outOfStockItems.join(', ')}
            </p>
            <p className="text-xs text-gray-600">
              장바구니에서 제거 후 다시 시도해주세요.
            </p>
          </div>
        )}

        {/* 주문 상품 목록 */}
        <div className="mt-4 sm:mt-6">
          <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 pb-2 border-b border-gray-200">주문 상품</h2>
          <div className="space-y-3 sm:space-y-4">
            {cart.map((item) => (
              <div 
                key={item.id} 
                className={`flex justify-between items-start gap-2 ${
                  item.inStock === false ? 'opacity-40' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm sm:text-base font-medium mb-1 truncate ${item.inStock === false ? 'line-through' : ''}`}>
                    {item.name}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {(item.price || 0).toLocaleString()}원 × {(item.quantity || 0)}개
                  </p>
                  {item.inStock === false && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-black text-white text-xs">
                      품절
                    </span>
                  )}
                </div>
                <p className={`text-sm sm:text-base font-semibold whitespace-nowrap ${item.inStock === false ? 'line-through' : ''}`}>
                  {((item.price || 0) * (item.quantity || 0)).toLocaleString()}원
                </p>
              </div>
            ))}
          </div>
        </div>

      {/* 포인트 사용 */}
      <div className="mt-6 sm:mt-8">
        <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 pb-2 border-b border-gray-200">포인트 사용</h3>
        
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3 text-xs sm:text-sm">
            <span className="text-gray-600">보유 포인트</span>
            <span className="font-semibold whitespace-nowrap">{points.toLocaleString()} P</span>
          </div>
          <div className="flex items-center justify-between mb-2 sm:mb-3 text-xs sm:text-sm text-gray-500">
            <span>사용 가능</span>
            <span className="whitespace-nowrap">{maxUsablePoints.toLocaleString()} P</span>
          </div>
          
          <div className="flex gap-2 mt-3 sm:mt-4">
            <input
              type="number"
              value={usedPoints}
              onChange={(e) => handlePointsChange(e.target.value)}
              min="0"
              max={maxUsablePoints}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 focus:border-black focus:outline-none text-xs sm:text-sm"
              placeholder="사용할 포인트"
            />
            <button
              onClick={() => setUsedPoints(maxUsablePoints)}
              className="px-4 sm:px-6 py-2 sm:py-3 border border-gray-300 hover:bg-gray-50 transition text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              전액 사용
            </button>
          </div>
        </div>

        {usedPoints > 0 && (
          <p className="text-xs sm:text-sm">
            {discount.toLocaleString()}원 할인 적용
          </p>
        )}
      </div>


      {/* 결제 모드 선택 (테스트용) - 주석처리됨 */}
      {/* 
      <div className="mt-6 sm:mt-8 border border-gray-300 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-bold mb-1">결제 모드</h3>
            <p className="text-xs sm:text-sm text-gray-600 truncate">
              {useRealPayment ? "실제 결제가 진행됩니다" : "테스트 결제 (실제 돈 안 나감)"}
            </p>
          </div>
          <label className="flex items-center cursor-pointer flex-shrink-0">
            <div className="relative">
              <input
                type="checkbox"
                checked={useRealPayment}
                onChange={(e) => setUseRealPayment(e.target.checked)}
                className="sr-only"
              />
              <div className={`block w-12 h-7 sm:w-14 sm:h-8 ${useRealPayment ? 'bg-black' : 'bg-gray-300'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-5 h-5 sm:w-6 sm:h-6 transition ${useRealPayment ? 'transform translate-x-5 sm:translate-x-6' : ''}`}></div>
            </div>
            <span className="ml-2 sm:ml-3 text-xs sm:text-sm font-semibold whitespace-nowrap">
              {useRealPayment ? "실제 결제" : "테스트"}
            </span>
          </label>
        </div>
      </div>
      */}

      </div>
      
      {/* 추가 여백 */}
      <div className="h-6 sm:h-8"></div>

      {/* 하단 고정 결제 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          {/* 결제 금액 요약 */}
          <div className="mb-3 sm:mb-4">
            <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">
              <span>상품 금액</span>
              <span className="whitespace-nowrap">{total.toLocaleString()}원</span>
            </div>
            {usedPoints > 0 && (
              <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">
                <span>포인트 할인</span>
                <span className="whitespace-nowrap">-{discount.toLocaleString()}원</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 sm:pt-3 border-t border-gray-200">
              <span className="text-sm sm:text-base font-bold">최종 결제금액</span>
              <span className="text-lg sm:text-xl font-bold whitespace-nowrap">{finalAmount.toLocaleString()}원</span>
            </div>
          </div>

          {/* 결제 버튼 */}
          <button
            onClick={handlePayment}
            disabled={processing || outOfStockItems.length > 0}
            className={`w-full py-3 sm:py-4 text-sm sm:text-base font-medium transition ${
              outOfStockItems.length > 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : processing
                ? 'bg-gray-800 text-white opacity-50 cursor-not-allowed'
                : 'bg-black text-white hover:bg-gray-800'
            }`}
          >
            {outOfStockItems.length > 0 
              ? '품절 상품 있음' 
              : processing 
              ? "처리 중..." 
              : "결제"
            }
          </button>
        </div>
      </div>


      {/* 결제 완료 모달 */}
      {paymentSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              {/* 성공 아이콘 애니메이션 */}
              <div className="mb-6">
                <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center animate-bounce">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              </div>

              <h2 className="text-3xl font-bold text-gray-800 mb-2">결제 완료!</h2>
              <p className="text-xl text-green-600 font-semibold mb-2">
                이용해주셔서 감사합니다 🙏
              </p>
              <p className="text-gray-600 mb-6">
                결제가 성공적으로 완료되었습니다
              </p>

              {/* 영수증 */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
                <div className="border-b border-gray-200 pb-3 mb-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">주문번호</span>
                    <span className="text-sm font-mono font-semibold">{orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">결제일시</span>
                    <span className="text-sm">{new Date().toLocaleString('ko-KR')}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">상품 금액</span>
                    <span>{total.toLocaleString()}원</span>
                  </div>
                  {usedPoints > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">포인트 할인</span>
                      <span className="text-red-600">-{discount.toLocaleString()}원</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">최종 결제금액</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {finalAmount.toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 추가 정보 */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 text-left">
                <p className="text-sm text-blue-800">
                  ✅ 재고가 자동으로 차감되었습니다<br/>
                  ✅ 포인트 내역에 저장되었습니다<br/>
                  ✅ 주문 내역에서 확인 가능합니다
                </p>
              </div>

              {/* 안내 메시지 */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 text-left">
                <p className="text-sm text-yellow-800">
                  💡 잠시 후 자동으로 로그아웃됩니다<br/>
                  카트가 초기화되어 다음 고객이 이용 가능합니다
                </p>
              </div>

              {/* 확인 버튼 */}
              <button
                onClick={async () => {
                  try {
                    // 카트 정리
                    if (cartNumber) {
                      // 1. 카트의 센서 데이터 삭제 (이미 결제 시 삭제됨)
                      // 2. 카트 상태 업데이트 (사용 중 해제)
                      const cartRef = ref(database, `carts/${cartNumber}`);
                      await update(cartRef, {
                        inUse: false,
                        userId: null,
                        releasedAt: Date.now()
                      });

                      // 3. 사용자 카트 번호 제거
                      const userCartNumberRef = ref(database, `users/${user.uid}/cartNumber`);
                      await set(userCartNumberRef, null);
                    }

                    // 4. 로그아웃
                    await signOut(auth);
                    
                    // 5. 로그인 페이지로 이동 (자동으로 됨)
                  } catch (error) {
                    console.error("로그아웃 오류:", error);
                    // 오류가 발생해도 강제로 로그아웃
                    await signOut(auth);
                  }
                }}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold text-lg"
              >
                확인 (로그아웃)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

