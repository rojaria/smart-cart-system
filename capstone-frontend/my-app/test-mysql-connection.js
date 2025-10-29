/**
 * MySQL 연결 테스트 스크립트
 */
import mysql from 'mysql2/promise';

const dbConfig = {
  host: '34.64.46.178',
  port: 3306,
  user: 'rojaria',
  password: '1Plus2is9!',
  database: 'payment_logs',
  charset: 'utf8mb4',
  ssl: {
    rejectUnauthorized: false
  },
  connectTimeout: 60000
};

async function testConnection() {
  let connection;
  
  try {
    console.log('🔍 MySQL 연결 테스트 시작...');
    console.log('📍 연결 정보:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
    });
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ MySQL 연결 성공!');
    
    // 간단한 쿼리 테스트
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ 쿼리 테스트 성공:', rows);
    
    // 데이터베이스 정보 확인
    const [dbInfo] = await connection.execute('SELECT DATABASE() as current_db, VERSION() as version');
    console.log('📊 데이터베이스 정보:', dbInfo[0]);
    
    // 테이블 존재 확인
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'payment_logs'
    `);
    console.log('📋 존재하는 테이블들:', tables.map(t => t.TABLE_NAME));
    
  } catch (error) {
    console.error('❌ MySQL 연결 실패:');
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
    console.error('전체 에러:', error);
    
    // 일반적인 에러 해결 방법 제시
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 해결 방법:');
      console.log('1. Cloud SQL 인스턴스가 실행 중인지 확인');
      console.log('2. 방화벽 설정에서 현재 IP가 허용되어 있는지 확인');
      console.log('3. Cloud SQL 프록시를 사용해보세요');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 해결 방법:');
      console.log('1. 사용자명과 비밀번호를 확인하세요');
      console.log('2. 사용자 권한을 확인하세요');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 해결 방법:');
      console.log('1. 호스트 주소를 확인하세요');
      console.log('2. 네트워크 연결을 확인하세요');
    }
    
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 연결 종료');
    }
  }
}

// 현재 IP 주소 확인
async function checkCurrentIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    console.log('🌐 현재 공인 IP:', data.ip);
    console.log('💡 이 IP가 Cloud SQL 승인된 네트워크에 추가되어 있는지 확인하세요');
  } catch (error) {
    console.log('IP 확인 실패:', error.message);
  }
}

// 실행
console.log('🚀 Cloud SQL 연결 진단 시작\n');
checkCurrentIP().then(() => {
  console.log('\n' + '='.repeat(50) + '\n');
  testConnection();
});
