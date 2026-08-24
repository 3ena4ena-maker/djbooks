import React, { useState } from 'react';
import { StockReason } from '../types';
import { inventoryStore } from '../services/inventoryStore';
import { BookCover } from '../components/common/BookCover';
import {
  History as HistoryIcon,
  ArrowDown,
  ArrowUp,
  AlertCircle,
  Filter,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';

interface HistoryViewProps {
  onSelectBook: (bookId: string) => void;
  onNavigateHome: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onSelectBook,
  onNavigateHome,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('all');
  const logs = inventoryStore.getLogs();

  const reasons = [
    { id: 'all', label: '전체 변동' },
    { id: '입고', label: '입고' },
    { id: '판매', label: '판매' },
    { id: '반품', label: '반품' },
    { id: '파손', label: '파손/분실' },
    { id: '기타', label: '기타/조정' },
  ];

  const filteredLogs = logs.filter((log) => {
    if (selectedReason === 'all') return true;
    if (selectedReason === '파손') return log.reason === '파손' || log.reason === '분실';
    if (selectedReason === '기타') return log.reason === '기타' || log.reason === '증정';
    return log.reason === selectedReason;
  });

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
            const isRestock = log.reason === '입고' || log.changeQuantity > 0;
            const isDamage = log.reason === '파손' || log.reason === '분실';
            const isSell = log.reason === '판매';

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
                            : isRestock
                            ? 'bg-[#d6eaaf] text-[#3c4c20]'
                            : 'bg-[#f0eee9] text-[#434848]'
                        }`}
                      >
                        {isRestock && <ArrowDown className="w-3 h-3" />}
                        {isSell && <ArrowUp className="w-3 h-3" />}
                        {isDamage && <AlertCircle className="w-3 h-3" />}
                        {log.changeQuantity > 0 ? `+${log.changeQuantity}` : log.changeQuantity}{' '}
                        {log.reason}
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

                <div className="flex flex-col items-end flex-shrink-0 text-right">
                  <span className="font-mono text-xs text-[#737878]">
                    {formatLogDate(log.createdAt)}
                  </span>
                  <span className="text-xs font-semibold text-[#171e1e] mt-1">
                    변동 후: <strong className="font-mono font-bold">{log.resultingQuantity}권</strong>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
