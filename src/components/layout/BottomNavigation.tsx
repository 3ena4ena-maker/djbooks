import React from 'react';
import { ViewType } from '../../types';
import { LayoutDashboard, BookOpen, ScanLine, History, Settings } from 'lucide-react';

interface BottomNavigationProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentView,
  onNavigate,
}) => {
  const items: { id: ViewType; label: string; icon: React.ReactNode }[] = [
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
      label: '스캔',
      icon: <ScanLine className="w-6 h-6 stroke-[2.5]" />,
    },
    {
      id: 'history',
      label: '기록',
      icon: <History className="w-5 h-5" />,
    },
    {
      id: 'settings',
      label: '설정',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)] border-t border-[#c3c7c7] bg-[#f0eee9] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 select-none">
      <div className="flex justify-around items-center px-2">
        {items.map((item) => {
          const isActive =
            currentView === item.id ||
            ((currentView === 'detail' || currentView === 'orders') && item.id === 'inventory');

          const isScan = item.id === 'scanner';

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all duration-150 min-w-[56px] cursor-pointer ${
                isActive
                  ? 'text-[#171e1e] font-bold'
                  : 'text-[#737878] hover:text-[#171e1e]'
              }`}
            >
              <div
                className={`flex items-center justify-center transition-transform ${
                  isScan
                    ? 'p-2 rounded-full bg-[#171e1e] text-white -mt-3 shadow-md active:scale-90'
                    : isActive
                    ? 'scale-110'
                    : ''
                }`}
              >
                {item.icon}
              </div>
              <span className={`text-[11px] mt-1 font-['Public_Sans','Noto_Sans_KR',sans-serif] ${isScan ? 'font-bold text-[#171e1e]' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
