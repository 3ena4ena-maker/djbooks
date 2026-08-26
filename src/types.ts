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

// Customer Book Order (손님 주문/예약 도서)
export type CustomerOrderStatus = '주문접수' | '입고완료' | '수령대기' | '수령완료' | '취소됨';

export interface CustomerOrder {
  id: string;
  bookTitle: string;
  bookAuthor?: string;
  bookPublisher?: string;
  isbn?: string;
  quantity: number;
  customerName: string;
  customerContact: string; // 전화번호 / SNS / 연락처
  depositPaid?: boolean; // 선결제/예약금 여부
  depositAmount?: number;
  depositMethod?: string;
  orderPrice?: number;
  orderType?: string;
  status: CustomerOrderStatus;
  note?: string; // 특이사항 (예: 선물포장, 입고 즉시 문자요망 등)
  orderDate?: string;
  createdAt: string;
  completedAt?: string; // 수령/판매 완료 일시
}

export interface DbCustomerOrder {
  id: string;
  customer_name: string;
  contact?: string | null;
  book_title: string;
  book_author?: string | null;
  publisher?: string | null;
  isbn?: string | null;
  quantity: number;
  order_type?: string | null;
  deposit_amount?: number | null;
  deposit_method?: string | null;
  total_price?: number | null;
  status: string;
  memo?: string | null;
  created_at: string;
  completed_at?: string | null;
}

