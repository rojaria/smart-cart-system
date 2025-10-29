import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// 결제 실패 페이지 - 즉시 장바구니로 이동
export default function PaymentFailPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // 즉시 장바구니로 이동 (화면 표시 없이)
    navigate("/", { replace: true });
  }, [navigate]);

  // 아무것도 렌더링하지 않음
  return null;
}

