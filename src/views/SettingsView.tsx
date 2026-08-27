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
  const [threshold, setThreshold] = useState<number | string>(currentSettings.lowStockThreshold);
  const [soundEnabled, setSoundEnabled] = useState(currentSettings.soundEnabled);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalThreshold = threshold === '' ? 0 : Math.max(0, parseInt(String(threshold), 10) || 0);
    inventoryStore.updateSettings({
      storeName: storeName.trim() || '책방 재고',
      branchName: branchName.trim() || '본점',
      lowStockThreshold: finalThreshold,
      soundEnabled,
    });
    feedback.playBeep('success');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
    onShowToast('서점 기본 정보 및 환경 설정이 저장되었습니다.');
  };

  const handleResetData = () => {
    if (window.confirm('모든 재고 및 변경 기록을 초기 샘플 데이터로 초기화하시겠습니까?')) {
      inventoryStore.resetToSampleData();
      feedback.playBeep('success');
      onShowToast('샘플 데이터로 초기화되었습니다.');
      setStoreName('독자서점');
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

CREATE TABLE IF NOT EXISTS customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title TEXT NOT NULL,
  book_author TEXT,
  publisher TEXT,
  book_publisher TEXT,
  isbn VARCHAR(32),
  quantity INTEGER NOT NULL DEFAULT 1,
  customer_name TEXT NOT NULL,
  contact TEXT,
  customer_contact TEXT,
  deposit_paid BOOLEAN DEFAULT false,
  deposit_amount NUMERIC(10, 2) DEFAULT 0,
  deposit_method VARCHAR(32) DEFAULT 'NONE',
  total_price NUMERIC(10, 2),
  order_price NUMERIC(10, 2),
  order_type VARCHAR(64) DEFAULT 'CUSTOMER_REQUEST',
  status VARCHAR(32) NOT NULL DEFAULT '주문접수',
  note TEXT,
  memo TEXT,
  order_date VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Index for instant lookup
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_book_id ON inventory_logs(book_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);

-- 🔐 Row Level Security (RLS) Policies (Full Access for Anon / Authenticated)
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all on books" ON books FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on inventory" ON inventory FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on inventory_logs" ON inventory_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on customer_orders" ON customer_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

  const [sqlTab, setSqlTab] = useState<'ddl' | 'diagnostic'>('ddl');

  const supabaseDiagnosticSql = `-- ==========================================
-- 🛠️ customer_orders Supabase 진단 쿼리 🛠️
-- ==========================================

-- 1. customer_orders 테이블 컬럼 목록 및 데이터 타입 확인
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'customer_orders'
ORDER BY ordinal_position;

-- 2. customer_orders 테이블 RLS 활성화 여부 확인
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'customer_orders';

-- 3. customer_orders 테이블에 설정된 RLS 정책 목록 (cmd: ALL, SELECT, INSERT, UPDATE, DELETE)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'customer_orders';

-- 4. [원클릭 복구] UPDATE 권한 포함 RLS 정책 전체 허용 SQL
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on customer_orders" ON customer_orders;
CREATE POLICY "Allow all on customer_orders"
ON customer_orders
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
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
          <div className="border-b border-[#e4e2dd] pb-3 space-y-1">
            <h2 className="text-base font-bold text-[#171e1e] flex items-center gap-2">
              <Store className="w-5 h-5 text-[#737878]" />
              서점 기본 정보
            </h2>
            <p className="text-xs text-[#737878] pl-7">메인 대시보드 및 상단에 실시간 반영</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                서점 이름
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="예: 책방 재고, 달빛 서점"
                className="w-full px-3.5 py-2.5 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-sm font-medium focus:bg-white focus:border-[#171e1e] outline-none"
              />
              <p className="text-[11px] text-[#737878] mt-1">
                * 저장 시 메인 대시보드와 상단 헤더의 서점 이름이 즉시 변경됩니다.
              </p>
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                지점 / 부서명
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="예: 본점, 성수점, 1호점"
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
                  min="0"
                  max="100"
                  value={threshold}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setThreshold('');
                    } else {
                      const num = parseInt(val, 10);
                      setThreshold(isNaN(num) ? 0 : Math.max(0, num));
                    }
                  }}
                  onBlur={() => {
                    if (threshold === '' || isNaN(Number(threshold))) {
                      setThreshold(0);
                    }
                  }}
                  className="w-28 px-3.5 py-2.5 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-sm font-bold text-center focus:bg-white focus:border-[#171e1e] outline-none"
                />
                <span className="text-xs text-[#737878]">
                  {threshold === 0 || threshold === '0'
                    ? '권 (0권 설정: 품절 시에만 알림)'
                    : `권 이하 시 '재고 부족' 뱃지 표시`}
                </span>
              </div>
              <p className="text-[11px] text-[#737878] mt-1.5">
                * 0권으로 설정하면 재고가 0권(품절)인 도서만 재고 부족으로 분류됩니다.
              </p>
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

        {/* Primary Save Action Banner */}
        <div className="bg-[#f0eee9] p-4 rounded-2xl border border-[#c3c7c7] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="text-xs text-[#434848] text-center sm:text-left">
            <p className="font-bold text-[#171e1e]">설정 변경사항을 적용하시겠습니까?</p>
            <p className="text-[11px]">서점 이름, 지점명, 재고 알림 기준(0권 포함)이 즉시 반영됩니다.</p>
          </div>
          <button
            type="submit"
            className={`w-full sm:w-auto px-7 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
              isSaved
                ? 'bg-[#d6eaaf] text-[#142000]'
                : 'bg-[#171e1e] text-white hover:bg-[#2c3333] active:scale-98'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{isSaved ? '수정 저장 완료!' : '수정 저장'}</span>
          </button>
        </div>
      </form>

      {/* Card 3: Supabase Cloud Database & Backup Management */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#c3c7c7] shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#e4e2dd] pb-3">
          <h2 className="text-base font-bold text-[#171e1e] flex items-center gap-2">
            <Database className="w-5 h-5 text-[#737878]" />
            Supabase 클라우드 데이터베이스
          </h2>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              inventoryStore.isConnectedToSupabase
                ? 'bg-[#d6eaaf] text-[#142000]'
                : 'bg-[#f0eee9] text-[#737878]'
            }`}
          >
            {inventoryStore.isConnectedToSupabase ? '● 실시간 연동 중' : '○ 로컬 스토리지 모드'}
          </span>
        </div>

        <div className="text-xs text-[#434848] space-y-2 leading-relaxed">
          <div className="p-3 bg-[#f5f3ee] rounded-xl border border-[#e9e2d1] font-mono text-[11px] break-all">
            <div className="text-[#737878] mb-1 font-sans font-bold">연결된 Supabase URL:</div>
            <div className="text-[#171e1e]">https://moubboivhveqdqrwmlkq.supabase.co</div>
          </div>
          <p>
            도서 목록(<code className="font-mono bg-[#f0eee9] px-1 py-0.5 rounded">books</code>), 실시간 재고(<code className="font-mono bg-[#f0eee9] px-1 py-0.5 rounded">inventory</code>), 입출고 변경 내역(<code className="font-mono bg-[#f0eee9] px-1 py-0.5 rounded">inventory_transactions</code>)이 원자적으로 보존 및 동기화됩니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={async () => {
              const ok = await inventoryStore.fetchFromSupabase();
              if (ok) {
                feedback.playBeep('success');
                onShowToast('Supabase 데이터 동기화 완료');
              } else {
                onShowToast('동기화 실패: 네트워크 또는 Key를 확인하세요.');
              }
            }}
            className="px-4 py-2.5 bg-[#171e1e] text-white rounded-xl text-xs font-bold hover:bg-[#2c3333] flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Supabase 지금 동기화</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-4 py-2.5 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-xs font-bold text-[#171e1e] hover:bg-[#eae8e3] flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>재고 데이터 JSON 백업</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="px-4 py-2.5 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-xs font-bold text-[#171e1e] hover:bg-[#eae8e3] flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="w-4 h-4" />
            <span>테이블 스키마 보기</span>
          </button>

          <button
            type="button"
            onClick={handleResetData}
            className="px-4 py-2.5 bg-[#ffdad6] text-[#93000a] rounded-xl text-xs font-bold hover:bg-[#ffdad6]/80 flex items-center gap-1.5 ml-auto cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>로컬 초기화</span>
          </button>
        </div>
      </div>

      {/* Supabase Schema & Diagnostic Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="bg-[#1b1c19] text-white w-full max-w-2xl rounded-2xl p-5 shadow-2xl border border-white/20 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSqlTab('ddl')}
                  className={`px-3 py-1 text-xs font-mono rounded-lg transition-all cursor-pointer ${
                    sqlTab === 'ddl'
                      ? 'bg-[#d6eaaf] text-[#142000] font-bold'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  DDL 스키마
                </button>
                <button
                  type="button"
                  onClick={() => setSqlTab('diagnostic')}
                  className={`px-3 py-1 text-xs font-mono rounded-lg transition-all cursor-pointer ${
                    sqlTab === 'diagnostic'
                      ? 'bg-[#d6eaaf] text-[#142000] font-bold'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  RLS/진단 SQL
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const sqlToCopy = sqlTab === 'ddl' ? supabaseSqlSchema : supabaseDiagnosticSql;
                  navigator.clipboard.writeText(sqlToCopy);
                  onShowToast(sqlTab === 'ddl' ? 'SQL DDL 스키마가 복사되었습니다.' : '진단용 SQL이 복사되었습니다.');
                }}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-xs rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> 복사하기
              </button>
            </div>
            <pre className="p-3 my-3 bg-black/50 rounded-xl overflow-x-auto text-[11px] font-mono text-white/90 flex-1 leading-relaxed whitespace-pre">
              {sqlTab === 'ddl' ? supabaseSqlSchema : supabaseDiagnosticSql}
            </pre>
            <button
              type="button"
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
