// 🔐 MySQL 안전한 연결 설정
const mysql = require('mysql2/promise');
const logger = require("firebase-functions/logger");

// 로컬 개발 환경 감지
const isLocal = process.env.NODE_ENV === 'development' || process.env.FUNCTIONS_EMULATOR === 'true';

// Cloud SQL 연결 설정
const dbConfig = isLocal ? {
  // 로컬 MySQL 설정
  host: process.env.LOCAL_DB_HOST || 'localhost',
  port: parseInt(process.env.LOCAL_DB_PORT) || 3306,
  user: process.env.LOCAL_DB_USER || 'root',
  password: process.env.LOCAL_DB_PASSWORD || '',
  database: process.env.LOCAL_DB_NAME || 'payment_logs',
  
  // 연결 풀 설정
  connectionLimit: 10,
  timeout: 60000,
  acquireTimeout: 60000,
  
  // 문자셋 설정
  charset: 'utf8mb4',
  
  // 재연결 설정
  reconnect: true,
  
  // 타임존 설정
  timezone: '+09:00'
} : {
  // Cloud SQL 설정
  host: process.env.DB_HOST || '34.64.46.178',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'rojaria',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'payment_logs',
  
  // 연결 풀 설정으로 성능 및 보안 향상
  connectionLimit: 10,
  timeout: 60000,
  acquireTimeout: 60000,
  
  // SSL 설정 (Cloud SQL용)
  ssl: {
    rejectUnauthorized: false
  },
  
  // 문자셋 설정
  charset: 'utf8mb4',
  
  // 재연결 설정
  reconnect: true,
  
  // 타임존 설정
  timezone: '+09:00'
};

// 연결 풀 생성
let pool = null;

/**
 * MySQL 연결 풀 초기화
 */
function initializePool() {
  if (!pool) {
    try {
      pool = mysql.createPool(dbConfig);
      logger.info('MySQL 연결 풀이 생성되었습니다.');
      
      // 연결 테스트
      pool.getConnection()
        .then(connection => {
          logger.info('MySQL 연결 테스트 성공');
          connection.release();
        })
        .catch(err => {
          logger.error('MySQL 연결 테스트 실패:', err);
        });
        
    } catch (error) {
      logger.error('MySQL 연결 풀 생성 실패:', error);
      throw error;
    }
  }
  return pool;
}

/**
 * MySQL 연결 가져오기
 */
async function getConnection() {
  if (!pool) {
    pool = initializePool();
  }
  return await pool.getConnection();
}

/**
 * 결제 트랜잭션 저장
 * @param {Object} paymentData - 결제 데이터
 * @returns {Promise<number>} - 생성된 트랜잭션 ID
 */
async function savePaymentTransaction(paymentData) {
  const connection = await getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 결제 트랜잭션 저장
    const [transactionResult] = await connection.execute(`
      INSERT INTO payment_transactions (
        order_id, user_id, payment_key, amount, discount, 
        final_amount, used_points, payment_method, payment_status, 
        toss_payment_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      paymentData.orderId,
      paymentData.userId,
      paymentData.paymentKey || null,
      paymentData.amount,
      paymentData.discount || 0,
      paymentData.finalAmount,
      paymentData.usedPoints || 0,
      paymentData.paymentMethod || 'unknown',
      paymentData.status || 'pending',
      JSON.stringify(paymentData.tossData || {})
    ]);
    
    const transactionId = transactionResult.insertId;
    
    // 결제 상품 저장
    if (paymentData.items && paymentData.items.length > 0) {
      const itemValues = paymentData.items.map(item => [
        transactionId,
        item.name,
        item.barcode || null,
        item.price,
        item.quantity,
        (item.price * item.quantity)
      ]);
      
      await connection.execute(`
        INSERT INTO payment_items (
          transaction_id, product_name, barcode, price, quantity, total_price
        ) VALUES ?
      `, [itemValues]);
    }
    
    await connection.commit();
    logger.info(`결제 로그 저장 완료: ${paymentData.orderId}`);
    
    return transactionId;
    
  } catch (error) {
    await connection.rollback();
    logger.error('결제 로그 저장 실패:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 결제 상태 업데이트
 * @param {string} orderId - 주문 ID
 * @param {string} status - 새로운 상태
 * @param {Object} additionalData - 추가 데이터
 */
async function updatePaymentStatus(orderId, status, additionalData = {}) {
  const connection = await getConnection();
  
  try {
    const updateFields = ['payment_status = ?'];
    const updateValues = [status];
    
    if (additionalData.paymentKey) {
      updateFields.push('payment_key = ?');
      updateValues.push(additionalData.paymentKey);
    }
    
    if (additionalData.tossData) {
      updateFields.push('toss_payment_data = ?');
      updateValues.push(JSON.stringify(additionalData.tossData));
    }
    
    updateValues.push(orderId);
    
    const [result] = await connection.execute(`
      UPDATE payment_transactions 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `, updateValues);
    
    if (result.affectedRows === 0) {
      throw new Error(`주문을 찾을 수 없습니다: ${orderId}`);
    }
    
    logger.info(`결제 상태 업데이트 완료: ${orderId} -> ${status}`);
    
  } catch (error) {
    logger.error('결제 상태 업데이트 실패:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 결제 내역 조회
 * @param {string} userId - 사용자 ID
 * @param {number} limit - 조회 개수 제한
 * @returns {Promise<Array>} - 결제 내역 배열
 */
async function getPaymentHistory(userId, limit = 10) {
  const connection = await getConnection();
  
  try {
    const [transactions] = await connection.execute(`
      SELECT 
        t.*,
        GROUP_CONCAT(
          CONCAT(i.product_name, '×', i.quantity) 
          ORDER BY i.id SEPARATOR ', '
        ) as items_summary
      FROM payment_transactions t
      LEFT JOIN payment_items i ON t.id = i.transaction_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `, [userId, limit]);
    
    return transactions;
    
  } catch (error) {
    logger.error('결제 내역 조회 실패:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 연결 풀 종료 (앱 종료 시 사용)
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('MySQL 연결 풀이 종료되었습니다.');
  }
}

module.exports = {
  initializePool,
  getConnection,
  savePaymentTransaction,
  updatePaymentStatus,
  getPaymentHistory,
  closePool
};
