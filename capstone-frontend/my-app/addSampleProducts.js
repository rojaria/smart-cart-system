/**
 * Firebase Realtime Database에 샘플 상품 데이터를 추가하는 스크립트
 */
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCbRSYJkSTe3vqKz71bU6yMyR493PE63yA",
  authDomain: "capstone-765-bd2ce.firebaseapp.com",
  databaseURL: "https://capstone-765-bd2ce-default-rtdb.firebaseio.com",
  projectId: "capstone-765-bd2ce",
  storageBucket: "capstone-765-bd2ce.firebasestorage.app",
  messagingSenderId: "484950060196",
  appId: "1:484950060196:web:0e9d398ef40b6c50a68a31"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// 샘플 상품 데이터
const sampleProducts = [
  {
    barcode: "8801234567890",
    name: "신라면",
    price: 3500,
    stock: 50,
    inStock: true,
    category: "식품",
    description: "매운 라면",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    barcode: "8801234567891",
    name: "삼양라면",
    price: 3000,
    stock: 30,
    inStock: true,
    category: "식품",
    description: "맑은 국물 라면",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    barcode: "8801234567892",
    name: "코카콜라",
    price: 1500,
    stock: 100,
    inStock: true,
    category: "음료",
    description: "콜라 음료",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    barcode: "8801234567893",
    name: "사이다",
    price: 1500,
    stock: 80,
    inStock: true,
    category: "음료",
    description: "사이다 음료",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    barcode: "8801234567894",
    name: "우유",
    price: 2500,
    stock: 40,
    inStock: true,
    category: "유제품",
    description: "신선한 우유",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    barcode: "8801234567895",
    name: "요구르트",
    price: 3000,
    stock: 25,
    inStock: true,
    category: "유제품",
    description: "프로바이오틱스 요구르트",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    barcode: "8801234567896",
    name: "식빵",
    price: 2000,
    stock: 15,
    inStock: true,
    category: "식품",
    description: "부드러운 식빵",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    barcode: "8801234567897",
    name: "과자",
    price: 1800,
    stock: 60,
    inStock: true,
    category: "식품",
    description: "바삭한 과자",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    barcode: "8801234567898",
    name: "초콜릿",
    price: 2200,
    stock: 35,
    inStock: true,
    category: "식품",
    description: "달콤한 초콜릿",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    barcode: "8801234567899",
    name: "사과",
    price: 5000,
    stock: 20,
    inStock: true,
    category: "과일",
    description: "신선한 사과",
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

async function addSampleProducts() {
  try {
    console.log("🚀 샘플 상품 데이터 추가 시작...");
    
    for (const product of sampleProducts) {
      const productRef = ref(database, `products/${product.barcode}`);
      await set(productRef, product);
      console.log(`✅ ${product.name} (${product.barcode}) 추가 완료 - 재고: ${product.stock}개`);
    }
    
    console.log("🎉 모든 샘플 상품 데이터 추가 완료!");
  } catch (error) {
    console.error("❌ 샘플 상품 데이터 추가 실패:", error);
  }
}

// 스크립트 실행
addSampleProducts();





