// React에서 필요한 기능들 가져오기
import React, { useState } from "react";
// Firebase 회원가입 기능 가져오기
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

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
      await createUserWithEmailAndPassword(auth, email, password);
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
