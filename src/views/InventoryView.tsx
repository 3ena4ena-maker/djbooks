import React, { useState } from 'react';
import { BookWithStock, InventoryFilter, InventorySort } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { BookCover } from '../components/common/BookCover';
import { StockBadge } from '../components/common/StockBadge';
import {
  Search,
  Plus,
  ArrowUpDown,
  ChevronRight,
  Filter,
  PlusCircle,
  MinusCircle,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { feedback } from '../utils/feedback';

interface InventoryViewProps {
  onSelectBook: (bookId: string) => void;
  onOpenAddBook: () => void;
  initialFilter?: InventoryFilter;
  searchQuery?: string;
  onShowToast: (message: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  onSelectBook,
  onOpenAddBook,
  initialFilter = 'all',
  searchQuery = '',
  onShowToast,
}) => {
  const [filter, setFilter] = useState<InventoryFilter>(initialFilter);
  const [sort, setSort] = useState<InventorySort>('updated');
  const [search, setSearch] = useState<string>(searchQuery);
  const [showSortDropdown, setShowSortDropdown] = useState<boolean>(false);

  const settings = inventoryStore.getSettings();
  const allBooks = inventoryStore.getBooksWithStock();

  // Filter logic
  const filteredBooks = allBooks.filter((book) => {
    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchTitle = book.title.toLowerCase().includes(q);
      const matchAuthor = book.author.toLowerCase().includes(q);
      const matchIsbn = book.isbn.toLowerCase().includes(q);
      const matchPublisher = book.publisher.toLowerCase().includes(q);
      if (!matchTitle && !matchAuthor && !matchIsbn && !matchPublisher) {
        return false;
      }
    }

    // Status filter
    if (filter === 'in_stock') {
      return book.quantity > settings.lowStockThreshold;
    }
    if (filter === 'low_stock') {
      return book.quantity > 0 && book.quantity <= settings.lowStockThreshold;
    }
    if (filter === 'out_of_stock') {
      return book.quantity <= 0;
    }
    return true;
  });

  // Sort logic
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    if (sort === 'stock_asc') return a.quantity - b.quantity;
    if (sort === 'stock_desc') return b.quantity - a.quantity;
    if (sort === 'title') return a.title.localeCompare(b.title, 'ko');
    if (sort === 'price_desc') return b.price - a.price;
    // Default: 'updated'
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const sortLabels: Record<InventorySort, string> = {
    updated: '최근 수정순',
    stock_asc: '재고 적은순',
    stock_desc: '재고 많은순',
    title: '제목순',
    price_desc: '가격 높은순',
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}.${month}.${day}.`;
    } catch {
      return '2026.08.24.';
    }
  };

  const handleQuickAdd = (e: React.MouseEvent, book: BookWithStock) => {
    e.stopPropagation();
    const res = inventoryStore.adjustStock(book.id, 1, '입고', '재고 목록 빠른 입고 (+1권)');
    if (res.success) {
      feedback.playBeep('success');
      onShowToast(`${book.title} +1권 입고 (현재: ${res.newQuantity}권)`);
    }
  };

  const handleQuickMinus = (e: React.MouseEvent, book: BookWithStock) => {
    e.stopPropagation();
    if (book.quantity <= 0) {
      onShowToast('현재 재고가 0권입니다.');
      feedback.playBeep('warning');
      return;
    }
    const res = inventoryStore.adjustStock(book.id, -1, '판매', '재고 목록 빠른 판매 (-1권)');
    if (res.success) {
      feedback.playBeep('success');
      onShowToast(`${book.title} -1권 판매 (현재: ${res.newQuantity}권)`);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 select-none pb-12">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#171e1e] mb-1.5 tracking-tight">
            재고 관리
          </h1>
          <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm md:text-base text-[#434848]">
            카탈로그, 재고, 가격을 관리하세요.
          </p>
        </div>

        {/* Action Button: Add Book */}
        <button
          onClick={onOpenAddBook}
          className="self-start md:self-auto bg-[#171e1e] text-white font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs md:text-sm font-semibold py-2.5 px-4 rounded-xl hover:bg-[#2c3333] transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>도서 등록</span>
        </button>
      </div>

      {/* Filter and Sort Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#f5f3ee] p-3 rounded-2xl border border-[#e9e2d1]">
        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: '전체' },
            { id: 'in_stock', label: '재고 있음' },
            { id: 'low_stock', label: '재고 부족' },
            { id: 'out_of_stock', label: '품절' },
          ].map((item) => {
            const isSelected = filter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setFilter(item.id as InventoryFilter)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#171e1e] text-white shadow-xs'
                    : 'bg-[#ffffff] text-[#434848] border border-[#c3c7c7] hover:bg-[#eae8e3]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Search & Sort on right */}
        <div className="flex items-center gap-2">
          {/* Mobile Search input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#737878] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="도서명, 저자, ISBN..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#c3c7c7] rounded-full text-xs placeholder-[#737878] focus:border-[#171e1e] outline-none"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#c3c7c7] rounded-full text-xs font-semibold text-[#171e1e] hover:bg-[#f0eee9] transition-colors cursor-pointer"
            >
              <span className="text-[#737878]">정렬</span>
              <span>{sortLabels[sort]}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#737878]" />
            </button>

            {showSortDropdown && (
              <div className="absolute right-0 mt-1.5 w-36 bg-white border border-[#c3c7c7] rounded-xl shadow-lg z-30 py-1 font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs">
                {(Object.keys(sortLabels) as InventorySort[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSort(s);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-[#f5f3ee] transition-colors ${
                      sort === s ? 'font-bold text-[#171e1e] bg-[#f0eee9]' : 'text-[#434848]'
                    }`}
                  >
                    {sortLabels[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW (Matching Stitch Image 7) */}
      <div className="hidden md:block bg-[#ffffff] rounded-2xl border border-[#c3c7c7] overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse font-['Public_Sans','Noto_Sans_KR',sans-serif]">
          <thead>
            <tr className="bg-[#f5f3ee] border-b border-[#c3c7c7] text-xs font-bold uppercase tracking-wider text-[#434848]">
              <th className="py-3.5 px-5 w-16">표지</th>
              <th className="py-3.5 px-5">도서명 및 저자</th>
              <th className="py-3.5 px-5">ISBN / 출판사</th>
              <th className="py-3.5 px-5">현재 재고</th>
              <th className="py-3.5 px-5 text-right">판매가</th>
              <th className="py-3.5 px-5 text-right">최근 수정일</th>
              <th className="py-3.5 px-5 text-center w-24">빠른 변동</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e4e2dd] text-sm">
            {sortedBooks.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#737878]">
                  일치하는 도서가 없습니다.
                </td>
              </tr>
            ) : (
              sortedBooks.map((book) => (
                <tr
                  key={book.id}
                  onClick={() => onSelectBook(book.id)}
                  className="hover:bg-[#f5f3ee] transition-colors cursor-pointer group"
                >
                  {/* Cover */}
                  <td className="py-3.5 px-5 align-middle">
                    <BookCover src={book.coverImage} alt={book.title} size="sm" />
                  </td>

                  {/* Title & Author */}
                  <td className="py-3.5 px-5 align-middle">
                    <div className="font-bold text-[#171e1e] group-hover:underline">
                      {book.title}
                    </div>
                    <div className="text-xs text-[#737878] mt-0.5">{book.author}</div>
                  </td>

                  {/* ISBN / Publisher */}
                  <td className="py-3.5 px-5 align-middle">
                    <div className="font-mono text-xs text-[#171e1e]">{book.isbn}</div>
                    <div className="text-xs text-[#737878] mt-0.5">{book.publisher}</div>
                  </td>

                  {/* Stock & Badge */}
                  <td className="py-3.5 px-5 align-middle">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-base w-6 text-[#171e1e]">
                        {book.quantity}
                      </span>
                      <StockBadge quantity={book.quantity} />
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-3.5 px-5 align-middle text-right font-mono font-semibold text-[#171e1e]">
                    ₩{book.price.toLocaleString('ko-KR')}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-5 align-middle text-right text-xs text-[#737878] font-mono">
                    {formatDate(book.updatedAt)}
                  </td>

                  {/* Quick delta buttons */}
                  <td className="py-3.5 px-5 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        title="1권 판매"
                        onClick={(e) => handleQuickMinus(e, book)}
                        className="p-1 rounded-md bg-[#f0eee9] hover:bg-[#ffdad6] text-[#ba1a1a] transition-colors cursor-pointer"
                      >
                        <MinusCircle className="w-4 h-4" />
                      </button>
                      <button
                        title="1권 입고"
                        onClick={(e) => handleQuickAdd(e, book)}
                        className="p-1 rounded-md bg-[#f0eee9] hover:bg-[#d6eaaf] text-[#3c4c20] transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD LIST VIEW */}
      <div className="md:hidden space-y-3">
        {sortedBooks.length === 0 ? (
          <div className="py-12 text-center text-[#737878] text-sm bg-white rounded-2xl border border-[#c3c7c7]">
            일치하는 도서가 없습니다.
          </div>
        ) : (
          sortedBooks.map((book) => (
            <div
              key={book.id}
              onClick={() => onSelectBook(book.id)}
              className="bg-white rounded-2xl p-4 border border-[#e9e2d1] hover:border-[#171e1e] transition-all shadow-xs flex flex-col gap-3 cursor-pointer"
            >
              <div className="flex items-start gap-3.5">
                <BookCover src={book.coverImage} alt={book.title} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-[#171e1e] text-sm line-clamp-1">
                      {book.title}
                    </h3>
                    <StockBadge quantity={book.quantity} />
                  </div>
                  <p className="text-xs text-[#737878] mt-0.5">{book.author} · {book.publisher}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#f0eee9]">
                    <span className="font-mono text-xs text-[#737878]">
                      재고 <strong className="text-sm text-[#171e1e]">{book.quantity}권</strong>
                    </span>
                    <span className="font-mono font-bold text-sm text-[#171e1e]">
                      ₩{book.price.toLocaleString('ko-KR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile Quick +/- Bar */}
              <div className="flex items-center justify-between pt-1 border-t border-[#f0eee9]" onClick={(e) => e.stopPropagation()}>
                <span className="text-[11px] text-[#737878] font-mono">
                  ISBN {book.isbn}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleQuickMinus(e, book)}
                    className="px-2.5 py-1 bg-[#f5f3ee] text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    -1 판매
                  </button>
                  <button
                    onClick={(e) => handleQuickAdd(e, book)}
                    className="px-2.5 py-1 bg-[#f5f3ee] text-[#3c4c20] hover:bg-[#d6eaaf] rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    +1 입고
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs text-[#737878] pt-2 px-2 font-['Public_Sans','Noto_Sans_KR',sans-serif]">
        <span>총 {sortedBooks.length}권의 도서 표시 중</span>
        <span>독립서점 재고관리 시스템</span>
      </div>
    </div>
  );
};
