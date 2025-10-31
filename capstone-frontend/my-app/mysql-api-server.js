/**
 * MySQL API 서버
 * Cloud SQL과 연결하여 결제 데이터를 저장하는 API 서버
 */
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import admin from 'firebase-admin';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 설정을 가장 먼저 적용 (다른 미들웨어보다 먼저!)
// CORS 화이트리스트 (운영 시 관리자 도메인만 허용)
console.log('[CORS] ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(/[,\s]+/)
  .map(s => s.trim())
  .filter(Boolean);

console.log('[CORS] Parsed origins:', allowedOrigins);

if (allowedOrigins.length > 0) {
  console.log('[CORS] Using whitelist mode');
  app.use(cors({
    origin: function (origin, callback) {
      console.log('[CORS] Request from origin:', origin);
      if (!origin) return callback(null, true);
      const ok = allowedOrigins.includes(origin);
      console.log('[CORS] Allowed:', ok);
      return callback(ok ? null : new Error('Not allowed by CORS'), ok);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'cache-control', 'Cache-Control']
  }));
} else {
  // 개발 및 기본 환경: 모든 origin 허용
  console.log('[CORS] Using open mode');
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'cache-control', 'Cache-Control']
  }));
}

// 미들웨어 설정
app.use(express.json());

// 간단한 요청 로깅 미들웨어
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// MySQL 연결 설정 (Cloud SQL 소켓/ TCP 자동 분기)
function buildDbConfig() {
  const useSocket = Boolean(process.env.CLOUD_SQL_CONNECTION_NAME);
  const base = {
    user: process.env.DB_USER || 'rojaria',
    password: process.env.DB_PASSWORD || '1Plus2is9!',
    database: process.env.DB_NAME || 'payment_logs',
    charset: 'utf8mb4',
    connectTimeout: 60000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };
  if (useSocket) {
    console.log('[DB] Using Cloud SQL socket connection');
    return {
      ...base,
      socketPath: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`
    };
  }
  console.log('[DB] Using TCP connection without SSL');
  return {
    ...base,
    host: process.env.DB_HOST || '34.64.46.178',
    port: parseInt(process.env.DB_PORT) || 3306
  };
}

const dbConfig = buildDbConfig();

// MySQL 연결 풀 생성
const pool = mysql.createPool(dbConfig);

// ==================== API 엔드포인트 ====================

// 결제 로그 저장 API
app.post('/api/payment/save', async (req, res) => {
  let connection;
  
  try {
    console.log('[PAYMENT] save request received');
    const { orderId, userId, userEmail, paymentKey, amount, discount, finalAmount, usedPoints, paymentMethod, status, tossData, items } = req.body;

    // 이메일 보존: 요청 본문 우선, 없으면 tossData 내 필드 추출
    const emailFromToss = tossData?.customerEmail || tossData?.customer?.email || null;
    const customerEmail = userEmail || emailFromToss || null;
    const enrichedTossData = {
      ...(tossData || {}),
      ...(customerEmail ? { customerEmail } : {})
    };
    
    connection = await pool.getConnection();
    
    // 결제 트랜잭션 저장
    const [transactionResult] = await connection.execute({ sql: `
      INSERT INTO payment_transactions (
        order_id, user_id, user_email, payment_key, amount, discount,
        final_amount, used_points, payment_method, payment_status,
        toss_payment_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, timeout: 20000 }, [
      orderId,
      userId,
      customerEmail,
      paymentKey || null,
      amount,
      discount || 0,
      finalAmount,
      usedPoints || 0,
      paymentMethod || 'unknown',
      status || 'completed',
      JSON.stringify(enrichedTossData)
    ]);
    
    const transactionId = transactionResult.insertId;
    
    // 결제 상품 저장
    if (items && items.length > 0) {
      console.log("📦 MySQL에 저장할 items:", JSON.stringify(items, null, 2));
      for (const item of items) {
        console.log(`📦 상품 저장: ${item.name}, 바코드: ${item.barcode}, 가격: ${item.price}, 수량: ${item.quantity}`);
        await connection.execute({ sql: `
          INSERT INTO payment_items (
            transaction_id, product_name, barcode, price, quantity, total_price
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, timeout: 20000 }, [
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
    console.log('[PAYMENT] save success txId=', transactionId);
    
  } catch (error) {
    console.error('[PAYMENT] save error:', error.message);
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
    console.log('[PAYMENT] history request userId=', req.params.userId);
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    
    connection = await pool.getConnection();
    
    const [results] = await connection.execute({ sql: `
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
    `, timeout: 20000 }, [userId, parseInt(limit)]);
    
    res.json({ 
      success: true, 
      data: results 
    });
    console.log('[PAYMENT] history success count=', results?.length || 0);
    
  } catch (error) {
    console.error('[PAYMENT] history error:', error.message);
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

// 주문 검색 API (이메일/사용자 식별자 + 기간)
app.get('/api/orders/search', async (req, res) => {
  let connection;
  try {
    const { user, from, to, limit = 10 } = req.query;
    if (!user) {
      return res.status(400).json({ success: false, error: 'user 쿼리 파라미터가 필요합니다.' });
    }
    connection = await pool.getConnection();

    // 이메일은 user_id 에 저장되지 않았을 수 있어 toss_payment_data JSON에서도 시도
    // created_at 기간 필터 optional
    const conditions = [];
    const params = [];
    conditions.push('(t.user_id = ? OR t.user_email = ? OR t.toss_payment_data LIKE ?)');
    params.push(String(user), String(user), `%${String(user)}%`);
    const fmt = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      const yy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const HH = pad(d.getHours());
      const MM = pad(d.getMinutes());
      const SS = pad(d.getSeconds());
      return `${yy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
    };
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) {
        conditions.push('t.created_at >= ?');
        params.push(fmt(d));
      }
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        conditions.push('t.created_at <= ?');
        params.push(fmt(d));
      }
    }

    const where = conditions.length ? ('WHERE ' + conditions.join(' AND ')) : '';
    const safeLimit = Number.parseInt(limit);
    const limitValue = Number.isFinite(safeLimit) ? safeLimit : 10;
    
    const sql = `
      SELECT 
        t.id, t.order_id, t.user_id, t.payment_key, t.final_amount, 
        t.used_points, t.payment_status, t.created_at
      FROM payment_transactions t
      ${where}
      ORDER BY t.created_at DESC
      LIMIT ${limitValue}
    `;

    // 디버깅: 쿼리와 바인딩 파라미터 로그
    console.log('[ORDER][search] where=', where, 'params=', params);

    const [rows] = await connection.execute({ sql, timeout: 20000 }, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[ORDER] search error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 주문 상세 조회 API (MySQL)
app.get('/api/orders/:orderId', async (req, res) => {
  let connection;
  try {
    console.log('[ORDER] get request orderId=', req.params.orderId);
    const { orderId } = req.params;
    connection = await pool.getConnection();

    const [txRows] = await connection.execute({
      sql: `SELECT id, order_id, user_id, payment_key, final_amount, used_points, payment_status, created_at
            FROM payment_transactions
            WHERE order_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
      timeout: 20000
    }, [orderId]);

    if (!txRows || txRows.length === 0) {
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
    }

    const tx = txRows[0];
    const [itemRows] = await connection.execute({
      sql: `SELECT product_name, barcode, price, quantity
            FROM payment_items
            WHERE transaction_id = ?`,
      timeout: 20000
    }, [tx.id]);

    const data = {
      orderId: tx.order_id,
      paymentId: tx.payment_key,
      userUid: tx.user_id,
      status: tx.payment_status || 'paid',
      usedPoints: Number(tx.used_points) || 0,
      earnedPoints: 0,
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
    console.log('[ORDER] get success items=', data.items?.length || 0);
  } catch (error) {
    console.error('[ORDER] get error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Firebase Admin 초기화 (RTDB 기록용)
try {
  if (!admin.apps.length) {
    const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://capstone-765-bd2ce-default-rtdb.firebaseio.com'
    const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (svcJson) {
      try {
        const creds = JSON.parse(svcJson)
        admin.initializeApp({
          credential: admin.credential.cert(creds),
          databaseURL
        })
        console.log('[FIREBASE] Admin initialized with service account JSON env')
      } catch (parseErr) {
        console.error('[FIREBASE] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', parseErr?.message)
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          databaseURL
        })
        console.log('[FIREBASE] Fallback to applicationDefault credential')
      }
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL
      })
      console.log('[FIREBASE] Admin initialized with applicationDefault credential')
    }
    console.log('[FIREBASE] Database URL =', databaseURL)
  }
} catch (e) {
  console.error('[FIREBASE] Admin init error:', e?.message)
}

// 전액 환불 API (토스 연동 + 멱등 + 선택적 RTDB 반영)
app.post('/api/refund', async (req, res) => {
  let connection;
  try {
    console.log('[REFUND] request body=', JSON.stringify(req.body));
    const { orderId, paymentId, refundItems, refundAmount, reason, adminUid, applyEffects = false, userUid, orderTotalAmount, orderUsedPoints = 0, orderEarnedPoints = 0 } = req.body || {};

    if (!orderId || !paymentId) {
      return res.status(400).json({ success: false, error: 'orderId, paymentId는 필수입니다.' });
    }
    if (!Array.isArray(refundItems) || refundItems.length === 0) {
      return res.status(400).json({ success: false, error: 'refundItems가 비어 있습니다.' });
    }

    const rtdb = admin.database();

    // 주문/결제 검증: MySQL 조회
    connection = await pool.getConnection();
    const [txRows] = await connection.execute({
      sql: `SELECT id, order_id, user_id, payment_key, final_amount, used_points, payment_status
            FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
      timeout: 20000
    }, [orderId]);
    if (!txRows || txRows.length === 0) {
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
    }
    const tx = txRows[0];
    if (tx.payment_key !== paymentId) {
      return res.status(400).json({ success: false, error: 'PAYMENT_MISMATCH' });
    }

    const originalAmount = Number(tx.final_amount) || 0;
    const reqRefundAmount = Math.round(Number(refundAmount) || 0);
    // 전체 환불만 허용
    if (reqRefundAmount !== originalAmount) {
      return res.status(400).json({ success: false, error: 'ONLY_FULL_REFUND_ALLOWED' });
    }

    // 이미 환불되었는지 확인 (중복 방지)
    const refundedOnceRef = rtdb.ref(`refundsByPayment/${paymentId}`);
    const refundedOnceSnap = await refundedOnceRef.get();
    if (refundedOnceSnap.exists()) {
      const existing = refundedOnceSnap.val();
      console.warn('[REFUND] already refunded paymentId=', paymentId);
      return res.status(409).json({ success: false, error: 'ALREADY_REFUNDED', refundId: existing.refundId });
    }

    // 토스 환불 호출
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
      body: JSON.stringify({ cancelReason: reason || 'admin refund', cancelAmount: reqRefundAmount })
    });
    const pgJson = await pgResp.json().catch(() => ({}));
    if (!pgResp.ok) {
      console.error('[REFUND] PG refund failed:', pgJson?.message);
      return res.status(502).json({ success: false, error: pgJson?.message || 'PG_REFUND_FAILED' });
    }

    // 환불 기록 및 선택적 반영 준비
    const refundId = `RFD-${Date.now()}`;
    const createdAt = Date.now();
    const updates = {};
    updates[`refunds/${refundId}`] = {
      refundId,
      orderId,
      paymentId,
      refundItems,
      refundAmount: reqRefundAmount,
      reason: reason || 'unspecified',
      adminUid: adminUid || null,
      applyEffects: Boolean(applyEffects),
      userUid: userUid || tx.user_id || null,
      orderTotalAmount: orderTotalAmount || originalAmount,
      orderUsedPoints: orderUsedPoints || Number(tx.used_points) || 0,
      orderEarnedPoints: orderEarnedPoints || 0,
      createdAt,
      pg: { status: pgJson?.status || 'canceled' }
    };
    updates[`refundsByPayment/${paymentId}`] = { refundId, amount: reqRefundAmount, createdAt };

    if (applyEffects === true) {
      // 재고 복원
      await Promise.all((refundItems || []).map(async it => {
        if (!it?.barcode || !it?.qty) return;
        const stockRef = rtdb.ref(`products/${it.barcode}/stock`);
        await stockRef.transaction(curr => {
          const current = Number(curr) || 0;
          const add = Number(it.qty) || 0;
          return current + add;
        });
      }));

      // 포인트 조정: 전액 환불 → 적립 회수 = earned, 사용 환급 = used
      const finalUserUid = userUid || tx.user_id || null;
      if (finalUserUid) {
        const pointsRef = rtdb.ref(`users/${finalUserUid}/points`);
        const used = Number(orderUsedPoints || tx.used_points || 0) || 0;
        const earned = Number(orderEarnedPoints || 0) || 0;
        await pointsRef.transaction(curr => {
          const current = Number(curr) || 0;
          const next = current - earned + used;
          return next < 0 ? 0 : next;
        });
        const eventRef = rtdb.ref(`users/${finalUserUid}/pointEvents`).push();
        updates[`users/${finalUserUid}/pointEvents/${eventRef.key}`] = {
          amount: -earned + used,
          type: 'system',
          reason: 'refund',
          description: '전액 환불에 따른 포인트 조정',
          timestamp: Date.now(),
          processed: false
        };
      }
    }

    await admin.database().ref().update(updates);
    console.log('[REFUND] success refundId=', refundId);
    res.json({ success: true, refundId });
  } catch (error) {
    console.error('[REFUND] error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 루트 경로 핸들러 추가
app.get('/', (req, res) => {
  res.json({ 
    message: 'Smart Cart API Server',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      payment_save: 'POST /api/payment/save',
      payment_history: 'GET /api/payment/history/:userId'
    }
  });
});

// 헬스체크 엔드포인트 추가 (Cloud Run용)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Smart Cart API',
    port: PORT
  });
});

// ==================== 서버 시작 ====================
app.listen(PORT, () => {
  console.log(`[SERVER] MySQL API server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[PROCESS] Uncaught Exception:', err);
});
