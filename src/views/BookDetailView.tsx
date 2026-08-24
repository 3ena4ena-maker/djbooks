import React, { useState } from 'react';
import { BookWithStock, ViewType } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { BookCover } from '../components/common/BookCover';
import { StockBadge } from '../components/common/StockBadge';
import { StockAdjustModal } from '../components/modals/StockAdjustModal';
import {
  ArrowLeft,
  PlusCircle,
  ShoppingCart,
  Edit3,
  History,
  MapPin,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  AlertCircle,
  Layers,
  BookOpen
} from 'lucide-react';
import { feedback } from '../utils/feedback';

interface BookDetailViewProps {
  bookId: string;
  onBack: () => void;
  onNavigate: (view: ViewType) => void;
  onShowToast: (message: string) => void;
}

export const BookDetailView: React.FC<BookDetailViewProps> = ({
  bookId,
  onBack,
  onNavigate,
  onShowToast,
}) => {
  const [modalMode, setModalMode] = useState<'adjust' | 'restock' | 'sell' | null>(null);

  const book = inventoryStore.getBookById(bookId);
  const logs = inventoryStore.getLogs(bookId);

  if (!book) {
    return (
      <div className="w-full max-w-4xl mx-auto py-16 text-center select-none">
        <p className="text-base text-[#434848] mb-4">도서 정보를 찾을 수 없습니다.</p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-[#171e1e] text-white rounded-xl text-xs font-semibold hover:bg-[#2c3333] cursor-pointer"
        >
          재고 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const formatLogDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hours = d.getHours();
      const period = hours < 12 ? '오전' : '오후';
      const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${month}월 ${day}일, ${period} ${formattedHours}:${minutes}`;
    } catch {
      return isoString;
    }
  };

  const handleQuickRestock = () => {
    setModalMode('restock');
  };

  const handleQuickSell = () => {
    setModalMode('sell');
  };

  const handleAdjust = () => {
    setModalMode('adjust');
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 select-none pb-16">
      {/* Breadcrumb / Back Navigation */}
      <div className="flex items-center gap-2 text-sm text-[#434848] font-['Public_Sans','Noto_Sans_KR',sans-serif]">
        <button
          onClick={onBack}
          className="hover:text-[#171e1e] transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>재고 목록으로 돌아가기</span>
        </button>
        <span className="text-[#c3c7c7]">/</span>
        <span className="text-[#171e1e] font-semibold">{book.category || '소설'}</span>
      </div>

      {/* Main Grid: Left Column Cover + Actions, Right Column Metadata & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (4 cols on desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Book Cover Card */}
          <div className="bg-[#ffffff] rounded-2xl p-5 border border-[#c3c7c7] shadow-sm relative overflow-hidden group">
            <div className="aspect-[2/3] w-full relative rounded-xl overflow-hidden border border-[#c3c7c7] shadow-[inset_4px_0_10px_rgba(0,0,0,0.12)] bg-[#f0eee9]">
              <img
                src={book.coverImage}
                alt={book.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Status Badge Overlay */}
            <div className="absolute top-8 right-8">
              <StockBadge quantity={book.quantity} showExactRemaining />
            </div>
          </div>

          {/* Primary Action Buttons (Matching Stitch Image 1) */}
          <div className="flex flex-col gap-3 font-['Public_Sans','Noto_Sans_KR',sans-serif]">
            {/* [+ 입고 처리] */}
            <button
              onClick={handleQuickRestock}
              className="bg-[#171e1e] text-white py-4 px-6 rounded-2xl hover:bg-[#2c3333] transition-all w-full flex items-center justify-center gap-2 shadow-xs font-bold text-sm active:translate-y-[1px] cursor-pointer"
            >
              <PlusCircle className="w-5 h-5 text-[#d6eaaf]" />
              <span>입고 처리</span>
            </button>

            {/* [- 판매 처리] & [재고 조정] */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleQuickSell}
                className="border border-[#c3c7c7] text-[#171e1e] bg-[#ffffff] hover:bg-[#f5f3ee] py-3.5 px-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 font-bold text-xs active:translate-y-[1px] cursor-pointer shadow-xs"
              >
                <ShoppingCart className="w-4 h-4 text-[#ba1a1a]" />
                <span>판매 처리</span>
              </button>

              <button
                onClick={handleAdjust}
                className="border border-[#c3c7c7] text-[#171e1e] bg-[#ffffff] hover:bg-[#f5f3ee] py-3.5 px-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 font-bold text-xs active:translate-y-[1px] cursor-pointer shadow-xs"
              >
                <Edit3 className="w-4 h-4 text-[#434848]" />
                <span>재고 조정</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (8 cols on desktop) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Header & Core Editorial Metadata */}
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl sm:text-4xl md:text-5xl font-bold text-[#171e1e] mb-2 tracking-tight">
                {book.title}
              </h1>
              <h2 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl sm:text-2xl text-[#434848] font-normal italic">
                {book.author}
              </h2>
            </div>

            {/* Bento-style Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* Stat 1: 현재 재고 */}
              <div className="bg-[#ffffff] p-4 rounded-2xl border border-[#c3c7c7] shadow-xs flex flex-col justify-between">
                <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs font-bold text-[#434848] uppercase tracking-wider mb-1">
                  현재 재고
                </span>
                <span className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl font-bold text-[#171e1e]">
                  {book.quantity}
                  <span className="text-sm font-normal font-['Public_Sans','Noto_Sans_KR',sans-serif] ml-1">권</span>
                </span>
              </div>

              {/* Stat 2: 판매가 */}
              <div className="bg-[#ffffff] p-4 rounded-2xl border border-[#c3c7c7] shadow-xs flex flex-col justify-between">
                <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs font-bold text-[#434848] uppercase tracking-wider mb-1">
                  판매가
                </span>
                <span className="font-['Playfair_Display','Noto_Serif_KR',serif] text-2xl sm:text-3xl font-bold text-[#171e1e]">
                  ₩{book.price.toLocaleString('ko-KR')}
                </span>
              </div>

              {/* Stat 3: 위치 */}
              <div className="bg-[#ffffff] p-4 rounded-2xl border border-[#c3c7c7] shadow-xs flex flex-col justify-between col-span-2">
                <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs font-bold text-[#434848] uppercase tracking-wider mb-1">
                  서가 위치
                </span>
                <span className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm sm:text-base text-[#171e1e] font-medium mt-1 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#737878]" />
                  {book.location || 'A4 선반, 소설 구역'}
                </span>
              </div>
            </div>

            {/* Detailed Info (List table format) */}
            <div className="bg-[#ffffff] rounded-2xl border border-[#c3c7c7] overflow-hidden shadow-xs font-['Public_Sans','Noto_Sans_KR',sans-serif]">
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#c3c7c7]">
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-xs font-bold text-[#737878] uppercase tracking-wider">
                    출판사
                  </span>
                  <span className="text-sm font-semibold text-[#171e1e]">{book.publisher}</span>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-xs font-bold text-[#737878] uppercase tracking-wider">
                    ISBN
                  </span>
                  <span className="font-mono text-sm font-semibold text-[#171e1e] tracking-wider">
                    {book.isbn}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#c3c7c7] border-t border-[#c3c7c7]">
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-xs font-bold text-[#737878] uppercase tracking-wider">
                    형태
                  </span>
                  <span className="text-sm font-semibold text-[#171e1e]">
                    {book.bindingType || '양장본'}
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-xs font-bold text-[#737878] uppercase tracking-wider">
                    출간일
                  </span>
                  <span className="text-sm font-semibold text-[#171e1e]">
                    {book.publishedDate || '2021년 4월 28일'}
                  </span>
                </div>
              </div>
            </div>

            {book.description && (
              <div className="p-4 bg-[#f5f3ee] rounded-2xl border border-[#e9e2d1] text-xs text-[#434848] leading-relaxed">
                {book.description}
              </div>
            )}
          </div>

          {/* Inventory History Timeline (Matching Stitch Image 1) */}
          <div className="space-y-4 pt-2">
            <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-2xl font-bold text-[#171e1e] flex items-center gap-2">
              <History className="w-6 h-6 text-[#737878]" />
              재고 변동 기록
            </h3>

            <div className="relative pl-6 sm:pl-8 border-l-2 border-[#c3c7c7] space-y-5 ml-3 font-['Public_Sans','Noto_Sans_KR',sans-serif]">
              {logs.length === 0 ? (
                <p className="text-sm text-[#737878] py-4">기록된 변동 내역이 없습니다.</p>
              ) : (
                logs.map((log) => {
                  const isRestock = log.reason === '입고' || log.changeQuantity > 0;
                  const isDamage = log.reason === '파손' || log.reason === '분실';
                  const isSell = log.reason === '판매';

                  return (
                    <div key={log.id} className="relative">
                      {/* Timeline Dot */}
                      <div
                        className={`absolute -left-[31px] sm:-left-[39px] top-3 bg-[#fbf9f4] border border-[#c3c7c7] rounded-full w-6 h-6 flex items-center justify-center`}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            isDamage
                              ? 'bg-[#ba1a1a]'
                              : isRestock
                              ? 'bg-[#28360c]'
                              : 'bg-[#737878]'
                          }`}
                        />
                      </div>

                      {/* Timeline Card */}
                      <div
                        className={`bg-[#ffffff] p-4 rounded-2xl border border-[#c3c7c7] shadow-xs ${
                          isDamage ? 'border-l-4 border-l-[#ba1a1a]' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1.5 flex-wrap gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${
                              isDamage
                                ? 'bg-[#ffdad6] text-[#93000a]'
                                : isRestock
                                ? 'bg-[#d6eaaf] text-[#3c4c20]'
                                : 'bg-[#f0eee9] text-[#434848]'
                            }`}
                          >
                            {isRestock && <ArrowDown className="w-3.5 h-3.5" />}
                            {isSell && <ArrowUp className="w-3.5 h-3.5" />}
                            {isDamage && <AlertCircle className="w-3.5 h-3.5" />}
                            {log.changeQuantity > 0 ? `+${log.changeQuantity}` : log.changeQuantity}{' '}
                            {log.reason}
                          </span>
                          <span className="text-xs text-[#737878] font-mono">
                            {formatLogDate(log.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#171e1e] mt-2">
                          {log.note || '재고 수량 변동이 기록되었습니다.'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => onNavigate('history')}
              className="mt-4 text-[#171e1e] hover:text-[#2c3333] font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              전체 서점 기록 보기 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {modalMode && (
        <StockAdjustModal
          book={book}
          initialMode={modalMode}
          onClose={() => setModalMode(null)}
          onSuccess={(msg) => onShowToast(msg)}
        />
      )}
    </div>
  );
};
