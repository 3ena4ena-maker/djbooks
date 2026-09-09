import React, { useState, useEffect, useRef } from 'react';
import { Book, SHELF_LOCATIONS } from '../../types';
import { inventoryStore } from '../../services/inventoryStore';
import { CoverImageUploader } from '../common/CoverImageUploader';
import { feedback } from '../../utils/feedback';
import { cleanAndValidateIsbn } from '../../utils/isbnValidator';
import { ISBNScannerModal } from '../common/ISBNScannerModal';
import {
  X,
  BookPlus,
  Sparkles,
  Search,
  Loader2,
  Store,
  Globe,
  ScanLine,
  Bookmark
} from 'lucide-react';

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
  const [location, setLocation] = useState(initialData?.location || '메인책상');
  const [coverImage, setCoverImage] = useState(
    initialData?.coverImage ||
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600'
  );
  const [initialStock, setInitialStock] = useState<number>(1);
  const [entryType, setEntryType] = useState<'초기 도서 입고' | '재입고'>('초기 도서 입고');
  const [isReaderPick, setIsReaderPick] = useState(false);
  const [description, setDescription] = useState(initialData?.description || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. 도서명/저자 통합 검색 상태
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

  // 2. 바코드 스캐너 모달 상태
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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

  // 통합 검색 실행 함수
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
        // 보강 실패 시 무시
      }
    }
    setSearchQuery('');
    setShowDropdown(false);
    feedback.playBeep('success');
  };

  // ISBN 직접 입력 또는 스캔 후 정보 조회 실행
  const handleIsbnLookup = async (targetIsbn?: string) => {
    const rawQuery = targetIsbn || isbn;
    if (!rawQuery.trim()) return;

    const validated = cleanAndValidateIsbn(rawQuery);
    const queryToUse = validated.isbn13 || rawQuery.trim();

    setIsSearching(true);
    try {
      const data = await inventoryStore.lookupExternalBook(queryToUse);
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
      } else {
        feedback.playBeep('warning');
      }
    } finally {
      setIsSearching(false);
    }
  };

  // 스캐너에서 ISBN-13 인식 성공 시
  const handleBarcodeScanned = (scannedCode: string) => {
    setIsbn(scannedCode);
    setIsScannerOpen(false);
    handleIsbnLookup(scannedCode);
  };

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
          isReaderPick,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-[#fbf9f4] w-full max-w-lg rounded-2xl border border-[#c3c7c7] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] sm:max-h-[90vh] flex flex-col box-border">
        {/* Header - No overflow or wrapping defect */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-[#c3c7c7] bg-[#f5f3ee] shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
            <BookPlus className="w-5 h-5 text-[#171e1e] shrink-0" />
            <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-base sm:text-lg font-bold text-[#171e1e] truncate">
              신규 도서 등록
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#737878] hover:text-[#171e1e] hover:bg-[#e4e2dd] rounded-full transition-colors cursor-pointer shrink-0"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form - Mobile 1-Column Responsive Layout */}
        <form
          onSubmit={handleSubmit}
          className="p-3.5 sm:p-5 overflow-y-auto overflow-x-hidden flex flex-col gap-4 font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm w-full box-border"
        >
          {/* ① 도서명 + 저자 통합 검색 */}
          <div ref={searchContainerRef} className="relative w-full box-border">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-bold text-[#171e1e] flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-[#8ea06b] shrink-0" />
                <span className="truncate">도서명/저자 통합 검색</span>
              </label>
              <span className="text-[11px] text-[#737878] shrink-0">매장 재고 및 도서 DB</span>
            </div>

            <div className="relative flex items-center w-full">
              <Search className="w-4 h-4 text-[#737878] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
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
                placeholder="도서명 또는 저자명 입력 (자동완성)"
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-[#c3c7c7] rounded-xl text-xs sm:text-sm focus:border-[#171e1e] outline-none shadow-xs box-border"
              />
              {isKeywordSearching && (
                <Loader2 className="w-4 h-4 text-[#737878] animate-spin absolute right-3 shrink-0" />
              )}
            </div>

            {/* 통합 검색 자동완성 드롭다운 */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#c3c7c7] rounded-xl shadow-lg max-h-56 overflow-y-auto z-20 divide-y divide-[#eae8e3] w-full box-border">
                {searchResults.length > 0 ? (
                  <>
                    <div className="p-2 bg-[#f5f3ee] text-[11px] font-bold text-[#434848] flex items-center justify-between sticky top-0 border-b border-[#eae8e3]">
                      <span>검색 결과 ({searchResults.length}건)</span>
                      <span className="text-[10px] text-[#737878]">클릭 시 자동 입력</span>
                    </div>
                    {searchResults.map((b, idx) => (
                      <button
                        key={`${b.title}-${b.author}-${idx}`}
                        type="button"
                        onClick={() => handleSelectBook(b)}
                        className="w-full p-2.5 text-left hover:bg-[#f5f3ee] flex items-center justify-between text-xs cursor-pointer transition-colors group box-border"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm flex items-center gap-1 shrink-0 ${
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

                        <div className="shrink-0 text-right">
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

          {/* ② ISBN 영역 (모바일: 1열 full-width 인풋 + 2버튼 그리드 / 데스크톱: 인풋+버튼 인라인) */}
          <div className="w-full box-border">
            <div className="flex items-center justify-between mb-1 gap-2">
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block truncate">
                ISBN (13자리 바코드)
              </label>
              <span className="text-[11px] text-[#737878] shrink-0">직접 입력 또는 스캔</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full">
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
                className="w-full sm:flex-1 min-w-0 px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none font-mono text-xs sm:text-sm box-border"
              />

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleIsbnLookup()}
                  disabled={isSearching || !isbn.trim()}
                  className="w-full sm:w-auto px-3.5 py-2 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl hover:bg-[#eae8e3] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-w-0"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>조회 중</span>
                    </>
                  ) : (
                    <span>정보 조회</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="w-full sm:w-auto px-3.5 py-2 bg-[#f5f3ee] text-[#171e1e] border border-[#c3c7c7] hover:bg-[#eae8e3] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-0"
                  title="카메라 바코드 스캐너 열기"
                >
                  <ScanLine className="w-3.5 h-3.5 text-[#3c4c20] shrink-0" />
                  <span>바코드 스캔</span>
                </button>
              </div>
            </div>
          </div>

          {/* ③ 표지 이미지 영역 (모바일: 1열 전체 / 데스크톱: 좌측 배치) */}
          <div className="w-full box-border">
            <CoverImageUploader
              value={coverImage}
              onChange={setCoverImage}
              label="도서 표지 이미지"
            />
          </div>

          {/* ④ 기본 도서 정보 (도서명, 저자, 출판사) - 모바일 1열 구조 */}
          <div className="flex flex-col gap-3 w-full box-border">
            <div>
              <label className="text-xs text-[#434848] font-bold block mb-1">
                도서명 <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 참을 수 없는 존재의 가벼움"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl text-xs sm:text-sm font-bold focus:border-[#171e1e] outline-none box-border"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              <div>
                <label className="text-xs text-[#434848] font-bold block mb-1">
                  저자 <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="예: 밀란 쿤데라"
                  className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl text-xs sm:text-sm focus:border-[#171e1e] outline-none box-border"
                />
              </div>
              <div>
                <label className="text-xs text-[#434848] font-bold block mb-1">
                  출판사
                </label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="예: 민음사"
                  className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl text-xs sm:text-sm focus:border-[#171e1e] outline-none box-border"
                />
              </div>
            </div>
          </div>

          {/* ⑤ 입고 종류 선택 토글 */}
          <div className="w-full box-border">
            <label className="text-xs text-[#434848] font-bold block mb-1">
              입고 종류 <span className="text-[#ba1a1a]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                onClick={() => setEntryType('초기 도서 입고')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                  entryType === '초기 도서 입고'
                    ? 'bg-[#171e1e] text-white border-[#171e1e] shadow-xs'
                    : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f5f3ee]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#d6eaaf] shrink-0"></span>
                <span className="truncate">초기 도서 입고</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryType('재입고')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                  entryType === '재입고'
                    ? 'bg-[#171e1e] text-white border-[#171e1e] shadow-xs'
                    : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f5f3ee]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#8ea06b] shrink-0"></span>
                <span className="truncate">재입고</span>
              </button>
            </div>
          </div>

          {/* ⑥ 판매가 & 수량 (모바일 1열 / 데스크톱 2열) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f5f3ee] p-3 sm:p-3.5 rounded-xl w-full box-border">
            <div>
              <label className="text-xs text-[#434848] font-bold block mb-1">
                판매가 (원)
              </label>
              <input
                type="number"
                placeholder="0"
                value={price !== undefined ? price : ''}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white border border-[#c3c7c7] rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold outline-none box-border"
              />
            </div>
            <div>
              <label className="text-xs text-[#434848] font-bold block mb-1">
                {entryType === '초기 도서 입고' ? '초기 입고 수량' : '재입고 수량'}
              </label>
              <input
                type="number"
                min="1"
                value={initialStock}
                onChange={(e) => setInitialStock(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-white border border-[#c3c7c7] rounded-lg px-3 py-2 text-xs sm:text-sm font-bold text-center outline-none box-border"
              />
            </div>
          </div>

          {/* ⑦ 카테고리 / 제본 방식 / 서가 위치 (모바일 1열 / 데스크톱 3열) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full box-border">
            <div>
              <label className="text-xs text-[#434848] font-bold block mb-1">
                카테고리
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-2 text-xs outline-none box-border"
              >
                <option value="소설">소설</option>
                <option value="시/에세이">시/에세이</option>
                <option value="인문">인문</option>
                <option value="예술/디자인">예술/디자인</option>
                <option value="독립잡지/진(Zine)">독립잡지/Zine</option>
                <option value="그림책">그림책</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-[#434848] font-bold block mb-1">
                제본 방식
              </label>
              <select
                value={bindingType}
                onChange={(e) => setBindingType(e.target.value)}
                className="w-full bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-2 text-xs outline-none box-border"
              >
                <option value="양장본">양장본</option>
                <option value="무선제본">무선제본</option>
                <option value="중철제본">중철제본</option>
                <option value="누드제본">누드제본</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-[#434848] font-bold block mb-1">
                서가 위치
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-2 text-xs outline-none box-border"
              >
                {location && !SHELF_LOCATIONS.includes(location as any) && (
                  <option value={location}>{location} (기존 위치)</option>
                )}
                {SHELF_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 독자픽 여부 설정 */}
          <div
            onClick={() => setIsReaderPick(!isReaderPick)}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
              isReaderPick
                ? 'bg-[#fff8e1] border-[#ffe082]'
                : 'bg-[#faf9f6] border-[#e4e2dd] hover:border-[#c3c7c7]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`p-1.5 rounded-lg ${
                  isReaderPick ? 'bg-[#ffecb3] text-[#b78103]' : 'bg-[#e4e2dd] text-[#737878]'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isReaderPick ? 'fill-[#b78103]' : ''}`} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#171e1e]">독자픽 도서로 등록</div>
                <div className="text-[11px] text-[#737878]">
                  독자서점 추천 도서로 지정되며, 품절 시 대시보드 재고부족 알림 대상이 됩니다.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isReaderPick}
              onChange={(e) => setIsReaderPick(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 accent-[#b78103] rounded cursor-pointer"
            />
          </div>

          {/* ⑧ Description */}
          <div className="w-full box-border">
            <label className="text-xs text-[#434848] font-bold block mb-1">
              책 소개 / 입고 메모
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="도서에 대한 소개나 서점원의 추천 코멘트를 작성할 수 있습니다."
              className="w-full p-2.5 bg-white border border-[#c3c7c7] rounded-lg text-xs focus:border-[#171e1e] outline-none box-border"
            />
          </div>

          {/* ⑨ Actions (모바일: 세로 배치 또는 정렬 / 데스크톱: 우측 정렬) */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-[#eae8e3] w-full box-border">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#737878] hover:text-[#171e1e] rounded-xl hover:bg-[#eae8e3] cursor-pointer text-center"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !author.trim() || isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#171e1e] text-white rounded-xl text-xs font-bold hover:bg-[#2c3333] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <BookPlus className="w-4 h-4 text-[#d6eaaf] shrink-0" />
              <span>{isSubmitting ? '등록 중...' : '도서 등록 완료'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Standalone Stable ISBN-13 Barcode Scanner Modal */}
      <ISBNScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
        title="신규 도서 바코드 스캔"
      />
    </div>
  );
};
