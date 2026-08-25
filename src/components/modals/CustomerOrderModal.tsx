import React, { useState, useEffect } from 'react';
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
  AlertCircle
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

  // Quick book autocomplete search
  const [searchQuery, setSearchQuery] = useState('');
  const [matchingBooks, setMatchingBooks] = useState<ReturnType<typeof inventoryStore.getBooksWithStock>>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length >= 1) {
      const q = searchQuery.toLowerCase();
      const results = inventoryStore.getBooksWithStock().filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.publisher && b.publisher.toLowerCase().includes(q))
      );
      setMatchingBooks(results.slice(0, 5));
      setShowDropdown(true);
    } else {
      setMatchingBooks([]);
      setShowDropdown(false);
    }
  }, [searchQuery]);

  const handleSelectBook = (b: ReturnType<typeof inventoryStore.getBooksWithStock>[0]) => {
    setBookTitle(b.title);
    setBookAuthor(b.author);
    setBookPublisher(b.publisher || '');
    if (b.price) {
      setOrderPrice(b.price * quantity);
    }
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle.trim() || !customerName.trim()) {
      return;
    }

    if (isEditing && order) {
      inventoryStore.updateCustomerOrder(order.id, {
        bookTitle: bookTitle.trim(),
        bookAuthor: bookAuthor.trim(),
        bookPublisher: bookPublisher.trim(),
        quantity: Math.max(1, quantity),
        customerName: customerName.trim(),
        customerContact: customerContact.trim(),
        depositPaid,
        orderPrice: orderPrice === '' ? 0 : Number(orderPrice),
        status,
        note: note.trim(),
        orderDate,
      });
      feedback.playBeep('success');
      onSuccess(`'${customerName}'님의 '${bookTitle}' 주문 정보가 수정되었습니다.`);
    } else {
      inventoryStore.addCustomerOrder({
        bookTitle: bookTitle.trim(),
        bookAuthor: bookAuthor.trim(),
        bookPublisher: bookPublisher.trim(),
        quantity: Math.max(1, quantity),
        customerName: customerName.trim(),
        customerContact: customerContact.trim(),
        depositPaid,
        orderPrice: orderPrice === '' ? 0 : Number(orderPrice),
        status,
        note: note.trim(),
        orderDate,
      });
      feedback.playBeep('success');
      onSuccess(`'${customerName}'님의 새 도서 주문이 등록되었습니다.`);
    }

    onClose();
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
          {/* Search existing inventory */}
          {!isEditing && (
            <div className="relative">
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                기존 등록 도서에서 찾기 (선택)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#737878] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="도서명 또는 저자명을 검색하여 자동 입력"
                  className="w-full pl-9 pr-3 py-2 bg-[#fbf9f4] border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && matchingBooks.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#c3c7c7] rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-[#f0eee9]">
                  {matchingBooks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectBook(b)}
                      className="w-full p-2.5 text-left hover:bg-[#f5f3ee] flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-[#171e1e] block truncate">{b.title}</span>
                        <span className="text-[11px] text-[#737878]">{b.author} · {b.publisher || '독립출판'}</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#3c4c20] bg-[#f0eee9] px-2 py-0.5 rounded-full">
                        재고 {b.quantity}권
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Book Info */}
          <div className="space-y-3 p-3.5 bg-[#fbf9f4] rounded-2xl border border-[#c3c7c7]">
            <span className="text-xs font-bold text-[#171e1e] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#737878]" />
              도서 정보
            </span>

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
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
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
