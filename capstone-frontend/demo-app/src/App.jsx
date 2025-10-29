import React, { useState, useEffect } from 'react';
import { ref, set, push, get, update, remove } from 'firebase/database';
import { database } from './firebase';
import { ShoppingCart, Plus, Minus, Trash2, Award, MapPin } from 'lucide-react';

// 시연용 상품 데이터
const DEMO_PRODUCTS = [
  { barcode: "8801234567890", name: "신라면", price: 3500 },
  { barcode: "8801234567891", name: "삼양라면", price: 3000 },
  { barcode: "8801234567892", name: "코카콜라", price: 1500 },
  { barcode: "8801234567893", name: "사이다", price: 1500 },
  { barcode: "8801234567894", name: "우유", price: 2500 },
  { barcode: "8801234567895", name: "요구르트", price: 3000 },
  { barcode: "8801234567896", name: "식빵", price: 2000 },
  { barcode: "8801234567897", name: "과자", price: 1800 },
  { barcode: "8801234567898", name: "초콜릿", price: 2200 },
  { barcode: "8801234567899", name: "사과", price: 5000 }
];

// 비콘 위치 데이터
const BEACON_LOCATIONS = [
  { id: "beacon_001", name: "입구", points: 5, description: "매장 입구 비콘" },
  { id: "beacon_002", name: "신선식품 코너", points: 10, description: "신선식품 구역 비콘" },
  { id: "beacon_003", name: "유제품 코너", points: 8, description: "유제품 구역 비콘" },
  { id: "beacon_004", name: "과자 코너", points: 6, description: "과자 구역 비콘" },
  { id: "beacon_005", name: "음료 코너", points: 7, description: "음료 구역 비콘" },
  { id: "beacon_006", name: "계산대", points: 15, description: "계산대 비콘" }
];

const CART_NUMBER = "001";
const USER_ID = "3lSd1o14fuUsKpDfoShocdfyCmz1";

