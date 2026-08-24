import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-4 duration-200 select-none">
      <div className="bg-[#171e1e] text-white px-4 py-3 rounded-2xl shadow-xl border border-white/10 flex items-center gap-3 max-w-md">
        <CheckCircle2 className="w-5 h-5 text-[#d6eaaf] flex-shrink-0" />
        <span className="text-xs sm:text-sm font-['Public_Sans','Noto_Sans_KR',sans-serif] font-medium flex-1">
          {message}
        </span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
