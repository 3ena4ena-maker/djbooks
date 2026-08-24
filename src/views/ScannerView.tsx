import React, { useState, useEffect, useRef } from 'react';
import { BookWithStock, Book } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { feedback } from '../utils/feedback';
import { BookCover } from '../components/common/BookCover';
import {
  Camera,
  RefreshCw,
  Zap,
  ZapOff,
  PlusCircle,
  MinusCircle,
  ScanLine,
  ChevronRight,
  Sparkles,
  BookPlus,
  ArrowLeft,
  Keyboard,
  Info
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [flashOn, setFlashOn] = useState<boolean>(false);
  const [manualIsbn, setManualIsbn] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // Scanned results state
  const [scannedIsbn, setScannedIsbn] = useState<string | null>(null);
  const [matchedBook, setMatchedBook] = useState<BookWithStock | null>(null);
  const [isNewBook, setIsNewBook] = useState<boolean>(false);
  const [newBookCandidate, setNewBookCandidate] = useState<Partial<Book> | null>(null);
  const [newBookStock, setNewBookStock] = useState<number>(3);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);

  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-reader-container';

  // Demo ISBN quick test chips
  const testIsbns = [
    { isbn: '9788956608877', title: '오버스토리 (기존)' },
    { isbn: '9780525559474', title: '미드나잇 라이브러리 (기존)' },
    { isbn: '9788954655972', title: '여행의 이유 (기존)' },
    { isbn: '9788937460005', title: '데미안 (신간 등록)' },
  ];

  // Initialize camera scanner
  const startScanner = async () => {
    try {
      setCameraError(null);
      if (qrReaderRef.current) {
        try {
          await qrReaderRef.current.stop();
        } catch {
          // Ignore
        }
      }

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      qrReaderRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.333333,
      };

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        (decodedText) => {
          handleDetectedBarcode(decodedText);
        },
        () => {
          // Frame scan error - ignore frame noise
        }
      );

      setCameraActive(true);
    } catch (err: unknown) {
      console.warn('Camera start error or permission denied:', err);
      setCameraActive(false);
      setCameraError('카메라 연결에 실패했습니다. (권한 허용 또는 시뮬레이션/직접 입력을 이용해주세요)');
    }
  };

  const stopScanner = async () => {
    if (qrReaderRef.current) {
      try {
        await qrReaderRef.current.stop();
      } catch {
        // Ignore
      }
      qrReaderRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, [facingMode]);

  // Handle detected or submitted barcode
  const handleDetectedBarcode = async (rawIsbn: string) => {
    const cleanIsbn = rawIsbn.replace(/[^0-9X]/gi, '').trim();
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
  const handleQuickSell = (book: BookWithStock) => {
    if (book.quantity <= 0) {
      onShowToast('현재 재고가 0권입니다.');
      feedback.playBeep('warning');
      return;
    }
    const res = inventoryStore.adjustStock(
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
    }
  };

  // Quick Restock (+1)
  const handleQuickRestock = (book: BookWithStock) => {
    const res = inventoryStore.adjustStock(
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
    }
  };

  // Register New Book
  const handleRegisterNewBook = () => {
    if (!newBookCandidate || !scannedIsbn) return;

    const registered = inventoryStore.registerBook(
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
        publishedDate: newBookCandidate.publishedDate || new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      },
      newBookStock,
      `스캐너 신규 도서 등록 (초도 입고: ${newBookStock}권)`
    );

    feedback.playBeep('success');
    onShowToast(`새로운 도서 '${registered.title}'이(가) 등록되었습니다.`);
    setMatchedBook(registered);
    setIsNewBook(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-[calc(100vh-8rem)] relative select-none">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between mb-4 px-2">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-1 text-sm font-semibold text-[#434848] hover:text-[#171e1e] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </button>

        <div className="flex items-center gap-2">
          {/* Camera Flip */}
          <button
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="p-2 bg-[#f5f3ee] border border-[#c3c7c7] rounded-full text-[#434848] hover:text-[#171e1e] cursor-pointer"
            title="카메라 전환"
          >
            <RefreshCw className="w-4 h-4" />
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

      {/* Manual ISBN Input Drawer */}
      {showManualInput && (
        <div className="mb-4 p-4 bg-[#f5f3ee] border border-[#c3c7c7] rounded-2xl animate-in fade-in duration-150">
          <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1.5">
            ISBN 바코드 번호 입력
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
              placeholder="예: 9788956608877"
              className="flex-1 px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl text-sm font-mono focus:border-[#171e1e] outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDetectedBarcode(manualIsbn);
              }}
            />
            <button
              onClick={() => handleDetectedBarcode(manualIsbn)}
              className="px-4 py-2 bg-[#171e1e] text-white text-xs font-semibold rounded-xl hover:bg-[#2c3333] cursor-pointer"
            >
              조회
            </button>
          </div>

          {/* Quick Demo ISBN Chips */}
          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] text-[#737878] font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#8ea06b]" /> 테스트 예시:
            </span>
            {testIsbns.map((t) => (
              <button
                key={t.isbn}
                onClick={() => {
                  setManualIsbn(t.isbn);
                  handleDetectedBarcode(t.isbn);
                }}
                className="text-[11px] px-2.5 py-1 bg-white border border-[#c3c7c7] rounded-lg hover:border-[#171e1e] text-[#171e1e] cursor-pointer"
              >
                {t.title}
              </button>
            ))}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none">
          <div className="text-white text-center mb-4 drop-shadow-md">
            <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold mb-1">
              책 스캔
            </h3>
            <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs text-white/90">
              책 뒷면의 바코드를 프레임 안에 맞춰주세요.
            </p>
          </div>

          {/* Target Frame */}
          <div className="relative w-64 h-40 border-2 border-white/50 rounded-2xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            {/* Corner accents (Sage Green) */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#d6eaaf] rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#d6eaaf] rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#d6eaaf] rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#d6eaaf] rounded-br-xl" />

            {/* Animated Laser Scanning Line */}
            <div className="absolute left-0 right-0 h-[2px] bg-[#d6eaaf] shadow-[0_0_10px_#d6eaaf] animate-pulse scan-laser" />
          </div>
        </div>

        {/* Retry Camera Button if failed */}
        {cameraError && !scannedIsbn && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-xs text-white p-3 rounded-xl text-xs flex items-center justify-between gap-2 z-20">
            <span className="truncate">{cameraError}</span>
            <button
              onClick={startScanner}
              className="px-3 py-1 bg-white text-black font-semibold rounded-lg hover:bg-[#d6eaaf] cursor-pointer"
            >
              재시도
            </button>
          </div>
        )}
      </div>

      {/* RESULT SLIDE-UP CARD (Matching Stitch Image 3) */}
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

              {/* Rapid Action Buttons [-1 판매] & [+1 입고] (Tactile, large) */}
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
                {/* [다음 책 스캔] - Primary user flow */}
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
              <div className="p-3 bg-[#e9e2d1] rounded-2xl flex items-center gap-2 text-xs text-[#1e1c11] font-medium">
                <Sparkles className="w-4 h-4 text-[#8ea06b] flex-shrink-0" />
                <span>새로운 책을 찾았습니다! 서점 재고에 바로 등록할 수 있습니다.</span>
              </div>

              {isLoadingMetadata ? (
                <div className="py-6 text-center text-sm text-[#737878]">
                  도서 정보를 조회하는 중입니다...
                </div>
              ) : (
                <div className="space-y-4 font-['Public_Sans','Noto_Sans_KR',sans-serif]">
                  <div className="flex gap-4">
                    <BookCover
                      src={newBookCandidate?.coverImage}
                      alt={newBookCandidate?.title || '신간'}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={newBookCandidate?.title || ''}
                        onChange={(e) =>
                          setNewBookCandidate((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="도서명"
                        className="w-full font-bold text-base bg-white border border-[#c3c7c7] rounded-xl px-3 py-1.5 mb-1.5 focus:border-[#171e1e] outline-none"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={newBookCandidate?.author || ''}
                          onChange={(e) =>
                            setNewBookCandidate((prev) => ({ ...prev, author: e.target.value }))
                          }
                          placeholder="저자"
                          className="text-xs bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-1.5 focus:border-[#171e1e] outline-none"
                        />
                        <input
                          type="text"
                          value={newBookCandidate?.publisher || ''}
                          onChange={(e) =>
                            setNewBookCandidate((prev) => ({ ...prev, publisher: e.target.value }))
                          }
                          placeholder="출판사"
                          className="text-xs bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-1.5 focus:border-[#171e1e] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-[#f5f3ee] p-3 rounded-xl">
                    <div>
                      <label className="text-[11px] text-[#737878] font-bold block mb-1">
                        판매가 (원)
                      </label>
                      <input
                        type="number"
                        value={newBookCandidate?.price || 15000}
                        onChange={(e) =>
                          setNewBookCandidate((prev) => ({
                            ...prev,
                            price: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#737878] font-bold block mb-1">
                        초도 입고 수량
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
                      <span>책 등록하기 (+{newBookStock}권 입고)</span>
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
