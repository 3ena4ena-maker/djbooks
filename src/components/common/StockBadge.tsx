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
  // 독자서점(독립서점) 운영 특성: 1권 이상은 정상 재고이므로 항상 '재고 있음'으로 표시
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

  // threshold가 명시적으로 2 이상으로 설정되어 있고 수량이 1보다 큰 경우에만 예외적으로 재고 부족 표시
  if (currentThreshold > 1 && quantity <= currentThreshold && quantity > 1) {
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
