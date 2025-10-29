import React, { useState, useEffect } from "react";
import { ref, set, get, update } from "firebase/database";
import { database } from "./firebase";

// 카트 번호 등록 페이지
export default function CartRegistrationPage({ user }) {
  const [cartNumber, setCartNumber] = useState("");
  const [currentCart, setCurrentCart] = useState(null);
  const [loading, setLoading] = useState(false);

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

  // 카트 번호 등록/변경
  const handleRegisterCart = async (e) => {
    e.preventDefault();
    
    if (!cartNumber.trim()) {
      alert("카트 번호를 입력해주세요.");
      return;
    }

    // 카트 번호를 3자리로 포맷 (1 -> 001, 12 -> 012)
    const formattedCartNumber = cartNumber.padStart(3, '0');

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
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-center text-gray-500">등록된 카트가 없습니다</p>
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

      {/* <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-gray-600">
          💡 <strong>안내:</strong> 매장 입구의 카트에 부착된 번호를 입력하세요.
          쇼핑이 끝나면 반드시 카트를 해제해주세요.
        </p>
      </div>

      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-xs text-gray-600">
          ✅ <strong>등록 가능한 카트:</strong> 001번 ~ 100번<br/>
          🔒 <strong>보안:</strong> 등록되지 않은 카트 번호는 사용할 수 없습니다
        </p>
      </div> */}
    </div>
  );
}


