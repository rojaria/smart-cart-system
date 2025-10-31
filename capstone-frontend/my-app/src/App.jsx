// React 라이브러리에서 필요한 기능들 가져오기
import React, { useEffect, useState } from "react";
// Firebase 인증 관련 기능 가져오기
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, database } from "./firebase";
import { ref, onValue, set, update, remove } from "firebase/database";
// 다른 컴포넌트들 가져오기
import SignUp from "./SignUp.jsx";
import LoginPage from "./LoginPage.jsx";
import CartPage from "./CartPage.jsx";
// 새로운 페이지들 추가
import CartRegistrationPage from "./CartRegistrationPage.jsx";
import PointsPage from "./PointsPage.jsx";
import CheckoutPageNew from "./CheckoutPageNew.jsx";
// import ProductManagementPage from "./ProductManagementPage.jsx"; // 주석처리됨
import PaymentSuccessPage from "./PaymentSuccessPage.jsx";
import PaymentFailPage from "./PaymentFailPage.jsx";
// Toast 알림 기능
import { ToastProvider } from "./contexts/ToastContext.jsx";
// 포인트 이벤트 시뮬레이터 (개발용)
import "./utils/pointEventSimulator.js";
// 페이지 이동을 위한 라우팅 기능 가져오기
import { Routes, Route, Link, useNavigate } from "react-router-dom";

