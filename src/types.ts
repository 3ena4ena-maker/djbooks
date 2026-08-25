export type StockReason = '입고' | '초기 도서 입고' | '재입고' | '판매' | '반품' | '파손' | '증정' | '분실' | '기타';
export type TransactionType = 'IN' | 'OUT' | 'ADJUST';

// Supabase Database Table Interfaces
export interface DbBook {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  price: number;
  category?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbInventory {
  id?: string;
  book_id: string;
  quantity: number;
  location?: string | null;
  updated_at?: string;
}

export interface DbInventoryTransaction {
  id: string;
  book_id: string;
  change_quantity: number;
  transaction_type: string; // 'IN' | 'OUT' | 'ADJUST'
  note?: string | null;
  created_at: string;
}

// Frontend Model Interfaces
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
  transactionType?: TransactionType;
  note?: string;
  createdAt: string;
}

export interface BookWithStock extends Book {
  quantity: number;
}

export type ViewType = 'dashboard' | 'scanner' | 'inventory' | 'detail' | 'history' | 'settings';

export type InventoryFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
export type InventorySort = 'updated' | 'stock_asc' | 'stock_desc' | 'title' | 'price_desc';

