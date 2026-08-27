import React, { useState, useEffect } from 'react';
import { ViewType } from '../../types';
import {
  LayoutDashboard,
  BookOpen,
  ScanLine,
  History,
  Settings,
  Plus,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { inventoryStore } from '../../services/inventoryStore';
import { authStore } from '../../services/authStore';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onOpenQuickRestock?: () => void;
  onOpenAddBook?: () => void;
  onShowToast?: (msg: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onOpenQuickRestock,
  onOpenAddBook,
  onShowToast,
}) => {
  const [isAdmin, setIsAdmin] = useState(authStore.isAdmin);

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => {
      setIsAdmin(authStore.isAdmin);
    });
    return unsubscribe;
  }, []);

  const settings = inventoryStore.getSettings();

  const handleBrandClick = () => {
    const activated = authStore.handleTripleClickTrigger();
    if (activated) {
      if (onShowToast) {
        onShowToast('🎉 관리자 모드가 활성화되었습니다.');
      }
    } else {
      onNavigate('dashboard');
    }
  };

  const handleExitAdmin = () => {
    authStore.disableAdminMode();
    if (onShowToast) {
      onShowToast('관리자 모드가 종료되었습니다. (일반 방문자 모드)');
    }
    if (currentView === 'history' || currentView === 'settings') {
      onNavigate('dashboard');
    }
  };

  const allNavItems: { id: ViewType; label: string; icon: React.ReactNode; badge?: number; adminOnly?: boolean }[] = [
    {
      id: 'dashboard',
      label: '홈',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'inventory',
      label: '재고',
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      id: 'scanner',
      label: '책 스캔',
      icon: <ScanLine className="w-5 h-5" />,
    },
    {
      id: 'history',
      label: '재고 기록',
      icon: <History className="w-5 h-5" />,
      adminOnly: true,
    },
    {
      id: 'settings',
      label: '설정',
      icon: <Settings className="w-5 h-5" />,
      adminOnly: true,
    },
  ];

  const visibleNavItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="bg-[#f5f3ee] h-screen w-64 fixed left-0 top-0 hidden lg:flex flex-col border-r border-[#c3c7c7] py-8 px-4 gap-4 z-40 select-none">
      {/* Brand Header (Triple-click / touch trigger area) */}
      <div
        className="flex items-center gap-3.5 mb-4 px-2 cursor-pointer group active:opacity-85 select-none"
        onClick={handleBrandClick}
        title="홈으로 이동"
      >
        <div className="w-11 h-11 rounded-full overflow-hidden border border-[#c3c7c7] bg-[#f0eee9] flex items-center justify-center flex-shrink-0 shadow-sm">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0IS4UUn27-tn2FvhJt6CKSaosHpVs8oTYpgwwoMZOVMm2ENeWX89Yd-csQPd8jX1gDkdbKStYK9PUiAW4cwCGT8lcSgQNF3P7wa2p_Nw6HhEetwjtpSqTozCUafVKx2lzVzydXYjr7C1tyHZ0-ZqWoTzbIVyPVwnZ0u_vUm3BunaTxmcy0-HP9rPEt0y6IEkjDc2pPbxSJrZN87E57kMugB6jVN4XZuR4eZWgr5nr8cm2fcw3vQaQ"
            alt="책방 로고"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="min-w-0">
          <h1 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e] leading-tight tracking-tight truncate">
            {settings.storeName || '독립서점'}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs text-[#434848] font-medium tracking-wide">
              {settings.branchName || '본점'}
            </p>
            {isAdmin && (
              <span className="text-[10px] bg-[#edf5e1] text-[#2d4710] border border-[#c3d9a5] px-1.5 py-0.2 rounded font-bold">
                관리자
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Primary CTA Quick Restock (관리자 전용) */}
      {isAdmin && (
        <button
          onClick={() => {
            if (onOpenQuickRestock) onOpenQuickRestock();
            else if (onOpenAddBook) onOpenAddBook();
          }}
          className="bg-[#171e1e] text-white font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm font-semibold py-3 px-4 rounded-xl hover:bg-[#2c3333] transition-all flex items-center justify-center gap-2 mb-2 w-full shadow-sm active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>빠른 입고</span>
        </button>
      )}

      {/* Nav List */}
      <nav className="flex flex-col gap-1.5 flex-grow overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive =
            currentView === item.id ||
            ((currentView === 'detail' || currentView === 'orders') && item.id === 'inventory');
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm text-left active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-[#171e1e] font-bold bg-[#eae8e3] shadow-xs'
                  : 'text-[#434848] hover:bg-[#eae8e3] hover:text-[#171e1e]'
              }`}
            >
              <span className={isActive ? 'text-[#171e1e]' : 'text-[#737878]'}>
                {item.icon}
              </span>
              <span className="flex-grow">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="bg-[#ffdad6] text-[#93000a] text-xs font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Admin Mode Status & Exit Box in Sidebar */}
      {isAdmin && (
        <div className="pt-2 border-t border-[#c3c7c7]/50">
          <div className="bg-white border border-[#c3c7c7] rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-[#2e7d32] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#171e1e] truncate">관리자 모드</p>
                <p className="text-[10px] text-[#737878] truncate">수정 권한 활성</p>
              </div>
            </div>
            <button
              onClick={handleExitAdmin}
              className="px-2 py-1 bg-[#fff8f7] border border-[#ffdad6] hover:bg-[#ffdad6] text-[#ba1a1a] rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 flex-shrink-0"
              title="관리자 모드 종료"
            >
              <LogOut className="w-3 h-3" />
              <span>종료</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="pt-1 text-xs text-[#737878] flex items-center justify-between px-2">
        <span>독립서점 POS Lite</span>
        <span className="font-mono text-[10px]">v1.0</span>
      </div>
    </aside>
  );
};
