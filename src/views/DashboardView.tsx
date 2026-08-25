import React from 'react';
import { ViewType, BookWithStock } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { BookCover } from '../components/common/BookCover';
import { StockBadge } from '../components/common/StockBadge';
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
  Layers,
  CircleDot
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: ViewType) => void;
  onSelectBook: (bookId: string) => void;
  onOpenAddBook: () => void;
  onOpenQuickRestock: () => void;
  onFilterLowStock: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectBook,
  onOpenAddBook,
  onOpenQuickRestock,
  onFilterLowStock,
}) => {
  const settings = inventoryStore.getSettings();
  const stats = inventoryStore.getWeeklyStats();
  const lowStockBooks = inventoryStore.getLowStockBooks().slice(0, 4);
  const recentLogs = inventoryStore.getLogs().slice(0, 5);

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

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 select-none">
      {/* Title & Atmosphere Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-[#434848] bg-[#f0eee9] px-2.5 py-1 rounded-full border border-[#c3c7c7]">
            📍 {settings.branchName || '본점'}
          </span>
          <span className="text-xs text-[#737878]">독립서점 재고 관리 시스템</span>
        </div>
        <h2 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#171e1e] mb-2 tracking-tight">
          {settings.storeName ? `${settings.storeName} 대시보드` : '서점 대시보드'}
        </h2>
        <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-base text-[#434848]">
          {settings.storeName || '책방'}의 실시간 재고 현황과 입출고 흐름을 확인해보세요.
        </p>
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: 전체 재고 */}
        <div
          onClick={() => onNavigate('inventory')}
          className="bg-[#f5f3ee] rounded-2xl p-5 md:p-6 border border-[#e9e2d1] hover:border-[#171e1e] transition-all flex flex-col justify-between cursor-pointer group shadow-xs"
        >
          <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs font-bold uppercase tracking-wider text-[#434848] mb-3 flex items-center gap-1.5">
            <Library className="w-4 h-4 text-[#737878] group-hover:text-[#171e1e] transition-colors" />
            전체 재고
          </span>
          <div className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#171e1e]">
            {stats.totalStock}
            <span className="text-base font-normal font-['Public_Sans','Noto_Sans_KR',sans-serif] ml-1">권</span>
          </div>
        </div>

        {/* Stat 2: 재고 부족 */}
        <div
          onClick={onFilterLowStock}
          className="bg-[#f5f3ee] rounded-2xl p-5 md:p-6 border border-[#e9e2d1] hover:border-[#ba1a1a] transition-all flex flex-col justify-between cursor-pointer group shadow-xs"
        >
          <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs font-bold uppercase tracking-wider text-[#434848] mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
            재고 부족
          </span>
          <div className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#ba1a1a]">
            {stats.lowStockCount}
            <span className="text-base font-normal font-['Public_Sans','Noto_Sans_KR',sans-serif] ml-1">종</span>
          </div>
        </div>

        {/* Stat 3: 이번주 입고 */}
        <div className="bg-[#f5f3ee] rounded-2xl p-5 md:p-6 border border-[#e9e2d1] border-t-4 border-t-[#bbce95] flex flex-col justify-between shadow-xs">
          <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs font-bold uppercase tracking-wider text-[#434848] mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#3c4c20]" />
            이번주 입고
          </span>
          <div className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#3c4c20]">
            +{stats.weeklyRestock}
            <span className="text-base font-normal font-['Public_Sans','Noto_Sans_KR',sans-serif] ml-1">권</span>
          </div>
        </div>

        {/* Stat 4: 이번주 판매 */}
        <div className="bg-[#f5f3ee] rounded-2xl p-5 md:p-6 border border-[#e9e2d1] border-t-4 border-t-[#c3c7c7] flex flex-col justify-between shadow-xs">
          <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs font-bold uppercase tracking-wider text-[#434848] mb-3 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-[#737878]" />
            이번주 판매
          </span>
          <div className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl md:text-4xl font-bold text-[#434848]">
            -{stats.weeklySales}
            <span className="text-base font-normal font-['Public_Sans','Noto_Sans_KR',sans-serif] ml-1">권</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Quick Actions + Timeline & Right Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (8 cols on desktop) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Quick Actions */}
          <div className="space-y-4">
            <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e] border-b border-[#c3c7c7]/60 pb-2">
              빠른 작업
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Prominent Hero Scan Action */}
              <button
                onClick={() => onNavigate('scanner')}
                className="col-span-1 sm:col-span-2 bg-[#1b1c19] text-[#ffffff] rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center gap-3 hover:bg-[#2c3333] transition-all group shadow-md active:scale-[0.99] cursor-pointer"
              >
                <div className="p-3 bg-white/10 rounded-full group-hover:scale-110 transition-transform">
                  <ScanLine className="w-9 h-9 text-[#d6eaaf]" />
                </div>
                <span className="font-['Playfair_Display','Noto_Serif_KR',serif] text-2xl font-bold tracking-wide flex items-center gap-2">
                  📷 책 스캔하기
                </span>
                <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm text-white/70">
                  카메라 바코드로 빠르게 도서를 추가하거나 조회하세요
                </span>
              </button>

              {/* Secondary Action: Add Book */}
              <button
                onClick={onOpenAddBook}
                className="bg-[#f0eee9] rounded-2xl p-5 flex items-center gap-4 border border-[#e9e2d1] hover:bg-[#eae8e3] hover:border-[#171e1e] transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <div className="bg-[#ffffff] rounded-full p-3 flex items-center justify-center shadow-xs border border-[#c3c7c7]">
                  <PlusCircle className="w-5 h-5 text-[#171e1e]" />
                </div>
                <div className="text-left">
                  <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm font-bold text-[#171e1e] block">
                    도서 추가
                  </span>
                  <span className="text-xs text-[#737878]">새 도서 직접 등록</span>
                </div>
              </button>

              {/* Secondary Action: Quick Restock */}
              <button
                onClick={onOpenQuickRestock}
                className="bg-[#f0eee9] rounded-2xl p-5 flex items-center gap-4 border border-[#e9e2d1] hover:bg-[#eae8e3] hover:border-[#171e1e] transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <div className="bg-[#ffffff] rounded-full p-3 flex items-center justify-center shadow-xs border border-[#c3c7c7]">
                  <TrendingUp className="w-5 h-5 text-[#3c4c20]" />
                </div>
                <div className="text-left">
                  <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm font-bold text-[#171e1e] block">
                    재고 입고
                  </span>
                  <span className="text-xs text-[#737878]">간편 다량 입고</span>
                </div>
              </button>
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
                className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs font-bold uppercase tracking-wider text-[#625e51] hover:text-[#171e1e] transition-colors flex items-center gap-1 cursor-pointer"
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
                          <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm text-[#171e1e] font-medium leading-snug">
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
                        <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs text-[#737878] whitespace-nowrap flex-shrink-0">
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

        {/* Right Column: Low Stock Preview (4 cols on desktop) */}
        <div className="lg:col-span-4 bg-[#f5f3ee] rounded-2xl p-5 md:p-6 border border-[#e9e2d1] flex flex-col h-full shadow-xs">
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
              <div className="py-12 text-center text-[#737878] text-sm">
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
                    <h4 className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm font-semibold text-[#171e1e] truncate group-hover:underline">
                      {book.title}
                    </h4>
                    <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs text-[#737878] truncate">
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
            className="mt-6 w-full py-3 bg-[#ffffff] border border-[#c3c7c7] rounded-xl font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs font-bold text-[#171e1e] hover:bg-[#eae8e3] hover:border-[#171e1e] transition-all shadow-xs cursor-pointer"
          >
            전체 부족 재고 확인
          </button>
        </div>
      </div>
    </div>
  );
};
