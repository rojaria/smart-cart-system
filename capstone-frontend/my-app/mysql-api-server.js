/**
 * MySQL API 서버
 * Cloud SQL과 연결하여 결제 데이터를 저장하는 API 서버
 */
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// MySQL 연결 설정 (Cloud SQL - 24/7 가동)
const dbConfig = {
  // 로컬 개발 환경에서는 TCP 연결 사용
  host: process.env.DB_HOST || '34.64.46.178',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: 'rojaria',
  password: '1Plus2is9!',
  database: 'payment_logs',
  charset: 'utf8mb4',
  // SSL 설정
  ssl: {
    rejectUnauthorized: false
  },
  // 연결 타임아웃 설정
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000
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
      console.log("📦 MySQL에 저장할 items:", JSON.stringify(items, null, 2));
      for (const item of items) {
        console.log(`📦 상품 저장: ${item.name}, 바코드: ${item.barcode}, 가격: ${item.price}, 수량: ${item.quantity}`);
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
app.listen(PORT);

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end();
  process.exit(0);
});
