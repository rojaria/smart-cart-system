// React에서 필요한 기능들 가져오기
import React, { useState } from "react";
// Firebase 회원가입 기능 가져오기
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, database } from "./firebase";
// Firebase Realtime Database 기능
import { ref, set, push } from "firebase/database";

// 회원가입 페이지 컴포넌트
export default function SignUp() {
  // email: 사용자가 입력한 이메일 저장
  const [email, setEmail] = useState("");
  // password: 사용자가 입력한 비밀번호 저장
  const [password, setPassword] = useState("");

  // 회원가입 처리 함수
  const handleSignUp = async (e) => {
    e.preventDefault(); // 폼 제출 시 페이지 새로고침 방지
    try {
      // Firebase를 사용해 새 계정 생성
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 사용자 등록 시 초기 데이터 설정
      await initializeUserData(user.uid, email);
      
    } catch (error) {
      // 오류 발생 시 에러 메시지 설정
      let message;
      switch (error.code) {
        case "auth/weak-password": message="비밀번호는 최소 6자 이상이어야 합니다."; break;
        case "auth/email-already-in-use": message="이미 사용 중인 이메일입니다."; break;
        case "auth/invalid-email": message="유효하지 않은 이메일 형식입니다."; break;
        default: message="회원가입 중 오류가 발생했습니다.";
      }
      // 에러 메시지 알림으로 표시
      alert(message);
    }
  };

  // 사용자 초기 데이터 설정 함수
  const initializeUserData = async (userId, email) => {
    try {
      const timestamp = Date.now();
      
      // 1. 사용자 기본 정보 설정
      const userRef = ref(database, `users/${userId}`);
      await set(userRef, {
        email: email,
        points: 0,
        totalDistance: 0,
        createdAt: timestamp,
        lastUpdated: timestamp
      });

      // 2. 포인트 히스토리에 가입 이벤트 추가
      const pointHistoryRef = push(ref(database, `users/${userId}/pointHistory`));
      await set(pointHistoryRef, {
        amount: 0,
        type: "system",
        reason: "signup",
        description: "회원가입 완료",
        timestamp: timestamp
      });

      // 3. 포인트 이벤트에 가입 이벤트 추가 (Toast 알림용)
      const pointEventRef = push(ref(database, `users/${userId}/pointEvents`));
      await set(pointEventRef, {
        amount: 0,
        type: "system",
        reason: "signup",
        description: "회원가입 완료",
        timestamp: timestamp,
        processed: false
      });

      console.log('✅ 사용자 초기 데이터 설정 완료');
      
    } catch (error) {
      console.error('❌ 사용자 초기 데이터 설정 실패:', error);
    }
  };

  return (
    <form className="flex flex-col" onSubmit={handleSignUp}>
      {/* 이메일 입력 필드 */}
      <input 
        type="email" 
        name="email"
        placeholder="이메일" 
        className="input" 
        autoComplete="email"
        required
        onChange={(e) => setEmail(e.target.value)} 
      />
      {/* 비밀번호 입력 필드 */}
      <input 
        type="password" 
        name="password"
        placeholder="비밀번호" 
        className="input" 
        autoComplete="new-password"
        required
        onChange={(e) => setPassword(e.target.value)} 
      />
      {/* 회원가입 버튼 */}
      <button type="submit" className="btn">회원가입</button>
    </form>
  );
}
