import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ScanLine,
  Cloud,
  CloudOff,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Menu,
  X,
  LayoutDashboard,
  BookOpen,
  History,
  ClipboardList,
  PlusCircle,
  Package,
  ShieldAlert
} from 'lucide-react';
import { ViewType } from '../../types';
import { inventoryStore } from '../../services/inventoryStore';
import { authStore } from '../../services/authStore';

interface TopHeaderProps {
  onNavigate: (view: ViewType) => void;
  onSearch?: (query: string) => void;
  searchQuery?: string;
  onOpenScanner?: () => void;
  onOpenAddBook?: () => void;
  onOpenQuickRestock?: () => void;
  onShowToast?: (msg: string) => void;
  currentView?: ViewType;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onNavigate,
  onSearch,
  searchQuery = '',
  onOpenScanner,
  onOpenAddBook,
  onOpenQuickRestock,
  onShowToast,
  currentView,
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(authStore.isAdmin);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => {
      setIsAdmin(authStore.isAdmin);
    });
    return unsubscribe;
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isMenuOpen]);

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
      if (onShowToast) onShowToast('Supabase 클라우드 동기화 완료');
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  const handleToggleAdmin = () => {
    const nextState = !isAdmin;
    authStore.setAdminMode(nextState);
    if (onShowToast) {
      onShowToast(
        nextState
          ? '🎉 관리자 모드가 활성화되었습니다.'
          : '일반 모드로 전환되었습니다.'
      );
    }
    setIsMenuOpen(false);
  };

  const settings = inventoryStore.getSettings();

  const viewTitleMap: Record<ViewType, string> = {
    dashboard: '홈 대시보드',
    inventory: '도서 재고',
    orders: '주문건 관리',
    scanner: '바코드 스캔',
    history: '재고 기록',
    settings: '서점 설정',
    detail: '도서 상세',
  };

  const navMenuItems: { id: ViewType; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    {
      id: 'dashboard',
      label: '홈 대시보드',
      icon: <LayoutDashboard className="w-4 h-4 text-[#737878]" />,
    },
    {
      id: 'inventory',
      label: '도서 재고 목록',
      icon: <BookOpen className="w-4 h-4 text-[#737878]" />,
    },

    {
      id: 'history',
      label: '재고 변동 기록',
      icon: <History className="w-4 h-4 text-[#737878]" />,
      adminOnly: true,
    },
    {
      id: 'settings',
      label: '서점 환경 설정',
      icon: <SettingsIcon className="w-4 h-4 text-[#737878]" />,
      adminOnly: true,
    },
  ];

  return (
    <header className="bg-[#fbf9f4] border-b border-[#c3c7c7] fixed top-0 left-0 right-0 z-30 flex justify-between items-center h-16 px-4 md:px-8 select-none">
      {/* 📚 Store Title & Current Page */}
      <div className="flex items-center gap-3">
        <span
          className="font-['Playfair_Display','Noto_Serif_KR',serif] text-lg sm:text-xl font-bold text-[#171e1e] cursor-pointer hover:opacity-75 transition-opacity select-none flex items-center gap-1.5"
          onClick={() => onNavigate('dashboard')}
          title={settings.storeName || '독자서점'}
        >
          <span>{settings.storeName || '독자서점'}</span>
          <span className="text-[11px] font-sans font-normal text-[#737878] bg-[#f0eee9] px-2 py-0.5 rounded-full border border-[#c3c7c7] hidden sm:inline">
            📍 {settings.branchName || '본점'}
          </span>
        </span>

        {currentView && currentView !== 'dashboard' && (
          <span className="text-xs font-semibold text-[#434848] bg-[#f0eee9] px-2.5 py-1 rounded-full border border-[#c3c7c7] whitespace-nowrap shadow-2xs">
            {viewTitleMap[currentView] || ''}
          </span>
        )}
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
      <div className="flex items-center gap-2 md:gap-3" ref={menuRef}>
        {/* Admin Mode Badge */}
        {isAdmin && (
          <div className="hidden xs:flex items-center gap-1.5 bg-[#edf5e1] text-[#2d4710] border border-[#c3d9a5] px-2.5 py-1 rounded-full text-xs font-bold shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2e7d32]" />
            <span>관리자 ON</span>
          </div>
        )}

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

        {/* 📷 바코드 스캔 버튼 */}
        <button
          onClick={() => {
            if (onOpenScanner) {
              onOpenScanner();
            } else if (onNavigate) {
              onNavigate('scanner');
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#171e1e] text-white text-xs font-semibold hover:bg-[#2c3333] transition-colors shadow-xs cursor-pointer active:scale-95"
          title="바코드 스캔"
        >
          <ScanLine className="w-3.5 h-3.5 text-[#d6eaaf]" />
          <span className="hidden sm:inline">스캔하기</span>
        </button>

        {/* ☰ 바코드 스캔 옆 삼선 더보기 메뉴 버튼 */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-2 rounded-full border transition-all cursor-pointer shadow-2xs flex items-center justify-center active:scale-95 ${
              isMenuOpen
                ? 'bg-[#171e1e] text-white border-[#171e1e]'
                : 'bg-white text-[#171e1e] border-[#c3c7c7] hover:bg-[#f5f3ee]'
            }`}
            title="메뉴 더보기"
          >
            {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {/* 더보기 드롭다운 메뉴 */}
          {isMenuOpen && (
            <div className="absolute right-0 top-12 w-64 bg-white rounded-2xl border border-[#c3c7c7] shadow-xl py-2 z-50 animate-fadeIn font-['Public_Sans','Noto_Sans_KR',sans-serif]">
              {/* Header inside menu */}
              <div className="px-4 py-2.5 border-b border-[#e4e2dd] flex items-center justify-between">
                <div>
                  <p className="font-['Playfair_Display','Noto_Serif_KR',serif] text-sm font-bold text-[#171e1e]">
                    {settings.storeName || '독자서점'} 메뉴
                  </p>
                  <p className="text-[11px] text-[#737878]">
                    {isAdmin ? '🛡️ 관리자 모드 활성화 중' : '일반 모드'}
                  </p>
                </div>
              </div>

              {/* Navigation links */}
              <div className="py-1">
                {navMenuItems
                  .filter((item) => !item.adminOnly || isAdmin)
                  .map((item) => {
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onNavigate(item.id);
                          setIsMenuOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#f0eee9] text-[#171e1e] font-bold'
                            : 'text-[#434848] hover:bg-[#fbf9f4] hover:text-[#171e1e]'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
              </div>

              {/* Admin Quick Action buttons */}
              {isAdmin && (
                <div className="px-3 py-2 border-t border-[#e4e2dd] space-y-1.5 bg-[#fbf9f4]">
                  {onOpenAddBook && (
                    <button
                      onClick={() => {
                        onOpenAddBook();
                        setIsMenuOpen(false);
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-[#c3c7c7] hover:border-[#171e1e] text-[#171e1e] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-[#2e7d32]" />
                      <span>새 도서 등록</span>
                    </button>
                  )}
                  {onOpenQuickRestock && (
                    <button
                      onClick={() => {
                        onOpenQuickRestock();
                        setIsMenuOpen(false);
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-[#c3c7c7] hover:border-[#171e1e] text-[#171e1e] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    >
                      <Package className="w-3.5 h-3.5 text-[#3c4c20]" />
                      <span>빠른 재입고</span>
                    </button>
                  )}
                </div>
              )}

              {/* Admin Mode Toggle Switch */}
              <div className="p-3 border-t border-[#e4e2dd]">
                <button
                  onClick={handleToggleAdmin}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                    isAdmin
                      ? 'bg-[#ffdad6] text-[#93000a] hover:bg-[#ffcdd2]'
                      : 'bg-[#171e1e] text-white hover:bg-[#2c3333]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isAdmin ? '관리자 모드 끄기' : '관리자 모드 켜기'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
