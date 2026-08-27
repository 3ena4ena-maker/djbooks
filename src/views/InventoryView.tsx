import React, { useState, useEffect } from 'react';
import { BookWithStock, InventoryFilter, InventorySort, CustomerOrder, CustomerOrderStatus, ViewType } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { authStore } from '../services/authStore';
import { BookCover } from '../components/common/BookCover';
import { StockBadge } from '../components/common/StockBadge';
import { EditBookModal } from '../components/modals/EditBookModal';
import { CustomerOrderModal } from '../components/modals/CustomerOrderModal';
import {
  Search,
  Plus,
  ArrowUpDown,
  ChevronRight,
  Filter,
  PlusCircle,
  MinusCircle,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  AlertTriangle,
  X,
  FileEdit,
  ClipboardList,
  Library,
  Clock,
  Package,
  CheckCircle2,
  User,
  Phone,
  Edit2,
  Check,
  Sparkles
} from 'lucide-react';
import { feedback } from '../utils/feedback';

interface InventoryViewProps {
  onSelectBook: (bookId: string) => void;
  onOpenAddBook: () => void;
  initialFilter?: InventoryFilter;
  searchQuery?: string;
  onShowToast: (message: string) => void;
  initialTab?: 'books' | 'orders';
  onNavigate?: (view: ViewType) => void;
}

type MainTabType = 'books' | 'orders';
type OrderFilterType = 'all' | '주문접수' | '입고완료' | '수령완료' | '취소됨';

