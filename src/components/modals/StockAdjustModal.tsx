import React, { useState } from 'react';
import { BookWithStock, StockReason } from '../../types';
import { inventoryStore } from '../../services/inventoryStore';
import { feedback } from '../../utils/feedback';
import { X, Check, ArrowDown, ArrowUp, AlertCircle } from 'lucide-react';
import { BookCover } from '../common/BookCover';

interface StockAdjustModalProps {
  book: BookWithStock;
  initialMode?: 'adjust' | 'restock' | 'sell';
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  book,
  initialMode = 'adjust',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'adjust' | 'restock' | 'sell'>(initialMode);
  const [deltaAmount, setDeltaAmount] = useState<number>(1);
  const [targetQuantity, setTargetQuantity] = useState<number>(book.quantity);
  const [reason, setReason] = useState<StockReason>(
    initialMode === 'restock' ? '입고' : initialMode === 'sell' ? '판매' : '기타'
  );
  const [note, setNote] = useState<string>('');

  const reasons: { id: StockReason; label: string; icon: string }[] = [
    { id: '입고', label: '입고', icon: 'arrow_downward' },
    { id: '판매', label: '판매', icon: 'arrow_upward' },
    { id: '반품', label: '반품', icon: 'replay' },
    { id: '파손', label: '파손', icon: 'remove_circle_outline' },
    { id: '증정', label: '증정', icon: 'card_giftcard' },
    { id: '분실', label: '분실', icon: 'search_off' },
    { id: '기타', label: '기타 (직접 수정)', icon: 'edit' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'restock') {
      const res = await inventoryStore.adjustStock(
        book.id,
        Math.abs(deltaAmount),
        '입고',
        note || `도서 입고 (+${deltaAmount}권)`
      );
      if (res.success) {
        feedback.playBeep('success');
        onSuccess(`${book.title} +${deltaAmount}권 입고되었습니다. (현재 재고: ${res.newQuantity}권)`);
        onClose();
      }
    } else if (mode === 'sell') {
      const res = await inventoryStore.adjustStock(
        book.id,
        -Math.abs(deltaAmount),
        '판매',
        note || `도서 판매 (-${deltaAmount}권)`
      );
      if (res.success) {
        feedback.playBeep('success');
        onSuccess(`${book.title} ${deltaAmount}권 판매 처리되었습니다. (현재 재고: ${res.newQuantity}권)`);
        onClose();
      }
    } else {
      // Direct adjustment
      const res = await inventoryStore.setExactStock(
        book.id,
        targetQuantity,
        reason,
        note || `재고 수량 직접 조정 (${book.quantity}권 → ${targetQuantity}권)`
      );
      if (res.success) {
        feedback.playBeep('success');
        onSuccess(`${book.title} 재고가 ${targetQuantity}권으로 수정되었습니다.`);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-[#fbf9f4] w-full max-w-md rounded-2xl border border-[#c3c7c7] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#c3c7c7] bg-[#f5f3ee]">
          <div className="flex items-center gap-3">
            <BookCover src={book.coverImage} alt={book.title} size="sm" />
            <div>
              <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-base font-bold text-[#171e1e] line-clamp-1">
                {book.title}
              </h3>
              <p className="text-xs text-[#434848] font-['Public_Sans','Noto_Sans_KR',sans-serif]">
                현재 재고: <span className="font-bold text-[#171e1e]">{book.quantity}권</span>
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

        {/* Mode Selector */}
        <div className="grid grid-cols-3 p-2 bg-[#f0eee9] border-b border-[#c3c7c7] text-xs font-semibold font-['Public_Sans','Noto_Sans_KR',sans-serif]">
          <button
            type="button"
            onClick={() => {
              setMode('restock');
              setReason('입고');
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'restock'
                ? 'bg-[#d6eaaf] text-[#142000] shadow-xs'
                : 'text-[#434848] hover:bg-[#eae8e3]'
            }`}
          >
            + 입고 처리
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('sell');
              setReason('판매');
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'sell'
                ? 'bg-[#ffdad6] text-[#93000a] shadow-xs'
                : 'text-[#434848] hover:bg-[#eae8e3]'
            }`}
          >
            - 판매 처리
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('adjust');
              setReason('기타');
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'adjust'
                ? 'bg-[#171e1e] text-white shadow-xs'
                : 'text-[#434848] hover:bg-[#eae8e3]'
            }`}
          >
            재고 직접 조정
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 font-['Public_Sans','Noto_Sans_KR',sans-serif]">
          {mode === 'restock' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider">
                입고 수량 (+권)
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeltaAmount(Math.max(1, deltaAmount - 1))}
                  className="w-12 h-12 rounded-xl bg-[#f0eee9] border border-[#c3c7c7] text-xl font-bold hover:bg-[#e4e2dd] transition-colors cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={deltaAmount}
                  onChange={(e) => setDeltaAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 h-12 text-center text-xl font-bold bg-[#ffffff] border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDeltaAmount(deltaAmount + 1)}
                  className="w-12 h-12 rounded-xl bg-[#f0eee9] border border-[#c3c7c7] text-xl font-bold hover:bg-[#e4e2dd] transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
              {/* Quick Presets */}
              <div className="flex gap-2 mt-1">
                {[1, 5, 10, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setDeltaAmount(num)}
                    className="flex-1 py-1.5 text-xs bg-[#f5f3ee] border border-[#c3c7c7] rounded-lg hover:border-[#171e1e] cursor-pointer"
                  >
                    +{num}권
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'sell' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider">
                판매 수량 (-권)
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeltaAmount(Math.max(1, deltaAmount - 1))}
                  className="w-12 h-12 rounded-xl bg-[#f0eee9] border border-[#c3c7c7] text-xl font-bold hover:bg-[#e4e2dd] transition-colors cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max={book.quantity}
                  value={deltaAmount}
                  onChange={(e) => setDeltaAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 h-12 text-center text-xl font-bold bg-[#ffffff] border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDeltaAmount(deltaAmount + 1)}
                  className="w-12 h-12 rounded-xl bg-[#f0eee9] border border-[#c3c7c7] text-xl font-bold hover:bg-[#e4e2dd] transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setDeltaAmount(num)}
                    className="flex-1 py-1.5 text-xs bg-[#f5f3ee] border border-[#c3c7c7] rounded-lg hover:border-[#171e1e] cursor-pointer"
                  >
                    -{num}권
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'adjust' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1.5">
                  변경할 목표 재고 수량
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetQuantity(Math.max(0, targetQuantity - 1))}
                    className="w-12 h-12 rounded-xl bg-[#f0eee9] border border-[#c3c7c7] text-xl font-bold hover:bg-[#e4e2dd] transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 h-12 text-center text-xl font-bold bg-[#ffffff] border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTargetQuantity(targetQuantity + 1)}
                    className="w-12 h-12 rounded-xl bg-[#f0eee9] border border-[#c3c7c7] text-xl font-bold hover:bg-[#e4e2dd] transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Reason Selector */}
              <div>
                <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1.5">
                  변동 사유
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {reasons.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReason(r.id)}
                      className={`py-2 px-1 rounded-lg text-xs font-medium text-center border transition-colors cursor-pointer ${
                        reason === r.id
                          ? 'bg-[#171e1e] text-white border-[#171e1e]'
                          : 'bg-[#ffffff] text-[#434848] border-[#c3c7c7] hover:bg-[#f5f3ee]'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Note Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#434848] uppercase tracking-wider">
              메모 / 사유 상세 (선택)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 정기 배송분 입고, 매장 결제 #8492, 침수 파손 등"
              className="px-3 py-2.5 bg-[#ffffff] border border-[#c3c7c7] rounded-xl text-sm focus:border-[#171e1e] outline-none placeholder-[#737878]"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-[#c3c7c7] rounded-xl text-sm font-semibold text-[#434848] hover:bg-[#eae8e3] transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#171e1e] text-white rounded-xl text-sm font-semibold hover:bg-[#2c3333] transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>확인 및 저장</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
