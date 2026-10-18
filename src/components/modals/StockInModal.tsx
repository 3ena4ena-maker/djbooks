import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BookWithStock, StockReason, Book, SHELF_LOCATIONS } from '../../types';
import { inventoryStore } from '../../services/inventoryStore';
import { authStore } from '../../services/authStore';
import { feedback } from '../../utils/feedback';
import { BookCover } from '../common/BookCover';
import { CoverImageUploader } from '../common/CoverImageUploader';
import { cleanAndValidateIsbn } from '../../utils/isbnValidator';
import { ISBNScannerModal } from '../common/ISBNScannerModal';
import {
  X,
  Search,
  Package,
  Minus,
  Plus,
  Check,
  RotateCcw,
  PlusCircle,
  BookPlus,
  Sparkles,
  Loader2,
  Store,
  Globe,
  ScanLine,
  Bookmark,
} from 'lucide-react';

interface StockInModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
  onOpenAddBook?: () => void;
  initialBookId?: string;
  defaultTab?: 'existing' | 'new';
}

export const StockInModal: React.FC<StockInModalProps> = ({
  onClose,
  onSuccess,
  onOpenAddBook,
  initialBookId,
  defaultTab = 'existing',
}) => {
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>(defaultTab);

  // ==========================================
  // 1. 기존 도서 입고 상태
  // ==========================================
  const books = inventoryStore.getBooksWithStock();
  const [search, setSearch] = useState('');
  const [selectedBook, setSelectedBook] = useState<BookWithStock | null>(() => {
    if (initialBookId) {
      return books.find((b) => b.id === initialBookId) || null;
    }
    return null;
  });

  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<StockReason>('입고');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter existing books
  const filteredBooks = useMemo(() => {
    if (!search.trim()) {
      return books.slice(0, 15);
    }
    const q = search.trim().toLowerCase();
    return books
      .filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.publisher && b.publisher.toLowerCase().includes(q)) ||
          b.isbn.includes(q)
      )
      .slice(0, 20);
  }, [books, search]);

  const handleSelectBook = (book: BookWithStock) => {
    setSelectedBook(book);
    setQuantity(1);
    feedback.playBeep('click');
  };

  const handleQuantityChange = (val: number) => {
    const clamped = Math.max(1, Math.min(9999, val));
    setQuantity(clamped);
  };

  const handleExistingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authStore.isAdmin) {
      feedback.playBeep('warning');
      alert('입고 처리는 관리자 모드에서만 가능합니다.');
      onClose();
      return;
    }
    if (!selectedBook) return;

    if (quantity <= 0) {
      feedback.playBeep('warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedNote = note.trim()
        ? `[${reason}] ${note.trim()}`
        : `대시보드 입고 (${reason} +${quantity}권)`;

      const res = await inventoryStore.adjustStock(
        selectedBook.id,
        quantity,
        reason,
        formattedNote
      );

      if (res.success) {
        feedback.playBeep('success');
        onSuccess(
          `'${selectedBook.title}' +${quantity}권 입고되었습니다. (현재 재고: ${res.newQuantity}권)`
        );
        onClose();
      } else {
        feedback.playBeep('warning');
        alert(res.error || '입고 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasons: { id: StockReason; label: string; desc: string }[] = [
    { id: '입고', label: '일반 입고', desc: '신규 도서 공급/납품' },
    { id: '재입고', label: '재입고', desc: '품절/부족 도서 재입고' },
    { id: '초기 도서 입고', label: '초기 입고', desc: '개점 및 초도 물량 입고' },
    { id: '기타', label: '기타', desc: '기타 재고 수량 추가' },
  ];

  // ==========================================
  // 2. 신규 도서 등록 및 입고 상태
  // ==========================================
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [category, setCategory] = useState('소설');
  const [bindingType, setBindingType] = useState('양장본');
  const [location, setLocation] = useState('메인책상');
  const [coverImage, setCoverImage] = useState(
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600'
  );
  const [newBookQuantity, setNewBookQuantity] = useState<number>(1);
  const [entryType, setEntryType] = useState<'초기 도서 입고' | '재입고' | '입고'>('초기 도서 입고');
  const [isReaderPick, setIsReaderPick] = useState(false);
  const [description, setDescription] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isNewSubmitting, setIsNewSubmitting] = useState(false);

  // 통합 검색 상태
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

  // 바코드 스캐너 모달 상태
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // 통합 검색 디바운스
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

  const handleSelectSearchedBook = async (b: {
    id?: string;
    title: string;
    author: string;
    publisher: string;
    price: number;
    isbn?: string;
    coverImage?: string;
    source: '매장 재고' | '도서 DB';
  }) => {
    // 만약 이미 매장에 존재하는 도서라면 바로 기존 도서 입고 화면으로 전환 안내
    if (b.source === '매장 재고' && b.id) {
      const existing = books.find((x) => x.id === b.id);
      if (existing) {
        setSelectedBook(existing);
        setActiveTab('existing');
        setSearchQuery('');
        setShowDropdown(false);
        feedback.playBeep('success');
        return;
      }
    }

    setTitle(b.title);
    setAuthor(b.author);
    setPublisher(b.publisher || '');
    if (b.price) setPrice(b.price);
    if (b.coverImage) setCoverImage(b.coverImage);
    if (b.isbn) {
      setIsbn(b.isbn);
      try {
        const extra = await inventoryStore.lookupExternalBook(b.isbn);
        if (extra) {
          if (extra.category) setCategory(extra.category);
          if (extra.coverImage) setCoverImage(extra.coverImage);
          if (extra.description) setDescription(extra.description);
        }
      } catch (e) {
        // ignore
      }
    }
    setSearchQuery('');
    setShowDropdown(false);
    feedback.playBeep('success');
  };

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

  const handleBarcodeScanned = (scannedCode: string) => {
    setIsbn(scannedCode);
    setIsScannerOpen(false);
    handleIsbnLookup(scannedCode);
  };

  const handleNewBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authStore.isAdmin) {
      feedback.playBeep('warning');
      alert('입고 처리는 관리자 모드에서만 가능합니다.');
      onClose();
      return;
    }

    if (!title.trim() || !author.trim() || isNewSubmitting) {
      return;
    }

    setIsNewSubmitting(true);
    try {
      const reasonLabel = entryType === '초기 도서 입고' ? '초기 도서 입고' : (entryType === '재입고' ? '재입고' : '입고');
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
        newBookQuantity,
        `${reasonLabel} (${newBookQuantity}권)`,
        reasonLabel as '초기 도서 입고' | '재입고'
      );

      feedback.playBeep('success');
      onClose();
      onSuccess(
        `신규 도서 '${newBook.title}'이(가) 등록되고 ${newBookQuantity}권 입고되었습니다.`
      );
    } catch (err) {
      console.error('Failed to register book:', err);
      setIsNewSubmitting(false);
    }
  };

  // 기존 검색에서 신규 도서 등록으로 전환 시 검색어 계승
  const handleSwitchToNewBookWithQuery = (prefillText: string) => {
    setActiveTab('new');
    if (prefillText.trim()) {
      setSearchQuery(prefillText.trim());
      setTitle(prefillText.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-[#fbf9f4] w-full max-w-lg rounded-2xl border border-[#c3c7c7] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] sm:max-h-[90vh] flex flex-col font-['Public_Sans','Noto_Sans_KR',sans-serif]">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-[#c3c7c7] bg-[#f5f3ee] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-[#d6eaaf] text-[#2d4710] rounded-lg shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-base sm:text-lg font-bold text-[#171e1e] truncate">
                도서 입고 입력
              </h3>
              <p className="text-[11px] sm:text-xs text-[#737878] truncate">
                기존 보유 도서 입고 또는 신규 도서 등록 및 입고
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#737878] hover:text-[#171e1e] hover:bg-[#e4e2dd] rounded-full transition-colors cursor-pointer shrink-0"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 🌟 2-Tab Navigation Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-[#f0eee9] border-b border-[#c3c7c7] gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('existing')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'existing'
                ? 'bg-white text-[#171e1e] shadow-2xs border border-[#e4e2dd]'
                : 'text-[#737878] hover:text-[#171e1e]'
            }`}
          >
            <Package className={`w-3.5 h-3.5 ${activeTab === 'existing' ? 'text-[#2e7d32]' : 'text-[#737878]'}`} />
            <span>기존 도서 입고</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'new'
                ? 'bg-white text-[#171e1e] shadow-2xs border border-[#e4e2dd]'
                : 'text-[#737878] hover:text-[#171e1e]'
            }`}
          >
            <BookPlus className={`w-3.5 h-3.5 ${activeTab === 'new' ? 'text-[#2e7d32]' : 'text-[#737878]'}`} />
            <span>신규 도서 등록 및 입고</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
          {/* ======================================================== */}
          {/* TAB 1: 기존 도서 입고                                    */}
          {/* ======================================================== */}
          {activeTab === 'existing' && (
            <>
              {!selectedBook ? (
                /* 1-A: 기존 도서 검색 및 선택 */
                <div className="space-y-3">
                  {/* 신규 도서 탭 이동 안내 배너 */}
                  <div className="bg-[#edf5e1] border border-[#c3d9a5] rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2 text-[#2d4710] min-w-0">
                      <PlusCircle className="w-4 h-4 shrink-0" />
                      <span className="truncate">서점에 없는 새로운 책인가요?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchToNewBookWithQuery(search)}
                      className="px-2.5 py-1 bg-[#2e7d32] hover:bg-[#1b5e20] text-white font-bold rounded-lg cursor-pointer shrink-0 shadow-2xs text-[11px] sm:text-xs"
                    >
                      + 신규 도서 등록
                    </button>
                  </div>

                  {/* 도서 검색창 */}
                  <div className="flex items-center bg-white rounded-xl px-3 py-2 border border-[#c3c7c7] focus-within:border-[#2e7d32] shadow-2xs">
                    <Search className="w-4 h-4 text-[#737878] mr-2 shrink-0" />
                    <input
                      type="text"
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="입고할 기존 도서명, 저자, ISBN 검색..."
                      className="bg-transparent border-none outline-none w-full text-xs sm:text-sm placeholder-[#737878]"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="text-[#737878] hover:text-[#171e1e] p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="text-xs font-bold text-[#434848] px-1 flex items-center justify-between">
                    <span>{search.trim() ? `검색 결과 (${filteredBooks.length})` : '도서 목록 선택'}</span>
                    <span className="text-[11px] text-[#737878]">클릭하여 선택</span>
                  </div>

                  <div className="divide-y divide-[#e4e2dd] max-h-[350px] overflow-y-auto pr-1">
                    {filteredBooks.length === 0 ? (
                      <div className="py-10 text-center text-[#737878] text-xs sm:text-sm space-y-2.5">
                        <p className="font-semibold text-[#171e1e]">
                          {search.trim() ? `‘${search}’ 일치 도서가 없습니다.` : '등록된 도서가 없습니다.'}
                        </p>
                        <p className="text-[11px]">
                          신규 도서 등록 탭으로 이동하여 새 책을 등록하고 바로 입고해보세요.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleSwitchToNewBookWithQuery(search)}
                          className="px-3.5 py-1.5 bg-[#2e7d32] text-white rounded-xl text-xs font-bold shadow-2xs hover:bg-[#1b5e20] cursor-pointer inline-flex items-center gap-1"
                        >
                          <BookPlus className="w-3.5 h-3.5" />
                          <span>신규 도서로 등록 및 입고하기 →</span>
                        </button>
                      </div>
                    ) : (
                      filteredBooks.map((book) => (
                        <div
                          key={book.id}
                          onClick={() => handleSelectBook(book)}
                          className="py-2.5 px-3 rounded-xl flex items-center justify-between gap-3 transition-all hover:bg-[#edf5e1]/40 cursor-pointer active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <BookCover src={book.coverImage} alt={book.title} size="sm" />
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs sm:text-sm text-[#171e1e] truncate">
                                {book.title}
                              </h4>
                              <p className="text-[11px] sm:text-xs text-[#737878] truncate">
                                {book.author} {book.publisher && `· ${book.publisher}`}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full ${
                                book.quantity <= 0
                                  ? 'bg-[#ffdad6] text-[#ba1a1a]'
                                  : 'bg-[#e8f5e9] text-[#2e7d32]'
                              }`}
                            >
                              현재 {book.quantity}권
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* 1-B: 선택된 기존 도서 입고 상세 수량/사유 Form */
                <form onSubmit={handleExistingSubmit} className="space-y-4">
                  {/* 선택된 도서 카드 */}
                  <div className="bg-[#f0eee9] p-3 rounded-xl border border-[#c3c7c7] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <BookCover src={selectedBook.coverImage} alt={selectedBook.title} size="sm" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-[#2e7d32] bg-[#d6eaaf] px-1.5 py-0.5 rounded">
                          입고 대상
                        </span>
                        <h4 className="font-bold text-xs sm:text-sm text-[#171e1e] truncate mt-0.5">
                          {selectedBook.title}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-[#737878] truncate">
                          {selectedBook.author} · 현재 재고:{' '}
                          <strong className="text-[#171e1e]">{selectedBook.quantity}권</strong>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedBook(null)}
                      className="text-xs text-[#434848] hover:text-[#171e1e] px-2.5 py-1 bg-white border border-[#c3c7c7] rounded-lg cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>변경</span>
                    </button>
                  </div>

                  {/* 입고 사유 선택 */}
                  <div>
                    <label className="block text-xs font-bold text-[#171e1e] mb-1.5">
                      입고 구분
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {reasons.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setReason(r.id)}
                          className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                            reason === r.id
                              ? 'bg-[#2e7d32] text-white border-[#2e7d32] shadow-xs'
                              : 'bg-white text-[#434848] border-[#c3c7c7] hover:border-[#2e7d32]'
                          }`}
                        >
                          <span>{r.label}</span>
                          <span
                            className={`text-[10px] font-normal ${
                              reason === r.id ? 'text-[#d6eaaf]' : 'text-[#737878]'
                            }`}
                          >
                            {r.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 입고 수량 설정 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[#171e1e]">
                        입고 수량
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 5, 10, 20].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setQuantity(q)}
                            className={`text-[11px] px-2 py-0.5 rounded-md border cursor-pointer font-semibold ${
                              quantity === q
                                ? 'bg-[#2e7d32] text-white border-[#2e7d32]'
                                : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f0eee9]'
                            }`}
                          >
                            +{q}권
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white rounded-xl border border-[#c3c7c7] p-1.5 focus-within:border-[#2e7d32]">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(quantity - 1)}
                        disabled={quantity <= 1}
                        className="p-2 text-[#2e7d32] hover:bg-[#d6eaaf]/40 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={quantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 1)}
                        className="flex-1 text-center font-bold text-lg text-[#171e1e] outline-none bg-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(quantity + 1)}
                        className="p-2 text-[#2e7d32] hover:bg-[#d6eaaf]/40 rounded-lg cursor-pointer"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="text-right text-[11px] text-[#737878] mt-1">
                      입고 후 예상 재고:{' '}
                      <strong className="text-[#2e7d32]">
                        {selectedBook.quantity + quantity}권
                      </strong>{' '}
                      (현재 {selectedBook.quantity}권 + {quantity}권)
                    </div>
                  </div>

                  {/* 메모 입력 */}
                  <div>
                    <label className="block text-xs font-bold text-[#171e1e] mb-1.5">
                      비고 / 메모 (선택사항)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="예: 창비 직납, 총판 정기 입고, 손님 요청 입고 등"
                      className="w-full bg-white rounded-xl px-3 py-2 border border-[#c3c7c7] text-xs sm:text-sm focus:border-[#2e7d32] outline-none placeholder-[#737878]"
                    />
                  </div>

                  {/* 하단 버튼 */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e4e2dd]">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-[#434848] hover:bg-[#e4e2dd] transition-all cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#2e7d32] text-white hover:bg-[#1b5e20] transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>입고 완료 (+{quantity}권)</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* ======================================================== */}
          {/* TAB 2: 신규 도서 등록 및 입고                           */}
          {/* ======================================================== */}
          {activeTab === 'new' && (
            <form onSubmit={handleNewBookSubmit} className="space-y-4">
              {/* ① 도서명/저자 통합 검색 */}
              <div ref={searchContainerRef} className="relative w-full">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-bold text-[#171e1e] flex items-center gap-1.5 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-[#2e7d32] shrink-0" />
                    <span>도서명/저자 통합 검색</span>
                  </label>
                  <span className="text-[11px] text-[#737878] shrink-0">매장 도서 및 온라인 DB</span>
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
                    className="w-full pl-9 pr-8 py-2 bg-white border border-[#c3c7c7] rounded-xl text-xs sm:text-sm focus:border-[#2e7d32] outline-none shadow-xs"
                  />
                  {isKeywordSearching && (
                    <Loader2 className="w-4 h-4 text-[#737878] animate-spin absolute right-3 shrink-0" />
                  )}
                </div>

                {/* 통합 검색 드롭다운 */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#c3c7c7] rounded-xl shadow-lg max-h-56 overflow-y-auto z-20 divide-y divide-[#eae8e3] w-full">
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
                            onClick={() => handleSelectSearchedBook(b)}
                            className="w-full p-2.5 text-left hover:bg-[#edf5e1]/40 flex items-center justify-between text-xs cursor-pointer transition-colors group"
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
                                      <span>기존 매장도서</span>
                                    </>
                                  ) : (
                                    <>
                                      <Globe className="w-2.5 h-2.5" />
                                      <span>도서DB</span>
                                    </>
                                  )}
                                </span>
                                <span className="font-bold text-[#171e1e] group-hover:text-[#2e7d32] truncate block">
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
                                      : 'bg-[#ffdad6] text-[#ba1a1a]'
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

              {/* ② ISBN 영역 */}
              <div>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block truncate">
                    ISBN (13자리 바코드)
                  </label>
                  <span className="text-[11px] text-[#737878] shrink-0">직접 입력 또는 스캔</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
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
                    className="w-full sm:flex-1 px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#2e7d32] outline-none font-mono text-xs sm:text-sm"
                  />

                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleIsbnLookup()}
                      disabled={isSearching || !isbn.trim()}
                      className="px-3.5 py-2 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl hover:bg-[#eae8e3] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                      className="px-3.5 py-2 bg-[#171e1e] text-white hover:bg-[#2c3333] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="카메라 바코드 스캐너 열기"
                    >
                      <ScanLine className="w-3.5 h-3.5 text-[#d6eaaf] shrink-0" />
                      <span>바코드 스캔</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ③ 표지 이미지 업로더 */}
              <div>
                <CoverImageUploader
                  value={coverImage}
                  onChange={setCoverImage}
                  label="도서 표지 이미지"
                />
              </div>

              {/* ④ 기본 도서 정보 (도서명, 저자, 출판사) */}
              <div className="space-y-2.5">
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
                    className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl text-xs sm:text-sm font-bold focus:border-[#2e7d32] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                      className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl text-xs sm:text-sm focus:border-[#2e7d32] outline-none"
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
                      className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl text-xs sm:text-sm focus:border-[#2e7d32] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* ⑤ 입고 종류 선택 토글 */}
              <div>
                <label className="text-xs text-[#434848] font-bold block mb-1">
                  입고 종류 <span className="text-[#ba1a1a]">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEntryType('초기 도서 입고')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                      entryType === '초기 도서 입고'
                        ? 'bg-[#2e7d32] text-white border-[#2e7d32] shadow-xs'
                        : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f5f3ee]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#d6eaaf] shrink-0"></span>
                    <span className="truncate">초기 입고</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType('입고')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                      entryType === '입고'
                        ? 'bg-[#2e7d32] text-white border-[#2e7d32] shadow-xs'
                        : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f5f3ee]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#d6eaaf] shrink-0"></span>
                    <span className="truncate">일반 입고</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType('재입고')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                      entryType === '재입고'
                        ? 'bg-[#2e7d32] text-white border-[#2e7d32] shadow-xs'
                        : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f5f3ee]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#d6eaaf] shrink-0"></span>
                    <span className="truncate">재입고</span>
                  </button>
                </div>
              </div>

              {/* ⑥ 판매가 & 입고 수량 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f5f3ee] p-3 rounded-xl">
                <div>
                  <label className="text-xs text-[#434848] font-bold block mb-1">
                    판매가 (원)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={price !== undefined ? price : ''}
                    onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-[#c3c7c7] rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#434848] font-bold block mb-1">
                    입고 수량 (권) <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <div className="flex items-center gap-1 bg-white border border-[#c3c7c7] rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setNewBookQuantity(Math.max(1, newBookQuantity - 1))}
                      disabled={newBookQuantity <= 1}
                      className="p-1 text-[#2e7d32] hover:bg-[#d6eaaf]/40 rounded disabled:opacity-30 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={newBookQuantity}
                      onChange={(e) => setNewBookQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 text-center font-bold text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setNewBookQuantity(newBookQuantity + 1)}
                      className="p-1 text-[#2e7d32] hover:bg-[#d6eaaf]/40 rounded cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ⑦ 카테고리 / 제본 방식 / 서가 위치 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-xs text-[#434848] font-bold block mb-1">
                    카테고리
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-2 text-xs outline-none"
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
                    className="w-full bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-2 text-xs outline-none"
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
                    className="w-full bg-white border border-[#c3c7c7] rounded-lg px-2.5 py-2 text-xs outline-none"
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
                onClick={() => {
                  if (authStore.isAdmin) {
                    setIsReaderPick(!isReaderPick);
                  }
                }}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isReaderPick
                    ? 'bg-[#fff8e1] border-[#ffe082] cursor-pointer'
                    : 'bg-[#faf9f6] border-[#e4e2dd] hover:border-[#c3c7c7] cursor-pointer'
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
                    <div className="text-xs font-bold text-[#171e1e]">독자픽 도서로 지정</div>
                    <div className="text-[11px] text-[#737878]">
                      품절 시 대시보드 상단 재고부족 알림 대상이 됩니다.
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

              {/* 책 소개 / 입고 메모 */}
              <div>
                <label className="text-xs text-[#434848] font-bold block mb-1">
                  책 소개 / 입고 메모
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="도서에 대한 소개나 입고 관련 메모를 작성할 수 있습니다."
                  className="w-full p-2.5 bg-white border border-[#c3c7c7] rounded-lg text-xs focus:border-[#2e7d32] outline-none"
                />
              </div>

              {/* 신규 도서 등록 액션 버튼 */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-[#eae8e3]">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-[#737878] hover:text-[#171e1e] rounded-xl hover:bg-[#eae8e3] cursor-pointer text-center"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || !author.trim() || isNewSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#2e7d32] text-white rounded-xl text-xs font-bold hover:bg-[#1b5e20] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <BookPlus className="w-4 h-4 text-[#d6eaaf] shrink-0" />
                  <span>
                    {isNewSubmitting
                      ? '등록 중...'
                      : `신규 도서 등록 및 입고 완료 (+${newBookQuantity}권)`}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
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
