import React, { useState, useEffect, useRef } from 'react';
import { CustomerOrder, CustomerOrderStatus } from '../../types';
import { inventoryStore } from '../../services/inventoryStore';
import { feedback } from '../../utils/feedback';
import {
  X,
  Check,
  ClipboardList,
  Search,
  BookOpen,
  User,
  Phone,
  CreditCard,
  FileText,
  Calendar,
  AlertCircle,
  Loader2,
  Sparkles,
  Store,
  Globe,
} from 'lucide-react';

interface CustomerOrderModalProps {
  order?: CustomerOrder | null; // If editing, pass existing order
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const CustomerOrderModal: React.FC<CustomerOrderModalProps> = ({
  order,
  onClose,
  onSuccess,
}) => {
  const isEditing = !!order;

  const [bookTitle, setBookTitle] = useState(order?.bookTitle || '');
  const [bookAuthor, setBookAuthor] = useState(order?.bookAuthor || '');
  const [bookPublisher, setBookPublisher] = useState(order?.bookPublisher || '');
  const [isbn, setIsbn] = useState(order?.isbn || '');
  const [quantity, setQuantity] = useState<number>(order?.quantity || 1);
  const [customerName, setCustomerName] = useState(order?.customerName || '');
  const [customerContact, setCustomerContact] = useState(order?.customerContact || '');
  const [depositPaid, setDepositPaid] = useState<boolean>(order?.depositPaid ?? false);
  const [orderPrice, setOrderPrice] = useState<number | ''>(order?.orderPrice !== undefined ? order.orderPrice : '');
  const [status, setStatus] = useState<CustomerOrderStatus>(order?.status || '주문접수');
  const [note, setNote] = useState(order?.note || '');
  const [orderDate, setOrderDate] = useState(
    order?.orderDate || new Date().toISOString().split('T')[0].replace(/-/g, '.')
  );

  // Book search & autocomplete
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
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Debounced auto-search when typing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performBookSearch(searchQuery.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdown
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
    setIsSearching(true);
    setHasSearched(true);
    try {
      const results = await inventoryStore.searchBooksByKeyword(queryText);
      setSearchResults(results);
      setShowDropdown(true);
    } catch (err) {
      console.error('Book search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectBook = (b: {
    title: string;
    author: string;
    publisher: string;
    price: number;
    isbn?: string;
  }) => {
    setBookTitle(b.title);
    setBookAuthor(b.author);
    setBookPublisher(b.publisher || '');
    if (b.isbn) {
      setIsbn(b.isbn);
    }
    if (b.price) {
      setOrderPrice(b.price * quantity);
    }
    setSearchQuery('');
    setShowDropdown(false);
    feedback.playBeep('success');
  };

  // Quick lookup from bookTitle field
  const handleQuickTitleSearch = () => {
    if (bookTitle.trim()) {
      setSearchQuery(bookTitle.trim());
      performBookSearch(bookTitle.trim());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle.trim() || !customerName.trim()) {
      return;
    }

    if (isEditing && order) {
      const res = await inventoryStore.updateCustomerOrder(order.id, {
        bookTitle: bookTitle.trim(),
        bookAuthor: bookAuthor.trim(),
        bookPublisher: bookPublisher.trim(),
        isbn: isbn.trim() || undefined,
        quantity: Math.max(1, quantity),
        customerName: customerName.trim(),
        customerContact: customerContact.trim(),
        depositPaid,
        orderPrice: orderPrice === '' ? 0 : Number(orderPrice),
        status,
        note: note.trim(),
        orderDate,
      });
      if (res.success) {
        feedback.playBeep('success');
        onSuccess(`'${customerName}'님의 '${bookTitle}' 주문 정보가 수정되었습니다.`);
        onClose();
      } else {
        feedback.playBeep('warning');
        const errDetail = res.error?.message ? `: ${res.error.message}` : '';
        onSuccess(`'${customerName}'님의 주문 정보 저장 실패${errDetail}`);
      }
    } else {
      const addRes = await inventoryStore.addCustomerOrder({
        bookTitle: bookTitle.trim(),
        bookAuthor: bookAuthor.trim(),
        bookPublisher: bookPublisher.trim(),
        isbn: isbn.trim() || undefined,
        quantity: Math.max(1, quantity),
        customerName: customerName.trim(),
        customerContact: customerContact.trim(),
        depositPaid,
        orderPrice: orderPrice === '' ? 0 : Number(orderPrice),
        status,
        note: note.trim(),
        orderDate,
      });
      if (addRes.success) {
        feedback.playBeep('success');
        onSuccess(`'${customerName}'님의 새 도서 주문이 등록되었습니다.`);
        onClose();
      } else {
        feedback.playBeep('warning');
        const errDetail = addRes.error?.message ? `: ${addRes.error.message}` : '';
        onSuccess(`주문 등록 실패${errDetail}`);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn select-none font-['Public_Sans','Noto_Sans_KR',sans-serif]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-hidden shadow-2xl border border-[#c3c7c7] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#c3c7c7] flex items-center justify-between bg-[#fbf9f4]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#171e1e] text-white flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-lg font-bold text-[#171e1e]">
                {isEditing ? '손님 주문 도서 수정' : '새 주문 도서 등록'}
              </h3>
              <p className="text-xs text-[#737878]">손님이 요청한 도서 예약 및 주문 정보를 기록합니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#737878] hover:text-[#171e1e] rounded-xl hover:bg-[#f5f3ee] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex flex-col gap-4 text-sm flex-1">
          {/* Quick Book Search & Auto-Fill */}
          {!isEditing && (
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
                  className="w-full pl-9 pr-20 py-2.5 bg-[#fbf9f4] border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] focus:bg-white outline-none text-xs transition-all shadow-2xs"
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
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-2.5 py-1 bg-[#171e1e] text-white rounded-lg text-xs font-medium hover:bg-[#2c3333] transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSearching ? (
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
                  {isSearching ? (
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
                      <p className="text-[11px]">아래 도서 정보 입력란에 직접 도서명을 입력해주세요.</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Book Info */}
          <div className="space-y-3 p-3.5 bg-[#fbf9f4] rounded-2xl border border-[#c3c7c7]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#171e1e] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#737878]" />
                도서 정보
              </span>
              {!isEditing && bookTitle.trim() && (
                <button
                  type="button"
                  onClick={handleQuickTitleSearch}
                  className="text-[11px] text-[#3c4c20] hover:text-[#171e1e] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>이 제목으로 정보 찾기</span>
                </button>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-[#434848] block mb-1">
                도서명 *
              </label>
              <input
                type="text"
                required
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="도서 제목을 입력하세요"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#434848] block mb-1">
                  저자
                </label>
                <input
                  type="text"
                  value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                  placeholder="저자명"
                  className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#434848] block mb-1">
                  출판사
                </label>
                <input
                  type="text"
                  value={bookPublisher}
                  onChange={(e) => setBookPublisher(e.target.value)}
                  placeholder="출판사명"
                  className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#434848] block mb-1">
                  주문 수량
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => {
                    const newQty = Math.max(1, parseInt(e.target.value) || 1);
                    setQuantity(newQty);
                  }}
                  className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs font-bold text-center"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#434848] block mb-1">
                  주문 금액 (원)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="예: 15000"
                  className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-3 p-3.5 bg-[#fbf9f4] rounded-2xl border border-[#c3c7c7]">
            <span className="text-xs font-bold text-[#171e1e] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#737878]" />
              주문 손님 정보
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#434848] block mb-1">
                  고객 성함 / 닉네임 *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="예: 김민주"
                  className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#434848] block mb-1">
                  연락처 (전화/SNS/이메일)
                </label>
                <input
                  type="text"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  placeholder="예: 010-1234-5678"
                  className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
                />
              </div>
            </div>

            {/* Deposit / Payment Status */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={depositPaid}
                  onChange={(e) => setDepositPaid(e.target.checked)}
                  className="w-4 h-4 rounded text-[#171e1e] focus:ring-0 cursor-pointer"
                />
                <span className="text-xs font-bold text-[#171e1e]">선결제 / 예약금 입금 완료</span>
              </label>
              <span className="text-[11px] text-[#737878]">
                {depositPaid ? '✅ 결제 완료' : '⏳ 수령 시 현장 결제'}
              </span>
            </div>
          </div>

          {/* Status & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#434848] block mb-1">
                진행 상태
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerOrderStatus)}
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs font-semibold"
              >
                <option value="주문접수">📝 주문접수 (입고 준비)</option>
                <option value="입고완료">📦 입고완료 (서점 도착)</option>
                <option value="수령대기">🔔 수령대기 (연락/픽업 대기)</option>
                <option value="수령완료">✨ 수령완료 (손님 전달됨)</option>
                <option value="취소됨">❌ 취소됨</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] block mb-1">
                주문 날짜
              </label>
              <input
                type="text"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                placeholder="예: 2026.08.25"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
              />
            </div>
          </div>

          {/* Note / Memo */}
          <div>
            <label className="text-xs font-bold text-[#434848] block mb-1">
              요청사항 / 서점 메모 (선택)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 선물 포장 요청, 입고 즉시 문자 요망, 보관함 3번 등"
              className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 mt-auto border-t border-[#f0eee9]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-[#c3c7c7] rounded-xl text-xs font-semibold text-[#434848] hover:bg-[#eae8e3] transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#171e1e] text-white rounded-xl text-xs font-semibold hover:bg-[#2c3333] transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? '주문 정보 저장' : '주문 도서 등록'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
