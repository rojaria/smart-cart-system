/**
 * Firebase Functions - Smart Cart API Server
 * 기존 mysql-api-server.js를 Firebase Functions로 이전
 */
const functions = require('firebase-functions');
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

// CORS 화이트리스트 (운영 시 관리자 도메인만 허용)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(cors({
    origin: function(origin, callback) {
      // 서버-서버 호출(origin 없음) 허용
      if (!origin) return callback(null, true);
      const ok = allowedOrigins.includes(origin);
      return callback(ok ? null : new Error('Not allowed by CORS'), ok);
    },
    credentials: true,
  }));
} else {
  // 개발 및 기본 환경: 모든 origin 허용
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
}

// 미들웨어 설정
app.use(express.json());

// MySQL 연결 설정 (Cloud SQL - 24/7 가동)
const dbConfig = {
  host: '34.64.46.178',
  port: 3306,
  user: 'rojaria',
  password: '1Plus2is9!',
  database: 'payment_logs',
  charset: 'utf8mb4',
  ssl: {
    rejectUnauthorized: false
  }
};

// MySQL 연결 풀 생성
const pool = mysql.createPool(dbConfig);

// ==================== API 엔드포인트 ====================

// 결제 로그 저장 API
app.post('/api/payment/save', async (req, res) => {
  let connection;
  
  try {
    const { orderId, userId, paymentKey, amount, discount, finalAmount, usedPoints, paymentMethod, status, tossData, items } = req.body;
    
    connection = await pool.getConnection();
    
    // 결제 트랜잭션 저장
    const [transactionResult] = await connection.execute(`
      INSERT INTO payment_transactions (
        order_id, user_id, payment_key, amount, discount, 
        final_amount, used_points, payment_method, payment_status, 
        toss_payment_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderId,
      userId,
      paymentKey || null,
      amount,
      discount || 0,
      finalAmount,
      usedPoints || 0,
      paymentMethod || 'unknown',
      status || 'completed',
      JSON.stringify(tossData || {})
    ]);
    
    const transactionId = transactionResult.insertId;
    
    // 결제 상품 저장
    if (items && items.length > 0) {
      for (const item of items) {
        await connection.execute(`
          INSERT INTO payment_items (
            transaction_id, product_name, barcode, price, quantity, total_price
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          transactionId,
          item.name,
          item.barcode || null,
          item.price,
          item.quantity,
          (item.price * item.quantity)
        ]);
      }
    }
    
    res.json({ 
      success: true, 
      message: '결제 로그 저장 완료',
      transactionId: transactionId 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 결제 로그 조회 API
app.get('/api/payment/history/:userId', async (req, res) => {
  let connection;
  
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    
    connection = await pool.getConnection();
    
    const [results] = await connection.execute(`
      SELECT 
        t.id, t.order_id, t.user_id, t.amount, t.final_amount, 
        t.payment_method, t.payment_status, t.created_at,
        COUNT(i.id) as item_count
      FROM payment_transactions t
      LEFT JOIN payment_items i ON t.id = i.transaction_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `, [userId, parseInt(limit)]);
    
    res.json({ 
      success: true, 
      data: results 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// -------------------- 주문 조회 (템플릿/모의) --------------------
app.get('/api/orders/:orderId', async (req, res) => {
  let connection;
  try {
    const { orderId } = req.params;
    connection = await pool.getConnection();

    const [txRows] = await connection.execute(
      `SELECT id, order_id, user_id, payment_key, final_amount, used_points, payment_status, created_at
       FROM payment_transactions
       WHERE order_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId]
    );

    if (!txRows || txRows.length === 0) {
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
    }

    const tx = txRows[0];
    const [itemRows] = await connection.execute(
      `SELECT product_name, barcode, price, quantity
       FROM payment_items
       WHERE transaction_id = ?`,
      [tx.id]
    );

    const data = {
      orderId: tx.order_id,
      paymentId: tx.payment_key,
      userUid: tx.user_id,
      status: tx.payment_status || 'paid',
      usedPoints: Number(tx.used_points) || 0,
      earnedPoints: 0, // 필요 시 계산/저장 로직으로 대체
      totalAmount: Number(tx.final_amount) || 0,
      items: (itemRows || []).map(r => ({
        barcode: r.barcode || null,
        name: r.product_name,
        price: Number(r.price) || 0,
        qty: Number(r.quantity) || 0
      })),
      createdAt: tx.created_at ? new Date(tx.created_at).getTime() : Date.now()
    };

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// -------------------- 환불 처리 (템플릿) --------------------
app.post('/api/refund', async (req, res) => {
  let connection;
  try {
    const { orderId, paymentId, refundItems, refundAmount, reason, adminUid, applyEffects = false, userUid, orderTotalAmount, orderUsedPoints = 0, orderEarnedPoints = 0 } = req.body || {};
    // 기본 검증
    if (!orderId || !paymentId) {
      return res.status(400).json({ success: false, error: 'orderId, paymentId는 필수입니다.' });
    }
    if (!Array.isArray(refundItems) || refundItems.length === 0) {
      return res.status(400).json({ success: false, error: 'refundItems가 비어 있습니다.' });
    }

    // Admin SDK 초기화
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    const rtdb = admin.database();

    // 멱등키: 결제ID + 환불금액
    const idemKey = `${paymentId}:${refundAmount}`;
    const idemRef = rtdb.ref(`refundsIndex/${idemKey}`);
    const idemSnap = await idemRef.get();
    if (idemSnap.exists()) {
      const existing = idemSnap.val();
      return res.json({ success: true, refundId: existing.refundId, idempotent: true });
    }

    // 주문/결제 검증: MySQL에서 조회
    connection = await pool.getConnection();
    const [txRows] = await connection.execute(
      `SELECT id, order_id, user_id, payment_key, final_amount, used_points, payment_status
       FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
      [orderId]
    );
    if (!txRows || txRows.length === 0) {
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
    }
    const tx = txRows[0];
    if (tx.payment_key !== paymentId) {
      return res.status(400).json({ success: false, error: 'PAYMENT_MISMATCH' });
    }
    const originalAmount = Number(tx.final_amount) || 0;
    const reqRefundAmount = Math.round(Number(refundAmount) || 0);
    // 전체 환불만 허용: 환불 금액은 원결제 금액과 정확히 같아야 함
    if (reqRefundAmount !== originalAmount) {
      return res.status(400).json({ success: false, error: 'ONLY_FULL_REFUND_ALLOWED' });
    }

    // 이미 환불된 결제인지 체크 (전체 환불 1회만 허용)
    const refundedOnceRef = rtdb.ref(`refundsByPayment/${paymentId}`);
    const refundedOnceSnap = await refundedOnceRef.get();
    if (refundedOnceSnap.exists()) {
      const existing = refundedOnceSnap.val();
      return res.status(409).json({ success: false, error: 'ALREADY_REFUNDED', refundId: existing.refundId });
    }

    // PG(토스) 환불 호출
    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ success: false, error: 'PG_SECRET_MISSING' });
    }
    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
    const pgResp = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentId)}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cancelReason: reason || 'admin refund',
        cancelAmount: reqRefundAmount
      })
    });
    const pgJson = await pgResp.json().catch(() => ({}));
    if (!pgResp.ok) {
      return res.status(502).json({ success: false, error: pgJson?.message || 'PG_REFUND_FAILED' });
    }

    // 환불 레코드 생성
    const refundId = `RFD-${Date.now()}`;
    const refundRecord = {
      refundId,
      orderId,
      paymentId,
      refundItems,
      refundAmount,
      reason: reason || 'unspecified',
      adminUid: adminUid || null,
      applyEffects: Boolean(applyEffects),
      userUid: userUid || null,
      orderTotalAmount: orderTotalAmount || null,
      orderUsedPoints: orderUsedPoints || 0,
      orderEarnedPoints: orderEarnedPoints || 0,
      createdAt: Date.now()
    };

    // 기본: 로그만 기록 (충돌 방지)
    const updates = {};
    updates[`refunds/${refundId}`] = refundRecord;
    updates[`refundsIndex/${idemKey}`] = { refundId, createdAt: refundRecord.createdAt };

    // 실제 반영이 활성화된 경우에만 재고/포인트 수행
    if (applyEffects === true) {
      // 재고 복원: 각 상품 stock += qty (RTDB transaction)
      await Promise.all(refundItems.map(async (it) => {
        if (!it?.barcode || !it?.qty) return;
        const stockRef = rtdb.ref(`products/${it.barcode}/stock`);
        await stockRef.transaction((curr) => {
          const current = Number(curr) || 0;
          const add = Number(it.qty) || 0;
          return current + add;
        });
      }));

      // 포인트 회수/환급 계산 (비례 배분, 정보 없으면 0)
      const total = Number(orderTotalAmount) || 0;
      const ratio = total > 0 ? (Number(refundAmount) || 0) / total : 0;
      const revokeEarned = Math.floor((Number(orderEarnedPoints) || 0) * ratio);
      const returnUsed = Math.floor((Number(orderUsedPoints) || 0) * ratio);

      if (userUid) {
        // 총 포인트 갱신 (transaction)
        const pointsRef = rtdb.ref(`users/${userUid}/points`);
        await pointsRef.transaction((curr) => {
          const current = Number(curr) || 0;
          const next = current - revokeEarned + returnUsed;
          return next < 0 ? 0 : next;
        });

        // 이벤트 로그 추가
        const eventsRef = rtdb.ref(`users/${userUid}/pointEvents`).push();
        updates[`users/${userUid}/pointEvents/${eventsRef.key}`] = {
          amount: -revokeEarned + returnUsed,
          type: 'system',
          reason: 'refund',
          description: '환불 처리에 따른 포인트 조정',
          timestamp: Date.now(),
          processed: false
        };
      }
    }

    // 전체 환불 인덱스(중복 방지)
    updates[`refundsByPayment/${paymentId}`] = { refundId, amount: reqRefundAmount, createdAt: refundRecord.createdAt };

    await rtdb.ref().update(updates);
    res.json({ success: true, refundId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==================== Firebase Functions Export ====================

// API 서버를 Firebase Functions로 export
exports.api = functions.https.onRequest(app);

// 헬스 체크 함수
exports.healthCheck = functions.https.onRequest((req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Smart Cart API'
  });
});