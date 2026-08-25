import React from 'react';
import { inventoryStore } from '../../services/inventoryStore';

interface StockBadgeProps {
  quantity: number;
  threshold?: number;
  showExactRemaining?: boolean;
  className?: string;
}

export const StockBadge: React.FC<StockBadgeProps> = ({
  quantity,
  threshold,
  showExactRemaining = false,
  className = '',
}) => {
  const currentThreshold = threshold !== undefined 
    ? threshold 
    : inventoryStore.getSettings().lowStockThreshold;

  if (quantity <= 0) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-[#ffdad6] text-[#93000a] whitespace-nowrap ${className}`}
      >
        품절
      </span>
    );
  }

  if (currentThreshold > 0 && quantity <= currentThreshold) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-[#ffdad6] text-[#93000a] whitespace-nowrap ${className}`}
      >
        {showExactRemaining ? `${quantity}권 남음` : '재고 부족'}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-[#d6eaaf] text-[#3c4c20] whitespace-nowrap ${className}`}
    >
      재고 있음
    </span>
  );
};
