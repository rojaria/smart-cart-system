import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import "./tailwind.css";
import './style.css';
import 'react-toastify/dist/ReactToastify.css';

// 개발 환경에서 StrictMode는 useEffect를 2번 실행시켜서
// 결제 승인이 중복으로 요청될 수 있습니다.
// 결제 테스트 시에는 StrictMode를 비활성화하는 것을 권장합니다.
const isDevelopment = import.meta.env.DEV;

ReactDOM.createRoot(document.getElementById("root")).render(
  isDevelopment ? (
    // 개발 모드: StrictMode 비활성화 (결제 중복 방지)
    <BrowserRouter>
      <App />
    </BrowserRouter>
  ) : (
    // 프로덕션 모드: StrictMode 활성화
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
);