export const InventoryView: React.FC<InventoryViewProps> = ({
  onSelectBook,
  onOpenAddBook,
  initialFilter = 'all',
  searchQuery = '',
  onShowToast,
  initialTab = 'books',
  onNavigate,
}) => {
  const [, setTick] = useState(0);
  const [isAdmin, setIsAdmin] = useState(authStore.isAdmin);
  const [activeTab, setActiveTab] = useState<MainTabType>(initialTab);

  // Synchronize active tab with initialTab prop when URL/route changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Inventory state
  const [filter, setFilter] = useState<InventoryFilter>(initialFilter);
  const [sort, setSort] = useState<InventorySort>('updated');
  const [search, setSearch] = useState<string>(searchQuery);
  const [showSortDropdown, setShowSortDropdown] = useState<boolean>(false);
  const [bookToDelete, setBookToDelete] = useState<BookWithStock | null>(null);
  const [bookToEdit, setBookToEdit] = useState<BookWithStock | null>(null);

  // Customer Orders state
  const [orderFilter, setOrderFilter] = useState<OrderFilterType>('all');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<CustomerOrder | null>(null);

  useEffect(() => {
    const unsubStore = inventoryStore.subscribe(() => {
      setTick((t) => t + 1);
    });
    const unsubAuth = authStore.subscribe(() => {
      setIsAdmin(authStore.isAdmin);
    });
    return () => {
      unsubStore();
      unsubAuth();
    };
  }, []);

  const settings = inventoryStore.getSettings();
  const allBooks = inventoryStore.getBooksWithStock();
  const allOrders = inventoryStore.getCustomerOrders();

  // Books Count Statistics
  const totalBooksCount = allBooks.length;
  const inStockBooksCount = allBooks.filter((b) => b.quantity > 0).length;
  const outOfStockBooksCount = allBooks.filter((b) => b.quantity <= 0).length;

  // Orders Count Statistics
  const totalOrdersCount = allOrders.length;
  const receivedOrdersCount = allOrders.filter((o) => o.status === '주문접수').length;
  const arrivedOrdersCount = allOrders.filter((o) => o.status === '입고완료' || o.status === '수령대기').length;
  const completedOrdersCount = allOrders.filter((o) => o.status === '수령완료').length;
  const cancelledOrdersCount = allOrders.filter((o) => o.status === '취소됨').length;

  // Books Filter logic (재고 수량 > 0 -> 재고 있음 / 재고 수량 = 0 -> 품절)
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
      return book.quantity > 0;
    }
    if (filter === 'out_of_stock') {
      return book.quantity <= 0;
    }
    return true;
  });

  // Books Sort logic
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    if (sort === 'stock_asc') return a.quantity - b.quantity;
    if (sort === 'stock_desc') return b.quantity - a.quantity;
    if (sort === 'title') return a.title.localeCompare(b.title, 'ko');
    if (sort === 'price_desc') return b.price - a.price;
    // Default: 'updated'
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Orders Filter logic
  const filteredOrders = allOrders.filter((order) => {
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase().trim();
      const matchBook = order.bookTitle.toLowerCase().includes(q);
      const matchAuthor = (order.bookAuthor || '').toLowerCase().includes(q);
      const matchPub = (order.bookPublisher || '').toLowerCase().includes(q);
      const matchCustomer = order.customerName.toLowerCase().includes(q);
      const matchContact = (order.customerContact || '').toLowerCase().includes(q);
      const matchNote = (order.note || '').toLowerCase().includes(q);
      if (!matchBook && !matchAuthor && !matchPub && !matchCustomer && !matchContact && !matchNote) {
        return false;
      }
    }

    if (orderFilter === 'all') {
      return true;
    }
    if (orderFilter === '입고완료') {
      return order.status === '입고완료' || order.status === '수령대기';
    }
    return order.status === orderFilter;
  });

  // 상태별 표시 우선순위 정렬: 1. 진행중인 건(수령대기) -> 2. 주문접수 -> 3. 입고완료 -> 4. 수령완료 -> 5. 취소됨
  const getOrderStatusPriority = (status: CustomerOrderStatus | string): number => {
    switch (status) {
      case '진행중인 건':
      case '수령대기':
        return 1;
      case '주문접수':
        return 2;
      case '입고완료':
        return 3;
      case '수령완료':
        return 4;
      case '취소됨':
        return 5;
      default:
        return 2;
    }
  };

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const priorityA = getOrderStatusPriority(a.status);
    const priorityB = getOrderStatusPriority(b.status);
    return priorityA - priorityB;
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

  const handleQuickAdd = async (e: React.MouseEvent, book: BookWithStock) => {
    e.stopPropagation();
    const res = await inventoryStore.adjustStock(book.id, 1, '입고', '재고 목록 빠른 입고 (+1권)');
    if (res.success) {
      feedback.playBeep('success');
      onShowToast(`${book.title} +1권 입고 (현재: ${res.newQuantity}권)`);
    } else if (res.error) {
      feedback.playBeep('warning');
      onShowToast(res.error);
    }
  };

  const handleQuickMinus = async (e: React.MouseEvent, book: BookWithStock) => {
    e.stopPropagation();
    if (book.quantity <= 0) {
      onShowToast('현재 재고가 0권입니다.');
      feedback.playBeep('warning');
      return;
    }
    const res = await inventoryStore.adjustStock(book.id, -1, '판매', '재고 목록 빠른 판매 (-1권)');
    if (res.success) {
      feedback.playBeep('success');
      onShowToast(`${book.title} -1권 판매 (현재: ${res.newQuantity}권)`);
    } else if (res.error) {
      feedback.playBeep('warning');
      onShowToast(res.error);
    }
  };

  const handleOpenDeleteConfirm = (e: React.MouseEvent, book: BookWithStock) => {
    e.stopPropagation();
    setBookToDelete(book);
  };

  const handleConfirmDelete = () => {
    if (!bookToDelete) return;
    const title = bookToDelete.title;
    const ok = inventoryStore.deleteBook(bookToDelete.id);
    if (ok) {
      feedback.playBeep('warning');
      onShowToast(`도서 '${title}'(이)가 삭제되었습니다.`);
    } else {
      onShowToast('도서 삭제에 실패했습니다.');
    }
    setBookToDelete(null);
  };

  const handleQuickOrderStatusChange = async (e: React.MouseEvent, order: CustomerOrder, nextStatus: CustomerOrderStatus) => {
    e.stopPropagation();
    onShowToast(`'${order.customerName}'님의 주문 상태를 '${nextStatus}'(으)로 변경 중...`);
    const result = await inventoryStore.updateCustomerOrderStatus(order.id, nextStatus);
    if (result.success) {
      feedback.playBeep('success');
      onShowToast(`'${order.customerName}'님의 주문 상태가 '${nextStatus}'(으)로 저장되었습니다.`);
    } else {
      feedback.playBeep('warning');
      const errDetail = result.error?.message ? `: ${result.error.message}` : '';
      onShowToast(`'${order.customerName}'님의 주문 상태 변경 실패${errDetail}`);
    }
  };

  const handleConfirmDeleteOrder = () => {
    if (orderToDelete) {
      inventoryStore.deleteCustomerOrder(orderToDelete.id);
      feedback.playBeep('warning');
      onShowToast(`'${orderToDelete.customerName}'님의 도서 주문 내역이 삭제되었습니다.`);
      setOrderToDelete(null);
    }
  };

  const getOrderStatusBadge = (status: CustomerOrderStatus) => {
    switch (status) {
      case '주문접수':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#fff8e1] text-[#b78103] border border-[#ffe082] px-2.5 py-0.5 rounded-full whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#b78103] animate-pulse" />
            주문접수
          </span>
        );
      case '입고완료':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] px-2.5 py-0.5 rounded-full whitespace-nowrap">
            <Package className="w-3 h-3" />
            입고완료
          </span>
        );
      case '수령대기':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#e3f2fd] text-[#1565c0] border border-[#90caf9] px-2.5 py-0.5 rounded-full whitespace-nowrap">
            <Clock className="w-3 h-3" />
            수령대기
          </span>
        );
      case '수령완료':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#f0eee9] text-[#737878] border border-[#c3c7c7] px-2.5 py-0.5 rounded-full whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-[#3c4c20]" />
            수령완료
          </span>
        );
      case '취소됨':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#ffdad6] text-[#ba1a1a] border border-[#ffb4ab] px-2.5 py-0.5 rounded-full whitespace-nowrap">
            취소됨
          </span>
        );
    }
  };

  const totalStockCount = allBooks.reduce((acc, b) => acc + b.quantity, 0);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 select-none pb-12 font-['Public_Sans','Noto_Sans_KR',sans-serif]">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#171e1e] mb-1.5 tracking-tight">
            재고 및 주문 관리
          </h1>
          <p className="text-sm md:text-base text-[#434848]">
            서점 카탈로그 도서 재고와 손님 예약/주문 도서를 실시간으로 관리하세요.
          </p>
        </div>

        {/* Action Button depending on active tab */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            {activeTab === 'books' ? (
              <button
                onClick={onOpenAddBook}
                className="bg-[#171e1e] text-white text-xs md:text-sm font-semibold py-2.5 px-4 rounded-xl hover:bg-[#2c3333] transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>도서 등록</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setIsOrderModalOpen(true);
                }}
                className="bg-[#171e1e] text-white text-xs md:text-sm font-semibold py-2.5 px-4 rounded-xl hover:bg-[#2c3333] transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>손님 주문 접수</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Top Navigation Tabs: [ 📦 재고관리 ] vs [ 🛒 주문건 ] */}
      <div className="flex items-center gap-2 border-b border-[#c3c7c7]/60 pb-1">
        <button
          onClick={() => {
            setActiveTab('books');
            if (onNavigate) onNavigate('inventory');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'books'
              ? 'bg-[#171e1e] text-white shadow-xs'
              : 'text-[#434848] hover:text-[#171e1e] hover:bg-[#f0eee9]'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>재고관리</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('orders');
            if (onNavigate) onNavigate('orders');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer relative ${
            activeTab === 'orders'
              ? 'bg-[#171e1e] text-white shadow-xs'
              : 'text-[#434848] hover:text-[#171e1e] hover:bg-[#f0eee9]'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>주문건</span>
          {receivedOrdersCount + arrivedOrdersCount > 0 && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'orders' ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-[#171e1e] text-white'
              }`}
            >
              대기 {receivedOrdersCount + arrivedOrdersCount}건
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 📦 도서 재고 목록 (BOOKS INVENTORY) */}
      {/* ========================================================================= */}
      {activeTab === 'books' && (
        <div className="space-y-6">
          {/* Filter and Sort Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#f5f3ee] p-3 rounded-2xl border border-[#e9e2d1]">
            {/* Filter Chips: 전체 / 🟢 재고 있음 / 🔴 품절 */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: `전체 ${totalBooksCount}` },
                { id: 'in_stock', label: `🟢 재고 있음 ${inStockBooksCount}` },
                { id: 'out_of_stock', label: `🔴 품절 ${outOfStockBooksCount}` },
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
              {/* Search input */}
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
                  <div className="absolute right-0 mt-1.5 w-36 bg-white border border-[#c3c7c7] rounded-xl shadow-lg z-30 py-1 text-xs">
                    {(Object.keys(sortLabels) as InventorySort[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setSort(s);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-[#f5f3ee] transition-colors cursor-pointer ${
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

          {/* DESKTOP TABLE VIEW */}
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
                  {isAdmin && <th className="py-3.5 px-5 text-center w-28">빠른 변동 / 관리</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e2dd] text-sm">
                {sortedBooks.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-[#737878]">
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

                      {/* Quick delta buttons, Edit & Delete Button (관리자 전용) */}
                      {isAdmin && (
                        <td className="py-3.5 px-5 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              title="1권 판매"
                              onClick={(e) => handleQuickMinus(e, book)}
                              className="p-1.5 rounded-lg bg-[#f0eee9] hover:bg-[#ffdad6] text-[#ba1a1a] transition-colors cursor-pointer"
                            >
                              <MinusCircle className="w-4 h-4" />
                            </button>
                            <button
                              title="1권 입고"
                              onClick={(e) => handleQuickAdd(e, book)}
                              className="p-1.5 rounded-lg bg-[#f0eee9] hover:bg-[#d6eaaf] text-[#3c4c20] transition-colors cursor-pointer"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                            <button
                              title="도서 정보 및 표지 수정"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBookToEdit(book);
                              }}
                              className="p-1.5 rounded-lg bg-[#f0eee9] hover:bg-[#eae8e3] text-[#171e1e] transition-colors cursor-pointer"
                            >
                              <FileEdit className="w-4 h-4" />
                            </button>
                            <button
                              title="도서 삭제"
                              onClick={(e) => handleOpenDeleteConfirm(e, book)}
                              className="p-1.5 rounded-lg bg-[#f0eee9] hover:bg-[#ffdad6] text-[#ba1a1a] opacity-70 hover:opacity-100 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
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

                  {/* Mobile Quick +/- Bar & Delete Button (관리자 전용) */}
                  {isAdmin ? (
                    <div className="flex items-center justify-between pt-1 border-t border-[#f0eee9]" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] text-[#737878] font-mono">
                        ISBN {book.isbn}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleQuickMinus(e, book)}
                          className="px-2.5 py-1 bg-[#f5f3ee] text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          -1 판매
                        </button>
                        <button
                          onClick={(e) => handleQuickAdd(e, book)}
                          className="px-2.5 py-1 bg-[#f5f3ee] text-[#3c4c20] hover:bg-[#d6eaaf] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          +1 입고
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBookToEdit(book);
                          }}
                          title="도서 정보 및 표지 수정"
                          className="p-1.5 bg-[#f5f3ee] text-[#171e1e] hover:bg-[#eae8e3] rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenDeleteConfirm(e, book)}
                          title="도서 삭제"
                          className="p-1.5 bg-[#f5f3ee] text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1 border-t border-[#f0eee9]">
                      <span className="text-[11px] text-[#737878] font-mono">
                        ISBN {book.isbn}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between text-xs text-[#737878] pt-2 px-2">
            <span>총 {sortedBooks.length}종의 도서 표시 중</span>
            <span>독립서점 재고관리 시스템</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 🛒 손님 주문관리 (CUSTOMER ORDERS VIEW) */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Order Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#f5f3ee] p-3 rounded-2xl border border-[#e9e2d1]">
            {/* Filter Chips: 전체 / 🟠 주문접수 / 🔵 입고완료 / 🟢 수령완료 / ⚫ 취소 */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: `전체 ${totalOrdersCount}` },
                { id: '주문접수', label: `🟠 주문접수 ${receivedOrdersCount}` },
                { id: '입고완료', label: `🔵 입고완료 ${arrivedOrdersCount}` },
                { id: '수령완료', label: `🟢 수령완료 ${completedOrdersCount}` },
                { id: '취소됨', label: `⚫ 취소 ${cancelledOrdersCount}` },
              ].map((item) => {
                const isSelected = orderFilter === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setOrderFilter(item.id as OrderFilterType)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
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

            {/* Order Search input */}
            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#737878] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="도서명, 손님명, 연락처..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#c3c7c7] rounded-full text-xs placeholder-[#737878] focus:border-[#171e1e] outline-none"
              />
            </div>
          </div>

          {/* Desktop Table View for Orders */}
          <div className="hidden md:block bg-[#ffffff] rounded-2xl border border-[#c3c7c7] overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f3ee] border-b border-[#c3c7c7] text-xs font-bold uppercase tracking-wider text-[#434848]">
                  <th className="py-3.5 px-5">상태</th>
                  <th className="py-3.5 px-5">주문 도서 정보</th>
                  <th className="py-3.5 px-5">주문 손님 / 연락처</th>
                  <th className="py-3.5 px-5 text-center">수량 / 금액</th>
                  <th className="py-3.5 px-5">주문일 / 특이사항</th>
                  {isAdmin && <th className="py-3.5 px-5 text-center w-40">진행 상태 변경 / 관리</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e2dd] text-sm">
                {sortedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-[#737878]">
                      일치하는 손님 주문 도서가 없습니다.
                    </td>
                  </tr>
                ) : (
                  sortedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-[#f5f3ee] transition-colors group">
                      {/* Status */}
                      <td className="py-3.5 px-5 align-middle">
                        {getOrderStatusBadge(order.status)}
                      </td>

                      {/* Book Title & Author */}
                      <td className="py-3.5 px-5 align-middle">
                        <div className="font-bold text-[#171e1e] font-['Playfair_Display','Noto_Serif_KR',serif] text-base">
                          {order.bookTitle}
                        </div>
                        <div className="text-xs text-[#737878] mt-0.5">
                          {order.bookAuthor ? `${order.bookAuthor} 저` : ''}
                          {order.bookPublisher ? ` · ${order.bookPublisher}` : ''}
                        </div>
                      </td>

                      {/* Customer Name & Contact */}
                      <td className="py-3.5 px-5 align-middle">
                        <div className="flex items-center gap-1.5 font-bold text-[#171e1e]">
                          <User className="w-3.5 h-3.5 text-[#737878]" />
                          <span>{order.customerName} 손님</span>
                        </div>
                        {order.customerContact ? (
                          <div className="text-xs text-[#737878] flex items-center gap-1 font-mono mt-0.5">
                            <Phone className="w-3 h-3" />
                            {order.customerContact}
                          </div>
                        ) : null}
                      </td>

                      {/* Quantity & Price */}
                      <td className="py-3.5 px-5 align-middle text-center">
                        <div className="font-bold text-[#171e1e]">{order.quantity}권</div>
                        <div className="text-xs font-mono text-[#737878]">
                          {order.orderPrice ? `₩${order.orderPrice.toLocaleString()}` : '-'}
                        </div>
                        <div className="mt-0.5">
                          {order.depositPaid ? (
                            <span className="text-[10px] font-bold text-[#2e7d32] bg-[#e8f5e9] px-1.5 py-0.5 rounded">
                              선결제 완료
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#e65100] bg-[#fff3e0] px-1.5 py-0.5 rounded">
                              수령 시 결제
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date & Note */}
                      <td className="py-3.5 px-5 align-middle">
                        <div className="text-xs font-mono text-[#737878]">{order.orderDate}</div>
                        {order.note ? (
                          <div className="text-xs text-[#434848] mt-1 bg-[#f0eee9] px-2 py-1 rounded-lg max-w-xs truncate" title={order.note}>
                            메모: {order.note}
                          </div>
                        ) : null}
                      </td>

                      {/* Quick Status Action & Edit/Delete (관리자 전용) */}
                      {isAdmin && (
                        <td className="py-3.5 px-5 align-middle text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Next Stage Button */}
                            {order.status === '주문접수' && (
                              <button
                                onClick={(e) => handleQuickOrderStatusChange(e, order, '입고완료')}
                                className="px-2 py-1 bg-[#e8f5e9] border border-[#a5d6a7] text-[#2e7d32] rounded-lg text-xs font-bold hover:bg-[#c8e6c9] cursor-pointer"
                              >
                                📦 입고완료
                              </button>
                            )}
                            {order.status === '입고완료' && (
                              <button
                                onClick={(e) => handleQuickOrderStatusChange(e, order, '수령대기')}
                                className="px-2 py-1 bg-[#e3f2fd] border border-[#90caf9] text-[#1565c0] rounded-lg text-xs font-bold hover:bg-[#bbdefb] cursor-pointer"
                              >
                                🔔 수령대기
                              </button>
                            )}
                            {order.status === '수령대기' && (
                              <button
                                onClick={(e) => handleQuickOrderStatusChange(e, order, '수령완료')}
                                className="px-2 py-1 bg-[#171e1e] text-white rounded-lg text-xs font-bold hover:bg-[#2c3333] cursor-pointer flex items-center gap-0.5"
                              >
                                <Check className="w-3 h-3" />
                                수령완료
                              </button>
                            )}
                            {order.status === '수령완료' && (
                              <span className="text-xs text-[#737878] font-medium px-2 py-1">완료됨</span>
                            )}

                            {/* Edit / Delete */}
                            <button
                              onClick={() => {
                                setEditingOrder(order);
                                setIsOrderModalOpen(true);
                              }}
                              title="주문 정보 수정"
                              className="p-1.5 text-[#737878] hover:text-[#171e1e] hover:bg-[#eae8e3] rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setOrderToDelete(order)}
                              title="주문 삭제"
                              className="p-1.5 text-[#737878] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View for Orders */}
          <div className="md:hidden space-y-3">
            {sortedOrders.length === 0 ? (
              <div className="py-12 text-center text-[#737878] text-sm bg-white rounded-2xl border border-[#c3c7c7]">
                일치하는 손님 주문 도서가 없습니다.
              </div>
            ) : (
              sortedOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-4 border border-[#c3c7c7] shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getOrderStatusBadge(order.status)}
                      <span className="text-[11px] text-[#737878] font-mono">{order.orderDate}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingOrder(order);
                            setIsOrderModalOpen(true);
                          }}
                          className="p-1 text-[#737878] hover:text-[#171e1e] rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setOrderToDelete(order)}
                          className="p-1 text-[#737878] hover:text-[#ba1a1a] rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-base font-bold text-[#171e1e]">
                      {order.bookTitle}
                    </h3>
                    <p className="text-xs text-[#737878] mt-0.5">
                      {order.bookAuthor ? `${order.bookAuthor} · ` : ''}
                      {order.bookPublisher || ''}
                      <span className="ml-2 font-bold text-[#171e1e]">({order.quantity}권)</span>
                    </p>
                  </div>

                  <div className="bg-[#fbf9f4] p-2.5 rounded-xl text-xs space-y-1 border border-[#f0eee9]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#171e1e] flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-[#737878]" /> {order.customerName} 손님
                      </span>
                      <span className="font-mono text-[#737878]">{order.customerContact}</span>
                    </div>
                    {order.note && (
                      <p className="text-[11px] text-[#434848] pt-1 border-t border-[#e4e2dd]">
                        <span className="font-semibold text-[#737878]">메모: </span>{order.note}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#f0eee9]">
                    <div>
                      {order.depositPaid ? (
                        <span className="text-[11px] font-bold text-[#2e7d32] bg-[#e8f5e9] px-2 py-0.5 rounded-md">
                          선결제 완료
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-[#e65100] bg-[#fff3e0] px-2 py-0.5 rounded-md">
                          수령 시 결제
                        </span>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1.5">
                        {order.status !== '입고완료' && order.status !== '수령완료' && (
                          <button
                            onClick={(e) => handleQuickOrderStatusChange(e, order, '입고완료')}
                            className="px-2.5 py-1 bg-[#e8f5e9] border border-[#a5d6a7] text-[#2e7d32] rounded-lg text-xs font-bold"
                          >
                            📦 입고완료
                          </button>
                        )}
                        {order.status !== '수령대기' && order.status !== '수령완료' && (
                          <button
                            onClick={(e) => handleQuickOrderStatusChange(e, order, '수령대기')}
                            className="px-2.5 py-1 bg-[#e3f2fd] border border-[#90caf9] text-[#1565c0] rounded-lg text-xs font-bold"
                          >
                            🔔 수령대기
                          </button>
                        )}
                        {order.status !== '수령완료' && (
                          <button
                            onClick={(e) => handleQuickOrderStatusChange(e, order, '수령완료')}
                            className="px-2.5 py-1 bg-[#171e1e] text-white rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            수령완료
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Orders Count Footer */}
          <div className="flex items-center justify-between text-xs text-[#737878] pt-2 px-2">
            <span>총 {sortedOrders.length}건의 주문 내역 표시 중</span>
            <span>독립서점 주문 및 예약 관리</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* DELETE BOOK CONFIRMATION MODAL */}
      {bookToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
          onClick={() => setBookToDelete(null)}
        >
          <div
            className="bg-[#ffffff] rounded-2xl p-6 max-w-md w-full border border-[#c3c7c7] shadow-xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffdad6] flex items-center justify-center text-[#ba1a1a]">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-lg font-bold text-[#171e1e]">
                    도서 목록에서 삭제
                  </h3>
                  <p className="text-xs text-[#737878]">이 작업은 되돌릴 수 없습니다.</p>
                </div>
              </div>
              <button
                onClick={() => setBookToDelete(null)}
                className="text-[#737878] hover:text-[#171e1e] p-1 rounded-lg hover:bg-[#f5f3ee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-[#f5f3ee] rounded-xl border border-[#e9e2d1] flex items-center gap-3.5">
              <BookCover src={bookToDelete.coverImage} alt={bookToDelete.title} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[#171e1e] text-sm truncate">{bookToDelete.title}</div>
                <div className="text-xs text-[#737878] mt-0.5">{bookToDelete.author} · {bookToDelete.publisher}</div>
                <div className="text-xs text-[#ba1a1a] font-semibold mt-1">
                  현재 보유 재고: {bookToDelete.quantity}권
                </div>
              </div>
            </div>

            <p className="text-xs text-[#434848] leading-relaxed">
              도서를 삭제하면 서점 카탈로그 및 해당 도서의 모든 재고 내역이 데이터베이스에서 함께 삭제됩니다. 정말로 삭제하시겠습니까?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBookToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#434848] hover:bg-[#f5f3ee] border border-[#c3c7c7] cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#ba1a1a] hover:bg-[#93000a] flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>삭제 확인</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BOOK MODAL */}
      {bookToEdit && (
        <EditBookModal
          book={bookToEdit}
          onClose={() => setBookToEdit(null)}
          onSuccess={(_updated, msg) => {
            onShowToast(msg);
            setBookToEdit(null);
          }}
        />
      )}

      {/* CUSTOMER ORDER CREATE/EDIT MODAL */}
      {isOrderModalOpen && (
        <CustomerOrderModal
          order={editingOrder}
          onClose={() => {
            setIsOrderModalOpen(false);
            setEditingOrder(null);
          }}
          onSuccess={(msg) => {
            onShowToast(msg);
          }}
        />
      )}

      {/* DELETE ORDER CONFIRMATION MODAL */}
      {orderToDelete && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setOrderToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 border border-[#c3c7c7] shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-bold text-base text-[#171e1e]">주문 내역 삭제</h4>
              <p className="text-xs text-[#434848]">
                '{orderToDelete.customerName}'님의 '{orderToDelete.bookTitle}' 주문 내역을 삭제하시겠습니까?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-2.5 border border-[#c3c7c7] rounded-xl text-xs font-semibold text-[#434848] hover:bg-[#f5f3ee] cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDeleteOrder}
                className="flex-1 py-2.5 bg-[#ba1a1a] text-white rounded-xl text-xs font-semibold hover:bg-[#93000a] cursor-pointer shadow-xs"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

