import React, { useState, useEffect } from 'react';
import { InventoryLog, StockReason } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { BookCover } from '../components/common/BookCover';
import { feedback } from '../utils/feedback';
import {
  History as HistoryIcon,
  ArrowDown,
  ArrowUp,
  AlertCircle,
  Filter,
  ArrowLeft,
  ChevronRight,
  Trash2,
  X,
  AlertTriangle
} from 'lucide-react';

interface HistoryViewProps {
  onSelectBook: (bookId: string) => void;
  onNavigateHome: () => void;
  onShowToast?: (message: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onSelectBook,
  onNavigateHome,
  onShowToast,
}) => {
  const [logs, setLogs] = useState<InventoryLog[]>(() => inventoryStore.getLogs());
  const [selectedReason, setSelectedReason] = useState<string>('all');
  const [logToDelete, setLogToDelete] = useState<InventoryLog | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = inventoryStore.subscribe(() => {
      setLogs(inventoryStore.getLogs());
    });
    return unsubscribe;
  }, []);

  const reasons = [
    { id: 'all', label: '전체 변동' },
    { id: '초기 도서 입고', label: '초기 입고' },
    { id: '재입고', label: '재입고' },
    { id: '입고', label: '일반 입고' },
    { id: '판매', label: '판매' },
    { id: '반품', label: '반품' },
    { id: '파손', label: '파손/분실' },
    { id: '기타', label: '기타/조정' },
  ];

  const filteredLogs = logs.filter((log) => {
    if (selectedReason === 'all') return true;
    if (selectedReason === '초기 도서 입고') {
      return log.reason === '초기 도서 입고' || (log.note && (log.note.includes('초기') || log.note.includes('초도')));
    }
    if (selectedReason === '재입고') {
      return log.reason === '재입고' || (log.note && log.note.includes('재입고'));
    }
    if (selectedReason === '입고') {
      return log.reason === '입고' && !(log.note && (log.note.includes('초기') || log.note.includes('초도') || log.note.includes('재입고')));
    }
    if (selectedReason === '파손') return log.reason === '파손' || log.reason === '분실';
    if (selectedReason === '기타') return log.reason === '기타' || log.reason === '증정';
    return log.reason === selectedReason;
  });

  const handleOpenDeleteModal = (e: React.MouseEvent, log: InventoryLog) => {
    e.stopPropagation();
    e.preventDefault();
    setLogToDelete(log);
  };

  const handleConfirmDelete = async () => {
    if (!logToDelete) return;
    setIsDeleting(true);
    try {
      await inventoryStore.deleteLog(logToDelete.id);
      setLogs(inventoryStore.getLogs());
      feedback.playBeep('success');
      if (onShowToast) {
        onShowToast('재고 변동 기록이 삭제되었습니다.');
      }
      setLogToDelete(null);
    } catch (err) {
      console.error('Failed to delete log:', err);
      if (onShowToast) {
        onShowToast('삭제 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const formatLogDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 select-none pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl font-bold text-[#171e1e] mb-1.5 flex items-center gap-2">
            <HistoryIcon className="w-7 h-7 text-[#737878]" />
            재고 변동 기록
          </h1>
          <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm text-[#434848]">
            서점 내 발생한 모든 입고, 판매, 파손 및 조정 이력입니다.
          </p>
        </div>

        <button
          onClick={onNavigateHome}
          className="self-start sm:self-auto text-xs font-semibold text-[#434848] hover:text-[#171e1e] flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 bg-[#f5f3ee] p-2 rounded-2xl border border-[#e9e2d1]">
        {reasons.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedReason(r.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedReason === r.id
                ? 'bg-[#171e1e] text-white shadow-xs'
                : 'bg-white text-[#434848] border border-[#c3c7c7] hover:bg-[#eae8e3]'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Log Feed */}
      <div className="space-y-3 font-['Public_Sans','Noto_Sans_KR',sans-serif]">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-[#737878] text-sm bg-white rounded-2xl border border-[#c3c7c7]">
            해당 조건의 재고 변동 내역이 없습니다.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isInitial = log.reason === '초기 도서 입고' || (log.note && (log.note.includes('초기') || log.note.includes('초도')));
            const isRestock = log.reason === '재입고' || (log.note && log.note.includes('재입고'));
            const isGeneralIn = log.reason === '입고' || log.changeQuantity > 0;
            const isDamage = log.reason === '파손' || log.reason === '분실';
            const isSell = log.reason === '판매';

            const displayReason = isInitial
              ? '초기 입고'
              : isRestock
              ? '재입고'
              : log.reason;

            return (
              <div
                key={log.id}
                onClick={() => onSelectBook(log.bookId)}
                className={`bg-white rounded-2xl p-4 border border-[#e9e2d1] hover:border-[#171e1e] transition-all shadow-xs flex items-center justify-between gap-4 cursor-pointer group ${
                  isDamage ? 'border-l-4 border-l-[#ba1a1a]' : ''
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <BookCover src={log.bookCoverImage} alt={log.bookTitle} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${
                          isDamage
                            ? 'bg-[#ffdad6] text-[#93000a]'
                            : isInitial
                            ? 'bg-[#d6eaaf] text-[#142000]'
                            : isRestock
                            ? 'bg-[#c5e09b] text-[#2c3d14]'
                            : isGeneralIn
                            ? 'bg-[#e4edd6] text-[#3c4c20]'
                            : 'bg-[#f0eee9] text-[#434848]'
                        }`}
                      >
                        {(isInitial || isRestock || isGeneralIn) && <ArrowDown className="w-3 h-3" />}
                        {isSell && <ArrowUp className="w-3 h-3" />}
                        {isDamage && <AlertCircle className="w-3 h-3" />}
                        {log.changeQuantity > 0 ? `+${log.changeQuantity}` : log.changeQuantity}{' '}
                        {displayReason}
                      </span>
                      <h3 className="font-bold text-sm text-[#171e1e] group-hover:underline truncate">
                        {log.bookTitle}
                      </h3>
                    </div>
                    <p className="text-xs text-[#737878] mt-1 truncate">
                      {log.note || '재고 수량이 업데이트되었습니다.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex flex-col items-end text-right">
                    <span className="font-mono text-xs text-[#737878]">
                      {formatLogDate(log.createdAt)}
                    </span>
                    <span className="text-xs font-semibold text-[#171e1e] mt-1">
                      변동 후: <strong className="font-mono font-bold">{log.resultingQuantity}권</strong>
                    </span>
                  </div>

                  {/* Delete Log Entry Button */}
                  <button
                    type="button"
                    title="기록 삭제"
                    onClick={(e) => handleOpenDeleteModal(e, log)}
                    className="p-2 text-[#737878] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/50 rounded-xl transition-all cursor-pointer z-10 active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {logToDelete && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => !isDeleting && setLogToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#e9e2d1] space-y-4 font-['Public_Sans','Noto_Sans_KR',sans-serif]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#ba1a1a]">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-base text-[#171e1e]">재고 변동 기록 삭제</h3>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setLogToDelete(null)}
                className="text-[#737878] hover:text-[#171e1e] p-1 rounded-lg hover:bg-[#f5f3ee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-[#f5f3ee] rounded-xl border border-[#e9e2d1] flex items-center gap-3.5">
              <BookCover src={logToDelete.bookCoverImage} alt={logToDelete.bookTitle} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[#171e1e] text-sm truncate">{logToDelete.bookTitle}</div>
                <div className="text-xs text-[#434848] mt-0.5">
                  {logToDelete.reason} ({logToDelete.changeQuantity > 0 ? `+${logToDelete.changeQuantity}` : logToDelete.changeQuantity}권)
                </div>
                <div className="text-[11px] text-[#737878] font-mono mt-0.5">
                  {formatLogDate(logToDelete.createdAt)}
                </div>
              </div>
            </div>

            <p className="text-xs text-[#434848] leading-relaxed">
              해당 재고 변동 이력 항목을 영구 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setLogToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#434848] hover:bg-[#f5f3ee] border border-[#c3c7c7] cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#ba1a1a] hover:bg-[#93000a] flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? '삭제 중...' : '기록 삭제'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
