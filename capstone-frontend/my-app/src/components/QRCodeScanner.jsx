import React, { useRef, useEffect, useState } from 'react';
import QrScanner from 'qr-scanner';

const QRCodeScanner = ({ onScan, onError, onClose }) => {
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // 컴포넌트 마운트 시 자동으로 QR 스캐너 초기화 및 시작
    const initializeScanner = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        if (videoRef.current) {
          // QR 스캐너 생성
          qrScannerRef.current = new QrScanner(
            videoRef.current,
            (result) => {
              console.log('QR 스캔 결과:', result.data);
              onScan(result.data);
              stopScanning();
            },
            {
              onDecodeError: (error) => {
                // 일반적인 디코딩 에러는 무시
                if (error !== 'No QR code found') {
                  console.log('QR 디코딩 에러:', error);
                }
              },
              highlightScanRegion: true,
              highlightCodeOutline: true,
              preferredCamera: 'environment' // 후면 카메라 우선
            }
          );

          // 스캐너 시작
          await qrScannerRef.current.start();
          setIsScanning(true);
          setIsInitializing(false);
        }
      } catch (err) {
        console.error('QR 스캐너 초기화 오류:', err);
        setIsInitializing(false);
        
        let errorMessage = 'QR 스캐너를 시작할 수 없습니다.';
        
        if (err.name === 'NotAllowedError') {
          errorMessage = '카메라 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = '카메라에 접근할 수 없습니다. 다른 앱에서 카메라를 사용 중인지 확인해주세요.';
        }
        
        setError(errorMessage);
        onError(err);
      }
    };

    // 약간의 지연 후 초기화 (DOM이 준비될 때까지)
    const timer = setTimeout(initializeScanner, 100);

    return () => {
      clearTimeout(timer);
      if (qrScannerRef.current) {
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
    };
  }, [onScan, onError]);

  // 재시작 함수 (에러 발생 시 사용)
  const restartScanning = async () => {
    try {
      setError(null);
      setIsInitializing(true);
      
      if (qrScannerRef.current) {
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }

      if (videoRef.current) {
        qrScannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            console.log('QR 스캔 결과:', result.data);
            onScan(result.data);
            stopScanning();
          },
          {
            onDecodeError: (error) => {
              if (error !== 'No QR code found') {
                console.log('QR 디코딩 에러:', error);
              }
            },
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment'
          }
        );

        await qrScannerRef.current.start();
        setIsScanning(true);
        setIsInitializing(false);
      }
    } catch (error) {
      console.error('QR 스캔 재시작 실패:', error);
      setIsInitializing(false);
      setError('QR 스캔을 다시 시작할 수 없습니다.');
      onError(error);
    }
  };

  const stopScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      setIsScanning(false);
    }
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">📱 QR 코드 스캔</h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* 에러 메시지 표시 */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="mb-4 relative">
          <video
            ref={videoRef}
            className="w-full h-64 bg-gray-100 rounded-lg"
            style={{ objectFit: 'cover' }}
          />
          {isInitializing && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 text-white rounded-lg">
              <div className="text-center">
                <div className="text-4xl mb-2 animate-spin">📷</div>
                <p>카메라를 준비 중...</p>
                <p className="text-sm mt-1">권한을 허용해주세요</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          {isScanning ? (
            <button
              onClick={stopScanning}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              ⏹️ 스캔 중지
            </button>
          ) : error ? (
            <button
              onClick={restartScanning}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              🔄 다시 시도
            </button>
          ) : (
            <div className="w-full px-4 py-2 bg-gray-400 text-gray-200 rounded-lg cursor-not-allowed">
              {isInitializing ? '초기화 중...' : '준비 중...'}
            </div>
          )}
          
          <p className="text-sm text-gray-600 text-center">
            {isInitializing 
              ? '카메라 권한을 허용해주세요'
              : isScanning 
                ? '카트에 부착된 QR 코드를 카메라에 비춰주세요'
                : error
                  ? '오류가 발생했습니다. 다시 시도해주세요'
                  : 'QR 스캔을 준비 중입니다'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;
