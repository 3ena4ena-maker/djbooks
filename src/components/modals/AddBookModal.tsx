import React, { useState, useEffect, useRef } from 'react';
import { Book } from '../../types';
import { inventoryStore } from '../../services/inventoryStore';
import { CoverImageUploader } from '../common/CoverImageUploader';
import { feedback } from '../../utils/feedback';
import {
  X,
  Check,
  BookPlus,
  Sparkles,
  Search,
  Loader2,
  Store,
  Globe,
  ScanLine,
  Camera,
  AlertCircle
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface AddBookModalProps {
  initialIsbn?: string;
  initialData?: Partial<Book>;
  onClose: () => void;
  onSuccess: (newBookId: string, message: string) => void;
}

export const AddBookModal: React.FC<AddBookModalProps> = ({
  initialIsbn = '',
  initialData,
  onClose,
  onSuccess,
}) => {
  const [isbn, setIsbn] = useState(initialIsbn || initialData?.isbn || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [author, setAuthor] = useState(initialData?.author || '');
  const [publisher, setPublisher] = useState(initialData?.publisher || '');
  const [price, setPrice] = useState<number | ''>(
    initialData?.price !== undefined ? initialData.price : ''
  );
  const [category, setCategory] = useState(initialData?.category || '소설');
  const [bindingType, setBindingType] = useState(initialData?.bindingType || '양장본');
  const [location, setLocation] = useState(initialData?.location || 'A1 선반');
  const [coverImage, setCoverImage] = useState(
    initialData?.coverImage ||
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600'
  );
  const [initialStock, setInitialStock] = useState<number>(1);
  const [entryType, setEntryType] = useState<'초기 도서 입고' | '재입고'>('초기 도서 입고');
  const [description, setDescription] = useState(initialData?.description || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. 도서명/저자 통합 검색 상태 (CustomerOrderModal과 동일한 로직 및 인터페이스 재사용)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{
      id?: string;
      isbn?: string;
      title: string;
      author: string;
      publisher: string;
      price: number;
      coverImage?: string;
      inStock: boolean;
      quantity: number;
      source: '매장 재고' | '도서 DB';
    }>
  >([]);
  const [isKeywordSearching, setIsKeywordSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 2. 바코드 스캐너 상태
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'addbook-modal-barcode-reader';

  // 검색어 입력 시 디바운스 자동 검색
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsKeywordSearching(false);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performBookSearch(searchQuery.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 검색 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 통합 검색 실행 함수 (inventoryStore.searchBooksByKeyword 재사용)
  const performBookSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsKeywordSearching(true);
    setHasSearched(true);
    try {
      const results = await inventoryStore.searchBooksByKeyword(queryText);
      setSearchResults(results);
      setShowDropdown(true);
    } catch (err) {
      console.error('Book search failed:', err);
    } finally {
      setIsKeywordSearching(false);
    }
  };

  // 검색 결과에서 도서 선택 시 폼 필드 자동 입력
  const handleSelectBook = async (b: {
    title: string;
    author: string;
    publisher: string;
    price: number;
    isbn?: string;
    coverImage?: string;
  }) => {
    setTitle(b.title);
    setAuthor(b.author);
    setPublisher(b.publisher || '');
    if (b.price) {
      setPrice(b.price);
    }
    if (b.coverImage) {
      setCoverImage(b.coverImage);
    }
    if (b.isbn) {
      setIsbn(b.isbn);
      // ISBN이 있는 경우 카테고리나 상세 설명 보강 조회
      try {
        const extra = await inventoryStore.lookupExternalBook(b.isbn);
        if (extra) {
          if (extra.category) setCategory(extra.category);
          if (extra.coverImage) setCoverImage(extra.coverImage);
          if (extra.description) setDescription(extra.description);
        }
      } catch (e) {
        // 비필수 보강 처리 무시
      }
    }
    setSearchQuery('');
    setShowDropdown(false);
    feedback.playBeep('success');
  };

  // ISBN 직접 입력 후 정보 조회 실행
  const handleIsbnLookup = async (targetIsbn?: string) => {
    const rawQuery = targetIsbn || isbn;
    if (!rawQuery.trim()) return;
    setIsSearching(true);
    try {
      const data = await inventoryStore.lookupExternalBook(rawQuery);
      if (data) {
        if (data.isbn) setIsbn(data.isbn);
        if (data.title) setTitle(data.title);
        if (data.author) setAuthor(data.author);
        if (data.publisher) setPublisher(data.publisher);
        if (data.price) setPrice(data.price);
        if (data.category) setCategory(data.category);
        if (data.coverImage) setCoverImage(data.coverImage);
        if (data.description) setDescription(data.description);
        feedback.playBeep('success');
      }
    } finally {
      setIsSearching(false);
    }
  };

  // 카메라 바코드 스캐너 생명주기 관리
  useEffect(() => {
    if (!isScannerOpen) {
      if (qrReaderRef.current) {
        const scanner = qrReaderRef.current;
        qrReaderRef.current = null;
        if (scanner.isScanning) {
          scanner.stop().catch(() => {}).finally(() => {
            scanner.clear().catch(() => {});
          });
        } else {
          scanner.clear().catch(() => {});
        }
      }
      return;
    }

    let isMounted = true;
    setScannerError(null);

    const startScanner = async () => {
      try {
        const formats = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];

        const scanner = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: formats,
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
        qrReaderRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 25,
            qrbox: { width: 260, height: 160 },
          },
          (decodedText) => {
            if (!isMounted) return;
            const clean = inventoryStore.normalizeIsbn(decodedText);
            setIsbn(clean);
            setIsScannerOpen(false);
            handleIsbnLookup(clean);
            feedback.playBeep('success');
          },
          () => {}
        );
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('[AddBookModal] Camera scanner start failed:', err);
        setScannerError('카메라를 시작할 수 없습니다. 권한을 확인하거나 ISBN을 직접 입력해주세요.');
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (qrReaderRef.current) {
        const scanner = qrReaderRef.current;
        qrReaderRef.current = null;
        if (scanner.isScanning) {
          scanner.stop().catch(() => {}).finally(() => {
            scanner.clear().catch(() => {});
          });
        } else {
          scanner.clear().catch(() => {});
        }
      }
    };
  }, [isScannerOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const newBook = await inventoryStore.registerBook(
        {
          isbn: isbn.trim() || `N/A-${Date.now()}`,
          title: title.trim(),
          author: author.trim(),
          publisher: publisher.trim() || '독립출판',
          price: price === '' ? 0 : Number(price),
          category,
          bindingType,
          location,
          coverImage,
          description,
          publishedDate: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
        },
        initialStock,
        `${entryType} (${initialStock}권)`,
        entryType
      );

      feedback.playBeep('success');
      onClose();
      onSuccess(newBook.id, `새로운 도서 '${newBook.title}'이(가) 등록되었습니다.`);
    } catch (err) {
      console.error('Failed to register book:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-[#fbf9f4] w-full max-w-lg rounded-2xl border border-[#c3c7c7] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#c3c7c7] bg-[#f5f3ee] flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookPlus className="w-5 h-5 text-[#171e1e]" />
            <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-lg font-bold text-[#171e1e]">
              신규 도서 등록
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#737878] hover:text-[#171e1e] hover:bg-[#e4e2dd] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex flex-col gap-4 font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm">
          {/* ① 도서명 + 저자 통합 검색 (기존 주문 도서 등록과 동일한 로직 및 UI) */}
          <div ref={searchContainerRef} className="relative">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-bold text-[#171e1e] flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-[#8ea06b] shrink-0" />
                <span>도서명/저자 통합 검색</span>
              </label>
              <span className="text-[11px] text-[#737878] shrink-0">매장 재고 및 도서 DB</span>
            </div>

            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#737878] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    performBookSearch(searchQuery);
                  }
                }}
                placeholder="도서명 또는 저자명을 입력하세요 (예: 달러구트, 데미안, 불편한 편의점)"
                className="w-full pl-9 pr-20 py-2.5 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs transition-all shadow-2xs"
              />

              <div className="absolute right-1.5 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowDropdown(false);
                    }}
                    className="p-1 text-[#737878] hover:text-[#171e1e] rounded-md hover:bg-[#e4e2dd] transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => performBookSearch(searchQuery)}
                  disabled={isKeywordSearching || !searchQuery.trim()}
                  className="px-2.5 py-1 bg-[#171e1e] text-white rounded-lg text-xs font-medium hover:bg-[#2c3333] transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isKeywordSearching ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Search className="w-3 h-3" />
                  )}
                  <span>검색</span>
                </button>
              </div>
            </div>

            {/* Autocomplete Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#c3c7c7] rounded-2xl shadow-xl z-30 overflow-hidden divide-y divide-[#f0eee9] max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                {isKeywordSearching ? (
                  <div className="p-4 text-center text-xs text-[#737878] flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#171e1e]" />
                    <span>도서 정보를 검색하고 있습니다...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    <div className="px-3 py-1.5 bg-[#f5f3ee] text-[11px] font-bold text-[#434848] flex items-center justify-between">
                      <span>검색 결과 ({searchResults.length}건)</span>
                      <span className="text-[10px] text-[#737878]">클릭 시 도서 정보가 자동 입력됩니다</span>
                    </div>
                    {searchResults.map((b, idx) => (
                      <button
                        key={`${b.title}-${b.author}-${idx}`}
                        type="button"
                        onClick={() => handleSelectBook(b)}
                        className="w-full p-2.5 text-left hover:bg-[#f5f3ee] flex items-center justify-between text-xs cursor-pointer transition-colors group"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm flex items-center gap-1 flex-shrink-0 ${
                                b.source === '매장 재고'
                                  ? 'bg-[#e7eedb] text-[#3c4c20] border border-[#d2dec0]'
                                  : 'bg-[#f0eee9] text-[#434848]'
                              }`}
                            >
                              {b.source === '매장 재고' ? (
                                <>
                                  <Store className="w-2.5 h-2.5" />
                                  <span>매장도서</span>
                                </>
                              ) : (
                                <>
                                  <Globe className="w-2.5 h-2.5" />
                                  <span>도서DB</span>
                                </>
                              )}
                            </span>
                            <span className="font-bold text-[#171e1e] group-hover:text-[#3c4c20] truncate block">
                              {b.title}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#737878] mt-0.5 truncate pl-0.5">
                            {b.author} · {b.publisher || '출판사 미상'}
                            {b.price ? ` · ${b.price.toLocaleString()}원` : ''}
                          </div>
                        </div>

                        <div className="flex-shrink-0 text-right">
                          {b.source === '매장 재고' ? (
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                b.quantity > 0
                                  ? 'bg-[#e7eedb] text-[#3c4c20]'
                                  : 'bg-[#ffcdd2]/40 text-[#c62828]'
                              }`}
                            >
                              재고 {b.quantity}권
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#737878] bg-[#f5f3ee] px-2 py-0.5 rounded-md">
                              자동완성
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                ) : hasSearched ? (
                  <div className="p-4 text-center text-xs text-[#737878]">
                    <p className="font-medium text-[#171e1e] mb-1">일치하는 검색 결과가 없습니다.</p>
                    <p className="text-[11px]">아래 ISBN 번호 입력 또는 직접 입력으로 등록해주세요.</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* ② ISBN 직접 입력 검색 & ③ ISBN 바코드 스캔 버튼 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block">
                ISBN (13자리 바코드)
              </label>
              <span className="text-[11px] text-[#737878]">직접 입력 또는 바코드 스캔</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleIsbnLookup();
                  }
                }}
                placeholder="예: 9788937460005"
                className="flex-1 px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => handleIsbnLookup()}
                disabled={isSearching || !isbn.trim()}
                className="px-3.5 py-2 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl hover:bg-[#eae8e3] text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {isSearching ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> 조회 중
                  </span>
                ) : (
                  '정보 조회'
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsScannerOpen((prev) => !prev)}
                className={`px-3 py-2 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isScannerOpen
                    ? 'bg-[#171e1e] text-white border-[#171e1e]'
                    : 'bg-[#f5f3ee] text-[#171e1e] border-[#c3c7c7] hover:bg-[#eae8e3]'
                }`}
                title="카메라 바코드 스캐너 열기"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>{isScannerOpen ? '닫기' : '스캔'}</span>
              </button>
            </div>

            {/* In-Modal Barcode Scanner Area */}
            {isScannerOpen && (
              <div className="mt-2.5 p-3 bg-black rounded-2xl overflow-hidden shadow-md relative animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between text-white text-xs mb-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Camera className="w-3.5 h-3.5 text-[#d6eaaf]" />
                    <span>바코드를 카메라에 맞춰주세요</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(false)}
                    className="p-1 text-white/80 hover:text-white rounded-md hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  id={scannerContainerId}
                  className="w-full aspect-[16/10] bg-zinc-900 rounded-xl overflow-hidden"
                />

                {scannerError && (
                  <div className="mt-2 p-2 bg-red-950/80 border border-red-800 text-red-200 rounded-lg text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{scannerError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                도서명 *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="도서 제목 입력"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                저자 *
              </label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="저자명 입력"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                출판사
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="출판사명"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                판매가 (원) *
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="판매가 입력 (예: 15000)"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none font-mono"
              />
            </div>
          </div>

          {/* 입고 종류 분류 선택 */}
          <div>
            <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1.5">
              입고 종류 *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEntryType('초기 도서 입고')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  entryType === '초기 도서 입고'
                    ? 'bg-[#171e1e] text-white border-[#171e1e] shadow-xs'
                    : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f5f3ee]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#d6eaaf]"></span>
                초기 도서 입고 (최초 등록)
              </button>
              <button
                type="button"
                onClick={() => setEntryType('재입고')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  entryType === '재입고'
                    ? 'bg-[#171e1e] text-white border-[#171e1e] shadow-xs'
                    : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f5f3ee]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#8ea06b]"></span>
                재입고 (추가 입고)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                {entryType === '초기 도서 입고' ? '초기 재고' : '입고 수량'}
              </label>
              <input
                type="number"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-center font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                카테고리
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
              >
                <option value="소설">소설</option>
                <option value="에세이">에세이</option>
                <option value="시/희곡">시/희곡</option>
                <option value="인문/사회">인문/사회</option>
                <option value="고전문학">고전문학</option>
                <option value="독립출판">독립출판</option>
                <option value="예술/디자인">예술/디자인</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                서가 위치
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: A4 선반"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
              />
            </div>
          </div>

          {/* 도서 표지 직접 업로드 / 촬영 / URL / 프리셋 */}
          <CoverImageUploader
            value={coverImage}
            onChange={setCoverImage}
            label="도서 표지 (직접 파일 등록/촬영)"
          />

          <div>
            <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
              도서 소개 (선택)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="간단한 책 소개나 입고 메모"
              className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2 mt-auto">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 py-3 border border-[#c3c7c7] rounded-xl text-sm font-semibold text-[#434848] hover:bg-[#eae8e3] transition-colors cursor-pointer disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-[#171e1e] text-white rounded-xl text-sm font-semibold hover:bg-[#2c3333] transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? '등록 중...' : '책 등록하기'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
