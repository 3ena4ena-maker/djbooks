import React, { useState } from 'react';
import { Search, ScanLine, Cloud, CloudOff, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { ViewType } from '../../types';
import { inventoryStore } from '../../services/inventoryStore';

interface TopHeaderProps {
  onNavigate: (view: ViewType) => void;
  onSearch?: (query: string) => void;
  searchQuery?: string;
  onOpenScanner?: () => void;
  onOpenAddBook?: () => void;
  currentView?: ViewType;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onNavigate,
  onSearch,
  searchQuery = '',
  onOpenScanner,
  onOpenAddBook,
  currentView,
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      onNavigate('inventory');
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await inventoryStore.fetchFromSupabase();
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  const settings = inventoryStore.getSettings();

  const viewTitleMap: Record<ViewType, string> = {
    dashboard: '홈',
    inventory: '도서 재고',
    scanner: '바코드 스캔',
    history: '재고 기록',
    settings: '서점 설정',
    detail: '도서 상세',
  };

  return (
    <header className="bg-[#fbf9f4] border-b border-[#c3c7c7] fixed top-0 left-0 right-0 lg:left-64 z-30 flex justify-between items-center h-16 px-4 md:px-8 select-none">
      {/* Mobile Title with Store Name & Current Page */}
      <div className="lg:hidden flex items-center gap-2">
        <span
          className="font-['Playfair_Display','Noto_Serif_KR',serif] text-base sm:text-lg font-bold text-[#171e1e] cursor-pointer truncate max-w-[130px]"
          onClick={() => onNavigate('dashboard')}
          title={settings.storeName || '책방 재고'}
        >
          {settings.storeName || '책방'}
        </span>
        {currentView && currentView !== 'dashboard' && (
          <span className="text-xs font-semibold text-[#434848] bg-[#f0eee9] px-2 py-0.5 rounded-md border border-[#c3c7c7] whitespace-nowrap">
            {viewTitleMap[currentView] || ''}
          </span>
        )}
      </div>

      {/* Desktop Page Location Indicator */}
      <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-bold text-[#171e1e] bg-[#f0eee9] px-3 py-1 rounded-full border border-[#c3c7c7] shadow-2xs">
          📍 {currentView ? viewTitleMap[currentView] : '홈'}
        </span>
      </div>

      {/* Global Search Bar (Desktop) */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex-grow max-w-md mx-4 hidden md:flex items-center bg-[#f5f3ee] rounded-full px-4 py-2 border border-[#e9e2d1] focus-within:border-[#171e1e] transition-colors"
      >
        <Search className="w-4 h-4 text-[#737878] mr-2 flex-shrink-0" />
        <input
          type="text"
          value={localQuery}
          onChange={handleSearchChange}
          placeholder="도서명, 저자, ISBN 검색..."
          className="bg-transparent border-none outline-none w-full font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm text-[#1b1c19] placeholder-[#737878] focus:ring-0"
        />
      </form>

      {/* Action shortcuts on top right */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Supabase Status Pill */}
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
            inventoryStore.isConnectedToSupabase
              ? 'bg-[#edf5e1] text-[#2d4710] border-[#c3d9a5] hover:bg-[#e2edd2]'
              : 'bg-[#f5f3ee] text-[#737878] border-[#c3c7c7]'
          }`}
          title={
            inventoryStore.isConnectedToSupabase
              ? 'Supabase PostgreSQL 실시간 연결됨 (클릭하여 동기화)'
              : '로컬 모드 (Supabase Key 설정 시 자동 동기화)'
          }
        >
          {isSyncing || inventoryStore.isLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3c4c20]" />
          ) : inventoryStore.isConnectedToSupabase ? (
            <Cloud className="w-3.5 h-3.5 text-[#3c4c20]" />
          ) : (
            <CloudOff className="w-3.5 h-3.5 text-[#737878]" />
          )}
          <span className="hidden sm:inline">
            {isSyncing || inventoryStore.isLoading
              ? '동기화 중...'
              : inventoryStore.isConnectedToSupabase
              ? 'DB 연결됨'
              : '로컬 모드'}
          </span>
        </button>

        <button
          onClick={() => {
            if (onOpenScanner) {
              onOpenScanner();
            } else if (onNavigate) {
              onNavigate('scanner');
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#171e1e] text-white text-xs font-semibold hover:bg-[#2c3333] transition-colors shadow-xs cursor-pointer"
          title="바코드 스캔"
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">스캔하기</span>
        </button>

        <button
          onClick={() => onNavigate('settings')}
          className="p-2 text-[#434848] hover:bg-[#f5f3ee] hover:text-[#171e1e] rounded-full transition-colors relative cursor-pointer"
          title="설정"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

