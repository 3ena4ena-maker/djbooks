import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { cleanAndValidateIsbn } from '../../utils/isbnValidator';
import { feedback } from '../../utils/feedback';
import {
  X,
  Camera,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ScanLine,
  Sparkles,
  Keyboard
} from 'lucide-react';

interface ISBNScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (isbn: string) => void;
  title?: string;
}

export const ISBNScannerModal: React.FC<ISBNScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'ISBN-13 바코드 스캔',
}) => {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannedIsbn, setScannedIsbn] = useState<string | null>(null);
  const [scanStatusMessage, setScanStatusMessage] = useState<string | null>(null);

  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const isLockedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const sessionIdRef = useRef<number>(0);
  const scannerContainerId = 'common-isbn-scanner-reader';

  // Safe teardown helper
  const safeStopAndClear = async (scanner: Html5Qrcode | null) => {
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (e) {
      console.debug('[ISBNScannerModal] Stop warning:', e);
    }
    try {
      await scanner.clear();
    } catch (e) {
      console.debug('[ISBNScannerModal] Clear warning:', e);
    }
  };

  const parseCameraError = (err: unknown): string => {
    if (!err) return '카메라를 시작할 수 없습니다.';
    const errorObj = err as { name?: string; message?: string };
    const errorName = errorObj.name || (typeof err === 'string' ? err : '');
    const errorMsg = errorObj.message || String(err);

    switch (errorName) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return '카메라 접근 권한이 허용되지 않았습니다. 브라우저 사이트 설정에서 카메라 권한을 확인해주세요.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return '사용 가능한 카메라 기기를 찾을 수 없습니다.';
      case 'NotReadableError':
      case 'TrackStartError':
        return '다른 앱이나 탭에서 카메라를 이미 사용 중입니다.';
      default:
        if (errorMsg.includes('Permission') || errorMsg.includes('NotAllowed')) {
          return '카메라 접근 권한이 필요합니다.';
        }
        return '카메라를 실행하지 못했습니다. 조명 및 권한을 확인해주세요.';
    }
  };

  const startScanner = async () => {
    if (!isOpen) return;
    const currentSessionId = ++sessionIdRef.current;

    setIsStarting(true);
    setCameraError(null);
    setScanStatusMessage(null);

    // Stop existing instance
    const prev = qrReaderRef.current;
    qrReaderRef.current = null;
    await safeStopAndClear(prev);

    if (currentSessionId !== sessionIdRef.current || !isMountedRef.current || !isOpen) {
      setIsStarting(false);
      return;
    }

    const formats = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.QR_CODE,
    ];

    const config = {
      fps: 25,
      disableFlip: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    };

    const handleSuccess = (decodedText: string) => {
      // If already locked in this session, ignore further frames
      if (isLockedRef.current) return;

      const validation = cleanAndValidateIsbn(decodedText);
      if (validation.isValid && validation.isbn13) {
        isLockedRef.current = true;
        feedback.playBeep('success');
        setScannedIsbn(validation.isbn13);
        setScanStatusMessage(`인식 성공: ${validation.isbn13}`);

        // Temporarily pause camera or safe stop
        if (qrReaderRef.current?.isScanning) {
          try {
            qrReaderRef.current.pause(true);
          } catch {
            // Ignore pause error
          }
        }

        // Deliver result
        setTimeout(() => {
          if (isMountedRef.current) {
            onScanSuccess(validation.isbn13);
          }
        }, 500);
      } else {
        // Not a valid ISBN-13
        console.debug('[ISBNScannerModal] Barcode detected but invalid ISBN:', decodedText, validation.errorReason);
      }
    };

    try {
      const scanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: formats,
        verbose: false,
      });

      let started = false;
      try {
        await scanner.start(
          {
            facingMode: facingMode,
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          config,
          handleSuccess,
          () => {}
        );
        started = true;
      } catch (errFacing) {
        console.warn('[ISBNScannerModal] Primary start failed, trying deviceId fallback:', errFacing);
      }

      if (started) {
        if (currentSessionId !== sessionIdRef.current || !isMountedRef.current || !isOpen) {
          await safeStopAndClear(scanner);
          return;
        }
        qrReaderRef.current = scanner;
        setCameraActive(true);
        setCameraError(null);
        return;
      }

      // Cleanup and try device enumeration
      await safeStopAndClear(scanner);

      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        const rearKeywords = ['back', 'rear', 'environment', '후면', '뒤'];
        const backCam =
          cameras.find((c) => {
            const label = c.label.toLowerCase();
            return rearKeywords.some((keyword) => label.includes(keyword));
          }) ||
          (facingMode === 'environment' && cameras.length > 1
            ? cameras[cameras.length - 1]
            : cameras[0]);

        const fallbackScanner = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: formats,
          verbose: false,
        });

        await fallbackScanner.start(
          backCam.id,
          config,
          handleSuccess,
          () => {}
        );

        if (currentSessionId !== sessionIdRef.current || !isMountedRef.current || !isOpen) {
          await safeStopAndClear(fallbackScanner);
          return;
        }

        qrReaderRef.current = fallbackScanner;
        setCameraActive(true);
        setCameraError(null);
      } else {
        throw new Error('카메라 장치를 찾을 수 없습니다.');
      }
    } catch (err) {
      if (currentSessionId === sessionIdRef.current && isMountedRef.current) {
        setCameraActive(false);
        setCameraError(parseCameraError(err));
      }
    } finally {
      if (currentSessionId === sessionIdRef.current && isMountedRef.current) {
        setIsStarting(false);
      }
    }
  };

  const stopScanner = async () => {
    sessionIdRef.current++;
    const scanner = qrReaderRef.current;
    qrReaderRef.current = null;
    await safeStopAndClear(scanner);
    if (isMountedRef.current) {
      setCameraActive(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (isOpen) {
      isLockedRef.current = false;
      setScannedIsbn(null);
      setScanStatusMessage(null);
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [isOpen, facingMode]);

  const handleRescan = () => {
    isLockedRef.current = false;
    setScannedIsbn(null);
    setScanStatusMessage(null);
    if (qrReaderRef.current?.isScanning) {
      try {
        qrReaderRef.current.resume();
      } catch {
        startScanner();
      }
    } else {
      startScanner();
    }
    feedback.playBeep('click');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="bg-[#fbf9f4] w-full max-w-lg rounded-3xl border border-[#c3c7c7] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#c3c7c7] bg-[#f5f3ee]">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-[#171e1e]" />
            <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-base sm:text-lg font-bold text-[#171e1e]">
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Camera Switch Button */}
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              disabled={isStarting}
              className="p-2 text-[#434848] hover:text-[#171e1e] bg-white border border-[#c3c7c7] rounded-full hover:bg-[#eae8e3] transition-colors cursor-pointer"
              title="전면/후면 카메라 전환"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isStarting ? 'animate-spin' : ''}`} />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#737878] hover:text-[#171e1e] hover:bg-[#e4e2dd] rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scanner Viewfinder Box */}
        <div className="p-4 flex flex-col items-center">
          <div className="relative w-full aspect-[16/10] bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
            {/* Html5Qrcode video container */}
            <div id={scannerContainerId} className="w-full h-full object-cover" />

            {/* Viewfinder Horizontal Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 p-3">
              <div className="text-white/90 text-center mb-2 drop-shadow-md">
                <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs font-semibold">
                  가로형 13자리 바코드를 프레임 중앙에 맞춰주세요
                </p>
              </div>

              {/* Horizontal ISBN-13 Scan Frame */}
              <div className="relative w-[88%] max-w-[360px] h-28 sm:h-32 border-2 border-white/60 rounded-2xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                {/* Sage Green Corner Borders */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#d6eaaf] rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#d6eaaf] rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#d6eaaf] rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#d6eaaf] rounded-br-xl" />

                {/* Laser animation */}
                {!scannedIsbn && (
                  <div className="absolute left-2 right-2 h-[2px] bg-[#d6eaaf] shadow-[0_0_8px_#d6eaaf] scan-laser-active" />
                )}

                {/* Success Indicator inside frame */}
                {scannedIsbn && (
                  <div className="absolute inset-0 bg-[#d6eaaf]/20 backdrop-blur-xs flex items-center justify-center gap-2 text-white font-bold text-sm animate-in zoom-in-95">
                    <CheckCircle2 className="w-6 h-6 text-[#d6eaaf]" />
                    <span className="text-[#142000] bg-[#d6eaaf] px-2.5 py-1 rounded-lg text-xs font-mono font-bold">
                      {scannedIsbn}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Loading / Starting Indicator */}
            {isStarting && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#d6eaaf]" />
                <span className="text-xs font-medium">카메라 준비 중...</span>
              </div>
            )}

            {/* Camera Error Message */}
            {cameraError && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-xs text-white p-4 flex flex-col items-center justify-center text-center z-20 gap-3">
                <AlertCircle className="w-8 h-8 text-[#ffdad6]" />
                <p className="text-xs text-[#ffdad6] font-medium leading-relaxed max-w-xs">
                  {cameraError}
                </p>
                <button
                  type="button"
                  onClick={startScanner}
                  className="px-4 py-2 bg-[#d6eaaf] text-[#142000] font-bold rounded-xl text-xs hover:bg-[#bbce95] cursor-pointer"
                >
                  카메라 다시 시도
                </button>
              </div>
            )}
          </div>

          {/* Bottom Control & Result Status Bar */}
          <div className="w-full mt-3 flex items-center justify-between gap-2">
            {scannedIsbn ? (
              <div className="flex-1 flex items-center justify-between bg-[#e9f2d8] border border-[#bbce95] p-2.5 rounded-xl text-xs text-[#283810] font-medium animate-in fade-in">
                <span className="font-mono font-bold tracking-wider">{scannedIsbn} 인식 완료</span>
                <button
                  type="button"
                  onClick={handleRescan}
                  className="px-2.5 py-1 bg-white border border-[#bbce95] rounded-lg text-[11px] font-bold text-[#283810] hover:bg-[#faf8f3] cursor-pointer"
                >
                  다시 스캔
                </button>
              </div>
            ) : (
              <div className="flex-1 text-[11px] text-[#737878] text-center">
                💡 바코드의 숫자가 뚜렷하게 보이도록 조절해주세요.
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-[#f0eee9] hover:bg-[#eae8e3] text-[#171e1e] font-semibold rounded-xl text-xs cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
