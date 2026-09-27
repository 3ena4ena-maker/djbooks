import React, { useState } from 'react';
import { inventoryStore, AppSettings, NationalLibraryApiResult } from '../services/inventoryStore';
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
  Copy,
  Library,
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  BookOpen
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

  // National Library API Diagnostic State
  const [nlIsbnInput, setNlIsbnInput] = useState('9788937460005');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlResult, setNlResult] = useState<NationalLibraryApiResult | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleTestNationalLibraryApi = async (targetIsbn?: string) => {
    const isbnToQuery = (targetIsbn || nlIsbnInput).trim().replace(/[^0-9X]/gi, '');
    if (!isbnToQuery) {
      onShowToast('조회할 ISBN을 입력해주세요.');
      return;
    }
    setNlLoading(true);
    setNlResult(null);
    try {
      const res = await inventoryStore.queryNationalLibraryApi(isbnToQuery);
      setNlResult(res);
      if (res.success) {
        feedback.playBeep('success');
        onShowToast(`국립중앙도서관 API 응답 성공: ${res.fields?.TITLE || '도서 확인'}`);
      } else if (res.reason === 'NL_CONFIG_ERROR') {
        onShowToast('NL_CERT_KEY 환경변수가 아직 설정되지 않았습니다.');
      } else if (res.reason === 'NOT_FOUND') {
        onShowToast('국립중앙도서관에 등록되지 않은 ISBN입니다.');
      } else {
        onShowToast(res.message || 'API 호출 오류 발생');
      }
    } catch (e: any) {
      onShowToast(`테스트 오류: ${e?.message || '네트워크 에러'}`);
    } finally {
      setNlLoading(false);
    }
  };

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

      {/* Card 4: National Library of Korea ISBN API Diagnostics & Verification */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#c3c7c7] shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e4e2dd] pb-3">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-[#171e1e]" />
            <h2 className="text-base font-bold text-[#171e1e]">
              국립중앙도서관 ISBN 서지정보 API 연동 검증
            </h2>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 bg-[#f0eee9] text-[#434848] rounded-full self-start sm:self-auto">
            /api/nl-book ↔ seoji/SearchApi.do
          </span>
        </div>

        <div className="text-xs text-[#434848] space-y-1.5 leading-relaxed">
          <p>
            국립중앙도서관 공식 ISBN 서지정보 API를 서버 프록시(<code>/api/nl-book</code>)를 통해 안전하게 호출합니다.
            인증키(<code>NL_CERT_KEY</code>)는 브라우저에 노출되지 않고 서버 환경변수에서만 처리됩니다.
          </p>
        </div>

        {/* Input & Action Section */}
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1.5">
              조회할 ISBN-13 바코드 번호
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={nlIsbnInput}
                  onChange={(e) => setNlIsbnInput(e.target.value)}
                  placeholder="예: 9788937460005 (13자리 ISBN)"
                  maxLength={17}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-sm font-mono font-medium focus:bg-white focus:border-[#171e1e] outline-none"
                />
                <Search className="w-4 h-4 text-[#737878] absolute left-3 top-3" />
              </div>
              <button
                type="button"
                disabled={nlLoading}
                onClick={() => handleTestNationalLibraryApi()}
                className="px-5 py-2.5 bg-[#171e1e] text-white rounded-xl text-xs font-bold hover:bg-[#2c3333] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                {nlLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>조회 중...</span>
                  </>
                ) : (
                  <>
                    <Library className="w-4 h-4" />
                    <span>국립중앙도서관 API 조회</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick ISBN Sample Buttons */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-[#737878]">
            <span className="font-semibold text-[#434848]">샘플 ISBN 테스트:</span>
            <button
              type="button"
              onClick={() => {
                setNlIsbnInput('9788937460005');
                handleTestNationalLibraryApi('9788937460005');
              }}
              className="px-2.5 py-1 bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#171e1e] rounded-lg text-xs font-medium cursor-pointer transition-colors border border-[#e4e2dd]"
            >
              데미안 (9788937460005)
            </button>
            <button
              type="button"
              onClick={() => {
                setNlIsbnInput('9788936434267');
                handleTestNationalLibraryApi('9788936434267');
              }}
              className="px-2.5 py-1 bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#171e1e] rounded-lg text-xs font-medium cursor-pointer transition-colors border border-[#e4e2dd]"
            >
              소년이 온다 (9788936434267)
            </button>
            <button
              type="button"
              onClick={() => {
                setNlIsbnInput('9788954682152');
                handleTestNationalLibraryApi('9788954682152');
              }}
              className="px-2.5 py-1 bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#171e1e] rounded-lg text-xs font-medium cursor-pointer transition-colors border border-[#e4e2dd]"
            >
              작별하지 않는다 (9788954682152)
            </button>
          </div>
        </div>

        {/* Test Result Display Area */}
        {nlResult && (
          <div className="pt-3 border-t border-[#e4e2dd] space-y-4">
            {/* Status Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#171e1e] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#737878]" />
                API 응답 결과
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                  nlResult.success
                    ? 'bg-[#d6eaaf] text-[#142000]'
                    : nlResult.reason === 'NL_CONFIG_ERROR'
                    ? 'bg-[#ffe082] text-[#5d4037]'
                    : 'bg-[#ffdad6] text-[#93000a]'
                }`}
              >
                {nlResult.success
                  ? '✓ 정상 조회 완료 (200 OK)'
                  : nlResult.reason === 'NL_CONFIG_ERROR'
                  ? '⚠ 서버 환경변수 키 미설정'
                  : nlResult.reason === 'NOT_FOUND'
                  ? '○ 도서 정보 없음'
                  : `✕ 오류: ${nlResult.reason}`}
              </span>
            </div>

            {/* Config Error Guidance Box */}
            {nlResult.reason === 'NL_CONFIG_ERROR' && (
              <div className="p-3.5 bg-[#fff8e1] border border-[#ffe082] rounded-xl text-xs text-[#5d4037] space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <AlertCircle className="w-4 h-4 text-[#f57f17]" />
                  서버 환경변수 NL_CERT_KEY 필요
                </div>
                <p>
                  국립중앙도서관 OpenAPI 인증키가 서버 환경변수에 아직 등록되지 않았습니다.
                </p>
                <div className="bg-white/80 p-2.5 rounded-lg border border-[#ffe082] font-mono text-[11px] space-y-1">
                  <div>• Cloudflare Pages: [Settings] → [Environment Variables] → Secret으로 <code>NL_CERT_KEY</code> 추가</div>
                  <div>• 로컬 개발: 프로젝트 루트 <code>.env</code> 파일에 <code>NL_CERT_KEY=발급받은키</code> 설정</div>
                </div>
              </div>
            )}

            {/* Not Found Box */}
            {nlResult.reason === 'NOT_FOUND' && (
              <div className="p-3 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl text-xs text-[#434848]">
                해당 ISBN(<code>{nlIsbnInput}</code>)에 대한 서지정보가 국립중앙도서관 DB에 등록되어 있지 않습니다.
              </div>
            )}

            {/* API Error Box */}
            {nlResult.reason === 'NL_API_ERROR' && (
              <div className="p-3.5 bg-[#ffdad6] border border-[#ffb4ab] rounded-xl text-xs text-[#93000a] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  국립중앙도서관 API 에러
                </div>
                <p>
                  {nlResult.message} {nlResult.errorCode ? `(코드: ${nlResult.errorCode})` : ''}
                </p>
              </div>
            )}

            {/* Field Extraction Table (Requested Key Fields) */}
            {nlResult.success && nlResult.fields && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#434848] uppercase tracking-wider">
                  실제 API 응답 추출 필드 (OpenAPI 규격 대조)
                </div>
                <div className="overflow-x-auto rounded-xl border border-[#c3c7c7]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#f0eee9] text-[#171e1e] font-bold border-b border-[#c3c7c7]">
                      <tr>
                        <th className="px-3.5 py-2">필드명</th>
                        <th className="px-3.5 py-2">설명</th>
                        <th className="px-3.5 py-2">실제 응답 값</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e4e2dd] bg-white font-mono text-[11px]">
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-[#171e1e]">EA_ISBN</td>
                        <td className="px-3.5 py-2 text-[#737878] font-sans">도서 13자리 ISBN</td>
                        <td className="px-3.5 py-2 text-[#171e1e]">{nlResult.fields.EA_ISBN || '-'}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-[#171e1e]">TITLE</td>
                        <td className="px-3.5 py-2 text-[#737878] font-sans">도서 표제명</td>
                        <td className="px-3.5 py-2 text-[#171e1e] font-sans font-bold">{nlResult.fields.TITLE || '-'}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-[#171e1e]">AUTHOR</td>
                        <td className="px-3.5 py-2 text-[#737878] font-sans">저자/역자</td>
                        <td className="px-3.5 py-2 text-[#171e1e] font-sans">{nlResult.fields.AUTHOR || '-'}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-[#171e1e]">PUBLISHER</td>
                        <td className="px-3.5 py-2 text-[#737878] font-sans">출판사</td>
                        <td className="px-3.5 py-2 text-[#171e1e] font-sans">{nlResult.fields.PUBLISHER || '-'}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-[#171e1e]">PUBLISH_PREDATE</td>
                        <td className="px-3.5 py-2 text-[#737878] font-sans">출판(예정)일자</td>
                        <td className="px-3.5 py-2 text-[#171e1e]">{nlResult.fields.PUBLISH_PREDATE || '-'}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-[#171e1e]">PRE_PRICE</td>
                        <td className="px-3.5 py-2 text-[#737878] font-sans">정가 / 가격</td>
                        <td className="px-3.5 py-2 text-[#171e1e]">
                          {nlResult.fields.PRE_PRICE ? `${Number(nlResult.fields.PRE_PRICE).toLocaleString()}원` : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-[#171e1e]">KDC</td>
                        <td className="px-3.5 py-2 text-[#737878] font-sans">KDC 분류명</td>
                        <td className="px-3.5 py-2 text-[#171e1e] font-sans">{nlResult.fields.KDC || '(미제공)'}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-[#171e1e]">KDC_CLASS_NO</td>
                        <td className="px-3.5 py-2 text-[#737878] font-sans">KDC 분류기호</td>
                        <td className="px-3.5 py-2 text-[#171e1e]">{nlResult.fields.KDC_CLASS_NO || '(미제공)'}</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2 font-bold text-[#171e1e]">EA_ADD_CODE</td>
                        <td className="px-3.5 py-2 text-[#737878] font-sans">부가기호(5자리)</td>
                        <td className="px-3.5 py-2 text-[#171e1e]">{nlResult.fields.EA_ADD_CODE || '(미제공)'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Dokja Bookstore Normalized Book Preview */}
                {nlResult.book && (
                  <div className="p-4 bg-[#f5f3ee] rounded-xl border border-[#c3c7c7] space-y-2">
                    <div className="text-xs font-bold text-[#171e1e] flex items-center justify-between">
                      <span>독자서점 Book 모델 자동 변환 결과</span>
                      <span className="text-[11px] font-normal text-[#737878]">
                        카테고리 변환: {nlResult.book.category || '일반도서'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-[#e4e2dd]">
                        <span className="text-[10px] text-[#737878] block">도서명</span>
                        <span className="font-bold text-[#171e1e] truncate block">{nlResult.book.title}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-[#e4e2dd]">
                        <span className="text-[10px] text-[#737878] block">저자 / 출판사</span>
                        <span className="font-medium text-[#171e1e] truncate block">
                          {nlResult.book.author} / {nlResult.book.publisher}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-[#e4e2dd]">
                        <span className="text-[10px] text-[#737878] block">판매 가격</span>
                        <span className="font-bold text-[#171e1e] block">
                          {nlResult.book.price?.toLocaleString()}원
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-[#e4e2dd]">
                        <span className="text-[10px] text-[#737878] block">출판일</span>
                        <span className="font-mono text-[#171e1e] block">
                          {nlResult.book.publishedDate || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Raw JSON Accordion Viewer */}
            {nlResult.raw && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#f0eee9] hover:bg-[#eae8e3] rounded-xl text-xs font-mono text-[#171e1e] cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-sans font-bold">
                    <Code2 className="w-3.5 h-3.5" />
                    서버 응답 원시 JSON ({showRawJson ? '접기' : '상세 펼치기'})
                  </span>
                  {showRawJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showRawJson && (
                  <div className="relative mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(nlResult.raw, null, 2));
                        onShowToast('원시 JSON 응답이 클립보드에 복사되었습니다.');
                      }}
                      className="absolute right-2.5 top-2.5 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-[11px] rounded-md flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> 복사
                    </button>
                    <pre className="p-3 bg-[#1b1c19] text-[#d6eaaf] rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-60">
                      {JSON.stringify(nlResult.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
