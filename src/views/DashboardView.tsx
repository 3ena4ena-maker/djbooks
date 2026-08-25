import React, { useState, useEffect } from 'react';
import { ViewType, BookWithStock, CustomerOrder, CustomerOrderStatus } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { BookCover } from '../components/common/BookCover';
import { StockBadge } from '../components/common/StockBadge';
import { CustomerOrderModal } from '../components/modals/CustomerOrderModal';
import { feedback } from '../utils/feedback';
import {
  ScanLine,
  PlusCircle,
  TrendingUp,
  Package,
  AlertTriangle,
  Library,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  ClipboardList,
  User,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  BookOpen,
  Filter,
  Check
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: ViewType) => void;
  onSelectBook: (bookId: string) => void;
  onOpenAddBook: () => void;
  onOpenQuickRestock: () => void;
  onFilterLowStock: () => void;
  onShowToast?: (message: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectBook,
  onOpenAddBook,
  onOpenQuickRestock,
  onFilterLowStock,
  onShowToast,
}) => {
  const [, setTick] = useState(0);
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'arrived' | 'completed'>('pending');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<CustomerOrder | null>(null);

  useEffect(() => {
    const unsubscribe = inventoryStore.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const settings = inventoryStore.getSettings();
  const stats = inventoryStore.getWeeklyStats();
  const orderStats = inventoryStore.getCustomerOrderStats();
  const allOrders = inventoryStore.getCustomerOrders();
  const lowStockBooks = inventoryStore.getLowStockBooks().slice(0, 4);
  const recentLogs = inventoryStore.getLogs().slice(0, 5);

  const filteredOrders = allOrders.filter((order) => {
    if (orderFilter === 'pending') {
      return order.status === '주문접수' || order.status === '입고완료' || order.status === '수령대기';
    }
    if (orderFilter === 'arrived') {
      return order.status === '입고완료' || order.status === '수령대기';
    }
    if (orderFilter === 'completed') {
      return order.status === '수령완료' || order.status === '취소됨';
    }
    return true; // 'all'
  });

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = new Date();
      const date = new Date(isoString);
      const diffMin = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

      if (diffMin < 1) return '방금 전';
      if (diffMin < 60) return `${diffMin}분 전`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return `어제, ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
      return `${date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`;
    } catch {
      return isoString;
    }
  };

  const handleQuickStatusChange = (e: React.MouseEvent, order: CustomerOrder, nextStatus: CustomerOrderStatus) => {
    e.stopPropagation();
    inventoryStore.updateCustomerOrderStatus(order.id, nextStatus);
    feedback.playBeep('success');
    if (onShowToast) {
      onShowToast(`'${order.customerName}'님의 주문 상태가 '${nextStatus}'(으)로 변경되었습니다.`);
    }
  };

  const handleDeleteOrder = () => {
    if (orderToDelete) {
      inventoryStore.deleteCustomerOrder(orderToDelete.id);
      feedback.playBeep('warning');
      if (onShowToast) {
        onShowToast(`'${orderToDelete.customerName}'님의 도서 주문 내역이 삭제되었습니다.`);
      }
      setOrderToDelete(null);
    }
  };

  const getStatusBadge = (status: CustomerOrderStatus) => {
    switch (status) {
      case '주문접수':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#fff8e1] text-[#b78103] border border-[#ffe082] px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#b78103] animate-pulse" />
            주문접수
          </span>
        );
      case '입고완료':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] px-2.5 py-0.5 rounded-full">
            <Package className="w-3 h-3" />
            입고완료
          </span>
        );
      case '수령대기':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#e3f2fd] text-[#1565c0] border border-[#90caf9] px-2.5 py-0.5 rounded-full">
            <Clock className="w-3 h-3" />
            수령대기
          </span>
        );
      case '수령완료':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#f0eee9] text-[#737878] border border-[#c3c7c7] px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-[#3c4c20]" />
            수령완료
          </span>
        );
      case '취소됨':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#ffdad6] text-[#ba1a1a] border border-[#ffb4ab] px-2.5 py-0.5 rounded-full">
            취소됨
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 select-none font-['Public_Sans','Noto_Sans_KR',sans-serif]">
      {/* Title & Atmosphere Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-[#434848] bg-[#f0eee9] px-2.5 py-1 rounded-full border border-[#c3c7c7]">
            📍 {settings.branchName || '본점'}
          </span>
          <span className="text-xs text-[#737878]">독립서점 재고 및 손님 주문 관리 시스템</span>
        </div>
        <h2 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#171e1e] mb-2 tracking-tight">
          {settings.storeName ? `${settings.storeName} 대시보드` : '독자서점 대시보드'}
        </h2>
        <p className="text-base text-[#434848]">
          {settings.storeName || '독자서점'}의 실시간 재고 현황, 손님 주문 목록 및 입출고 흐름을 확인해보세요.
        </p>
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: 전체 재고 */}
        <div
          onClick={() => onNavigate('inventory')}
          className="bg-[#f5f3ee] rounded-2xl p-5 md:p-6 border border-[#e9e2d1] hover:border-[#171e1e] transition-all flex flex-col justify-between cursor-pointer group shadow-xs"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#434848] mb-3 flex items-center gap-1.5">
            <Library className="w-4 h-4 text-[#737878] group-hover:text-[#171e1e] transition-colors" />
            전체 재고
          </span>
          <div className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#171e1e]">
            {stats.totalStock}
            <span className="text-base font-normal font-['Public_Sans','Noto_Sans_KR',sans-serif] ml-1">권</span>
          </div>
        </div>

        {/* Stat 2: 손님 주문 / 예약 */}
        <div
          onClick={() => {
            const el = document.getElementById('customer-orders-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-[#f5f3ee] rounded-2xl p-5 md:p-6 border border-[#e9e2d1] border-t-4 border-t-[#171e1e] hover:border-[#171e1e] transition-all flex flex-col justify-between cursor-pointer group shadow-xs"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#434848] mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-[#171e1e]" />
              주문받은 책
            </span>
            {orderStats.pending > 0 && (
              <span className="text-[10px] bg-[#171e1e] text-white px-2 py-0.5 rounded-full font-bold">
                진행 {orderStats.pending}
              </span>
            )}
          </span>
          <div className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#171e1e]">
            {orderStats.pending}
            <span className="text-base font-normal font-['Public_Sans','Noto_Sans_KR',sans-serif] ml-1">건 대기</span>
          </div>
        </div>

        {/* Stat 3: 재고 부족 */}
        <div
          onClick={onFilterLowStock}
          className="bg-[#f5f3ee] rounded-2xl p-5 md:p-6 border border-[#e9e2d1] hover:border-[#ba1a1a] transition-all flex flex-col justify-between cursor-pointer group shadow-xs"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#434848] mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
            재고 부족
          </span>
          <div className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#ba1a1a]">
            {stats.lowStockCount}
            <span className="text-base font-normal font-['Public_Sans','Noto_Sans_KR',sans-serif] ml-1">종</span>
          </div>
        </div>

        {/* Stat 4: 이번주 입출고 변동 (가시성 대폭 강화) */}
        <div
          onClick={() => onNavigate('history')}
          className="bg-[#f5f3ee] rounded-2xl p-4 md:p-5 border border-[#e9e2d1] hover:border-[#171e1e] transition-all flex flex-col justify-between shadow-xs cursor-pointer group"
          title="클릭하여 전체 입출고 내역 보기"
        >
          <div className="mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#434848] flex items-center gap-1.5 whitespace-nowrap">
              <TrendingUp className="w-4 h-4 text-[#171e1e]" />
              이번주 변동
            </span>
          </div>

          {/* 입고 / 판매 분리 가시성 강화 카드 */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            {/* 입고 블록 */}
            <div className="bg-white rounded-xl p-2.5 border border-[#c8e6c9] flex flex-col justify-between min-w-0">
              <span className="text-xs font-bold text-[#2e7d32] whitespace-nowrap flex items-center gap-1">
                <Package className="w-3.5 h-3.5 flex-shrink-0" />
                입고
              </span>
              <div className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl sm:text-2xl font-bold text-[#2e7d32] mt-0.5 whitespace-nowrap">
                {stats.weeklyRestock}
                <span className="text-xs font-normal font-['Public_Sans','Noto_Sans_KR',sans-serif] ml-0.5 text-[#2e7d32]/80">권</span>
              </div>
            </div>

            {/* 판매 블록 (재고 도서 판매 + 손님 주문 도서 판매 통합) */}
            <div className="bg-white rounded-xl p-2.5 border border-[#ffcdd2] flex flex-col justify-between min-w-0">
              <span className="text-xs font-bold text-[#c62828] whitespace-nowrap flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 flex-shrink-0" />
                판매
              </span>
              <div className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl sm:text-2xl font-bold text-[#c62828] mt-0.5 whitespace-nowrap">
                {stats.weeklySales}
                <span className="text-xs font-normal font-['Public_Sans','Noto_Sans_KR',sans-serif] ml-0.5 text-[#c62828]/80">권</span>
              </div>
              {stats.orderSales > 0 && (
                <div
                  className="text-[10px] font-medium text-[#c62828]/90 font-['Public_Sans','Noto_Sans_KR',sans-serif] mt-0.5 whitespace-nowrap truncate"
                  title={`손님 주문 수령/판매 ${stats.orderSales}권 포함`}
                >
                  (주문 {stats.orderSales}권 포함)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Quick Actions & Order Management & History, Right Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (8 cols on desktop) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Quick Actions */}
          <div className="space-y-4">
            <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e] border-b border-[#c3c7c7]/60 pb-2">
              빠른 작업
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Scan Action */}
              <button
                onClick={() => onNavigate('scanner')}
                className="bg-[#1b1c19] text-[#ffffff] rounded-2xl p-5 flex flex-col items-center justify-center gap-2.5 hover:bg-[#2c3333] transition-all group shadow-md active:scale-[0.98] cursor-pointer text-center"
              >
                <div className="p-2.5 bg-white/10 rounded-full group-hover:scale-110 transition-transform">
                  <ScanLine className="w-6 h-6 text-[#d6eaaf]" />
                </div>
                <span className="font-['Playfair_Display','Noto_Serif_KR',serif] text-base font-bold tracking-wide">
                  📷 책 스캔하기
                </span>
                <span className="text-[11px] text-white/70">
                  바코드로 조회/입고
                </span>
              </button>

              {/* Add Book */}
              <button
                onClick={onOpenAddBook}
                className="bg-[#f0eee9] rounded-2xl p-5 flex flex-col items-center justify-center gap-2 border border-[#e9e2d1] hover:bg-[#eae8e3] hover:border-[#171e1e] transition-all cursor-pointer shadow-xs active:scale-95 text-center"
              >
                <div className="bg-[#ffffff] rounded-full p-2.5 shadow-xs border border-[#c3c7c7]">
                  <PlusCircle className="w-5 h-5 text-[#171e1e]" />
                </div>
                <span className="text-sm font-bold text-[#171e1e]">
                  새 도서 등록
                </span>
                <span className="text-[11px] text-[#737878]">표지 촬영 및 등록</span>
              </button>

              {/* Add Customer Order */}
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setIsOrderModalOpen(true);
                }}
                className="bg-[#f0eee9] rounded-2xl p-5 flex flex-col items-center justify-center gap-2 border border-[#e9e2d1] hover:bg-[#eae8e3] hover:border-[#171e1e] transition-all cursor-pointer shadow-xs active:scale-95 text-center group"
              >
                <div className="bg-[#ffffff] rounded-full p-2.5 shadow-xs border border-[#c3c7c7] group-hover:border-[#171e1e]">
                  <ClipboardList className="w-5 h-5 text-[#3c4c20]" />
                </div>
                <span className="text-sm font-bold text-[#171e1e]">
                  손님 주문 접수
                </span>
                <span className="text-[11px] text-[#737878]">예약 도서 기록</span>
              </button>
            </div>
          </div>

          {/* ========================================== */}
          {/* 📦 손님 주문받은 책 목록 (CUSTOMER ORDERS SECTION) */}
          {/* ========================================== */}
          <div id="customer-orders-section" className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#c3c7c7]/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e] flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-[#3c4c20]" />
                    주문받은 책 목록
                  </h3>
                  <span className="text-xs font-bold bg-[#171e1e] text-white px-2 py-0.5 rounded-full">
                    {allOrders.length}건
                  </span>
                </div>
                <p className="text-xs text-[#737878] mt-0.5">
                  손님이 서점에 예약·주문 요청한 도서의 입고 및 수령 상태를 관리합니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Filter Tabs */}
                <div className="flex bg-[#f0eee9] p-1 rounded-xl gap-1 text-xs">
                  <button
                    onClick={() => setOrderFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      orderFilter === 'pending'
                        ? 'bg-white text-[#171e1e] shadow-xs'
                        : 'text-[#737878] hover:text-[#171e1e]'
                    }`}
                  >
                    진행 중 ({orderStats.pending})
                  </button>
                  <button
                    onClick={() => setOrderFilter('arrived')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      orderFilter === 'arrived'
                        ? 'bg-white text-[#171e1e] shadow-xs'
                        : 'text-[#737878] hover:text-[#171e1e]'
                    }`}
                  >
                    입고/대기 ({orderStats.arrived})
                  </button>
                  <button
                    onClick={() => setOrderFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      orderFilter === 'all'
                        ? 'bg-white text-[#171e1e] shadow-xs'
                        : 'text-[#737878] hover:text-[#171e1e]'
                    }`}
                  >
                    전체
                  </button>
                </div>

                {/* Add Order Button */}
                <button
                  onClick={() => {
                    setEditingOrder(null);
                    setIsOrderModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-[#171e1e] text-white rounded-xl text-xs font-bold hover:bg-[#2c3333] transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>주문 등록</span>
                </button>
              </div>
            </div>

            {/* Orders Cards List */}
            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="bg-[#fbf9f4] border border-[#e9e2d1] rounded-2xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#f0eee9] text-[#737878] mx-auto flex items-center justify-center">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#171e1e]">
                      {orderFilter === 'pending' ? '진행 중인 주문 도서가 없습니다.' : '해당하는 주문 도서가 없습니다.'}
                    </p>
                    <p className="text-xs text-[#737878] mt-1">
                      손님이 원하는 독립출판물이나 절판/주문 도서를 등록하여 관리해보세요.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingOrder(null);
                      setIsOrderModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#c3c7c7] hover:border-[#171e1e] text-[#171e1e] rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>첫 주문 등록하기</span>
                  </button>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl p-4 border border-[#c3c7c7] hover:border-[#171e1e] transition-all shadow-xs space-y-3 group"
                    >
                      {/* Top Bar: Book Title + Status Badge + Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {getStatusBadge(order.status)}
                            <span className="text-[11px] text-[#737878] font-mono">
                              {order.orderDate} 주문
                            </span>
                            {order.depositPaid ? (
                              <span className="text-[10px] font-bold bg-[#e8f5e9] text-[#2e7d32] px-2 py-0.5 rounded-md">
                                선결제 완료
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-[#fff3e0] text-[#e65100] px-2 py-0.5 rounded-md">
                                수령 시 결제
                              </span>
                            )}
                          </div>
                          <h4 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-base sm:text-lg font-bold text-[#171e1e] leading-snug">
                            {order.bookTitle}
                          </h4>
                          <p className="text-xs text-[#737878]">
                            {order.bookAuthor ? `${order.bookAuthor} 저` : ''}
                            {order.bookPublisher ? ` · ${order.bookPublisher}` : ''}
                            <span className="ml-2 font-bold text-[#171e1e]">({order.quantity}권)</span>
                            {order.orderPrice ? (
                              <span className="ml-2 font-mono text-[#434848]">
                                {order.orderPrice.toLocaleString()}원
                              </span>
                            ) : null}
                          </p>
                        </div>

                        {/* Edit / Delete Buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingOrder(order);
                              setIsOrderModalOpen(true);
                            }}
                            title="주문 정보 수정"
                            className="p-1.5 text-[#737878] hover:text-[#171e1e] hover:bg-[#f0eee9] rounded-lg transition-colors cursor-pointer"
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
                      </div>

                      {/* Middle: Customer Details & Note */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#fbf9f4] p-3 rounded-xl border border-[#f0eee9] text-xs">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-[#737878]" />
                          <span className="font-bold text-[#171e1e]">{order.customerName} 손님</span>
                          {order.customerContact && (
                            <span className="text-[#737878] flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3" />
                              {order.customerContact}
                            </span>
                          )}
                        </div>

                        {order.note && (
                          <div className="text-[#434848] text-xs flex items-center gap-1.5">
                            <span className="font-bold text-[#737878] flex-shrink-0">메모:</span>
                            <span className="truncate">{order.note}</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Quick State Transition Bar */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#f0eee9] flex-wrap gap-2 text-xs">
                        <span className="text-[11px] text-[#737878]">빠른 상태 변경:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {order.status !== '주문접수' && (
                            <button
                              onClick={(e) => handleQuickStatusChange(e, order, '주문접수')}
                              className="px-2.5 py-1 bg-white border border-[#c3c7c7] hover:bg-[#f5f3ee] rounded-lg text-[11px] text-[#434848] font-semibold cursor-pointer"
                            >
                              주문접수
                            </button>
                          )}
                          {order.status !== '입고완료' && (
                            <button
                              onClick={(e) => handleQuickStatusChange(e, order, '입고완료')}
                              className="px-2.5 py-1 bg-[#e8f5e9] border border-[#a5d6a7] hover:bg-[#c8e6c9] text-[#2e7d32] rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              📦 입고완료
                            </button>
                          )}
                          {order.status !== '수령대기' && (
                            <button
                              onClick={(e) => handleQuickStatusChange(e, order, '수령대기')}
                              className="px-2.5 py-1 bg-[#e3f2fd] border border-[#90caf9] hover:bg-[#bbdefb] text-[#1565c0] rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              🔔 수령대기
                            </button>
                          )}
                          {order.status !== '수령완료' && (
                            <button
                              onClick={(e) => handleQuickStatusChange(e, order, '수령완료')}
                              className="px-2.5 py-1 bg-[#171e1e] text-white hover:bg-[#2c3333] rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <Check className="w-3 h-3" />
                              수령완료 처리
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Activity Timeline */}
          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-end border-b border-[#c3c7c7]/60 pb-2">
              <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e]">
                최근 재고 변동
              </h3>
              <button
                onClick={() => onNavigate('history')}
                className="text-xs font-bold uppercase tracking-wider text-[#625e51] hover:text-[#171e1e] transition-colors flex items-center gap-1 cursor-pointer"
              >
                전체 보기 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 relative pl-4 sm:pl-6 border-l-2 border-[#e4e2dd] ml-2">
              {recentLogs.length === 0 ? (
                <p className="text-sm text-[#737878] py-4">최근 변동 내역이 없습니다.</p>
              ) : (
                recentLogs.map((log) => {
                  const isPositive = log.changeQuantity > 0;
                  const isDamage = log.reason === '파손' || log.reason === '분실';
                  return (
                    <div key={log.id} className="relative group">
                      {/* Dot icon on timeline line */}
                      <div
                        className={`absolute -left-[23px] sm:-left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-[#fbf9f4] ${
                          isDamage
                            ? 'border-[#ba1a1a]'
                            : isPositive
                            ? 'border-[#8ea06b]'
                            : 'border-[#171e1e]'
                        }`}
                      />

                      <div
                        onClick={() => onSelectBook(log.bookId)}
                        className="bg-[#ffffff] rounded-xl p-3.5 border border-[#e9e2d1] hover:border-[#171e1e] transition-all cursor-pointer shadow-xs flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-[#171e1e] font-medium leading-snug">
                            <span
                              className={`font-bold mr-1.5 ${
                                isDamage
                                  ? 'text-[#ba1a1a]'
                                  : isPositive
                                  ? 'text-[#3c4c20]'
                                  : 'text-[#434848]'
                              }`}
                            >
                              {log.changeQuantity > 0 ? `+${log.changeQuantity}` : log.changeQuantity} {log.reason}:
                            </span>
                            <span>{log.bookTitle}</span>
                          </p>
                          {log.note && (
                            <p className="text-xs text-[#737878] mt-0.5 truncate">{log.note}</p>
                          )}
                        </div>
                        <span className="text-xs text-[#737878] whitespace-nowrap flex-shrink-0">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Low Stock Preview + Store Note (4 cols on desktop) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Low Stock Card */}
          <div className="bg-[#f5f3ee] rounded-2xl p-5 md:p-6 border border-[#e9e2d1] flex flex-col shadow-xs">
            <div className="flex justify-between items-center mb-5 pb-2 border-b border-[#c3c7c7]/50">
              <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#ba1a1a]" />
                재고 부족
              </h3>
              <span className="text-xs font-bold bg-[#ffdad6] text-[#93000a] px-2 py-0.5 rounded-full">
                {stats.lowStockCount}권
              </span>
            </div>

            <div className="flex flex-col gap-3 flex-grow">
              {lowStockBooks.length === 0 ? (
                <div className="py-8 text-center text-[#737878] text-sm">
                  현재 부족한 재고가 없습니다. 👍
                </div>
              ) : (
                lowStockBooks.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => onSelectBook(book.id)}
                    className="flex gap-3 bg-[#ffffff] rounded-xl p-3 border border-[#e9e2d1] hover:border-[#171e1e] transition-all items-center cursor-pointer shadow-xs group"
                  >
                    <BookCover src={book.coverImage} alt={book.title} size="sm" />
                    <div className="flex-grow min-w-0">
                      <h4 className="text-sm font-semibold text-[#171e1e] truncate group-hover:underline">
                        {book.title}
                      </h4>
                      <p className="text-xs text-[#737878] truncate">
                        {book.author}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <StockBadge quantity={book.quantity} showExactRemaining />
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={onFilterLowStock}
              className="mt-5 w-full py-2.5 bg-[#ffffff] border border-[#c3c7c7] rounded-xl text-xs font-bold text-[#171e1e] hover:bg-[#eae8e3] hover:border-[#171e1e] transition-all shadow-xs cursor-pointer"
            >
              전체 부족 재고 확인
            </button>
          </div>
        </div>
      </div>

      {/* Customer Order Modal (Create / Edit) */}
      {isOrderModalOpen && (
        <CustomerOrderModal
          order={editingOrder}
          onClose={() => {
            setIsOrderModalOpen(false);
            setEditingOrder(null);
          }}
          onSuccess={(msg) => {
            if (onShowToast) onShowToast(msg);
          }}
        />
      )}

      {/* Delete Order Confirmation Modal */}
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
                onClick={handleDeleteOrder}
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
