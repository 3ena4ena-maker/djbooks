import React, { useState } from 'react';
import { Search, Bell, ScanLine } from 'lucide-react';
import { ViewType } from '../../types';

interface TopHeaderProps {
  onNavigate: (view: ViewType) => void;
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onNavigate,
  onSearch,
  searchQuery = '',
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);

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

  return (
    <header className="bg-[#fbf9f4] border-b border-[#c3c7c7] fixed top-0 w-full z-30 flex justify-between items-center h-16 px-4 md:px-8 lg:ml-64 lg:w-[calc(100%-16rem)] select-none">
      {/* Mobile Title */}
      <div
        className="lg:hidden font-['Playfair_Display','Noto_Serif_KR',serif] text-xl font-bold text-[#171e1e] cursor-pointer"
        onClick={() => onNavigate('dashboard')}
      >
        책방 재고
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
        <button
          onClick={() => onNavigate('scanner')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#171e1e] text-white text-xs font-semibold hover:bg-[#2c3333] transition-colors shadow-xs"
          title="바코드 스캔"
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">스캔하기</span>
        </button>

        <button
          onClick={() => onNavigate('settings')}
          className="p-2 text-[#434848] hover:bg-[#f5f3ee] rounded-full transition-colors relative"
          title="설정"
        >
          <span className="material-symbols-outlined text-[22px]">settings</span>
        </button>
      </div>
    </header>
  );
};
