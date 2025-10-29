/**
 * Firebase Functions API 호출 서비스
 * 
 * 사용법:
 * import { api } from "./services/api";
 * const result = await api.getProduct("8801234567890");
 */

// Firebase Functions 기본 URL
// 배포 후 실제 URL로 변경하세요
const FUNCTIONS_BASE_URL = "https://asia-northeast3-capstone-765-bd2ce.cloudfunctions.net";

/**
 * API 호출 헬퍼 함수
 */
const fetchAPI = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "서버 오류가 발생했습니다.");
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
};

/**
 * API 메서드 모음
 */
export const api = {
  // ==========================================
  // 상품 관련 API
  // ==========================================

  /**
   * 바코드로 상품 정보 조회
   * @param {string} barcode - 상품 바코드
   * @returns {Promise<{success: boolean, product: object}>}
   */
  getProduct: async (barcode) => {
    return fetchAPI(`getProduct?barcode=${barcode}`);
  },

  /**
   * 스캔한 상품을 장바구니에 추가
   * @param {string} userId - 사용자 UID
   * @param {string} barcode - 상품 바코드
   * @param {number} quantity - 수량 (기본값: 1)
   * @returns {Promise<{success: boolean, message: string, product: object}>}
   */
  addScannedItem: async (userId, barcode, quantity = 1) => {
    return fetchAPI("addScannedItem", {
      method: "POST",
      body: JSON.stringify({ userId, barcode, quantity })
    });
  },

  /**
   * 상품 추가/수정 (관리자용)
   * @param {object} productData - {barcode, name, price, category, inStock}
   * @returns {Promise<{success: boolean, message: string}>}
   */
  addProduct: async (productData) => {
    return fetchAPI("addProduct", {
      method: "POST",
      body: JSON.stringify(productData)
    });
  },

  // ==========================================
  // 포인트 관련 API
  // ==========================================

  /**
   * 이동 거리 기반 포인트 지급
   * @param {string} userId - 사용자 UID
   * @param {number} distance - 이동 거리 (m)
   * @returns {Promise<{success: boolean, earnedPoints: number, totalPoints: number}>}
   */
  addDistancePoints: async (userId, distance) => {
    return fetchAPI("addDistancePoints", {
      method: "POST",
      body: JSON.stringify({ userId, distance })
    });
  },

  /**
   * 위치 기반 이벤트 포인트 확인
   * @param {string} userId - 사용자 UID
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @returns {Promise<{success: boolean, triggered: boolean, event?: string, points?: number}>}
   */
  checkLocationEvent: async (userId, x, y) => {
    return fetchAPI("checkLocationEvent", {
      method: "POST",
      body: JSON.stringify({ userId, x, y })
    });
  },

  // ==========================================
  // 결제 관련 API
  // ==========================================

  /**
   * 결제 준비 (주문 생성)
   * @param {string} userId - 사용자 UID
   * @param {array} items - 장바구니 상품 배열
   * @param {number} total - 총 금액
   * @param {number} usedPoints - 사용할 포인트
   * @returns {Promise<{success: boolean, orderId: string, finalAmount: number}>}
   */
  preparePayment: async (userId, items, total, usedPoints = 0) => {
    return fetchAPI("preparePayment", {
      method: "POST",
      body: JSON.stringify({ userId, items, total, usedPoints })
    });
  },

  /**
   * 결제 완료 처리
   * @param {string} userId - 사용자 UID
   * @param {string} orderId - 주문 ID
   * @param {string} paymentMethod - 결제 수단
   * @returns {Promise<{success: boolean, message: string}>}
   */
  completePayment: async (userId, orderId, paymentMethod) => {
    return fetchAPI("completePayment", {
      method: "POST",
      body: JSON.stringify({ userId, orderId, paymentMethod })
    });
  },

  // ==========================================
  // 위치 관련 API
  // ==========================================

  /**
   * 카트 위치 업데이트
   * @param {string} userId - 사용자 UID
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @returns {Promise<{success: boolean, message: string}>}
   */
  updateLocation: async (userId, x, y) => {
    return fetchAPI("updateLocation", {
      method: "POST",
      body: JSON.stringify({ userId, x, y })
    });
  }
};

/**
 * API 엔드포인트 목록 (참고용)
 */
export const API_ENDPOINTS = {
  // 상품
  GET_PRODUCT: "getProduct",
  ADD_SCANNED_ITEM: "addScannedItem",
  ADD_PRODUCT: "addProduct",
  
  // 포인트
  ADD_DISTANCE_POINTS: "addDistancePoints",
  CHECK_LOCATION_EVENT: "checkLocationEvent",
  
  // 결제
  PREPARE_PAYMENT: "preparePayment",
  COMPLETE_PAYMENT: "completePayment",
  
  // 위치
  UPDATE_LOCATION: "updateLocation"
};

/**
 * 로컬 개발용 Mock API (Firebase Functions 배포 전 테스트용)
 */
export const mockApi = {
  getProduct: async (barcode) => {
    // 임의의 상품 정보 반환
    return {
      success: true,
      product: {
        name: "테스트 상품",
        price: 5000,
        category: "식품",
        inStock: true
      }
    };
  },
  
  addScannedItem: async (userId, barcode, quantity) => {
    return {
      success: true,
      message: "장바구니에 추가되었습니다.",
      product: {
        name: "테스트 상품",
        price: 5000
      }
    };
  },
  
  addDistancePoints: async (userId, distance) => {
    const points = Math.floor(distance / 10);
    return {
      success: true,
      message: `${points} 포인트가 적립되었습니다!`,
      earnedPoints: points,
      totalPoints: points
    };
  }
  
  // ... 나머지 Mock 함수들
};

export default api;


