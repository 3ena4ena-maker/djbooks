import React, { useState, useMemo } from 'react';
import { BookWithStock, StockReason } from '../../types';
import { inventoryStore } from '../../services/inventoryStore';
import { authStore } from '../../services/authStore';
import { feedback } from '../../utils/feedback';
import { BookCover } from '../common/BookCover';
import {
  X,
  Search,
  ShoppingBag,
  Minus,
  Plus,
  AlertTriangle,
  ArrowRight,
  Check,
  RotateCcw
} from 'lucide-react';

interface StockOutModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
  initialBookId?: string;
}

export const StockOutModal: React.FC<StockOutModalProps> = ({
  onClose,
  onSuccess,
  initialBookId,
}) => {
  const books = inventoryStore.getBooksWithStock();
  const [search, setSearch] = useState('');
  const [selectedBook, setSelectedBook] = useState<BookWithStock | null>(() => {
    if (initialBookId) {
      return books.find((b) => b.id === initialBookId) || null;
    }
    return null;
  });

  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<StockReason>('판매');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter books by search
  const filteredBooks = useMemo(() => {
    if (!search.trim()) {
      // If no search, show books with stock first
      return books
        .filter((b) => b.quantity > 0)
        .slice(0, 15);
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
    if (!selectedBook) return;
    const maxQty = Math.max(1, selectedBook.quantity);
    const clamped = Math.min(Math.max(1, val), maxQty);
    setQuantity(clamped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authStore.isAdmin) {
      feedback.playBeep('warning');
      alert('출고 처리는 관리자 모드에서만 가능합니다.');
      onClose();
      return;
    }
    if (!selectedBook) return;

    if (selectedBook.quantity <= 0) {
      feedback.playBeep('warning');
      return;
    }

    if (quantity > selectedBook.quantity) {
      feedback.playBeep('warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedNote = note.trim()
        ? `[${reason}] ${note.trim()}`
        : `대시보드 출고 (${reason} -${quantity}권)`;

      const res = await inventoryStore.adjustStock(
        selectedBook.id,
        -quantity,
        reason,
        formattedNote
      );

      if (res.success) {
        feedback.playBeep('success');
        onSuccess(
          `'${selectedBook.title}' ${quantity}권 출고 처리되었습니다. (잔여 재고: ${res.newQuantity}권)`
        );
        onClose();
      } else {
        feedback.playBeep('warning');
        alert(res.error || '출고 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasons: { id: StockReason; label: string; desc: string }[] = [
    { id: '판매', label: '판매', desc: '매장 및 온라인 도서 판매' },
    { id: '반품', label: '반품', desc: '출판사/공급처 반품' },
    { id: '파손', label: '파손/오염', desc: '도서 손상 및 폐기' },
    { id: '분실', label: '분실', desc: '매장 내 분실 확인' },
    { id: '증정', label: '증정/홍보', desc: '이벤트 및 증정용' },
    { id: '기타', label: '기타', desc: '기타 수량 차감' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-[#fbf9f4] w-full max-w-lg rounded-2xl border border-[#c3c7c7] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col font-['Public_Sans','Noto_Sans_KR',sans-serif]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#c3c7c7] bg-[#f5f3ee]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#ffdad6] text-[#ba1a1a] rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-lg font-bold text-[#171e1e]">
                출고 내용 입력
              </h3>
              <p className="text-xs text-[#737878]">
                도서 판매, 반품, 파손 등 재고 출고 기록
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#737878] hover:text-[#171e1e] hover:bg-[#e4e2dd] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedBook ? (
            /* 1단계: 출고할 도서 검색 및 선택 */
            <div className="space-y-3">
              <div className="flex items-center bg-white rounded-xl px-3 py-2 border border-[#c3c7c7] focus-within:border-[#ba1a1a] shadow-2xs">
                <Search className="w-4 h-4 text-[#737878] mr-2" />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="출고할 도서명, 저자, ISBN 검색..."
                  className="bg-transparent border-none outline-none w-full text-sm placeholder-[#737878]"
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

              <div className="text-xs font-bold text-[#434848] px-1">
                {search.trim() ? `검색 결과 (${filteredBooks.length})` : '재고 보유 도서 목록'}
              </div>

              <div className="divide-y divide-[#e4e2dd] max-h-[380px] overflow-y-auto pr-1">
                {filteredBooks.length === 0 ? (
                  <div className="py-12 text-center text-[#737878] text-sm">
                    {search.trim()
                      ? '검색된 도서가 없습니다.'
                      : '출고 가능한 재고 도서가 없습니다.'}
                  </div>
                ) : (
                  filteredBooks.map((book) => {
                    const isOutOfStock = book.quantity <= 0;
                    return (
                      <div
                        key={book.id}
                        onClick={() => !isOutOfStock && handleSelectBook(book)}
                        className={`py-2.5 px-3 rounded-xl flex items-center justify-between gap-3 transition-all ${
                          isOutOfStock
                            ? 'opacity-40 cursor-not-allowed bg-[#f0eee9]'
                            : 'hover:bg-[#ffdad6]/20 cursor-pointer active:scale-[0.99]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <BookCover src={book.coverImage} alt={book.title} size="sm" />
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm text-[#171e1e] truncate">
                              {book.title}
                            </h4>
                            <p className="text-xs text-[#737878] truncate">
                              {book.author} {book.publisher && `· ${book.publisher}`}
                            </p>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              isOutOfStock
                                ? 'bg-[#ffdad6] text-[#ba1a1a]'
                                : 'bg-[#e8f5e9] text-[#2e7d32]'
                            }`}
                          >
                            재고 {book.quantity}권
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* 2단계: 선택된 도서 출고 상세 입력 Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 선택된 도서 카드 */}
              <div className="bg-[#f0eee9] p-3 rounded-xl border border-[#c3c7c7] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <BookCover src={selectedBook.coverImage} alt={selectedBook.title} size="sm" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-[#ba1a1a] bg-[#ffdad6] px-1.5 py-0.5 rounded">
                      출고 대상
                    </span>
                    <h4 className="font-bold text-sm text-[#171e1e] truncate mt-0.5">
                      {selectedBook.title}
                    </h4>
                    <p className="text-xs text-[#737878] truncate">
                      {selectedBook.author} · 현재 재고:{' '}
                      <strong className="text-[#171e1e]">{selectedBook.quantity}권</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="text-xs text-[#434848] hover:text-[#171e1e] px-2.5 py-1 bg-white border border-[#c3c7c7] rounded-lg cursor-pointer flex-shrink-0 flex items-center gap-1 shadow-2xs"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>변경</span>
                </button>
              </div>

              {/* 출고 사유 선택 */}
              <div>
                <label className="block text-xs font-bold text-[#171e1e] mb-1.5">
                  출고 사유
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {reasons.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReason(r.id)}
                      className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                        reason === r.id
                          ? 'bg-[#ba1a1a] text-white border-[#ba1a1a] shadow-xs'
                          : 'bg-white text-[#434848] border-[#c3c7c7] hover:border-[#ba1a1a]'
                      }`}
                    >
                      <span>{r.label}</span>
                      <span className={`text-[10px] font-normal ${reason === r.id ? 'text-[#ffdad6]' : 'text-[#737878]'}`}>
                        {r.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 출고 수량 설정 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#171e1e]">
                    출고 수량 (최대 {selectedBook.quantity}권)
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, selectedBook.quantity].map((q) => {
                      if (q <= 0 || q > selectedBook.quantity) return null;
                      return (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuantity(q)}
                          className={`text-[11px] px-2 py-0.5 rounded-md border cursor-pointer font-semibold ${
                            quantity === q
                              ? 'bg-[#ba1a1a] text-white border-[#ba1a1a]'
                              : 'bg-white text-[#434848] border-[#c3c7c7] hover:bg-[#f0eee9]'
                          }`}
                        >
                          {q === selectedBook.quantity ? `전량(${q}권)` : `${q}권`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white rounded-xl border border-[#c3c7c7] p-1.5 focus-within:border-[#ba1a1a]">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1}
                    className="p-2 text-[#ba1a1a] hover:bg-[#ffdad6]/40 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={selectedBook.quantity}
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 1)}
                    className="flex-1 text-center font-bold text-lg text-[#171e1e] outline-none bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={quantity >= selectedBook.quantity}
                    className="p-2 text-[#ba1a1a] hover:bg-[#ffdad6]/40 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-right text-[11px] text-[#737878] mt-1">
                  출고 후 잔여 재고:{' '}
                  <strong className="text-[#171e1e]">
                    {selectedBook.quantity - quantity}권
                  </strong>
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
                  placeholder="예: 손님 현금 결제, 알라딘 중고 반품, 이벤트 증정 등"
                  className="w-full bg-white rounded-xl px-3 py-2 border border-[#c3c7c7] text-sm focus:border-[#ba1a1a] outline-none placeholder-[#737878]"
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
                  disabled={isSubmitting || selectedBook.quantity <= 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#ba1a1a] text-white hover:bg-[#93000a] transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>출고 완료 (-{quantity}권)</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
