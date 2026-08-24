export type StockReason = '입고' | '판매' | '반품' | '파손' | '증정' | '분실' | '기타';

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  price: number;
  coverImage: string;
  category?: string;
  publishedDate?: string;
  bindingType?: string; // e.g., '양장본', '무선제본'
  location?: string; // e.g., 'A4 선반, 소설 구역'
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Inventory {
  bookId: string;
  quantity: number;
}

export interface InventoryLog {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor?: string;
  bookCoverImage?: string;
  changeQuantity: number; // e.g. +5, -1
  resultingQuantity: number;
  reason: StockReason;
  note?: string;
  createdAt: string;
}

export interface BookWithStock extends Book {
  quantity: number;
}

export type ViewType = 'dashboard' | 'scanner' | 'inventory' | 'detail' | 'history' | 'settings';

export type InventoryFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
export type InventorySort = 'updated' | 'stock_asc' | 'stock_desc' | 'title' | 'price_desc';
