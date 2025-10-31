import React, { useState, useEffect } from "react";
import { ref, set, get, update } from "firebase/database";
import { database } from "./firebase";
import QRCodeScanner from "./components/QRCodeScanner";

// 카트 번호 등록 페이지
export default function CartRegistrationPage({ user }) {
  const [cartNumber, setCartNumber] = useState("");
  const [currentCart, setCurrentCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  // 현재 사용자의 카트 정보 조회
  useEffect(() => {
    if (!user) return;
    
    const fetchCurrentCart = async () => {
      const userRef = ref(database, `users/${user.uid}/cartNumber`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        setCurrentCart(snapshot.val());
      }
    };
    
    fetchCurrentCart();
  }, [user]);

  // 카트 등록 로직 (공통 함수)
  const registerCart = async (cartNumberToUse) => {
    const cartNum = cartNumberToUse || cartNumber.trim();
    
    if (!cartNum) {
      alert("카트 번호를 입력해주세요.");
      return;
    }

    // 카트 번호를 3자리로 포맷 (1 -> 001, 12 -> 012)
    const formattedCartNumber = cartNum.padStart(3, '0');

    setLoading(true);

    try {
      // 1. 해당 카트가 시스템에 등록되어 있는지 확인
      const cartRef = ref(database, `carts/${formattedCartNumber}`);
      const cartSnapshot = await get(cartRef);
      
      if (!cartSnapshot.exists()) {
        alert(`❌ 카트 ${formattedCartNumber}번은 존재하지 않습니다.\n\n등록된 카트 번호를 입력해주세요.\n(예: 001, 002, 003, ... 100)`);
        setLoading(false);
        return;
      }
      
      // 2. 해당 카트가 다른 사용자가 사용 중인지 확인
      const cartData = cartSnapshot.val();
      if (cartData.inUse && cartData.userId !== user.uid) {
        // 사용 시작 시간 계산
        const assignedTime = cartData.assignedAt ? new Date(cartData.assignedAt).toLocaleString('ko-KR') : '알 수 없음';
        
        alert(
          `🚫 카트 ${formattedCartNumber}번은 이미 사용 중입니다!\n\n` +
          `다른 고객이 현재 이 카트로 쇼핑 중입니다.\n` +
          `사용 시작: ${assignedTime}\n\n` +
          `다른 카트 번호를 선택해주세요.`
        );
        setLoading(false);
        return;
      }
      
      // 2-1. 동일한 사용자가 재등록하는 경우 (안전장치)
      if (cartData.inUse && cartData.userId === user.uid && currentCart === formattedCartNumber) {
        alert(`✅ 이미 카트 ${formattedCartNumber}번을 사용 중입니다.`);
        setLoading(false);
        return;
      }

      // 3. 이전 카트가 있다면 해제
      if (currentCart) {
        const oldCartRef = ref(database, `carts/${currentCart}`);
        await update(oldCartRef, {
          inUse: false,
          userId: null,
          releasedAt: Date.now()
        });
      }

      // 4. 새 카트 등록 (기존 데이터 유지하면서 업데이트)
      await update(cartRef, {
        userId: user.uid,
        inUse: true,
        assignedAt: Date.now(),
        lastUpdated: Date.now()
      });

      // 5. 사용자 정보에 카트 번호 저장
      const userCartRef = ref(database, `users/${user.uid}/cartNumber`);
      await set(userCartRef, formattedCartNumber);

      setCurrentCart(formattedCartNumber);
      alert(`✅ 카트 ${formattedCartNumber}번이 등록되었습니다!`);
      setCartNumber("");

    } catch (error) {
      console.error("카트 등록 오류:", error);
      alert("카트 등록 중 오류가 발생했습니다: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 폼 제출 핸들러
  const handleRegisterCart = async (e) => {
    e.preventDefault();
    await registerCart();
  };

  // QR 스캔 핸들러
  const handleQRScan = async (qrData) => {
    console.log('QR 스캔 결과:', qrData);
    
    // QR 데이터에서 카트 번호 추출 (001, 002, 003... 형식)
    const scannedCartNumber = qrData.trim();
    
    // 유효성 검사 (3자리 숫자)
    if (/^\d{3}$/.test(scannedCartNumber)) {
      setCartNumber(scannedCartNumber);
      setShowQRScanner(false);
      
      // 자동으로 카트 등록 실행
      try {
        await registerCart(scannedCartNumber);
      } catch (error) {
        console.error('QR 스캔 후 카트 등록 실패:', error);
        alert('카트 등록 중 오류가 발생했습니다.');
      }
    } else {
      // QR 스캔창 닫기
      setShowQRScanner(false);
      
      // 유효하지 않은 QR 코드 알림 후 다시 시도
      alert("유효하지 않은 QR 코드입니다.\n\n\n다시 시도하시겠습니까?");
      
      // 알림창 확인 후 QR 스캔창 다시 열기
      setTimeout(() => {
        setShowQRScanner(true);
      }, 100);
    }
  };

  const handleQRScanError = (error) => {
    console.error("QR 스캔 오류:", error);
    
    let errorMessage = "QR 스캔 중 오류가 발생했습니다.";
    
    if (error && error.message) {
      errorMessage += `\n\n오류 내용: ${error.message}`;
    } else if (typeof error === 'string') {
      errorMessage += `\n\n오류 내용: ${error}`;
    } else {
      errorMessage += "\n\n알 수 없는 오류가 발생했습니다.";
    }
    
    // 모바일 환경에서의 일반적인 오류 메시지 추가
    if (error && error.name === 'NotAllowedError') {
      errorMessage += "\n\n해결 방법:\n1. 브라우저 설정에서 카메라 권한을 허용해주세요\n2. HTTPS 연결을 사용해주세요";
    } else if (error && error.name === 'NotFoundError') {
      errorMessage += "\n\n해결 방법:\n1. 카메라가 연결되어 있는지 확인해주세요\n2. 다른 앱에서 카메라를 사용 중인지 확인해주세요";
    }
    
    // QR 스캔창 닫기
    setShowQRScanner(false);
    
    // 알림창 표시 후 QR 스캔창 다시 열기
    alert(errorMessage + "\n\n다시 시도하시겠습니까?");
    
    // 알림창 확인 후 QR 스캔창 다시 열기
    setTimeout(() => {
      setShowQRScanner(true);
    }, 100);
  };

  const handleCloseQRScanner = () => {
    setShowQRScanner(false);
  };

  // 카트 해제
  const handleReleaseCart = async () => {
    if (!currentCart) return;

    if (!confirm("현재 카트를 해제하시겠습니까?")) return;

    setLoading(true);

    try {
      // 1. 카트 상태 업데이트
      const cartRef = ref(database, `carts/${currentCart}`);
      await update(cartRef, {
        inUse: false,
        userId: null,
        releasedAt: Date.now()
      });

      // 2. 사용자 정보에서 카트 번호 제거
      const userCartRef = ref(database, `users/${user.uid}/cartNumber`);
      await set(userCartRef, null);

      alert("카트가 해제되었습니다.");
      setCurrentCart(null);

    } catch (error) {
      console.error("카트 해제 오류:", error);
      alert("카트 해제 중 오류가 발생했습니다: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">🛒 카트 등록</h2>

      {/* 현재 등록된 카트 정보 */}
      {currentCart ? (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">현재 등록된 카트</p>
          <p className="text-2xl font-bold text-green-700">카트 {currentCart}번</p>
          <button
            onClick={handleReleaseCart}
            disabled={loading}
            className="mt-3 w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? "처리 중..." : "카트 해제"}
          </button>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-center">
            <p className="text-green-700 font-medium mb-3">📱 QR 코드로 카트 등록</p>
            <button
              onClick={() => setShowQRScanner(true)}
              className="w-full px-4 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
            >
              📱 QR 코드로 스캔하기
            </button>
          </div>
        </div>
      )}

      {/* 카트 번호 입력 폼 */}
      <form onSubmit={handleRegisterCart} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            카트 번호
          </label>
          <input
            type="text"
            value={cartNumber}
            onChange={(e) => setCartNumber(e.target.value)}
            placeholder="예: 1, 2, 3... 또는 001, 002, 003..."
            maxLength="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "처리 중..." : currentCart ? "카트 변경" : "카트 등록"}
        </button>
      </form>


      {/* QR 스캔 모달 */}
      {showQRScanner && (
        <QRCodeScanner
          onScan={handleQRScan}
          onError={handleQRScanError}
          onClose={handleCloseQRScanner}
        />
      )}
    </div>
  );
}