function App() {
  const [cart, setCart] = useState([]);
  const [points, setPoints] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedBeacon, setSelectedBeacon] = useState('');
  const [loading, setLoading] = useState(false);
  const [visitedBeacons, setVisitedBeacons] = useState(new Set());

  // 장바구니 데이터 로드
  useEffect(() => {
    loadCartData();
    loadUserData();
  }, []);

  const loadCartData = async () => {
    try {
      const cartRef = ref(database, `carts/${CART_NUMBER}/items`);
      const snapshot = await get(cartRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const items = Object.keys(data).map(key => ({
          id: key, // 바코드가 키가 되므로 id도 바코드가 됨
          ...data[key]
        }));
        setCart(items);
      }
    } catch (error) {
      console.error('장바구니 로드 오류:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const pointsRef = ref(database, `users/${USER_ID}/points`);
      const distanceRef = ref(database, `users/${USER_ID}/totalDistance`);
      
      const [pointsSnapshot, distanceSnapshot] = await Promise.all([
        get(pointsRef),
        get(distanceRef)
      ]);
      
      setPoints(pointsSnapshot.val() || 0);
      setTotalDistance(distanceSnapshot.val() || 0);
    } catch (error) {
      console.error('사용자 데이터 로드 오류:', error);
    }
  };

  // 바코드 스캔 시뮬레이션
  const handleBarcodeScan = async () => {
    if (!barcodeInput.trim()) {
      alert('바코드를 입력해주세요.');
      return;
    }

    const product = DEMO_PRODUCTS.find(p => p.barcode === barcodeInput);
    if (!product) {
      alert('등록되지 않은 상품입니다.');
      return;
    }

    setLoading(true);
    try {
      // 기존 상품이 있는지 확인
      const existingItem = cart.find(item => item.barcode === barcodeInput);
      
      if (existingItem) {
        // 수량 증가
        const itemRef = ref(database, `carts/${CART_NUMBER}/items/${product.barcode}`);
        await update(itemRef, { quantity: existingItem.quantity + 1 });
      } else {
        // 새 상품 추가 (바코드를 키로 사용)
        const itemRef = ref(database, `carts/${CART_NUMBER}/items/${product.barcode}`);
        await set(itemRef, {
          barcode: product.barcode,
          name: product.name,
          price: product.price,
          quantity: 1,
          detectedAt: Date.now()
        });
      }
      
      await loadCartData();
      setBarcodeInput('');
      alert(`✅ ${product.name}이(가) 장바구니에 추가되었습니다!`);
    } catch (error) {
      console.error('상품 추가 오류:', error);
      alert('상품 추가 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 수량 변경
  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    try {
      // itemId는 이제 바코드가 됨
      const itemRef = ref(database, `carts/${CART_NUMBER}/items/${itemId}`);
      await update(itemRef, { quantity: newQuantity });
      
      // 로컬 상태 업데이트
      const newCart = cart.map(item => 
        item.id === itemId 
          ? { ...item, quantity: newQuantity }
          : item
      );
      setCart(newCart);
    } catch (error) {
      console.error('수량 변경 오류:', error);
    }
  };

  // 상품 삭제
  const removeItem = async (itemId) => {
    try {
      // itemId는 이제 바코드가 됨
      const itemRef = ref(database, `carts/${CART_NUMBER}/items/${itemId}`);
      await remove(itemRef);
      
      // 로컬 상태에서 제거
      const newCart = cart.filter(item => item.id !== itemId);
      setCart(newCart);
    } catch (error) {
      console.error('상품 삭제 오류:', error);
    }
  };

  // 비콘 방문 시뮬레이션
  const visitBeacon = async () => {
    if (!selectedBeacon) {
      alert('비콘을 선택해주세요.');
      return;
    }

    const beacon = BEACON_LOCATIONS.find(b => b.id === selectedBeacon);
    if (!beacon) {
      alert('선택된 비콘이 없습니다.');
      return;
    }

    // 이미 방문한 비콘인지 확인
    if (visitedBeacons.has(selectedBeacon)) {
      alert(`이미 ${beacon.name}을(를) 방문했습니다.`);
      return;
    }

    setLoading(true);
    try {
      // 포인트 업데이트
      const pointsRef = ref(database, `users/${USER_ID}/points`);
      const newPoints = points + beacon.points;
      await set(pointsRef, newPoints);
      
      // 포인트 내역 추가
      const historyRef = push(ref(database, `users/${USER_ID}/pointHistory`));
      await set(historyRef, {
        amount: beacon.points,
        type: "earned",
        reason: "location_event",
        eventName: beacon.name,
        description: `${beacon.name} 방문`,
        timestamp: Date.now()
      });
      
      setPoints(newPoints);
      setVisitedBeacons(prev => new Set([...prev, selectedBeacon]));
      setSelectedBeacon('');
      alert(`✅ ${beacon.name} 방문으로 ${beacon.points}포인트가 적립되었습니다!`);
    } catch (error) {
      console.error('포인트 적립 오류:', error);
      alert('포인트 적립 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 비콘 방문 기록 초기화
  const resetBeaconVisits = async () => {
    if (confirm('비콘 방문 기록과 포인트를 초기화하시겠습니까?')) {
      try {
        // 1. 방문 기록 초기화
        setVisitedBeacons(new Set());
        
        // 2. 포인트 초기화
        const pointsRef = ref(database, `users/${USER_ID}/points`);
        await set(pointsRef, 0);
        setPoints(0);
        
        // 3. 총 이동거리 초기화
        const distanceRef = ref(database, `users/${USER_ID}/totalDistance`);
        await set(distanceRef, 0);
        setTotalDistance(0);
        
        // 4. 포인트 내역 초기화
        const historyRef = ref(database, `users/${USER_ID}/pointHistory`);
        await set(historyRef, null);
        
        alert('비콘 방문 기록과 포인트가 초기화되었습니다.');
      } catch (error) {
        console.error('초기화 오류:', error);
        alert('초기화 중 오류가 발생했습니다.');
      }
    }
  };

  // 장바구니 비우기
  const clearCart = async () => {
    if (!confirm('장바구니를 비우시겠습니까?')) return;
    
    try {
      // Firebase에서 장바구니 아이템들 삭제
      const cartRef = ref(database, `carts/${CART_NUMBER}/items`);
      await remove(cartRef);
      
      // 로컬 상태 초기화
      setCart([]);
      alert('장바구니가 비워졌습니다.');
    } catch (error) {
      console.error('장바구니 비우기 오류:', error);
      // 오류가 발생해도 로컬 상태는 초기화
      setCart([]);
    }
  };

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="container">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold mb-2">🛒 SmartCart 시연 프로그램</h1>
        <p className="text-gray-600">카트 번호: {CART_NUMBER} | 사용자: {USER_ID}</p>
      </div>

      <div className="grid">
        {/* 바코드 스캔 섹션 */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            바코드 스캔 시뮬레이션
          </h2>
          
          <div className="mb-4">
            <label className="block text-lg font-bold mb-2">바코드 입력</label>
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="바코드를 입력하세요 (예: 8801234567890)"
              className="input"
            />
            <button
              onClick={handleBarcodeScan}
              disabled={loading}
              className="btn w-full"
            >
              {loading ? '처리 중...' : '상품 추가'}
            </button>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-bold mb-2">등록된 상품 목록</h3>
            <div className="space-y-2">
              {DEMO_PRODUCTS.map(product => (
                <div key={product.barcode} className="flex justify-between items-center p-2 border rounded">
                  <span className="text-sm">{product.name}</span>
                  <span className="text-sm text-gray-600">{product.barcode}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 비콘 방문 섹션 */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-6 h-6" />
            비콘 방문 시뮬레이션
          </h2>
          
          <div className="mb-4">
            <label className="block text-lg font-bold mb-2">비콘 위치 선택</label>
            <select
              value={selectedBeacon}
              onChange={(e) => setSelectedBeacon(e.target.value)}
              className="input"
            >
              <option value="">비콘을 선택하세요</option>
              {BEACON_LOCATIONS.map(beacon => (
                <option 
                  key={beacon.id} 
                  value={beacon.id}
                  disabled={visitedBeacons.has(beacon.id)}
                >
                  {beacon.name} ({beacon.points}P) {visitedBeacons.has(beacon.id) ? '- 방문완료' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={visitBeacon}
              disabled={loading || !selectedBeacon}
              className="btn btn-success w-full mb-2"
            >
              {loading ? '처리 중...' : '비콘 방문'}
            </button>
            <button
              onClick={resetBeaconVisits}
              className="btn btn-danger w-full"
            >
              방문 기록 & 포인트 초기화
            </button>
          </div>

          <div className="bg-green-50 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold">현재 포인트</span>
              <span className="text-2xl font-bold text-green-600">{points.toLocaleString()} P</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold">방문한 비콘</span>
              <span className="text-lg font-bold">{visitedBeacons.size}/{BEACON_LOCATIONS.length}개</span>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-bold mb-2">비콘 위치 목록</h3>
            <div className="space-y-2">
              {BEACON_LOCATIONS.map(beacon => (
                <div 
                  key={beacon.id} 
                  className={`flex justify-between items-center p-2 border rounded ${
                    visitedBeacons.has(beacon.id) ? 'bg-green-100 border-green-300' : 'bg-gray-50'
                  }`}
                >
                  <div>
                    <span className="font-medium">{beacon.name}</span>
                    <p className="text-sm text-gray-600">{beacon.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-green-600">{beacon.points}P</span>
                    {visitedBeacons.has(beacon.id) && (
                      <p className="text-xs text-green-600">방문완료</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 장바구니 섹션 */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            장바구니 ({cart.length}개 상품)
          </h2>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="btn btn-danger"
            >
              장바구니 비우기
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            장바구니가 비어있습니다
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center p-4 border rounded">
                <div className="flex-1">
                  <h3 className="font-bold">{item.name}</h3>
                  <p className="text-gray-600">바코드: {item.barcode}</p>
                  <p className="text-lg font-bold text-green-600">
                    {(item.price * item.quantity).toLocaleString()}원
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="btn"
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-lg font-bold w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="btn"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => removeItem(item.id)}
                    className="btn btn-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-xl font-bold">
                <span>총 금액</span>
                <span className="text-green-600">{totalPrice.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
