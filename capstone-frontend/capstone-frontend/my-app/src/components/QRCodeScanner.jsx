import React, { useRef, useEffect, useState } from 'react';
import QrScanner from 'qr-scanner';

const QRCodeScanner = ({ onScan, onError, onClose }) => {
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
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
            // 에러는 너무 자주 발생하므로 로그만 출력
            if (error !== 'No QR code found') {
              console.log('QR 스캔 에러:', error);
            }
          }
        }
      );
    }

    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.destroy();
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      if (qrScannerRef.current) {
        await qrScannerRef.current.start();
        setIsScanning(true);
      }
    } catch (error) {
      console.error('QR 스캔 시작 실패:', error);
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

        <div className="mb-4">
          <video
            ref={videoRef}
            className="w-full h-64 bg-gray-100 rounded-lg"
            style={{ objectFit: 'cover' }}
          />
        </div>

        <div className="flex flex-col space-y-2">
          {!isScanning ? (
            <button
              onClick={startScanning}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              📷 스캔 시작
            </button>
          ) : (
            <button
              onClick={stopScanning}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              ⏹️ 스캔 중지
            </button>
          )}
          
          <p className="text-sm text-gray-600 text-center">
            카트에 부착된 QR 코드를 카메라에 비춰주세요
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;


