import React, { useState } from 'react';
import { inventoryStore } from '../../services/inventoryStore';
import { feedback } from '../../utils/feedback';
import { X, Search, Plus, Check } from 'lucide-react';
import { BookCover } from '../common/BookCover';
import { StockBadge } from '../common/StockBadge';

interface QuickRestockModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const QuickRestockModal: React.FC<QuickRestockModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [search, setSearch] = useState('');
  const books = inventoryStore.getBooksWithStock();

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      b.isbn.includes(search)
  );

  const handleQuickAdd = (bookId: string, bookTitle: string, amount: number) => {
    const res = inventoryStore.adjustStock(
      bookId,
      amount,
      '입고',
      `빠른 입고 (+${amount}권)`
    );
    if (res.success) {
      feedback.playBeep('success');
      onSuccess(`${bookTitle} +${amount}권 입고되었습니다. (현재 재고: ${res.newQuantity}권)`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-[#fbf9f4] w-full max-w-lg rounded-2xl border border-[#c3c7c7] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#c3c7c7] bg-[#f5f3ee]">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#171e1e]" />
            <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-lg font-bold text-[#171e1e]">
              빠른 도서 입고
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#737878] hover:text-[#171e1e] hover:bg-[#e4e2dd] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 bg-[#f0eee9] border-b border-[#c3c7c7]">
          <div className="flex items-center bg-white rounded-xl px-3 py-2 border border-[#c3c7c7] focus-within:border-[#171e1e]">
            <Search className="w-4 h-4 text-[#737878] mr-2" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="도서명, 저자, ISBN 검색..."
              className="bg-transparent border-none outline-none w-full text-sm placeholder-[#737878]"
            />
          </div>
        </div>

        {/* Book List */}
        <div className="p-4 overflow-y-auto flex-1 divide-y divide-[#e4e2dd] space-y-2">
          {filteredBooks.length === 0 ? (
            <div className="py-12 text-center text-[#737878] text-sm">
              검색된 도서가 없습니다.
            </div>
          ) : (
            filteredBooks.map((book) => (
              <div
                key={book.id}
                className="pt-2 pb-2 flex items-center justify-between gap-3 group hover:bg-[#f5f3ee] px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BookCover src={book.coverImage} alt={book.title} size="sm" />
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm text-[#1b1c19] truncate">
                      {book.title}
                    </h4>
                    <p className="text-xs text-[#737878] truncate">
                      {book.author} · 현재 재고: <span className="font-bold text-[#171e1e]">{book.quantity}권</span>
                    </p>
                  </div>
                </div>

                {/* Quick Add Buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleQuickAdd(book.id, book.title, 1)}
                    className="px-2.5 py-1.5 bg-[#ffffff] border border-[#c3c7c7] hover:border-[#171e1e] hover:bg-[#d6eaaf] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => handleQuickAdd(book.id, book.title, 5)}
                    className="px-2.5 py-1.5 bg-[#ffffff] border border-[#c3c7c7] hover:border-[#171e1e] hover:bg-[#d6eaaf] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    +5
                  </button>
                  <button
                    onClick={() => handleQuickAdd(book.id, book.title, 10)}
                    className="px-2.5 py-1.5 bg-[#171e1e] text-white hover:bg-[#2c3333] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    +10
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#c3c7c7] bg-[#f5f3ee] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#ffffff] border border-[#c3c7c7] rounded-xl text-xs font-semibold text-[#434848] hover:bg-[#eae8e3] cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
