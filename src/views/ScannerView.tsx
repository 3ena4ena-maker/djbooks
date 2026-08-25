import React, { useState, useEffect, useRef } from 'react';
import { BookWithStock, Book } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { feedback } from '../utils/feedback';
import { BookCover } from '../components/common/BookCover';
import {
  Camera,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  ScanLine,
  ChevronRight,
  Sparkles,
  BookPlus,
  ArrowLeft,
  Keyboard,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface ScannerViewProps {
  onSelectBook: (bookId: string) => void;
  onNavigateHome: () => void;
  onShowToast: (message: string) => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  onSelectBook,
  onNavigateHome,
  onShowToast,
}) => {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualIsbn, setManualIsbn] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [isScanningFile, setIsScanningFile] = useState<boolean>(false);

  // Scanned results state
  const [scannedIsbn, setScannedIsbn] = useState<string | null>(null);
  const [matchedBook, setMatchedBook] = useState<BookWithStock | null>(null);
  const [isNewBook, setIsNewBook] = useState<boolean>(false);
  const [newBookCandidate, setNewBookCandidate] = useState<
    (Partial<Book> & { isExternalFound?: boolean }) | null
  >(null);
  const [newBookStock, setNewBookStock] = useState<number>(3);
  const [newBookEntryType, setNewBookEntryType] = useState<'초기 도서 입고' | '재입고'>('초기 도서 입고');
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);

  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const sessionIdRef = useRef<number>(0);
  const scannerContainerId = 'barcode-reader-container';

  // Demo ISBN quick test chips
  const testIsbns = [
    { isbn: '9788956608877', title: '오버스토리 (기존)' },
    { isbn: '9780525559474', title: '미드나잇 라이브러리 (기존)' },
    { isbn: '9788954655972', title: '여행의 이유 (기존)' },
    { isbn: '9788937460005', title: '데미안 (신간 등록)' },
    { isbn: '9791190313186', title: '우리가 빛의 속도로 갈 수 없다면' },
  ];

  // Helper to extract descriptive error message based on DOMException name
  const parseCameraError = (err: unknown): string => {
    if (!err) return '알 수 없는 이유로 카메라를 시작할 수 없습니다.';

    const errorObj = err as { name?: string; message?: string };
    const errorName = errorObj.name || (typeof err === 'string' ? err : '');
    const errorMsg = errorObj.message || String(err);

    console.error('[ScannerView] Camera initialization failed:', {
      name: errorName,
      message: errorMsg,
      raw: err,
    });

    switch (errorName) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return '카메라 접근 권한이 허용되지 않았습니다. 브라우저 설정에서 카메라 권한을 확인해 주세요.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return '사용 가능한 카메라를 찾을 수 없습니다.';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return '기기에서 요청한 카메라 해상도/설정을 지원하지 않습니다.';
      case 'NotReadableError':
      case 'TrackStartError':
        return '다른 앱이나 탭에서 카메라를 이미 사용 중입니다. 다른 카메라 앱을 종료 후 재시도해 주세요.';
      case 'AbortError':
        return '카메라 연결이 중단되었습니다. 다시 시도해 주세요.';
      case 'SecurityError':
        return '보안 정책(HTTPS)으로 인해 카메라에 접근할 수 없습니다.';
      default:
        if (errorMsg.includes('Permission') || errorMsg.includes('NotAllowed')) {
          return '카메라 접근 권한이 필요합니다. 브라우저 사이트 설정에서 카메라 권한을 허용해 주세요.';
        }
        return `카메라 시작 실패 (${errorName || '오류'}: ${errorMsg.slice(0, 60)})`;
    }
  };

  // Safe teardown helper that awaits both stop() and clear() without throwing
  const safeStopAndClear = async (scanner: Html5Qrcode | null) => {
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (e) {
      console.debug('[ScannerView] Safe stop non-critical warning:', e);
    }
    try {
      await scanner.clear();
    } catch (e) {
      console.debug('[ScannerView] Safe clear non-critical warning:', e);
    }
  };

  // Initialize camera scanner safely for mobile devices with concurrency guards
  const startScanner = async () => {
    if (isStartingRef.current) {
      console.debug('[ScannerView] startScanner ignored - already in transition');
      return;
    }

    isStartingRef.current = true;
    const currentSessionId = ++sessionIdRef.current;

    if (isMountedRef.current) {
      setIsStartingCamera(true);
      setCameraError(null);
    }

    // 1. Safely stop and clear any existing instance completely
    const previousScanner = qrReaderRef.current;
    qrReaderRef.current = null;
    await safeStopAndClear(previousScanner);

    if (currentSessionId !== sessionIdRef.current || !isMountedRef.current) {
      isStartingRef.current = false;
      return;
    }

    const formats = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.QR_CODE,
    ];

    const config = {
      fps: 30, // 30 FPS for instant real-time barcode edge detection
      disableFlip: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true, // Native hardware-accelerated BarcodeDetector API
      },
    };

    const onScanSuccess = (decodedText: string) => {
      handleDetectedBarcode(decodedText);
    };

    const onScanFailure = () => {
      // Normal frame scanning failure - ignore
    };

    try {
      // 2. Primary attempt: standard facingMode with high-resolution continuous focus
      const primaryScanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: formats,
        verbose: false,
      });

      let started = false;
      let primaryError: unknown = null;

      try {
        await primaryScanner.start(
          {
            facingMode: facingMode,
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          config,
          onScanSuccess,
          onScanFailure
        );
        started = true;
      } catch (err1) {
        primaryError = err1;
        console.warn('[ScannerView] Primary facingMode start failed, cleaning up before device fallback:', err1);
      }

      if (started) {
        if (currentSessionId !== sessionIdRef.current || !isMountedRef.current) {
          await safeStopAndClear(primaryScanner);
          return;
        }
        qrReaderRef.current = primaryScanner;
        setCameraActive(true);
        setCameraError(null);
        return;
      }

      // Cleanup failed primary instance before attempting fallback to avoid transition lock
      await safeStopAndClear(primaryScanner);

      if (currentSessionId !== sessionIdRef.current || !isMountedRef.current) {
        return;
      }

      // 3. Fallback attempt: deviceId enumeration with a fresh Html5Qrcode instance
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        // Prioritize rear/back camera using all relevant keywords (back, rear, environment, 후면, 뒤)
        const rearKeywords = ['back', 'rear', 'environment', '후면', '뒤'];
        const backCam =
          cameras.find((c) => {
            const label = c.label.toLowerCase();
            return rearKeywords.some((keyword) => label.includes(keyword));
          }) ||
          (facingMode === 'environment' && cameras.length > 1
            ? cameras[cameras.length - 1] // On mobile, secondary/last camera is usually the rear camera
            : cameras[0]);

        const fallbackScanner = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: formats,
          verbose: false,
        });

        try {
          await fallbackScanner.start(
            backCam.id,
            config,
            onScanSuccess,
            onScanFailure
          );

          if (currentSessionId !== sessionIdRef.current || !isMountedRef.current) {
            await safeStopAndClear(fallbackScanner);
            return;
          }

          qrReaderRef.current = fallbackScanner;
          setCameraActive(true);
          setCameraError(null);
        } catch (errFallback) {
          await safeStopAndClear(fallbackScanner);
          throw errFallback || primaryError;
        }
      } else {
        throw primaryError || new Error('No camera devices available');
      }
    } catch (err: unknown) {
      if (currentSessionId === sessionIdRef.current && isMountedRef.current) {
        const friendlyMessage = parseCameraError(err);
        setCameraActive(false);
        setCameraError(friendlyMessage);
        setShowManualInput(true);
      }
    } finally {
      isStartingRef.current = false;
      if (currentSessionId === sessionIdRef.current && isMountedRef.current) {
        setIsStartingCamera(false);
      }
    }
  };

  const stopScanner = async () => {
    sessionIdRef.current++; // Invalidate any in-flight start
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      const scanner = qrReaderRef.current;
      qrReaderRef.current = null;
      await safeStopAndClear(scanner);
    } finally {
      isStoppingRef.current = false;
      if (isMountedRef.current) {
        setCameraActive(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    startScanner();

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [facingMode]);

  // Handle detected or submitted barcode
  const handleDetectedBarcode = async (rawIsbn: string) => {
    const cleanIsbn = inventoryStore.normalizeIsbn(rawIsbn);
    if (!cleanIsbn) return;

    feedback.playBeep('scan');
    setScannedIsbn(cleanIsbn);

    // Check existing database
    const existing = inventoryStore.getBookByIsbn(cleanIsbn);
    if (existing) {
      setMatchedBook(existing);
      setIsNewBook(false);
      setNewBookCandidate(null);
    } else {
      // New book flow
      setMatchedBook(null);
      setIsNewBook(true);
      setIsLoadingMetadata(true);
      try {
        const candidate = await inventoryStore.lookupExternalBook(cleanIsbn);
        setNewBookCandidate(candidate);
      } finally {
        setIsLoadingMetadata(false);
      }
    }
  };

  // Image File / Photo Upload Barcode Scan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    try {
      // Create temporary scanner instance for file scanning if needed
      let scanner = qrReaderRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
      }

      const decodedResult = await scanner.scanFile(file, true);
      if (decodedResult) {
        handleDetectedBarcode(decodedResult);
        onShowToast('바코드 사진을 성공적으로 인식했습니다.');
      }
    } catch (err) {
      console.warn('File scan failed:', err);
      feedback.playBeep('warning');
      onShowToast('사진에서 바코드를 인식하지 못했습니다. 선명한 바코드 사진으로 다시 시도해주세요.');
    } finally {
      setIsScanningFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Continuous scan: Reset scan overlay and resume camera
  const handleNextScan = () => {
    feedback.playBeep('click');
    setScannedIsbn(null);
    setMatchedBook(null);
    setIsNewBook(false);
    setNewBookCandidate(null);
    setManualIsbn('');

    // Ensure scanner is running
    if (!cameraActive) {
      startScanner();
    }
  };

  // Quick Sell (-1)
  const handleQuickSell = async (book: BookWithStock) => {
    if (book.quantity <= 0) {
      onShowToast('현재 재고가 0권입니다.');
      feedback.playBeep('warning');
      return;
    }
    const res = await inventoryStore.adjustStock(
      book.id,
      -1,
      '판매',
      '스캐너 빠른 판매 (-1권)'
    );
    if (res.success) {
      feedback.playBeep('success');
      const updated = inventoryStore.getBookById(book.id);
      if (updated) setMatchedBook(updated);
      onShowToast(`[판매 완료] ${book.title} (남은 재고: ${res.newQuantity}권)`);
    } else if (res.error) {
      feedback.playBeep('warning');
      onShowToast(res.error);
    }
  };

  // Quick Restock (+1)
  const handleQuickRestock = async (book: BookWithStock) => {
    const res = await inventoryStore.adjustStock(
      book.id,
      1,
      '입고',
      '스캐너 빠른 입고 (+1권)'
    );
    if (res.success) {
      feedback.playBeep('success');
      const updated = inventoryStore.getBookById(book.id);
      if (updated) setMatchedBook(updated);
      onShowToast(`[입고 완료] ${book.title} (현재 재고: ${res.newQuantity}권)`);
    } else if (res.error) {
      feedback.playBeep('warning');
      onShowToast(res.error);
    }
  };

  // Register New Book
  const handleRegisterNewBook = async () => {
    if (!newBookCandidate || !scannedIsbn) return;

    const registered = await inventoryStore.registerBook(
      {
        isbn: scannedIsbn,
        title: newBookCandidate.title || `새 도서 (${scannedIsbn})`,
        author: newBookCandidate.author || '저자 미상',
        publisher: newBookCandidate.publisher || '독립출판',
        price: newBookCandidate.price || 15000,
        category: newBookCandidate.category || '소설',
        bindingType: newBookCandidate.bindingType || '무선제본',
        location: newBookCandidate.location || '신간 매대',
        coverImage:
          newBookCandidate.coverImage ||
          'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
        publishedDate:
          newBookCandidate.publishedDate ||
          new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      },
      newBookStock,
      `스캐너 ${newBookEntryType} (${newBookStock}권)`,
      newBookEntryType
    );

    feedback.playBeep('success');
    onShowToast(`새로운 도서 '${registered.title}'이(가) 등록되었습니다.`);
    setMatchedBook(registered);
    setIsNewBook(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-[calc(100vh-8rem)] relative select-none">
      {/* Hidden File Input for Image/Photo Barcode Scan */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Top Header Controls */}
      <div className="flex items-center justify-between mb-4 px-2">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-1 text-sm font-semibold text-[#434848] hover:text-[#171e1e] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </button>

        <div className="flex items-center gap-2">
          {/* Barcode Image / Photo Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanningFile}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#f5f3ee] text-[#434848] border border-[#c3c7c7] hover:bg-[#eae8e3] transition-colors cursor-pointer"
            title="바코드 사진 파일로 스캔"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">사진/이미지 스캔</span>
            <span className="sm:hidden">사진</span>
          </button>

          {/* Camera Flip */}
          <button
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="p-2 bg-[#f5f3ee] border border-[#c3c7c7] rounded-full text-[#434848] hover:text-[#171e1e] cursor-pointer"
            title="카메라 전환 (전면/후면)"
          >
            <RefreshCw className={`w-4 h-4 ${isStartingCamera ? 'animate-spin' : ''}`} />
          </button>

          {/* Manual Input Toggle */}
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
              showManualInput
                ? 'bg-[#171e1e] text-white border-[#171e1e]'
                : 'bg-[#f5f3ee] text-[#434848] border-[#c3c7c7] hover:bg-[#eae8e3]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>ISBN 직접 입력</span>
          </button>
        </div>
      </div>

      {/* Manual ISBN Input & Quick Test Barcode Section */}
      {showManualInput && (
        <div className="mb-4 p-4 bg-[#f5f3ee] border border-[#c3c7c7] rounded-2xl animate-in fade-in duration-150 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block">
              ISBN 바코드 번호 직접 입력
            </label>
            <span className="text-[11px] text-[#737878]">13자리 번호 입력 후 엔터</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
              placeholder="예: 9788956608877"
              className="flex-1 px-3.5 py-2.5 bg-white border border-[#c3c7c7] rounded-xl text-sm font-mono focus:border-[#171e1e] outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDetectedBarcode(manualIsbn);
              }}
            />
            <button
              onClick={() => handleDetectedBarcode(manualIsbn)}
              disabled={!manualIsbn.trim()}
              className="px-5 py-2.5 bg-[#171e1e] text-white text-xs font-semibold rounded-xl hover:bg-[#2c3333] disabled:opacity-50 cursor-pointer shadow-xs"
            >
              조회
            </button>
          </div>

          {/* Quick Demo ISBN Chips */}
          <div className="pt-2 border-t border-[#e9e2d1]">
            <div className="text-[11px] text-[#737878] font-medium flex items-center gap-1 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#8ea06b]" />
              <span>클릭하여 즉시 테스트할 수 있는 바코드 예시:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {testIsbns.map((t) => (
                <button
                  key={t.isbn}
                  onClick={() => {
                    setManualIsbn(t.isbn);
                    handleDetectedBarcode(t.isbn);
                  }}
                  className="text-xs px-3 py-1.5 bg-white border border-[#c3c7c7] rounded-xl hover:border-[#171e1e] hover:bg-[#faf8f3] text-[#171e1e] font-medium cursor-pointer shadow-2xs transition-colors"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Viewfinder Main Card */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-black rounded-3xl overflow-hidden shadow-xl border border-[#c3c7c7] flex items-center justify-center">
        {/* Actual HTML5 QR / Barcode Reader element */}
        <div id={scannerContainerId} className="w-full h-full object-cover" />

        {/* Fallback Camera Simulation Background if stream is not active */}
        {!cameraActive && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-75"
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB75DbfEuG75jReOUegtlH3_Xmiq_FPs_jMKtdXzCeZCfsCfmTwTA4G1wqpgXimYs18nnJT28iHjY6nBtSyj5DgpdWlP7A-lHTGfghR-eOunXvFUckG0gqtdfnRjwOlvlFJ4GEHUic9wDtGzNPbxorxA3B8HUsHzB3t-QmPD5TS0pVmzlo6fOIJccU_yk1tTEp5zdXaI3eAvzeX5UQhLOE6rfTYi1KzyJLjSB_nbU6P_KAUxrMdyZ2X')",
            }}
          />
        )}

        {/* Viewfinder Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none z-10">
          <div className="text-white text-center mb-4 drop-shadow-md">
            <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold mb-1">
              책 바코드 스캔
            </h3>
            <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs text-white/90">
              책 뒷면의 ISBN 13자리 바코드를 사각 프레임 안에 비춰주세요.
            </p>
          </div>

          {/* Single Large Target Frame */}
          <div className="relative w-[88%] max-w-[440px] h-48 sm:h-56 border-2 border-white/60 rounded-3xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
            {/* Bold Corner Accents (Sage Green) */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#d6eaaf] rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#d6eaaf] rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#d6eaaf] rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#d6eaaf] rounded-br-2xl" />

            {/* Smooth Animated Laser Scanning Line */}
            <div className="absolute left-3 right-3 h-[2.5px] bg-[#d6eaaf] shadow-[0_0_12px_#d6eaaf] scan-laser-active" />
          </div>
        </div>

        {/* Camera Starting / Loading Indicator */}
        {isStartingCamera && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20 gap-2">
            <RefreshCw className="w-8 h-8 animate-spin text-[#d6eaaf]" />
            <span className="text-sm font-semibold">카메라를 연결하는 중입니다...</span>
          </div>
        )}

        {/* Camera Error / No Camera fallback Banner */}
        {cameraError && !scannedIsbn && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/85 backdrop-blur-xs text-white p-3.5 rounded-2xl text-xs flex flex-col sm:flex-row items-center justify-between gap-3 z-20 border border-white/20 shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#ffdad6] flex-shrink-0" />
              <span>{cameraError}</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-[#d6eaaf] text-[#142000] font-bold rounded-xl hover:bg-[#bbce95] cursor-pointer text-xs"
              >
                사진 업로드 스캔
              </button>
              <button
                onClick={startScanner}
                className="px-3 py-1.5 bg-white text-black font-semibold rounded-xl hover:bg-[#eae8e3] cursor-pointer text-xs"
              >
                카메라 재시도
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RESULT SLIDE-UP CARD */}
      {scannedIsbn && (
        <div className="mt-4 bg-[#fbf9f4] rounded-3xl border border-[#c3c7c7] shadow-xl p-5 md:p-6 animate-in slide-in-from-bottom-6 duration-200">
          {/* Drag Handle Decoration */}
          <div className="w-full flex justify-center pb-3">
            <div className="w-12 h-1 bg-[#c3c7c7] rounded-full opacity-60" />
          </div>

          {/* CASE 1: EXISTING BOOK IN INVENTORY */}
          {matchedBook && (
            <div className="space-y-5">
              {/* Book Info Card */}
              <div className="flex items-start gap-4">
                <BookCover
                  src={matchedBook.coverImage}
                  alt={matchedBook.title}
                  size="lg"
                  className="shadow-sm"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e] leading-snug line-clamp-2">
                    {matchedBook.title}
                  </h3>
                  <p className="text-xs text-[#434848] mt-1 font-['Public_Sans','Noto_Sans_KR',sans-serif]">
                    {matchedBook.author} | {matchedBook.publisher}
                  </p>
                  <div className="flex items-center gap-2 mt-2.5 font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm">
                    <span className="text-[#171e1e]">
                      현재 재고: <strong className="text-base text-[#171e1e]">{matchedBook.quantity}권</strong>
                    </span>
                    <span className="text-[#737878]">•</span>
                    <span className="text-[#171e1e] font-semibold">
                      ₩{matchedBook.price.toLocaleString('ko-KR')}
                    </span>
                  </div>
                  {matchedBook.location && (
                    <span className="inline-block mt-1 text-[11px] bg-[#f0eee9] text-[#625e51] px-2 py-0.5 rounded-md">
                      📍 {matchedBook.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Rapid Action Buttons [-1 판매] & [+1 입고] */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Sell Button */}
                <button
                  onClick={() => handleQuickSell(matchedBook)}
                  className="flex flex-col items-center justify-center py-4 px-2 rounded-2xl bg-[#eae8e3] hover:bg-[#e4e2dd] border-b-4 border-[#ba1a1a]/30 active:border-b-0 active:translate-y-1 transition-all cursor-pointer shadow-xs"
                >
                  <MinusCircle className="w-7 h-7 text-[#ba1a1a] mb-1" />
                  <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] font-bold text-sm text-[#171e1e]">
                    [-1 판매]
                  </span>
                  <span className="text-[10px] text-[#737878] mt-0.5">재고 1권 차감</span>
                </button>

                {/* Restock Button */}
                <button
                  onClick={() => handleQuickRestock(matchedBook)}
                  className="flex flex-col items-center justify-center py-4 px-2 rounded-2xl bg-[#d6eaaf] hover:bg-[#bbce95] border-b-4 border-[#3c4c20]/30 active:border-b-0 active:translate-y-1 transition-all cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-7 h-7 text-[#3c4c20] mb-1" />
                  <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] font-bold text-sm text-[#142000]">
                    [+1 입고]
                  </span>
                  <span className="text-[10px] text-[#3c4c20] mt-0.5">재고 1권 추가</span>
                </button>
              </div>

              {/* Bottom Flow Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                {/* [다음 책 스캔] */}
                <button
                  onClick={handleNextScan}
                  className="w-full py-4 bg-[#171e1e] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#2c3333] active:scale-[0.98] transition-all text-base shadow-sm cursor-pointer"
                >
                  <ScanLine className="w-5 h-5 text-[#d6eaaf]" />
                  <span>다음 책 스캔</span>
                </button>

                {/* Optional view details */}
                <button
                  onClick={() => onSelectBook(matchedBook.id)}
                  className="w-full py-2.5 text-xs text-[#737878] hover:text-[#171e1e] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  도서 상세 정보 보기 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* CASE 2: NEW BOOK (NOT IN INVENTORY) */}
          {isNewBook && (
            <div className="space-y-4">
              {isLoadingMetadata ? (
                <div className="py-8 text-center flex flex-col items-center justify-center gap-3 bg-[#fbf9f4] border border-[#e1ded7] rounded-2xl p-6">
                  <Loader2 className="w-7 h-7 text-[#171e1e] animate-spin" />
                  <div className="font-['Public_Sans','Noto_Sans_KR',sans-serif] font-bold text-sm text-[#171e1e]">
                    도서 정보를 검색하는 중입니다...
                  </div>
                  <div className="text-xs text-[#737878]">
                    ISBN({scannedIsbn})으로 도서 서지 DB에서 책 정보를 자동으로 찾고 있습니다.
                  </div>
                </div>
              ) : (
                <div className="space-y-4 font-['Public_Sans','Noto_Sans_KR',sans-serif]">
                  {/* Status Banner */}
                  {newBookCandidate?.isExternalFound ? (
                    <div className="p-3 bg-[#e9f2d8] border border-[#bbce95] rounded-2xl flex items-center gap-2 text-xs text-[#283810] font-medium">
                      <Sparkles className="w-4 h-4 text-[#5b7529] flex-shrink-0" />
                      <span>외부 도서 정보를 성공적으로 찾았습니다! 내용을 확인 후 재고에 등록하세요.</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-[#fdf4e8] border border-[#f3d3a6] rounded-2xl flex items-start gap-2 text-xs text-[#7a4100] font-medium">
                      <AlertCircle className="w-4 h-4 text-[#ba6b00] flex-shrink-0 mt-0.5" />
                      <span>
                        ISBN은 인식했지만 도서 정보를 찾을 수 없습니다. 책 제목과 저자 정보를 직접 입력해 주세요.
                      </span>
                    </div>
                  )}

                  {/* Scanned ISBN Badge */}
                  <div className="flex items-center justify-between px-3 py-2 bg-[#f2efe9] rounded-xl text-xs">
                    <span className="text-[#737878] font-medium">인식된 바코드 (ISBN-13)</span>
                    <span className="font-mono font-bold text-[#171e1e] tracking-wider">
                      {scannedIsbn}
                    </span>
                  </div>

                  <div className="flex gap-4">
                    <BookCover
                      src={newBookCandidate?.coverImage}
                      alt={newBookCandidate?.title || '신간'}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] text-[#737878] font-bold block mb-0.5">
                        도서명 *
                      </label>
                      <input
                        type="text"
                        value={newBookCandidate?.title || ''}
                        onChange={(e) =>
                          setNewBookCandidate((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="책 제목을 입력해주세요"
                        className="w-full font-bold text-base bg-white border border-[#c3c7c7] rounded-xl px-3 py-1.5 mb-2 focus:border-[#171e1e] outline-none"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-[#737878] font-bold block mb-0.5">
                            저자
                          </label>
                          <input
                            type="text"
                            value={newBookCandidate?.author || ''}
                            onChange={(e) =>
                              setNewBookCandidate((prev) => ({ ...prev, author: e.target.value }))
                            }
                            placeholder="저자명"
                            className="w-full text-xs bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-1.5 focus:border-[#171e1e] outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#737878] font-bold block mb-0.5">
                            출판사
                          </label>
                          <input
                            type="text"
                            value={newBookCandidate?.publisher || ''}
                            onChange={(e) =>
                              setNewBookCandidate((prev) => ({ ...prev, publisher: e.target.value }))
                            }
                            placeholder="출판사명"
                            className="w-full text-xs bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-1.5 focus:border-[#171e1e] outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 입고 종류 선택 토글 */}
                  <div>
                    <label className="text-[11px] text-[#737878] font-bold block mb-1">
                      입고 종류 *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewBookEntryType('초기 도서 입고')}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          newBookEntryType === '초기 도서 입고'
                            ? 'bg-[#171e1e] text-white border-[#171e1e] shadow-xs'
                            : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f5f3ee]'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-[#d6eaaf]"></span>
                        초기 도서 입고
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewBookEntryType('재입고')}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          newBookEntryType === '재입고'
                            ? 'bg-[#171e1e] text-white border-[#171e1e] shadow-xs'
                            : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f5f3ee]'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-[#8ea06b]"></span>
                        재입고
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-[#f5f3ee] p-3 rounded-xl">
                    <div>
                      <label className="text-[11px] text-[#737878] font-bold block mb-1">
                        판매가 (원)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={newBookCandidate?.price !== undefined ? newBookCandidate.price : ''}
                        onChange={(e) =>
                          setNewBookCandidate((prev) => ({
                            ...prev,
                            price: e.target.value === '' ? 0 : Number(e.target.value),
                          }))
                        }
                        className="w-full bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#737878] font-bold block mb-1">
                        {newBookEntryType === '초기 도서 입고' ? '초기 입고 수량' : '재입고 수량'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newBookStock}
                        onChange={(e) => setNewBookStock(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-1.5 text-xs font-bold text-center"
                      />
                    </div>
                  </div>

                  {/* Register Action Button */}
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      onClick={handleRegisterNewBook}
                      className="w-full py-4 bg-[#171e1e] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#2c3333] shadow-sm cursor-pointer active:scale-[0.98] transition-all"
                    >
                      <BookPlus className="w-5 h-5 text-[#d6eaaf]" />
                      <span>{newBookEntryType} (+{newBookStock}권)</span>
                    </button>

                    <button
                      onClick={handleNextScan}
                      className="w-full py-2.5 text-xs text-[#737878] hover:text-[#171e1e] cursor-pointer"
                    >
                      등록 취소하고 다음 책 스캔
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
