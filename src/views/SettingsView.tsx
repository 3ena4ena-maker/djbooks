import React, { useState } from 'react';
import { inventoryStore, AppSettings } from '../services/inventoryStore';
import { feedback } from '../utils/feedback';
import {
  Settings as SettingsIcon,
  Store,
  Volume2,
  Database,
  RotateCcw,
  Download,
  Check,
  ShieldAlert,
  Code2,
  Copy
} from 'lucide-react';

interface SettingsViewProps {
  onShowToast: (message: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onShowToast }) => {
  const currentSettings = inventoryStore.getSettings();
  const [storeName, setStoreName] = useState(currentSettings.storeName);
  const [branchName, setBranchName] = useState(currentSettings.branchName);
  const [threshold, setThreshold] = useState(currentSettings.lowStockThreshold);
  const [soundEnabled, setSoundEnabled] = useState(currentSettings.soundEnabled);
  const [showSqlModal, setShowSqlModal] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    inventoryStore.updateSettings({
      storeName,
      branchName,
      lowStockThreshold: Number(threshold) || 3,
      soundEnabled,
    });
    feedback.playBeep('success');
    onShowToast('설정이 저장되었습니다.');
  };

  const handleResetData = () => {
    if (window.confirm('모든 재고 및 변경 기록을 초기 샘플 데이터로 초기화하시겠습니까?')) {
      inventoryStore.resetToSampleData();
      feedback.playBeep('success');
      onShowToast('샘플 데이터로 초기화되었습니다.');
      setStoreName('책방 재고');
      setBranchName('본점');
      setThreshold(3);
    }
  };

  const handleExportJson = () => {
    const data = {
      books: inventoryStore.getBooks(),
      inventoryWithStock: inventoryStore.getBooksWithStock(),
      logs: inventoryStore.getLogs(),
      settings: inventoryStore.getSettings(),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folio-flow-inventory-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('재고 데이터 백업 JSON이 다운로드되었습니다.');
  };

  const supabaseSqlSchema = `-- 📚 Supabase / PostgreSQL Schema for Folio Flow Independent Bookstore

CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn VARCHAR(32) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  cover_image TEXT,
  category VARCHAR(64) DEFAULT '소설',
  published_date VARCHAR(64),
  binding_type VARCHAR(64) DEFAULT '양장본',
  location VARCHAR(128) DEFAULT 'A1 선반',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  book_id UUID PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  change_quantity INTEGER NOT NULL,
  resulting_quantity INTEGER NOT NULL,
  reason VARCHAR(32) NOT NULL CHECK (reason IN ('입고', '판매', '반품', '파손', '증정', '분실', '기타')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for instant barcode / ISBN lookup
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_book_id ON inventory_logs(book_id);
`;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 select-none pb-16">
      <div>
        <h1 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-3xl font-bold text-[#171e1e] mb-1.5 flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-[#737878]" />
          서점 환경 설정
        </h1>
        <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm text-[#434848]">
          책방 정보, 재고 부족 경고 기준, 데이터베이스 설정을 관리합니다.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 font-['Public_Sans','Noto_Sans_KR',sans-serif]">
        {/* Card 1: Store Information */}
        <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#c3c7c7] shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#171e1e] flex items-center gap-2 border-b border-[#e4e2dd] pb-3">
            <Store className="w-5 h-5 text-[#737878]" />
            서점 기본 정보
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                서점 이름
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-sm font-medium focus:bg-white focus:border-[#171e1e] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                지점 / 부서명
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-sm font-medium focus:bg-white focus:border-[#171e1e] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Inventory & Alert Rules */}
        <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#c3c7c7] shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#171e1e] flex items-center gap-2 border-b border-[#e4e2dd] pb-3">
            <ShieldAlert className="w-5 h-5 text-[#737878]" />
            재고 알림 및 피드백
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                재고 부족 경고 기준 (권 이하)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={threshold}
                  onChange={(e) => setThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-32 px-3.5 py-2.5 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-sm font-bold text-center focus:bg-white focus:border-[#171e1e] outline-none"
                />
                <span className="text-xs text-[#737878]">권 이하 시 '재고 부족' 뱃지 표시</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#f5f3ee] rounded-xl border border-[#e9e2d1]">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-5 h-5 text-[#737878]" />
                <div>
                  <span className="text-xs font-bold text-[#171e1e] block">바코드 스캔 비프음</span>
                  <span className="text-[11px] text-[#737878]">스캔 및 입출고 시 음향 피드백</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="w-5 h-5 accent-[#171e1e] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-[#171e1e] text-white rounded-xl text-sm font-bold hover:bg-[#2c3333] transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>설정 저장</span>
          </button>
        </div>
      </form>

      {/* Card 3: Database & Backup Management */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#c3c7c7] shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#171e1e] flex items-center gap-2 border-b border-[#e4e2dd] pb-3">
          <Database className="w-5 h-5 text-[#737878]" />
          데이터베이스 및 백업
        </h2>

        <p className="text-xs text-[#434848] leading-relaxed">
          현재 앱은 브라우저 안전 스토리지에 데이터를 실시간 저장합니다. 향후 Supabase 또는 클라우드 PostgreSQL 연동을 위한 전용 테이블 스키마가 완벽하게 준비되어 있습니다.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExportJson}
            className="px-4 py-2.5 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-xs font-bold text-[#171e1e] hover:bg-[#eae8e3] flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>재고 데이터 JSON 백업</span>
          </button>

          <button
            onClick={() => setShowSqlModal(true)}
            className="px-4 py-2.5 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-xs font-bold text-[#171e1e] hover:bg-[#eae8e3] flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="w-4 h-4" />
            <span>Supabase SQL 스키마 보기</span>
          </button>

          <button
            onClick={handleResetData}
            className="px-4 py-2.5 bg-[#ffdad6] text-[#93000a] rounded-xl text-xs font-bold hover:bg-[#ffdad6]/80 flex items-center gap-1.5 ml-auto cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>샘플 데이터로 초기화</span>
          </button>
        </div>
      </div>

      {/* Supabase Schema Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="bg-[#1b1c19] text-white w-full max-w-2xl rounded-2xl p-5 shadow-2xl border border-white/20 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-mono text-xs text-[#d6eaaf]">Supabase Schema (DDL)</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(supabaseSqlSchema);
                  onShowToast('SQL 스키마가 클립보드에 복사되었습니다.');
                }}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-xs rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> 복사하기
              </button>
            </div>
            <pre className="p-3 my-3 bg-black/50 rounded-xl overflow-x-auto text-[11px] font-mono text-white/90 flex-1 leading-relaxed">
              {supabaseSqlSchema}
            </pre>
            <button
              onClick={() => setShowSqlModal(false)}
              className="mt-2 w-full py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-white/90 cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
