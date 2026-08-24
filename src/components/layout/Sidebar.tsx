import React from 'react';
import { ViewType } from '../../types';
import {
  LayoutDashboard,
  BookOpen,
  ScanLine,
  AlertTriangle,
  History,
  Settings,
  PlusCircle,
  Plus
} from 'lucide-react';
import { inventoryStore } from '../../services/inventoryStore';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onOpenQuickRestock?: () => void;
  onOpenAddBook?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onOpenQuickRestock,
  onOpenAddBook,
}) => {
  const settings = inventoryStore.getSettings();
  const lowStockCount = inventoryStore.getLowStockBooks().length;

  const navItems: { id: ViewType; label: string; icon: React.ReactNode; badge?: number }[] = [
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
    },
    {
      id: 'settings',
      label: '설정',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <aside className="bg-[#f5f3ee] h-screen w-64 fixed left-0 top-0 hidden lg:flex flex-col border-r border-[#c3c7c7] py-8 px-4 gap-4 z-40 select-none">
      {/* Brand Header */}
      <div
        className="flex items-center gap-3.5 mb-6 px-2 cursor-pointer group"
        onClick={() => onNavigate('dashboard')}
      >
        <div className="w-11 h-11 rounded-full overflow-hidden border border-[#c3c7c7] bg-[#f0eee9] flex items-center justify-center flex-shrink-0 shadow-sm">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0IS4UUn27-tn2FvhJt6CKSaosHpVs8oTYpgwwoMZOVMm2ENeWX89Yd-csQPd8jX1gDkdbKStYK9PUiAW4cwCGT8lcSgQNF3P7wa2p_Nw6HhEetwjtpSqTozCUafVKx2lzVzydXYjr7C1tyHZ0-ZqWoTzbIVyPVwnZ0u_vUm3BunaTxmcy0-HP9rPEt0y6IEkjDc2pPbxSJrZN87E57kMugB6jVN4XZuR4eZWgr5nr8cm2fcw3vQaQ"
            alt="책방 로고"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <h1 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e] leading-tight tracking-tight">
            {settings.storeName || '책방 재고'}
          </h1>
          <p className="font-['Public_Sans','Noto_Sans_KR',sans-serif] text-xs text-[#434848] font-medium tracking-wide">
            {settings.branchName || '본점'}
          </p>
        </div>
      </div>

      {/* Primary CTA Quick Restock */}
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

      {/* Nav List */}
      <nav className="flex flex-col gap-1.5 flex-grow overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentView === item.id || (currentView === 'detail' && item.id === 'inventory');
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

      {/* Footer Info */}
      <div className="pt-3 border-t border-[#c3c7c7]/40 text-xs text-[#737878] flex items-center justify-between px-2">
        <span>독립서점 POS Lite</span>
        <span className="font-mono text-[10px]">v1.0</span>
      </div>
    </aside>
  );
};