// 메인 앱 컴포넌트
export default function App() {
  // 페이지 이동 함수
  const navigate = useNavigate();
  // user: 현재 로그인한 사용자 정보 저장
  const [user, setUser] = useState(undefined); // undefined = 로딩 중, null = 로그아웃
  // loading: 로그인 상태 확인 중인지 여부
  const [loading, setLoading] = useState(true);
  // showLogin: 로그인 화면을 보여줄지, 회원가입 화면을 보여줄지 결정
  const [showLogin, setShowLogin] = useState(true);
  // cartNumber: 현재 등록된 카트 번호 (초기값을 localStorage에서 불러옴)
  const [cartNumber, setCartNumber] = useState(() => {
    const saved = localStorage.getItem('cartNumber');
    return saved || null;
  });
  // cartLoading: 카트 정보 로딩 중
  const [cartLoading, setCartLoading] = useState(true);

  // 컴포넌트가 처음 실행될 때 한 번만 실행됨
  useEffect(() => {
    // 🔥 브라우저 간 로그아웃 동기화
    const handleStorageChange = (e) => {
      if (e.key === 'logout') {
        console.log("📡 다른 탭에서 로그아웃 감지, 현재 세션도 로그아웃 처리");
        setUser(null);
        setLoading(false);
        setCartNumber(null);
        setCartLoading(false);
        localStorage.removeItem('cartNumber');
        localStorage.removeItem('userId');
        navigate('/');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    // Firebase에서 로그인 상태 변화를 계속 감지
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      // 새로고침 시 일시적인 null 상태를 방지하기 위해 약간의 지연 추가
      if (currentUser) {
        setUser(currentUser); // 로그인한 사용자 정보 저장
        setLoading(false); // 로딩 끝
        
        // 로그인 후 홈페이지(장바구니)로 리다이렉트 (결제 페이지들 제외)
        if (window.location.pathname !== '/' && 
            window.location.pathname !== '/points' && 
            window.location.pathname !== '/checkout' && 
            window.location.pathname !== '/products' &&
            !window.location.pathname.startsWith('/payment-') &&
            !window.location.pathname.includes('payment-success') &&
            !window.location.pathname.includes('payment-fail')) {
          navigate('/', { replace: true });
        }
        
        // 결제 성공 페이지에 URL 파라미터가 없으면 홈으로 리다이렉트
        if (window.location.pathname === '/payment-success' && !window.location.search) {
          navigate('/', { replace: true });
        }
        
        // 결제 성공 페이지에 URL 파라미터 없이 직접 접근 시에만 홈으로 리다이렉트
        if (window.location.pathname === '/payment-success' && !window.location.search) {
          navigate('/', { replace: true });
        }
      } else {
        // 로그아웃 상태이지만 즉시 초기화하지 않고 잠시 대기
        setTimeout(async () => {
          // Firebase의 카트 데이터도 삭제
          const savedCartNumber = localStorage.getItem('cartNumber');
          if (savedCartNumber) {
            try {
              const cartItemsRef = ref(database, `carts/${savedCartNumber}/items`);
              await remove(cartItemsRef);
            } catch (error) {
              console.error("카트 데이터 삭제 오류:", error);
            }
          }
          
          // State 초기화
          setUser(null); // null = 로그아웃 상태
          setLoading(false);
          setCartNumber(null);
          setCartLoading(false);
          
          // localStorage 정리
          localStorage.removeItem('cartNumber');
          localStorage.removeItem('userId');
        }, 100); // 100ms 지연
      }
    });
    // 컴포넌트가 사라질 때 감지 중지
    return () => {
      unsub();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 사용자가 로그인하면 카트 번호 실시간 감지
  useEffect(() => {
    // Firebase 인증이 아직 로딩 중이면 대기
    if (user === undefined) {
      return;
    }
    
    if (!user) {
      setCartLoading(false);
      return;
    }

    setCartLoading(true);
    
    const cartRef = ref(database, `users/${user.uid}/cartNumber`);
    const unsubscribe = onValue(cartRef, async (snapshot) => {
      const newCartNumber = snapshot.val();
      
      if (newCartNumber) {
        setCartNumber(newCartNumber);
        
        // 🔥 카트 상태를 inUse: true로 자동 활성화
        try {
          const cartStatusRef = ref(database, `carts/${newCartNumber}`);
          await update(cartStatusRef, {
            inUse: true,
            userId: user.uid,
            lastUsedAt: Date.now()
          });
        } catch (error) {
          console.error("카트 활성화 오류:", error);
        }
        
        // localStorage에도 저장하여 새로고침 후에도 유지
        localStorage.setItem('cartNumber', newCartNumber);
        localStorage.setItem('userId', user.uid);
      } else {
        // Firebase에 카트넘버가 없으면 카트 등록 화면으로
        console.log("⚠️ Firebase에 카트넘버 없음");
        setCartNumber(null);
      }
      
      setCartLoading(false);
    });

    return () => unsubscribe();
  }, [user]);


  // 브라우저 종료 시 카트 정리는 하지 않음 (새로고침 시 장바구니 유지)

  // 로딩 중이면 "로딩 중..." 메시지 표시
  if (loading || cartLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center text-lg">로딩 중...</div>
      </div>
    );
  }

  // 로그인하지 않은 경우 - 로그인/회원가입 화면 표시
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-auto max-w-md">
          <div className="card">
            {/* showLogin이 true면 로그인 화면, false면 회원가입 화면 */}
            {showLogin ? (
              <>
                <LoginPage />
                <p className="auth-toggle">
                  계정이 없으신가요?{" "}
                  {/* 회원가입 버튼 클릭 시 회원가입 화면으로 전환 */}
                  <button onClick={() => setShowLogin(false)}>회원가입</button>
                </p>
              </>
            ) : (
              <>
                <SignUp />
                <p className="auth-toggle">
                  이미 계정이 있으신가요?{" "}
                  {/* 로그인 버튼 클릭 시 로그인 화면으로 전환 */}
                  <button onClick={() => setShowLogin(true)}>로그인</button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 카트 정리 함수 (로그아웃, 브라우저 종료 시 공통 사용)
  const cleanupCart = async (currentCartNumber, currentUserId) => {
    console.log("🔧 카트 정리 시작:", { currentCartNumber, currentUserId });

    try {
      // 1. 카트의 센서 데이터(items) 삭제
      if (currentCartNumber) {
        console.log("📦 카트 데이터 정리 중:", currentCartNumber);
        const cartItemsRef = ref(database, `carts/${currentCartNumber}/items`);
        await remove(cartItemsRef);
        console.log("✅ 카트 아이템 삭제 완료");

        // 2. 카트 상태 업데이트 (사용 중 해제)
        console.log("🔄 카트 상태 업데이트 중...");
        const cartRef = ref(database, `carts/${currentCartNumber}`);
        await update(cartRef, {
          inUse: false,
          userId: null,
          releasedAt: Date.now()
        });
        console.log("✅ 카트 상태 inUse: false로 업데이트 완료");
      }

      // 3. 사용자의 장바구니 데이터 삭제
      if (currentUserId) {
        console.log("👤 사용자 데이터 정리 중:", currentUserId);
        const userCartRef = ref(database, `users/${currentUserId}/cart`);
        await remove(userCartRef);
        console.log("✅ 사용자 장바구니 삭제 완료");

        // 4. 사용자 카트 번호 제거
        const userCartNumberRef = ref(database, `users/${currentUserId}/cartNumber`);
        await set(userCartNumberRef, null);
        console.log("✅ 사용자 카트 번호 제거 완료");
      }
      
      console.log("🎉 전체 카트 정리 완료!");
    } catch (error) {
      console.error("❌ 카트 정리 오류:", error);
      throw error; // 오류를 다시 throw
    }
  };

  // 로그아웃 처리 함수
  const handleLogout = async () => {
    try {
      // 현재 사용자 정보와 카트 번호 저장
      const currentUserId = user?.uid;
      const currentCartNumber = cartNumber;
      
      console.log("🔄 로그아웃 시작:", { currentUserId, currentCartNumber });
      
      // 카트 정리 (signOut 전에 실행)
      if (currentCartNumber && currentUserId) {
        console.log("🔧 카트 정리 시작...");
        await cleanupCart(currentCartNumber, currentUserId);
        console.log("✅ 카트 정리 완료");
      } else {
        console.log("⚠️ 카트 정보 없음, 정리 건너뜀");
      }

      // 로그아웃
      await signOut(auth);
      
      // 🔥 다른 탭에 로그아웃 알림 (localStorage 이벤트 발동)
      localStorage.setItem('logout', Date.now().toString());
      localStorage.removeItem('logout'); // 즉시 제거하여 다른 로그아웃에도 반응
      
      console.log("✅ 로그아웃 완료");
    } catch (error) {
      console.error("❌ 로그아웃 오류:", error);
      alert("로그아웃 중 오류가 발생했습니다.");
      // 오류가 발생해도 강제로 로그아웃
      await signOut(auth);
    }
  };

  // 결제 성공 페이지일 때는 네비게이션 없이 전체 화면 표시
  if (window.location.pathname === '/payment-success') {
    return (
      <Routes>
        <Route path="/payment-success" element={<PaymentSuccessPage user={user} />} />
      </Routes>
    );
  }

  // 전체 앱을 중앙 정렬하는 부모 컨테이너
  return (
    <ToastProvider>
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-full max-w-6xl px-4">
        {user && !cartNumber ? (
          // 로그인했지만 카트 미등록 → 카트 등록 화면
          <>
            {/* 상단 바 */}
            <nav className="w-full bg-white shadow-md rounded-lg mb-6 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-3 sm:gap-0">
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  <button 
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm whitespace-nowrap" 
                    onClick={handleLogout}
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            </nav>
            {/* 카트 등록 화면 */}
            <CartRegistrationPage user={user} />
          </>
        ) : user && cartNumber ? (
          // 로그인 & 카트 등록 완료 → 메인 화면 표시
          <>
            {/* 상단 네비게이션 바 */}
            <nav className="w-full bg-white shadow-md rounded-lg mb-6 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6">
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <Link to="/" className="text-sm text-gray-600 hover:text-gray-800 font-medium transition whitespace-nowrap">
                    장바구니
                  </Link>
                  <Link to="/points" className="text-sm text-gray-600 hover:text-gray-800 font-medium transition whitespace-nowrap">
                    포인트
                  </Link>
                </div>
                <button
                  className="ml-auto px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm whitespace-nowrap"
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
            </nav>
            
            {/* 페이지 라우팅 설정 */}
            <Routes>
              {/* "/" 경로 - 장바구니 페이지 */}
              <Route path="/" element={<CartPage user={user} />} />
              {/* "/points" 경로 - 포인트 페이지 */}
              <Route path="/points" element={<PointsPage user={user} />} />
              {/* "/checkout" 경로 - 새로운 결제 페이지 */}
              <Route path="/checkout" element={<CheckoutPageNew user={user} />} />
              {/* "/payment-success" 경로 - 결제 성공 페이지 */}
              <Route path="/payment-success" element={<PaymentSuccessPage user={user} />} />
              {/* "/payment-fail" 경로 - 결제 실패 페이지 */}
              <Route path="/payment-fail" element={<PaymentFailPage />} />
            </Routes>
          </>
        ) : (
          // 로그인하지 않은 경우
          <div className="text-center">
            <p className="text-gray-500">로그인이 필요합니다.</p>
          </div>
        )}
        </div>
      </div>
    </ToastProvider>
  );
}
