// React에서 필요한 기능들 가져오기
import React, { useEffect, useState } from "react";
// 페이지 이동 기능 가져오기
import { useNavigate } from "react-router-dom";
// Realtime Database 관련 기능 가져오기
import { ref, onValue, update, remove, push, set, get } from "firebase/database";
import { database, auth } from "./firebase";
import { signOut } from "firebase/auth";

// 장바구니 페이지 컴포넌트
export default function CartPage({ user }) {
  // 페이지 이동 함수
  const navigate = useNavigate();
  // cart: 장바구니 상품 목록 저장
  const [cart, setCart] = useState([]);
  // 상품별 재고 상태 저장
  const [productStockStatus, setProductStockStatus] = useState({});
  // 현재 사용자의 카트 번호 (초기값을 localStorage에서 불러옴)
  const [cartNumber, setCartNumber] = useState(() => {
    const saved = localStorage.getItem('cartNumber');
    return saved || null;
  });

  // 사용자의 카트 번호 조회
  useEffect(() => {
    // Firebase 인증이 아직 로딩 중이면 대기
    if (user === undefined) {
      return;
    }
    
    if (!user) return;
    
    
    const cartNumberRef = ref(database, `users/${user.uid}/cartNumber`);
    const unsubscribe = onValue(cartNumberRef, (snapshot) => {
      const newCartNumber = snapshot.val();
      
      if (newCartNumber) {
        setCartNumber(newCartNumber);
        // localStorage에도 저장하여 새로고침 후에도 유지
        localStorage.setItem('cartNumber', newCartNumber);
        localStorage.setItem('userId', user.uid);
      } else {
        // Firebase에 카트넘버가 없으면 localStorage에서 복원 시도
        const savedCartNumber = localStorage.getItem('cartNumber');
        const savedUserId = localStorage.getItem('userId');
        

      }
    });
    
    return () => unsubscribe();
  }, [user]);

  // 🔒 카트 사용 권한 실시간 검증
  useEffect(() => {
    // Firebase 인증이 아직 로딩 중이면 대기
    if (user === undefined) return;
    
    if (!user || !cartNumber) return;


    const cartRef = ref(database, `carts/${cartNumber}`);
    const unsubscribe = onValue(cartRef, async (snapshot) => {
      if (snapshot.exists()) {
        const cartData = snapshot.val();
        
        // 다른 사용자가 이 카트를 탈취한 경우 (계정과 카트가 끊김)
        if (cartData.inUse && cartData.userId !== user.uid) {
          
          // 장바구니 데이터 초기화
          setCart([]);
          
          // localStorage 정리
          localStorage.removeItem('cartNumber');
          localStorage.removeItem('userId');
          
          // 사용자에게 알림
          alert(
            `⚠️ 경고: 카트 ${cartNumber}번이 다른 사용자에 의해 사용되고 있습니다!\n\n` +
            `장바구니가 초기화되고 로그아웃됩니다.`
          );
          
          // 강제 로그아웃
          await signOut(auth);
          window.location.href = "/";
        }
        
        // 카트가 해제된 경우
        if (!cartData.inUse) {
          // 카트가 해제됨
        }
      } else {
        // 카트가 삭제된 경우
        setCart([]);
        alert(`⚠️ 카트 ${cartNumber}번이 시스템에서 제거되었습니다.\n장바구니가 초기화됩니다.`);
      }
    });

    return () => unsubscribe();
  }, [user, cartNumber]);

  // 📦 상품 재고 상태 실시간 모니터링
  useEffect(() => {
    if (!cartNumber || cart.length === 0) return;


    // 장바구니에 있는 모든 상품의 재고 상태를 모니터링
    const unsubscribeFunctions = cart.map(item => {
      const productRef = ref(database, `products/${item.barcode}`);
      return onValue(productRef, (snapshot) => {
        if (snapshot.exists()) {
          const productData = snapshot.val();
          const stock = productData.stock || 0;
          const inStock = stock > 0;
          
          
          setProductStockStatus(prev => ({
            ...prev,
            [item.barcode]: {
              stock,
              inStock,
              lastUpdated: Date.now()
            }
          }));
        } else {
          // 상품이 Firebase에 없으면 품절로 처리
          setProductStockStatus(prev => ({
            ...prev,
            [item.barcode]: {
              stock: 0,
              inStock: false,
              lastUpdated: Date.now()
            }
          }));
        }
      });
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [cartNumber, cart]);

  // 컴포넌트가 실행되거나 user/cartNumber가 변경될 때마다 실행
  useEffect(() => {
    
    // Firebase 인증이 아직 로딩 중이면 대기
    if (user === undefined) {
      return;
    }
    
    // 로그인하지 않았으면 종료
    if (!user) {
      return;
    }
    
    // localStorage의 userId와 현재 user.uid가 다르면 카트넘버 초기화
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId && savedUserId !== user.uid) {
      localStorage.removeItem('cartNumber');
      localStorage.removeItem('userId');
      setCartNumber(null);
      return;
    }
    
    // 카트 번호가 없으면 종료
    if (!cartNumber) {
      return;
    }
    
    
    const unsubscribers = [];
    
    // 🔥 카트 번호 기반으로 센서 데이터 읽기
    const cartRef = ref(database, `carts/${cartNumber}/items`);
    

    // 실시간으로 장바구니 데이터 변화 감지
    const cartUnsubscribe = onValue(cartRef, 
      snapshot => {
        const data = snapshot.val();
        
        let items = [];
        if (data) {
          // JSON 객체를 배열로 변환 (Firebase 키를 id로 사용)
          items = Object.keys(data).map(key => {
            return { 
              id: key, // Firebase 키를 id로 사용 (barcode가 키로 사용됨)
              ...data[key] 
            };
          });
          setCart(items);
        } else {
          setCart([]);
        }
        
        // 🔍 각 상품의 재고 상태를 실시간으로 감지
        items.forEach(item => {
          if (item.barcode) {
            const productRef = ref(database, `products/${item.barcode}`);
            const productUnsubscribe = onValue(productRef, (snap) => {
              if (snap.exists()) {
                const productData = snap.val();
                setProductStockStatus(prev => ({
                  ...prev,
                  [item.barcode]: {
                    inStock: productData.inStock,
                    name: productData.name,
                    price: productData.price
                  }
                }));
              } else {
                // 상품 DB에 없으면 재고 없음
                setProductStockStatus(prev => ({
                  ...prev,
                  [item.barcode]: {
                    inStock: false,
                    name: item.name,
                    price: item.price
                  }
                }));
              }
            });
            unsubscribers.push(productUnsubscribe);
          }
        });
      },
      error => {
        alert("데이터 읽기 실패: " + error.message);
      }
    );
    
    // 컴포넌트가 사라질 때 모든 실시간 감지 중지
    return () => {
      cartUnsubscribe();
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, cartNumber]);

  // 수량 증가 함수 (+ 버튼)
  const increment = async (id, quantity) => {
    if (!cartNumber) return;
    // 카트의 센서 데이터에서 해당 상품의 수량을 1 증가
    const itemRef = ref(database, `carts/${cartNumber}/items/${id}`);
    await update(itemRef, { quantity: quantity + 1 });
  };

  // 수량 감소 함수 (- 버튼)
  const decrement = async (id, quantity) => {
    if (!cartNumber) return;
    // 수량이 1 이하면 감소하지 않음
    if (quantity <= 1) return;
    // 카트의 센서 데이터에서 해당 상품의 수량을 1 감소
    const itemRef = ref(database, `carts/${cartNumber}/items/${id}`);
    await update(itemRef, { quantity: quantity - 1 });
  };

  // 수량 직접 입력 함수
  const handleQuantityChange = async (id, qty) => {
    if (!cartNumber) return;
    // 1보다 작은 수는 1로 설정
    if (qty < 1) qty = 1;
    // 카트의 센서 데이터에서 해당 상품의 수량을 입력한 값으로 변경
    const itemRef = ref(database, `carts/${cartNumber}/items/${id}`);
    await update(itemRef, { quantity: qty });
  };

  // 상품 삭제 함수
  const handleRemove = async (id) => {
    if (!cartNumber) return;
    const itemRef = ref(database, `carts/${cartNumber}/items/${id}`);
    await remove(itemRef);
  };

  // 테스트 데이터 추가 함수 (센서 데이터 시뮬레이션)
  const addTestData = async () => {
    if (!cartNumber) {
      alert("❌ 카트 번호가 없습니다.");
      return;
    }
    
    try {
      // 💡 상품 관리 샘플 데이터와 동일한 상품들 추가 (센서가 감지한 것처럼)
      // 📦 전체 샘플 상품 목록:
      // 8801234567890 - 신라면 (3500원)
      // 8801234567891 - 삼양라면 (3000원)
      // 8801234567892 - 코카콜라 (1500원)
      // 8801234567893 - 사이다 (1500원)
      // 8801234567894 - 우유 (2500원)
      // 8801234567895 - 요구르트 (3000원)
      // 8801234567896 - 식빵 (2000원)
      // 8801234567897 - 과자 (1800원)
      // 8801234567898 - 초콜릿 (2200원)
      // 8801234567899 - 사과 (5000원)
      
      const items = [
        { barcode: "8801234567890", name: "신라면", price: 3500, quantity: 2, detectedAt: Date.now() },
        { barcode: "8801234567892", name: "코카콜라", price: 1500, quantity: 3, detectedAt: Date.now() },
        { barcode: "8801234567894", name: "우유", price: 2500, quantity: 1, detectedAt: Date.now() },
        { barcode: "8801234567897", name: "과자", price: 1800, quantity: 2, detectedAt: Date.now() },
        { barcode: "8801234567899", name: "사과", price: 5000, quantity: 1, detectedAt: Date.now() }
      ];
      
      // 각 상품을 고정 ID로 추가 (센서 데이터처럼)
      for (const item of items) {
        const itemRef = ref(database, `carts/${cartNumber}/items/${item.barcode}`);
        
        try {
          await set(itemRef, item);
          
          // 저장 후 즉시 확인
          const verifyRef = ref(database, `carts/${cartNumber}/items/${item.barcode}`);
          const verifySnapshot = await get(verifyRef);
        } catch (error) {
          // 저장 실패
        }
      }
      
      alert(`✅ 카트 ${cartNumber}번에 센서 데이터 5개가 추가되었습니다!\n(실제 센서가 상품을 감지한 것처럼 동작)`);
    } catch (error) {
      alert("❌ 데이터 추가 실패: " + error.message);
    }
  };

  return (
    <div className="w-full">
      {/* 헤더 */}
      <div className="w-full border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-center gap-2 relative">
            <h1 className="text-xl sm:text-xl font-bold -ml-16 sm:-ml-20">장바구니</h1>
            {/* 센서 시뮬레이션 버튼 (테스트용) - 주석처리됨 */}
            {/* 
            <button
              onClick={addTestData}
              className="absolute right-0 px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-300 hover:bg-gray-50 transition text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
            >
              센서 시뮬레이션
            </button>
            */}
          </div>
        </div>
      </div>

      {/* 카트 정보 */}
      <div className="w-full border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 sm:px-6 py-6 sm:py-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between text-base sm:text-base gap-4">
              <div className="flex items-center gap-4 sm:gap-4">
                <span className="text-gray-600 whitespace-nowrap text-lg font-medium">카트 번호</span>
                <span className="font-mono font-bold text-2xl">{cartNumber}</span>
              </div>
              <div className="flex items-center gap-3 sm:gap-3">
                <div className="w-3 h-3 sm:w-3 sm:h-3 bg-black rounded-full flex-shrink-0"></div>
                <span className="text-gray-600 text-base sm:text-base whitespace-nowrap font-medium">실시간 동기화</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 상품 목록 */}
      <div className="w-full max-w-4xl mx-auto px-6 sm:px-6 py-6 sm:py-6 pb-16 sm:pb-16">
        {cart.length === 0 ? (
          <div className="text-center py-16 sm:py-20">
            <p className="text-gray-400 text-xl sm:text-lg">장바구니가 비어있습니다</p>
          </div>
        ) : (
          <div className="space-y-0">
            {cart.map(item => {
              const stockInfo = item.barcode ? productStockStatus[item.barcode] : null;
              const isOutOfStock = stockInfo && stockInfo.inStock === false;
              
              return (
                <div 
                  key={item.id} 
                  className="border-b border-gray-100 py-6 sm:py-6"
                >
                  {/* 상품 정보 */}
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className={`text-base sm:text-base font-medium truncate ${isOutOfStock ? 'text-gray-400 line-through' : 'text-black'}`}>
                          {item.name}
                        </p>
                        {isOutOfStock && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-black text-white text-xs">
                            품절
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1 hover:bg-gray-100 rounded transition flex-shrink-0 ml-2"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* 수량 및 가격 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 sm:gap-3">
                      <span className="text-sm sm:text-sm text-gray-500 whitespace-nowrap">수량</span>
                      <div className={`flex items-center border ${isOutOfStock ? 'border-gray-200 bg-gray-50' : 'border-gray-300'}`}>
                        <button
                          onClick={() => !isOutOfStock && decrement(item.id, item.quantity)}
                          disabled={isOutOfStock}
                          className={`w-8 h-8 sm:w-8 sm:h-8 transition flex items-center justify-center ${isOutOfStock ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                        >
                          <span className="text-lg sm:text-lg">-</span>
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={item.quantity}
                          onChange={e => !isOutOfStock && handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                          disabled={isOutOfStock}
                          className={`w-12 sm:w-12 h-8 sm:h-8 text-center border-x text-sm sm:text-sm ${isOutOfStock ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-gray-300'}`}
                        />
                        <button
                          onClick={() => !isOutOfStock && increment(item.id, item.quantity)}
                          disabled={isOutOfStock}
                          className={`w-8 h-8 sm:w-8 sm:h-8 transition flex items-center justify-center ${isOutOfStock ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                        >
                          <span className="text-lg sm:text-lg">+</span>
                        </button>
                      </div>
                    </div>
                    <p className={`text-lg sm:text-lg font-semibold whitespace-nowrap ${isOutOfStock ? 'text-gray-400' : ''}`}>
                      {isOutOfStock ? '품절' : `${(item.price * item.quantity).toLocaleString()}원`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 하단 고정 요소를 위한 여백 */}
      {cart.length > 0 && (
        <div className="h-40 sm:h-36"></div>
      )}

      {/* 하단 고정 영역 */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-6 sm:px-6 py-4 sm:py-4">
            {/* 최종 가격 */}
            <div className="mb-3 sm:mb-4">
              {(() => {
                // 품절 상품 제외한 가격 계산
                const availableItems = cart.filter(item => {
                  const stockInfo = item.barcode ? productStockStatus[item.barcode] : null;
                  return !stockInfo || stockInfo.inStock !== false;
                });
                const totalPrice = availableItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
                const outOfStockItems = cart.filter(item => {
                  const stockInfo = item.barcode ? productStockStatus[item.barcode] : null;
                  return stockInfo && stockInfo.inStock === false;
                });
                
                return (
                  <>
                    <div className="flex items-center justify-between text-sm sm:text-sm text-gray-600 mb-2 sm:mb-2">
                      <span>상품가격</span>
                      <span className="whitespace-nowrap">{totalPrice.toLocaleString()}원</span>
                    </div>
                    {outOfStockItems.length > 0 && (
                      <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2">
                        <span>품절 상품 제외</span>
                        <span className="whitespace-nowrap">-{outOfStockItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString()}원</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm sm:text-sm text-gray-600 mb-2 sm:mb-3">
                      <span>배송비</span>
                      <span className="whitespace-nowrap">0원</span>
                    </div>
                    <div className="flex items-center justify-between text-lg sm:text-lg font-bold pt-3 sm:pt-3 border-t border-gray-200">
                      <span>합계</span>
                      <span className="whitespace-nowrap">{totalPrice.toLocaleString()}원</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* 결제 버튼 */}
            <button
              onClick={async () => {
                // 품절 상품이 있는지 확인
                const outOfStockItems = cart.filter(item => {
                  const stockInfo = item.barcode ? productStockStatus[item.barcode] : null;
                  return stockInfo && stockInfo.inStock === false;
                });
                
                if (outOfStockItems.length > 0) {
                  // 품절 상품 자동 제거
                  for (const item of outOfStockItems) {
                    await handleRemove(item.id);
                  }
                  
                  // 사용자에게 알림
                  alert(`품절된 상품 ${outOfStockItems.length}개가 자동으로 제거되었습니다.\n\n제거된 상품:\n${outOfStockItems.map(item => `- ${item.name}`).join('\n')}`);
                }
                
                // 결제 페이지로 이동
                navigate("/checkout");
              }}
              className="w-full py-4 sm:py-4 bg-black text-white text-base sm:text-base font-medium hover:bg-gray-800 transition"
            >
              구매하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
