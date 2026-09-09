import React, { useState, useEffect } from 'react';
import { BookWithStock, ViewType } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { authStore } from '../services/authStore';
import { getDisplayCategory } from '../utils/category';
import { BookCover } from '../components/common/BookCover';
import { StockBadge } from '../components/common/StockBadge';
import { StockAdjustModal } from '../components/modals/StockAdjustModal';
import { EditBookModal } from '../components/modals/EditBookModal';
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
  BookOpen,
  Trash2,
  AlertTriangle,
  X,
  FileEdit,
  Camera,
  UploadCloud,
  Bookmark
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
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(authStore.isAdmin);
  const [, setTick] = useState(0);

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
      {/* Breadcrumb / Back Navigation & Quick Edit Bar */}
      <div className="flex items-center justify-between text-sm text-[#434848] font-['Public_Sans','Noto_Sans_KR',sans-serif]">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="hover:text-[#171e1e] transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>재고 목록으로 돌아가기</span>
          </button>
          <span className="text-[#c3c7c7]">/</span>
          <span className="text-[#171e1e] font-semibold">{getDisplayCategory(book)}</span>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#ffffff] hover:bg-[#f5f3ee] border border-[#c3c7c7] text-[#171e1e] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <FileEdit className="w-3.5 h-3.5 text-[#171e1e]" />
            <span>도서 정보 수정</span>
          </button>
        )}
      </div>

      {/* Main Grid: Left Column Cover + Actions, Right Column Metadata & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (4 cols on desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Book Cover Card */}
          <div className="bg-[#ffffff] rounded-2xl p-5 border border-[#c3c7c7] shadow-sm relative overflow-hidden group">
            <div
              onClick={() => isAdmin && setIsEditModalOpen(true)}
              className={`aspect-[2/3] w-full relative rounded-xl overflow-hidden border border-[#c3c7c7] shadow-[inset_4px_0_10px_rgba(0,0,0,0.12)] bg-[#f0eee9] ${
                isAdmin ? 'cursor-pointer' : ''
              }`}
              title={isAdmin ? '클릭하여 도서 표지 및 정보 수정' : undefined}
            >
              <img
                src={book.coverImage}
                alt={book.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />

              {/* Hover overlay to directly edit cover image (관리자 전용) */}
              {isAdmin && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center">
                    <UploadCloud className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-bold bg-black/60 px-3 py-1 rounded-full">
                    표지 직접 변경 / 수정
                  </span>
                </div>
              )}
            </div>

            {/* Status Badge Overlay */}
            <div className="absolute top-8 right-8 pointer-events-none">
              <StockBadge quantity={book.quantity} showExactRemaining />
            </div>
          </div>

          {/* Primary Action Buttons (관리자 전용) */}
          {isAdmin && (
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

              {/* [도서 정보 및 표지 수정] */}
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="border border-[#c3c7c7] text-[#171e1e] bg-[#ffffff] hover:bg-[#f5f3ee] py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 font-bold text-xs active:translate-y-[1px] cursor-pointer shadow-xs"
              >
                <FileEdit className="w-4 h-4 text-[#737878]" />
                <span>도서 정보 & 표지 수정</span>
              </button>

              {/* [도서 삭제] */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="border border-[#ffdad6] text-[#ba1a1a] bg-[#fff8f7] hover:bg-[#ffdad6]/40 py-2.5 px-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 font-bold text-xs active:translate-y-[1px] cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-[#ba1a1a]" />
                <span>도서 삭제</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column (8 cols on desktop) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Header & Core Editorial Metadata */}
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2.5">
                  <button
                    type="button"
                    onClick={async () => {
                      const newStatus = await inventoryStore.toggleReaderPick(book.id);
                      feedback.playBeep('click');
                      onShowToast(
                        newStatus
                          ? `'${book.title}'이(가) 독자픽으로 지정되었습니다.`
                          : `'${book.title}'의 독자픽 지정이 해제되었습니다.`
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                      book.isReaderPick
                        ? 'bg-[#fff8e1] text-[#b78103] border border-[#ffe082]'
                        : 'bg-white text-[#737878] border border-[#c3c7c7] hover:text-[#171e1e] hover:border-[#171e1e]'
                    }`}
                    title={book.isReaderPick ? '클릭 시 독자픽 해제' : '클릭 시 독자픽 지정'}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${book.isReaderPick ? 'fill-[#b78103]' : ''}`} />
                    <span>{book.isReaderPick ? '독자픽 도서' : '독자픽 지정'}</span>
                  </button>
                  <span className="text-xs text-[#737878] bg-[#f0eee9] px-2 py-0.5 rounded-md font-medium">
                    {getDisplayCategory(book)}
                  </span>
                </div>
                <h1 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl sm:text-4xl md:text-5xl font-bold text-[#171e1e] mb-2 tracking-tight break-words">
                  {book.title}
                </h1>
                <h2 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl sm:text-2xl text-[#434848] font-normal italic">
                  {book.author}
                </h2>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-2.5 bg-white border border-[#c3c7c7] hover:bg-[#f5f3ee] rounded-2xl text-[#434848] hover:text-[#171e1e] transition-all cursor-pointer shadow-xs flex-shrink-0"
                  title="도서 정보 수정"
                >
                  <FileEdit className="w-4 h-4" />
                </button>
              )}
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
                    분류 (소분류)
                  </span>
                  <span className="text-sm font-semibold text-[#171e1e]">
                    {getDisplayCategory(book)}
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

      {/* Edit Book Modal */}
      {isEditModalOpen && (
        <EditBookModal
          book={book}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(_updated, msg) => {
            onShowToast(msg);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
          onClick={() => setShowDeleteConfirm(false)}
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
                    도서 삭제
                  </h3>
                  <p className="text-xs text-[#737878]">이 작업은 되돌릴 수 없습니다.</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-[#737878] hover:text-[#171e1e] p-1 rounded-lg hover:bg-[#f5f3ee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-[#f5f3ee] rounded-xl border border-[#e9e2d1] flex items-center gap-3.5">
              <BookCover src={book.coverImage} alt={book.title} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[#171e1e] text-sm truncate">{book.title}</div>
                <div className="text-xs text-[#737878] mt-0.5">{book.author} · {book.publisher}</div>
                <div className="text-xs text-[#ba1a1a] font-semibold mt-1">
                  현재 보유 재고: {book.quantity}권
                </div>
              </div>
            </div>

            <p className="text-xs text-[#434848] leading-relaxed">
              도서를 삭제하면 서점 카탈로그 및 해당 도서의 모든 재고 내역이 데이터베이스에서 함께 삭제됩니다. 정말로 삭제하시겠습니까?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#434848] hover:bg-[#f5f3ee] border border-[#c3c7c7] cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  const title = book.title;
                  inventoryStore.deleteBook(book.id);
                  feedback.playBeep('warning');
                  onShowToast(`도서 '${title}'(이)가 삭제되었습니다.`);
                  setShowDeleteConfirm(false);
                  onBack();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#ba1a1a] hover:bg-[#93000a] flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>삭제 확인</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
