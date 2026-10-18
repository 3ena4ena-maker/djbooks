import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ViewType, CustomerOrder, CustomerOrderStatus, BookWithStock, InventoryLog } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { authStore } from '../services/authStore';
import { CustomerOrderModal } from '../components/modals/CustomerOrderModal';
import { StockOutModal } from '../components/modals/StockOutModal';
import { StockInModal } from '../components/modals/StockInModal';
import { isSupabaseConfigured } from '../lib/supabase';
import { BookCover } from '../components/common/BookCover';
import { StockBadge } from '../components/common/StockBadge';
import { feedback } from '../utils/feedback';
import {
  Library,
  Package,
  ShoppingBag,
  Plus,
  Minus,
  Search,
  ScanLine,
  X,
  Menu,
  ChevronRight,
  Clock,
  CheckCircle2,
  User,
  Phone,
  Edit2,
  Trash2,
  Check,
  PlusCircle,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  MapPin,
  ClipboardList,
  ArrowRight,
  BookOpen,
  History,
  Settings as SettingsIcon,
  Cloud,
  CloudOff,
  RefreshCw
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
  const [isAdmin, setIsAdmin] = useState(authStore.isAdmin);

  // Left Section (전체 재고) states
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');


  // Right Bottom (입고) states
  const [inboundFilter, setInboundFilter] = useState<'all' | 'restocks' | 'orders'>('all');

  // Customer Order Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<CustomerOrder | null>(null);

  // Stock Movement Modals (출고 / 입고 입력)
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Hamburger Menu state
  const [isDashMenuOpen, setIsDashMenuOpen] = useState(false);
  const dashMenuRef = useRef<HTMLDivElement>(null);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await inventoryStore.fetchFromSupabase();
      feedback.playBeep('success');
      if (onShowToast) onShowToast('Supabase 클라우드 동기화 완료');
    } catch {
      feedback.playBeep('warning');
      if (onShowToast) onShowToast('클라우드 동기화 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

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

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dashMenuRef.current && !dashMenuRef.current.contains(e.target as Node)) {
        setIsDashMenuOpen(false);
      }
    };
    if (isDashMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDashMenuOpen]);

  const settings = inventoryStore.getSettings();
  const stats = inventoryStore.getWeeklyStats();
  const orderStats = inventoryStore.getCustomerOrderStats();
  const allOrders = inventoryStore.getCustomerOrders();
  const allBooksWithStock = inventoryStore.getBooksWithStock();
  const allLogs = inventoryStore.getLogs();

  // 1. 전체 재고 필터링
  const filteredBooks = useMemo(() => {
    let result = [...allBooksWithStock];

    // 재고 상태 필터
    if (inventoryStockFilter === 'in_stock') {
      result = result.filter((b) => b.quantity > 0);
    } else if (inventoryStockFilter === 'out_of_stock') {
      result = result.filter((b) => b.quantity <= 0);
    }

    // 검색어 필터
    if (inventorySearch.trim()) {
      const q = inventorySearch.trim().toLowerCase();
      result = result.filter((b) => {
        return (
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.publisher && b.publisher.toLowerCase().includes(q)) ||
          (b.isbn && b.isbn.toLowerCase().includes(q)) ||
          (b.location && b.location.toLowerCase().includes(q))
        );
      });
    }

    // 기본 정렬: 재고 많은 순, 같은 경우 최근 업데이트 순
    return result.sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [allBooksWithStock, inventorySearch, inventoryStockFilter]);

  const totalInventoryQuantity = useMemo(() => {
    return allBooksWithStock.reduce((acc, b) => acc + (b.quantity || 0), 0);
  }, [allBooksWithStock]);

  const inStockCount = useMemo(() => {
    return allBooksWithStock.filter((b) => b.quantity > 0).length;
  }, [allBooksWithStock]);

  const outOfStockCount = useMemo(() => {
    return allBooksWithStock.filter((b) => b.quantity <= 0).length;
  }, [allBooksWithStock]);

  // 2. 출고 (Outbound) 필터링
  // - 판매, 반품, 파손, 분실 등 수량 감소 로그
  const outboundLogs = useMemo(() => {
    return allLogs
      .filter((log) => {
        // 독자픽 및 비재고 트랜잭션 제외
        if ((log.transactionType as string) === 'READER_PICK' || (log.note && log.note.includes('독자픽'))) {
          return false;
        }
        // 출고 조건: changeQuantity < 0 또는 reason이 판매/반품/파손/분실/증정
        const isOutboundReason =
          log.reason === '판매' ||
          log.reason === '반품' ||
          log.reason === '파손' ||
          log.reason === '분실' ||
          log.reason === '증정';
        return isOutboundReason || log.changeQuantity < 0;
      })
      .slice(0, 10);
  }, [allLogs]);


  // 3. 입고 (Inbound) 필터링
  // - 입고, 재입고, 초기 도서 입고 등 수량 증가 로그
  const inboundLogs = useMemo(() => {
    return allLogs
      .filter((log) => {
        if ((log.transactionType as string) === 'READER_PICK' || (log.note && log.note.includes('독자픽'))) {
          return false;
        }
        const isInboundReason =
          log.reason === '입고' ||
          log.reason === '재입고' ||
          log.reason === '초기 도서 입고';
        return isInboundReason || log.changeQuantity > 0;
      })
      .slice(0, 10);
  }, [allLogs]);

  // 손님 주문 도서 중 '입고완료' 된 주문
  const arrivedOrders = useMemo(() => {
    return allOrders.filter((o) => o.status === '입고완료');
  }, [allOrders]);

  // 빠른 재고 증감 (+1 / -1)
  const handleQuickAdjust = async (e: React.MouseEvent, book: BookWithStock, delta: number) => {
    e.stopPropagation();
    if (!isAdmin) {
      if (onShowToast) onShowToast('관리자 모드에서만 재고를 수정할 수 있습니다.');
      return;
    }

    if (delta < 0 && book.quantity <= 0) {
      feedback.playBeep('warning');
      if (onShowToast) onShowToast(`'${book.title}'은(는) 이미 재고가 0권(품절)입니다.`);
      return;
    }

    const reason = delta > 0 ? '입고' : '판매';
    const note = delta > 0 ? '대시보드 빠른 입고 (+1)' : '대시보드 빠른 판매 (-1)';
    const res = await inventoryStore.adjustStock(book.id, delta, reason, note);

    if (res.success) {
      feedback.playBeep('success');
      if (onShowToast) {
        onShowToast(`'${book.title}' 재고가 ${res.newQuantity}권으로 변경되었습니다.`);
      }
    } else {
      feedback.playBeep('warning');
      if (onShowToast) {
        onShowToast(res.error || '재고 변경 중 오류가 발생했습니다.');
      }
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
      if (diffDays === 1) return `어제 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
      return `${date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 select-none font-['Public_Sans','Noto_Sans_KR',sans-serif]">
      {/* 🌟 상단 대시보드 헤더 & 핵심 지표 바 */}
      <div className="bg-white rounded-2xl border border-[#c3c7c7] p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
            <span className="text-[11px] sm:text-xs font-bold text-[#434848] bg-[#f0eee9] px-2 sm:px-2.5 py-0.5 rounded-full border border-[#c3c7c7]">
              📍 {settings.branchName || '본점'}
            </span>
            <span className="text-[11px] sm:text-xs text-[#737878]">
              독립서점 재고 및 입출고 실시간 관리
            </span>
          </div>
          <h2
            onClick={() => {
              const nextState = !isAdmin;
              authStore.setAdminMode(nextState);
              feedback.playBeep('success');
              if (onShowToast) {
                onShowToast(
                  nextState
                    ? '🎉 관리자 모드로 전환되었습니다.'
                    : '일반 모드로 전환되었습니다.'
                );
              }
            }}
            className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl sm:text-2xl md:text-3xl font-bold text-[#171e1e] cursor-pointer select-none inline-flex items-center gap-2 transition-opacity active:opacity-70"
          >
            <span>{settings.storeName ? `${settings.storeName} 대시보드` : '독자서점 대시보드'}</span>
            {isAdmin && (
              <span className="text-[10px] sm:text-xs font-sans font-bold px-2 sm:px-2.5 py-0.5 rounded-full border bg-[#edf5e1] text-[#2d4710] border-[#c3d9a5] shadow-2xs">
                관리자 모드 (ON)
              </span>
            )}
          </h2>
        </div>

        {/* 핵심 통계 요약 칩 */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
          <div
            onClick={() => onNavigate('inventory')}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-[#f5f3ee] hover:bg-[#eae8e3] rounded-xl border border-[#e9e2d1] cursor-pointer transition-colors shadow-2xs text-[11px] sm:text-xs"
            title="전체 재고 관리 페이지로 이동"
          >
            <Library className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#737878]" />
            <span className="text-[#434848]">전체 재고:</span>
            <span className="font-bold text-[#171e1e]">{allBooksWithStock.length}종 / {totalInventoryQuantity}권</span>
          </div>

          {/* 재고 부족 칩 (독자픽 품절 등) */}
          <div
            onClick={onFilterLowStock}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border cursor-pointer transition-all shadow-2xs text-[11px] sm:text-xs ${
              stats.lowStockCount > 0
                ? 'bg-[#ffdad6] hover:bg-[#ffcdd2] text-[#93000a] border-[#ffb4ab]'
                : 'bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#737878] border-[#e9e2d1]'
            }`}
            title="재고 부족(품절 독자픽) 도서 목록 보기"
          >
            <AlertTriangle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stats.lowStockCount > 0 ? 'text-[#ba1a1a]' : 'text-[#737878]'}`} />
            <span className={stats.lowStockCount > 0 ? 'text-[#93000a] font-medium' : 'text-[#434848]'}>
              재고 부족:
            </span>
            <span className={`font-bold ${stats.lowStockCount > 0 ? 'text-[#ba1a1a]' : 'text-[#171e1e]'}`}>
              {stats.lowStockCount}종
            </span>
            {stats.lowStockCount > 0 && (
              <span className="text-[9px] sm:text-[10px] bg-[#ba1a1a] text-white px-1.5 py-0.5 rounded-full font-bold">
                독자픽 품절
              </span>
            )}
          </div>

          {/* Supabase 클라우드 동기화 버튼 */}
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 ${
              isSupabaseConfigured
                ? 'bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#2d4710] border-[#c3d9a5]'
                : 'bg-[#f5f3ee] text-[#737878] border-[#c3c7c7]'
            }`}
            title={isSupabaseConfigured ? 'Supabase 클라우드 DB 실시간 동기화' : '클라우드 DB 미연결'}
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2e7d32] animate-spin" />
            ) : isSupabaseConfigured ? (
              <Cloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2e7d32]" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#737878]" />
            )}
            <span className="hidden sm:inline">동기화</span>
          </button>

          {/* 바코드 스캔 */}
          <button
            onClick={() => onNavigate('scanner')}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-[#171e1e] hover:bg-[#2c3333] text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <ScanLine className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#d6eaaf]" />
            <span>스캔</span>
          </button>

          {/* ☰ 바코드 스캔 옆 삼선 더보기 메뉴 버튼 */}
          <div className="relative" ref={dashMenuRef}>
            <button
              onClick={() => setIsDashMenuOpen(!isDashMenuOpen)}
              className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer shadow-2xs flex items-center justify-center active:scale-95 ${
                isDashMenuOpen
                  ? 'bg-[#171e1e] text-white border-[#171e1e]'
                  : 'bg-[#f5f3ee] text-[#171e1e] border-[#c3c7c7] hover:bg-[#eae8e3]'
              }`}
              title="메뉴 더보기"
            >
              {isDashMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            {/* 더보기 드롭다운 메뉴 */}
            {isDashMenuOpen && (
              <div className="absolute right-0 top-11 w-56 bg-white rounded-2xl border border-[#c3c7c7] shadow-xl py-2 z-50 animate-fadeIn font-['Public_Sans','Noto_Sans_KR',sans-serif]">
                <div className="px-4 py-2 border-b border-[#e4e2dd] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#171e1e]">서점 메뉴 바로가기</span>
                  {isAdmin && (
                    <span className="text-[10px] font-bold text-[#2d4710] bg-[#edf5e1] px-1.5 py-0.5 rounded border border-[#c3d9a5]">
                      관리자 모드
                    </span>
                  )}
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      onNavigate('inventory');
                      setIsDashMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-[#434848] hover:bg-[#fbf9f4] hover:text-[#171e1e] flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-[#737878]" />
                    <span>도서 재고 목록</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate('orders');
                      setIsDashMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-[#434848] hover:bg-[#fbf9f4] hover:text-[#171e1e] flex items-center gap-2 cursor-pointer"
                  >
                    <ClipboardList className="w-4 h-4 text-[#737878]" />
                    <span>손님 주문 관리</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate('scanner');
                      setIsDashMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-[#434848] hover:bg-[#fbf9f4] hover:text-[#171e1e] flex items-center gap-2 cursor-pointer"
                  >
                    <ScanLine className="w-4 h-4 text-[#737878]" />
                    <span>바코드 스캔</span>
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => {
                          onNavigate('history');
                          setIsDashMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-[#434848] hover:bg-[#fbf9f4] hover:text-[#171e1e] flex items-center gap-2 cursor-pointer"
                      >
                        <History className="w-4 h-4 text-[#737878]" />
                        <span>재고 변동 기록</span>
                      </button>
                      <button
                        onClick={() => {
                          onNavigate('settings');
                          setIsDashMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-[#434848] hover:bg-[#fbf9f4] hover:text-[#171e1e] flex items-center gap-2 cursor-pointer"
                      >
                        <SettingsIcon className="w-4 h-4 text-[#737878]" />
                        <span>서점 환경 설정</span>
                      </button>
                    </>
                  )}
                </div>
                {isAdmin && (
                  <div className="px-3 py-2 border-t border-[#e4e2dd] bg-[#fbf9f4] space-y-1">
                    <button
                      onClick={() => {
                        onOpenAddBook();
                        setIsDashMenuOpen(false);
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-[#c3c7c7] hover:border-[#171e1e] text-[#171e1e] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-[#2e7d32]" />
                      <span>새 도서 등록</span>
                    </button>
                    <button
                      onClick={() => {
                        onOpenQuickRestock();
                        setIsDashMenuOpen(false);
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-[#c3c7c7] hover:border-[#171e1e] text-[#171e1e] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Package className="w-3.5 h-3.5 text-[#3c4c20]" />
                      <span>빠른 재입고</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 📐 메인 3섹션 그리드 레이아웃 */}
      {/* 모바일/태블릿: 상단 출고/입고 최우선 노출 -> 하단 전체 재고 */}
      {/* 데스크탑: 좌측 상단 출고 + 하단 입고 (50%) | 우측: 전체 재고 (50%) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* ======================================================== */}
        {/* 📦 1. 출고 & 입고 현황 (모바일/태블릿 최우선 노출) */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 flex flex-col md:grid md:grid-cols-2 lg:flex lg:flex-col gap-4 sm:gap-6">
          
          {/* ======================================================== */}
          {/* 📤 1-1. 출고 관리 (판매 및 출고 내역) */}
          {/* ======================================================== */}
          <div className="bg-white rounded-2xl border border-[#c3c7c7] shadow-xs p-4 sm:p-5 md:p-6 flex flex-col h-[350px] sm:h-[365px] lg:h-[377px]">
            {/* 섹션 상단 헤더 */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e4e2dd] mb-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#ffdad6]/60 rounded-xl text-[#ba1a1a]">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e]">
                    출고 현황
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsStockOutModalOpen(true)}
                      className="px-3 py-1.5 bg-[#ba1a1a] hover:bg-[#93000a] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                      title="출고 내용 입력 (판매, 반품, 파손 등)"
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>출고 입력</span>
                    </button>
                    <button
                      onClick={() => onNavigate('history')}
                      className="text-xs font-bold text-[#434848] hover:text-[#171e1e] flex items-center gap-0.5 px-2 py-1.5 rounded-lg hover:bg-[#f0eee9] transition-all cursor-pointer"
                      title="전체 변동 내역 페이지로 이동"
                    >
                      <span>내역</span>
                      <ChevronRight className="w-4 h-4 text-[#737878]" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 건수 안내 */}
            <div className="flex items-center justify-between mb-2.5 flex-shrink-0 text-xs text-[#737878]">
              <span className="font-semibold text-[#434848]">
                최근 출고 내역 ({outboundLogs.length})
              </span>
              <span className="text-[11px]">
                최근 10건 표시
              </span>
            </div>

            {/* 출고 목록 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {outboundLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#737878] space-y-1">
                  <ShoppingBag className="w-7 h-7 opacity-40" />
                  <p className="text-xs font-bold text-[#171e1e]">최근 출고/판매 내역이 없습니다.</p>
                  <p className="text-[11px]">도서를 판매하거나 바코드를 스캔하여 출고해보세요.</p>
                </div>
              ) : (
                outboundLogs.map((log) => {
                  return (
                    <div
                      key={log.id}
                      onClick={() => onSelectBook(log.bookId)}
                      className="bg-[#fbf9f4] hover:bg-white rounded-xl p-2.5 border border-[#e9e2d1] hover:border-[#ba1a1a] transition-all flex items-center justify-between gap-3 text-xs cursor-pointer shadow-2xs group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-bold bg-[#ffdad6] text-[#93000a] px-2 py-0.2 rounded text-[10px]">
                            {log.reason || '판매'}
                          </span>
                          <span className="font-['Playfair_Display','Noto_Serif_KR',serif] font-bold text-[#171e1e] group-hover:text-[#ba1a1a] transition-colors truncate">
                            {log.bookTitle}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#737878] flex items-center gap-2">
                          <span>{formatRelativeTime(log.createdAt)}</span>
                          {log.note && <span className="truncate">· {log.note}</span>}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="font-mono font-bold text-sm text-[#ba1a1a]">
                          {log.changeQuantity}권
                        </span>
                        <div className="text-[10px] text-[#737878]">
                          잔여 {log.resultingQuantity}권
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* 📥 3. 오른쪽 하단: 입고 관리 (도서 입고 및 재입고 내역) */}
          {/* ======================================================== */}
          <div className="bg-white rounded-2xl border border-[#c3c7c7] shadow-xs p-4 sm:p-5 md:p-6 flex flex-col h-[350px] sm:h-[365px] lg:h-[377px]">
            {/* 섹션 상단 헤더 */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e4e2dd] mb-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#d6eaaf]/60 rounded-xl text-[#3c4c20]">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e]">
                    입고 현황
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsStockInModalOpen(true)}
                      className="px-3 py-1.5 bg-[#2e7d32] hover:bg-[#1b5e20] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                      title="입고 내용 입력 (신규 입고, 재입고 등)"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>입고 입력</span>
                    </button>
                    <button
                      onClick={onOpenAddBook}
                      className="px-2.5 py-1.5 bg-[#f0eee9] hover:bg-[#eae8e3] text-[#171e1e] border border-[#c3c7c7] rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                      title="새 도서 등록"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>신규 도서</span>
                    </button>
                    <button
                      onClick={() => onNavigate('history')}
                      className="text-xs font-bold text-[#434848] hover:text-[#171e1e] flex items-center gap-0.5 px-2 py-1.5 rounded-lg hover:bg-[#f0eee9] transition-all cursor-pointer"
                      title="전체 변동 내역 페이지로 이동"
                    >
                      <span>내역</span>
                      <ChevronRight className="w-4 h-4 text-[#737878]" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 필터 탭 */}
            <div className="flex items-center justify-between mb-2.5 flex-shrink-0 text-xs">
              <div className="flex bg-[#f0eee9] p-1 rounded-xl gap-1">
                <button
                  onClick={() => setInboundFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    inboundFilter === 'all'
                      ? 'bg-white text-[#171e1e] shadow-2xs'
                      : 'text-[#737878] hover:text-[#171e1e]'
                  }`}
                >
                  최근 입고 ({inboundLogs.length})
                </button>
                <button
                  onClick={() => setInboundFilter('orders')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    inboundFilter === 'orders'
                      ? 'bg-white text-[#2e7d32] shadow-2xs'
                      : 'text-[#737878] hover:text-[#2e7d32]'
                  }`}
                >
                  주문 입고완료 ({arrivedOrders.length})
                </button>
              </div>

              <span className="text-[11px] text-[#737878]">
                최근 10건 표시
              </span>
            </div>

            {/* 입고 목록 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {inboundFilter === 'orders' ? (
                arrivedOrders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#737878] space-y-1">
                    <Package className="w-7 h-7 text-[#737878] opacity-50" />
                    <p className="text-xs font-bold text-[#171e1e]">입고 완료된 손님 주문이 없습니다.</p>
                  </div>
                ) : (
                  arrivedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-[#f1f8e9] rounded-xl p-3 border border-[#c8e6c9] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-bold bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] px-2 py-0.5 rounded text-[10px]">
                            📦 입고완료
                          </span>
                          <span className="font-bold text-[#171e1e]">{order.customerName} 손님</span>
                          <span className="text-[#737878] text-[11px] font-mono">{order.customerContact}</span>
                        </div>
                        <p className="font-bold text-[#171e1e] truncate">{order.bookTitle}</p>
                        <p className="text-[11px] text-[#737878]">
                          수량 {order.quantity}권 {order.note ? `· ${order.note}` : ''}
                        </p>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={(e) => handleQuickStatusChange(e, order, '수령대기')}
                          className="px-2.5 py-1.5 bg-[#1565c0] hover:bg-[#0d47a1] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 shadow-2xs"
                        >
                          <span>수령 안내(대기)</span>
                        </button>
                      )}
                    </div>
                  ))
                )
              ) : inboundLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#737878] space-y-1">
                  <Package className="w-7 h-7 opacity-40" />
                  <p className="text-xs font-bold text-[#171e1e]">최근 입고 내역이 없습니다.</p>
                  <p className="text-[11px]">새 도서를 입고하거나 빠른 재입고를 진행해보세요.</p>
                </div>
              ) : (
                inboundLogs.map((log) => {
                  return (
                    <div
                      key={log.id}
                      onClick={() => onSelectBook(log.bookId)}
                      className="bg-[#fbf9f4] hover:bg-white rounded-xl p-2.5 border border-[#e9e2d1] hover:border-[#2e7d32] transition-all flex items-center justify-between gap-3 text-xs cursor-pointer shadow-2xs group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-bold bg-[#e8f5e9] text-[#2e7d32] px-2 py-0.2 rounded text-[10px]">
                            {log.reason || '입고'}
                          </span>
                          <span className="font-['Playfair_Display','Noto_Serif_KR',serif] font-bold text-[#171e1e] group-hover:text-[#2e7d32] transition-colors truncate">
                            {log.bookTitle}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#737878] flex items-center gap-2">
                          <span>{formatRelativeTime(log.createdAt)}</span>
                          {log.note && <span className="truncate">· {log.note}</span>}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="font-mono font-bold text-sm text-[#2e7d32]">
                          +{log.changeQuantity}권
                        </span>
                        <div className="text-[10px] text-[#737878]">
                          입고 후 {log.resultingQuantity}권
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* ======================================================== */}
        {/* 📚 2. 전체 재고 화면 (모바일/태블릿: 출고·입고 아래 전체너비) */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#c3c7c7] shadow-xs p-4 sm:p-5 md:p-6 flex flex-col h-[520px] sm:h-[600px] lg:h-[778px]">
          {/* 섹션 상단 헤더 */}
          <div className="flex items-center justify-between pb-3 border-b border-[#e4e2dd] mb-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#f0eee9] rounded-xl text-[#171e1e]">
                <Library className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e]">
                  전체 도서 재고
                </h3>
                <p className="text-xs text-[#737878]">
                  현재 보유 {allBooksWithStock.length}종 · 총 {totalInventoryQuantity}권
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isAdmin && (
                <button
                  onClick={onOpenAddBook}
                  className="px-2.5 py-1.5 bg-[#171e1e] text-white rounded-xl text-xs font-bold hover:bg-[#2c3333] transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="신규 도서 등록"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>도서 등록</span>
                </button>
              )}
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs font-bold text-[#434848] hover:text-[#171e1e] flex items-center gap-0.5 px-2 py-1.5 rounded-lg hover:bg-[#f0eee9] transition-all cursor-pointer"
                title="전체 재고 관리 페이지로 이동"
              >
                <span>전체보기</span>
                <ChevronRight className="w-4 h-4 text-[#737878]" />
              </button>
            </div>
          </div>

          {/* 검색창 & 필터 탭 */}
          <div className="space-y-2.5 mb-3 flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder="도서명, 저자, 출판사, 위치(책장) 검색..."
                className="w-full pl-9 pr-8 py-2 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-xs font-medium focus:bg-white focus:border-[#171e1e] outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-[#737878] absolute left-3 top-2.5" />
              {inventorySearch && (
                <button
                  onClick={() => setInventorySearch('')}
                  className="absolute right-2.5 top-2.5 text-[#737878] hover:text-[#171e1e] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex bg-[#f0eee9] p-1 rounded-xl gap-1">
                <button
                  onClick={() => setInventoryStockFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    inventoryStockFilter === 'all'
                      ? 'bg-white text-[#171e1e] shadow-2xs'
                      : 'text-[#737878] hover:text-[#171e1e]'
                  }`}
                >
                  전체 ({allBooksWithStock.length})
                </button>
                <button
                  onClick={() => setInventoryStockFilter('in_stock')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    inventoryStockFilter === 'in_stock'
                      ? 'bg-white text-[#2e7d32] shadow-2xs'
                      : 'text-[#737878] hover:text-[#2e7d32]'
                  }`}
                >
                  재고 보유 ({inStockCount})
                </button>
                <button
                  onClick={() => setInventoryStockFilter('out_of_stock')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    inventoryStockFilter === 'out_of_stock'
                      ? 'bg-white text-[#ba1a1a] shadow-2xs'
                      : 'text-[#737878] hover:text-[#ba1a1a]'
                  }`}
                >
                  품절 ({outOfStockCount})
                </button>
              </div>

              <span className="text-[11px] text-[#737878]">
                {filteredBooks.length}개 표시
              </span>
            </div>
          </div>

          {/* 재고 도서 목록 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredBooks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#737878] space-y-2">
                <Library className="w-8 h-8 opacity-40" />
                <p className="text-sm font-bold text-[#171e1e]">
                  {inventorySearch ? '검색 결과와 일치하는 도서가 없습니다.' : '등록된 재고 도서가 없습니다.'}
                </p>
                <p className="text-xs">
                  {inventorySearch ? '다른 검색어를 입력해 보세요.' : '새 도서를 등록하여 재고 관리를 시작해보세요.'}
                </p>
              </div>
            ) : (
              filteredBooks.map((book) => {
                const isOutOfStock = book.quantity <= 0;
                return (
                  <div
                    key={book.id}
                    onClick={() => onSelectBook(book.id)}
                    className="group bg-[#fbf9f4] hover:bg-white rounded-xl p-3 border border-[#e9e2d1] hover:border-[#171e1e] transition-all flex items-center justify-between gap-3 cursor-pointer shadow-2xs"
                  >
                    {/* 좌측: 책 표지 & 서지 정보 */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <BookCover
                        src={book.coverImage}
                        alt={book.title}
                        size="sm"
                        className="shadow-2xs rounded-md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <StockBadge quantity={book.quantity} />
                          {book.isReaderPick && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              isOutOfStock 
                                ? 'bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab]' 
                                : 'bg-[#fff8e1] text-[#b78103] border-[#ffe082]'
                            }`}>
                              ★ 독자픽{isOutOfStock ? ' (품절)' : ''}
                            </span>
                          )}
                          {book.location && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-[#eef2e6] text-[#3c4c20] px-1.5 py-0.5 rounded border border-[#d2dec3]">
                              <MapPin className="w-2.5 h-2.5" />
                              {book.location}
                            </span>
                          )}
                          {book.category && (
                            <span className="text-[10px] text-[#737878]">
                              {book.category}
                            </span>
                          )}
                        </div>

                        <h4 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-sm font-bold text-[#171e1e] group-hover:text-[#3c4c20] transition-colors truncate">
                          {book.title}
                        </h4>
                        <p className="text-xs text-[#737878] truncate">
                          {book.author} · {book.publisher}
                        </p>
                      </div>
                    </div>

                    {/* 우측: 수량 & 빠른 조정 버튼 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <div
                          className={`font-['Playfair_Display','Noto_Serif_KR',serif] text-base font-bold ${
                            isOutOfStock ? 'text-[#ba1a1a]' : 'text-[#171e1e]'
                          }`}
                        >
                          {book.quantity}
                          <span className="text-xs font-normal font-sans ml-0.5 text-[#737878]">권</span>
                        </div>
                        {book.price ? (
                          <div className="text-[11px] text-[#737878] font-mono">
                            {book.price.toLocaleString()}원
                          </div>
                        ) : null}
                      </div>

                      {/* 관리자 빠른 +/- 수량 조작 버튼 */}
                      {isAdmin && (
                        <div
                          className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#c3c7c7] shadow-2xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleQuickAdjust(e, book, -1)}
                            disabled={isOutOfStock}
                            title="판매/출고 (-1)"
                            className="w-7 h-7 sm:w-7 sm:h-7 flex items-center justify-center rounded active:scale-90 text-[#ba1a1a] hover:bg-[#ffdad6] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleQuickAdjust(e, book, 1)}
                            title="입고 (+1)"
                            className="w-7 h-7 sm:w-7 sm:h-7 flex items-center justify-center rounded active:scale-90 text-[#2e7d32] hover:bg-[#d6eaaf] cursor-pointer transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
      </div>

      {/* 출고 내용 입력 모달 (관리자 전용) */}
      {isAdmin && isStockOutModalOpen && (
        <StockOutModal
          onClose={() => setIsStockOutModalOpen(false)}
          onSuccess={(msg) => {
            if (onShowToast) onShowToast(msg);
          }}
        />
      )}

      {/* 입고 내용 입력 모달 (관리자 전용) */}
      {isAdmin && isStockInModalOpen && (
        <StockInModal
          onClose={() => setIsStockInModalOpen(false)}
          onSuccess={(msg) => {
            if (onShowToast) onShowToast(msg);
          }}
          onOpenAddBook={onOpenAddBook}
        />
      )}

      {/* 손님 주문 등록/수정 모달 (필요 시 유지) */}
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

      {/* 주문 삭제 확인 모달 */}
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
