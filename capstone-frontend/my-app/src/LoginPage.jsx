// React에서 필요한 기능들 가져오기
import React, { useState } from "react";
// Firebase 로그인 기능 가져오기
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

// 로그인 페이지 컴포넌트
export default function LoginPage() {
  // email: 사용자가 입력한 이메일 저장
  const [email, setEmail] = useState("");
  // password: 사용자가 입력한 비밀번호 저장
  const [password, setPassword] = useState("");

  // 로그인 처리 함수
  const handleLogin = async (e) => {
    e.preventDefault(); // 폼 제출 시 페이지 새로고침 방지
    try {
      // Firebase를 사용해 이메일과 비밀번호로 로그인 시도
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      // 디버깅을 위해 실제 에러 코드 콘솔 출력
                  
      // 오류 발생 시 에러 메시지 설정
      let message;
      switch(error.code){
        case "auth/wrong-password": 
          message="비밀번호가 틀렸습니다."; 
          break;
        case "auth/user-not-found": 
          message="존재하지 않는 계정입니다."; 
          break;
        case "auth/invalid-email": 
          message="유효하지 않은 이메일입니다."; 
          break;
        case "auth/invalid-credential":
          message="이메일 또는 비밀번호가 올바르지 않습니다.";
          break;
        case "auth/invalid-login-credentials":
          message="이메일 또는 비밀번호가 올바르지 않습니다.";
          break;
        case "auth/user-disabled":
          message="비활성화된 계정입니다.";
          break;
        case "auth/too-many-requests":
          message="너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.";
          break;
        case "auth/network-request-failed":
          message="네트워크 연결에 문제가 있습니다.";
          break;
        default: 
          message=`로그인 중 오류가 발생했습니다. (${error.code})`; 
      }
      // 에러 메시지 알림으로 표시
      alert(message);
    }
  };

  return (
    <form className="flex flex-col" onSubmit={handleLogin}>
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
        autoComplete="current-password"
        required
        onChange={(e) => setPassword(e.target.value)} 
      />
      {/* 로그인 버튼 */}
      <button type="submit" className="btn">로그인</button>
    </form>
  );
}
