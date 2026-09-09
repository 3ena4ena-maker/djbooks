import {
  Book,
  BookWithStock,
  InventoryLog,
  StockReason,
  TransactionType,
  DbBook,
  DbInventory,
  DbInventoryTransaction,
  CustomerOrder,
  CustomerOrderStatus,
  DbCustomerOrder,
} from '../types';
import { INITIAL_BOOKS, INITIAL_INVENTORY, INITIAL_LOGS } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { authStore } from './authStore';

const STORAGE_KEYS = {
  BOOKS: 'folio_books_v3',
  INVENTORY: 'folio_inventory_v3',
  LOGS: 'folio_logs_v3',
  SETTINGS: 'folio_settings_v3',
  ORDERS: 'folio_customer_orders_v1',
};

const INITIAL_ORDERS: CustomerOrder[] = [
  {
    id: 'a1b2c3d4-1111-4111-8111-111111111111',
    bookTitle: '아무튼, 서점',
    bookAuthor: '김윤아',
    bookPublisher: '위고',
    quantity: 1,
    customerName: '김민주',
    customerContact: '010-3849-1920',
    depositPaid: true,
    orderPrice: 12000,
    status: '입고완료',
    note: '입고 안내 문자 발송 완료 (목요일 오후 픽업 예정)',
    orderDate: '2026.08.23',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'a1b2c3d4-2222-4222-8222-222222222222',
    bookTitle: '식물과 함께하는 오후',
    bookAuthor: '이지원',
    bookPublisher: '초록책방',
    quantity: 2,
    customerName: '이서연',
    customerContact: '010-9281-4412',
    depositPaid: false,
    orderPrice: 32000,
    status: '주문접수',
    note: '선물용 포장 요청',
    orderDate: '2026.08.24',
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'a1b2c3d4-3333-4333-8333-333333333333',
    bookTitle: '빛과 물질에 관한 스펙트럼',
    bookAuthor: '김초엽',
    bookPublisher: '문학동네',
    quantity: 1,
    customerName: '박도현',
    customerContact: '010-5123-8890',
    depositPaid: true,
    orderPrice: 15000,
    status: '수령대기',
    note: '서점 예약 보관함 2번에 보관 중',
    orderDate: '2026.08.22',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
];

export interface AppSettings {
  storeName: string;
  branchName: string;
  lowStockThreshold: number;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  storeName: '독자서점',
  branchName: '본점',
  lowStockThreshold: 3,
  soundEnabled: true,
  hapticEnabled: true,
};

type Listener = () => void;

// Helper to check if a string is a valid UUID format
export function isValidUUID(str: string): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Generate a valid RFC4122 v4 UUID
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to map UI reason to Supabase transaction_type
export function reasonToTransactionType(reason: StockReason, changeQty: number): TransactionType {
  if (reason === '입고' || reason === '초기 도서 입고' || reason === '재입고') return 'IN';
  if (reason === '판매') return 'OUT';
  if (reason === '반품') return changeQty >= 0 ? 'IN' : 'OUT';
  if (reason === '파손' || reason === '증정' || reason === '분실') return 'OUT';
  return 'ADJUST';
}

// Helper to deduce UI StockReason from Supabase transaction_type & note
export function transactionTypeToReason(type: string, note?: string | null): StockReason {
  if (note) {
    if (note.includes('초기') || note.includes('초도') || note.includes('신규')) return '초기 도서 입고';
    if (note.includes('재입고')) return '재입고';
    if (note.includes('입고')) return '입고';
    if (note.includes('판매')) return '판매';
    if (note.includes('반품')) return '반품';
    if (note.includes('파손')) return '파손';
    if (note.includes('증정')) return '증정';
    if (note.includes('분실')) return '분실';
    if (note.includes('조정') || note.includes('수정')) return '기타';
  }
  if (type === 'IN') return '입고';
  if (type === 'OUT') return '판매';
  return '기타';
}

class InventoryStore {
  private books: Book[] = [];
  private inventory: Record<string, number> = {};
  private locations: Record<string, string> = {};
  private logs: InventoryLog[] = [];
  private orders: CustomerOrder[] = [];
  private settings: AppSettings = DEFAULT_SETTINGS;
  private listeners: Set<Listener> = new Set();

  public isLoading: boolean = false;
  public lastSyncTime: Date | null = null;
  public syncError: string | null = null;
  public isConnectedToSupabase: boolean = isSupabaseConfigured;

  constructor() {
    this.loadFromStorage();
    if (isSupabaseConfigured) {
      this.fetchFromSupabase();
      this.setupRealtimeSubscription();
    }
  }

  private loadFromStorage() {
    try {
      const storedBooks = localStorage.getItem(STORAGE_KEYS.BOOKS);
      const storedInventory = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      const storedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      const storedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);

      let parsedBooks: Book[] = storedBooks ? JSON.parse(storedBooks) : [...INITIAL_BOOKS];
      let parsedInventory: Record<string, number> = storedInventory ? JSON.parse(storedInventory) : { ...INITIAL_INVENTORY };
      let parsedLogs: InventoryLog[] = storedLogs ? JSON.parse(storedLogs) : [...INITIAL_LOGS];
      let parsedOrders: CustomerOrder[] = storedOrders ? JSON.parse(storedOrders) : [...INITIAL_ORDERS];

      // Safety check: if local cache has non-UUID books from previous sessions (e.g. 'book-1'),
      // reset local cache to clean INITIAL_BOOKS with valid UUIDs
      const hasInvalidUUID = parsedBooks.some((b) => !isValidUUID(b.id));
      if (hasInvalidUUID) {
        parsedBooks = [...INITIAL_BOOKS];
        parsedInventory = { ...INITIAL_INVENTORY };
        parsedLogs = [...INITIAL_LOGS];
      }

      // Ensure every book has a clean boolean isReaderPick (default false)
      parsedBooks = parsedBooks.map((b) => ({
        ...b,
        isReaderPick: Boolean(b.isReaderPick),
      }));

      this.books = parsedBooks;
      this.inventory = parsedInventory;
      this.logs = parsedLogs;
      this.orders = parsedOrders;
      let loadedSettings: AppSettings = storedSettings ? JSON.parse(storedSettings) : { ...DEFAULT_SETTINGS };
      if (!loadedSettings.storeName || loadedSettings.storeName === '책방 재고') {
        loadedSettings.storeName = '독자서점';
      }
      this.settings = loadedSettings;
    } catch (e) {
      console.warn('Failed to load local cache, fallback to initial state', e);
      this.books = [...INITIAL_BOOKS];
      this.inventory = { ...INITIAL_INVENTORY };
      this.logs = [...INITIAL_LOGS];
      this.orders = [...INITIAL_ORDERS];
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(this.books));
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(this.inventory));
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.logs));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(this.orders));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (e) {
      console.error('Failed to save to local cache', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Listener callback error', err);
      }
    });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ==========================================
  // 🔄 Supabase Data Fetching & Sync
  // ==========================================
  public async fetchFromSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    this.isLoading = true;
    this.syncError = null;
    this.notify();

    try {
      // 1. Fetch Books from Supabase
      const { data: dbBooks, error: booksError } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false });

      if (booksError) throw booksError;

      // 2. Fetch Inventory from Supabase
      const { data: dbInventory, error: invError } = await supabase
        .from('inventory')
        .select('*');

      if (invError) throw invError;

      // 3. Fetch Transactions from Supabase (Recent 100)
      const { data: dbTransactions, error: txError } = await supabase
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (txError) throw txError;

      // If database is completely empty on first connection, seed initial sample books with valid UUIDs
      if ((!dbBooks || dbBooks.length === 0) && (!dbInventory || dbInventory.length === 0)) {
        await this.seedInitialBooksToSupabase();
        return true;
      }

      // Map Supabase books to Frontend model - directly use Supabase UUID (b.id)
      const mappedBooks: Book[] = (dbBooks || []).map((b: DbBook) => ({
        id: b.id,
        isbn: b.isbn || '',
        title: b.title || '제목 없음',
        author: b.author || '저자 미상',
        publisher: b.publisher || '출판사 미상',
        price: Number(b.price) || 0,
        category: b.category || '소설',
        description: b.description || '',
        coverImage:
          b.cover_image_url ||
          'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
        isReaderPick: Boolean(b.is_reader_pick ?? (b as any).isReaderPick ?? false),
        createdAt: b.created_at || new Date().toISOString(),
        updatedAt: b.updated_at || new Date().toISOString(),
      }));

      // Map Inventory
      const invMap: Record<string, number> = {};
      const locMap: Record<string, string> = {};
      (dbInventory || []).forEach((inv: DbInventory) => {
        invMap[inv.book_id] = Number(inv.quantity) || 0;
        if (inv.location) {
          locMap[inv.book_id] = inv.location;
        }
      });

      // Update book locations from inventory
      mappedBooks.forEach((book) => {
        if (locMap[book.id]) {
          book.location = locMap[book.id];
        }
      });

      // Map Transactions to Logs
      const bookMap = new Map<string, Book>(mappedBooks.map((b) => [b.id, b]));
      const mappedLogs: InventoryLog[] = (dbTransactions || []).map(
        (tx: DbInventoryTransaction) => {
          const matched = bookMap.get(tx.book_id);
          const reason = transactionTypeToReason(tx.transaction_type, tx.note);
          const qty = invMap[tx.book_id] ?? 0;

          return {
            id: tx.id,
            bookId: tx.book_id,
            bookTitle: matched?.title || '삭제된 도서',
            bookAuthor: matched?.author || '',
            bookCoverImage: matched?.coverImage,
            changeQuantity: tx.change_quantity,
            resultingQuantity: qty,
            reason,
            transactionType: (tx.transaction_type as TransactionType) || 'ADJUST',
            note: tx.note || `${tx.transaction_type} (${tx.change_quantity > 0 ? '+' : ''}${tx.change_quantity})`,
            createdAt: tx.created_at || new Date().toISOString(),
          };
        }
      );

      // 4. Fetch Customer Orders from Supabase
      try {
        const { data: dbOrders, error: ordersError } = await supabase
          .from('customer_orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error('[InventoryStore] Supabase customer_orders 조회 실패:', ordersError);
        } else if (Array.isArray(dbOrders)) {
          const mappedOrders: CustomerOrder[] = dbOrders.map((o: DbCustomerOrder) => {
            const depositAmt = Number(o.deposit_amount) || 0;
            const isDepositPaid = Boolean(depositAmt > 0 || (o.deposit_method && o.deposit_method !== 'NONE'));
            const orderDateStr = o.created_at
              ? o.created_at.split('T')[0].replace(/-/g, '.')
              : new Date().toISOString().split('T')[0].replace(/-/g, '.');

            return {
              id: o.id,
              bookTitle: o.book_title,
              bookAuthor: o.book_author || undefined,
              bookPublisher: o.publisher || undefined,
              isbn: o.isbn || undefined,
              quantity: Number(o.quantity) || 1,
              customerName: o.customer_name,
              customerContact: o.contact || '',
              depositPaid: isDepositPaid,
              depositAmount: depositAmt,
              depositMethod: o.deposit_method || 'NONE',
              orderPrice: o.total_price !== null && o.total_price !== undefined ? Number(o.total_price) : undefined,
              orderType: o.order_type || 'CUSTOMER_REQUEST',
              status: (o.status as CustomerOrderStatus) || '주문접수',
              note: o.memo || undefined,
              orderDate: orderDateStr,
              createdAt: o.created_at || new Date().toISOString(),
              completedAt: o.completed_at || undefined,
            };
          });
          this.orders = mappedOrders;
          console.log(`[InventoryStore] Supabase customer_orders ${mappedOrders.length}건 로드 완료`);
        }
      } catch (orderErr) {
        console.error('[InventoryStore] Supabase customer_orders fetch 에러:', orderErr);
      }

      this.books = mappedBooks;
      this.inventory = invMap;
      this.locations = locMap;
      this.logs = mappedLogs;
      this.lastSyncTime = new Date();
      this.isConnectedToSupabase = true;
      this.syncError = null;
      this.saveToStorage();

      return true;
    } catch (err: unknown) {
      let errorMsg = 'Supabase 데이터 조회 실패';
      if (err instanceof Error) {
        errorMsg = err.message;
      } else if (typeof err === 'object' && err !== null) {
        const anyErr = err as { message?: string; error_description?: string; details?: string; hint?: string };
        errorMsg = anyErr.message || anyErr.error_description || anyErr.details || anyErr.hint || JSON.stringify(err);
      }
      console.warn('Supabase fetch error:', errorMsg);
      this.syncError = errorMsg;
      this.isConnectedToSupabase = false;
      return false;
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  // Seed default books to Supabase if database tables are empty
  private async seedInitialBooksToSupabase() {
    try {
      for (const b of INITIAL_BOOKS) {
        const { error: bErr } = await supabase.from('books').upsert({
          id: b.id,
          isbn: b.isbn,
          title: b.title,
          author: b.author,
          publisher: b.publisher,
          price: b.price,
          category: b.category,
          description: b.description,
          cover_image_url: b.coverImage,
          created_at: b.createdAt,
          updated_at: b.updatedAt,
        });

        if (!bErr) {
          const initialQty = INITIAL_INVENTORY[b.id] ?? 5;
          await supabase.from('inventory').upsert({
            book_id: b.id,
            quantity: initialQty,
            location: b.location || 'A1 선반',
            updated_at: new Date().toISOString(),
          });

          await supabase.from('inventory_transactions').insert({
            book_id: b.id,
            change_quantity: initialQty,
            transaction_type: 'IN',
            note: '초기 도서 입고',
            created_at: b.createdAt,
          });
        }
      }
      await this.fetchFromSupabase();
    } catch (seedErr) {
      console.warn('Initial seed skipped or failed:', seedErr);
    }
  }

  // Setup Realtime Live Channel for multi-client synchronization
  private setupRealtimeSubscription() {
    if (!isSupabaseConfigured) return;

    try {
      const channel = supabase
        .channel('folio-realtime-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'books' },
          () => {
            this.fetchFromSupabase();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'inventory' },
          () => {
            this.fetchFromSupabase();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'inventory_transactions' },
          () => {
            this.fetchFromSupabase();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'customer_orders' },
          () => {
            this.fetchFromSupabase();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('Realtime subscription not available or failed:', e);
    }
  }

  // ==========================================
  // 📖 Read Methods
  // ==========================================
  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveToStorage();
  }

  public getBooks(): Book[] {
    return [...this.books];
  }

  public getBooksWithStock(): BookWithStock[] {
    return this.books.map((book) => ({
      ...book,
      location: this.locations[book.id] || book.location || 'A1 선반',
      quantity: this.inventory[book.id] ?? 0,
    }));
  }

  public getBookById(id: string): BookWithStock | undefined {
    const book = this.books.find((b) => b.id === id);
    if (!book) return undefined;
    return {
      ...book,
      location: this.locations[book.id] || book.location || 'A1 선반',
      quantity: this.inventory[book.id] ?? 0,
    };
  }

  public getBookByIsbn(isbn: string): BookWithStock | undefined {
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
    const book = this.books.find((b) => b.isbn.replace(/[^0-9X]/gi, '') === cleanIsbn);
    if (!book) return undefined;
    return {
      ...book,
      location: this.locations[book.id] || book.location || 'A1 선반',
      quantity: this.inventory[book.id] ?? 0,
    };
  }

  // Async query directly to Supabase for barcode scanning
  public async lookupBookByIsbnInSupabase(isbn: string): Promise<BookWithStock | null> {
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '').trim();
    if (!cleanIsbn) return null;

    // First check memory
    const memoryMatch = this.getBookByIsbn(cleanIsbn);
    if (memoryMatch) return memoryMatch;

    if (!isSupabaseConfigured) return null;

    try {
      const { data: bookData, error } = await supabase
        .from('books')
        .select('*')
        .eq('isbn', cleanIsbn)
        .maybeSingle();

      if (error || !bookData) return null;

      // Fetch corresponding inventory
      const { data: invData } = await supabase
        .from('inventory')
        .select('*')
        .eq('book_id', bookData.id)
        .maybeSingle();

      const result: BookWithStock = {
        id: bookData.id,
        isbn: bookData.isbn,
        title: bookData.title,
        author: bookData.author,
        publisher: bookData.publisher,
        price: Number(bookData.price) || 0,
        category: bookData.category || '소설',
        description: bookData.description || '',
        coverImage:
          bookData.cover_image_url ||
          'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
        location: invData?.location || 'A1 선반',
        quantity: Number(invData?.quantity) || 0,
        isReaderPick: Boolean(bookData.is_reader_pick ?? (bookData as any).isReaderPick ?? false),
        createdAt: bookData.created_at,
        updatedAt: bookData.updated_at,
      };

      // Add to local state
      const existsIndex = this.books.findIndex((b) => b.id === result.id);
      if (existsIndex >= 0) {
        this.books[existsIndex] = result;
      } else {
        this.books.unshift(result);
      }
      this.inventory[result.id] = result.quantity;
      if (invData?.location) {
        this.locations[result.id] = invData.location;
      }
      this.saveToStorage();

      return result;
    } catch (e) {
      console.warn('Lookup ISBN in Supabase error:', e);
      return null;
    }
  }

  public getLogs(bookId?: string): InventoryLog[] {
    if (bookId) {
      return this.logs.filter((log) => log.bookId === bookId);
    }
    return [...this.logs];
  }

  public getLowStockBooks(): BookWithStock[] {
    // 홈 대시보드 재고부족 프리뷰: 독자픽으로 지정된 도서 중 품절(0권)된 책만
    return this.getBooksWithStock()
      .filter((b) => b.isReaderPick === true && b.quantity <= 0)
      .sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  }

  public getWeeklyStats() {
    const all = this.getBooksWithStock();
    const totalStock = all.reduce((sum, b) => sum + b.quantity, 0);
    // 홈 대시보드 재고부족: isReaderPick === true AND stock === 0 (독자픽 품절 도서만 카운트)
    const lowStockCount = all.filter((b) => b.isReaderPick === true && b.quantity <= 0).length;

    // 대한민국 표준시(KST, UTC+9) 기준 이번 주 월요일 00:00:00.000 ~ 일요일 23:59:59.999 계산
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const now = new Date();
    const kstTime = now.getTime() + KST_OFFSET_MS;
    const kstDate = new Date(kstTime);

    const kstDayOfWeek = kstDate.getUTCDay(); // 0(일), 1(월), ..., 6(토)
    const diffToMonday = kstDayOfWeek === 0 ? 6 : kstDayOfWeek - 1;

    const kstYear = kstDate.getUTCFullYear();
    const kstMonth = kstDate.getUTCMonth();
    const kstDay = kstDate.getUTCDate();

    const kstMondayStart = Date.UTC(kstYear, kstMonth, kstDay - diffToMonday, 0, 0, 0, 0);
    const kstSundayEnd = Date.UTC(kstYear, kstMonth, kstDay - diffToMonday + 6, 23, 59, 59, 999);

    const startOfWeekUtc = kstMondayStart - KST_OFFSET_MS;
    const endOfWeekUtc = kstSundayEnd - KST_OFFSET_MS;

    // 기록 페이지의 실제 기록(this.logs) 중 이번 주 월요일 00:00:00 ~ 일요일 23:59:59 범위에 해당하는 기록만 필터링
    const weeklyLogs = this.logs.filter((l) => {
      const logTime = new Date(l.createdAt).getTime();
      return logTime >= startOfWeekUtc && logTime <= endOfWeekUtc;
    });

    let weeklySalesCount = 0;
    let weeklyRestockCount = 0;

    for (const log of weeklyLogs) {
      if (log.reason === '판매' || log.transactionType === 'OUT') {
        weeklySalesCount += 1;
      } else if (
        log.reason === '입고' ||
        log.reason === '재입고' ||
        log.reason === '초기 도서 입고' ||
        log.transactionType === 'IN' ||
        log.changeQuantity > 0
      ) {
        weeklyRestockCount += 1;
      }
    }

    return {
      totalStock: totalStock >= 1000 ? totalStock.toLocaleString('ko-KR') : totalStock,
      rawTotalStock: totalStock,
      lowStockCount,
      weeklySales: weeklySalesCount,
      generalSales: weeklySalesCount,
      orderSales: 0,
      weeklyRestock: weeklyRestockCount,
      todaySales: weeklySalesCount,
      todayRestock: weeklyRestockCount,
    };
  }

  public getTodayStats() {
    return this.getWeeklyStats();
  }

  // ==========================================
  // ✍️ Write & Mutation Methods (Supabase Sync with Rollback)
  // ==========================================
  public async adjustStock(
    bookId: string,
    change: number,
    reason: StockReason,
    note?: string
  ): Promise<{ success: boolean; newQuantity: number; error?: string }> {
    const book = this.books.find((b) => b.id === bookId);
    if (!book) {
      return { success: false, newQuantity: 0, error: '도서를 찾을 수 없습니다.' };
    }

    const previousQty = this.inventory[bookId] ?? 0;
    const previousUpdatedAt = book.updatedAt;
    const newQty = Math.max(0, previousQty + change);
    const nowIso = new Date().toISOString();

    // 1. Optimistic Local Update
    this.inventory[bookId] = newQty;
    book.updatedAt = nowIso;

    const txType = reasonToTransactionType(reason, change);
    const generatedLogId = generateUUID();
    const newLog: InventoryLog = {
      id: generatedLogId,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCoverImage: book.coverImage,
      changeQuantity: change,
      resultingQuantity: newQty,
      reason,
      transactionType: txType,
      note: note || (change > 0 ? `+${change} 입고 처리` : `${change} 판매/출고 처리`),
      createdAt: nowIso,
    };

    this.logs.unshift(newLog);
    this.saveToStorage();

    // 2. Persist to Supabase with error rollback
    if (isSupabaseConfigured) {
      const syncResult = await this.syncStockChangeToSupabase(bookId, newQty, change, txType, newLog.note);
      if (!syncResult.success) {
        // Rollback optimistic update
        this.inventory[bookId] = previousQty;
        book.updatedAt = previousUpdatedAt;
        this.logs = this.logs.filter((l) => l.id !== generatedLogId);
        this.saveToStorage();

        // Refresh from server to ensure accurate state
        this.fetchFromSupabase();

        return {
          success: false,
          newQuantity: previousQty,
          error: syncResult.error || '재고 저장에 실패했습니다. 서버 데이터와 다시 동기화합니다.',
        };
      }
    }

    return { success: true, newQuantity: newQty };
  }

  public async setExactStock(
    bookId: string,
    newQuantity: number,
    reason: StockReason,
    note?: string
  ): Promise<{ success: boolean; newQuantity: number; error?: string }> {
    const book = this.books.find((b) => b.id === bookId);
    if (!book) {
      return { success: false, newQuantity: 0, error: '도서를 찾을 수 없습니다.' };
    }

    const previousQty = this.inventory[bookId] ?? 0;
    const previousUpdatedAt = book.updatedAt;
    const change = newQuantity - previousQty;
    const nowIso = new Date().toISOString();

    this.inventory[bookId] = newQuantity;
    book.updatedAt = nowIso;

    const txType = reasonToTransactionType(reason, change);
    const generatedLogId = generateUUID();
    const newLog: InventoryLog = {
      id: generatedLogId,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCoverImage: book.coverImage,
      changeQuantity: change,
      resultingQuantity: newQuantity,
      reason,
      transactionType: txType,
      note: note || `재고 직접 수정 (${previousQty}권 → ${newQuantity}권)`,
      createdAt: nowIso,
    };

    this.logs.unshift(newLog);
    this.saveToStorage();

    if (isSupabaseConfigured) {
      const syncResult = await this.syncStockChangeToSupabase(bookId, newQuantity, change, txType, newLog.note);
      if (!syncResult.success) {
        // Rollback optimistic update
        this.inventory[bookId] = previousQty;
        book.updatedAt = previousUpdatedAt;
        this.logs = this.logs.filter((l) => l.id !== generatedLogId);
        this.saveToStorage();

        this.fetchFromSupabase();

        return {
          success: false,
          newQuantity: previousQty,
          error: syncResult.error || '재고 저장에 실패했습니다. 서버 데이터와 다시 동기화합니다.',
        };
      }
    }

    return { success: true, newQuantity };
  }

  private async syncStockChangeToSupabase(
    bookId: string,
    newQuantity: number,
    changeQuantity: number,
    transactionType: TransactionType,
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Ensure inventory record exists and update quantity
      const { data: existingInv, error: selectErr } = await supabase
        .from('inventory')
        .select('id')
        .eq('book_id', bookId)
        .maybeSingle();

      if (selectErr) throw selectErr;

      if (existingInv?.id) {
        const { error: updateErr } = await supabase
          .from('inventory')
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('book_id', bookId);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from('inventory').insert({
          book_id: bookId,
          quantity: newQuantity,
          location: this.locations[bookId] || 'A1 선반',
          updated_at: new Date().toISOString(),
        });

        if (insertErr) throw insertErr;
      }

      // 2. Record transaction in inventory_transactions
      if (changeQuantity !== 0) {
        const { error: txErr } = await supabase.from('inventory_transactions').insert({
          book_id: bookId,
          change_quantity: changeQuantity,
          transaction_type: transactionType,
          note: note || null,
          created_at: new Date().toISOString(),
        });

        if (txErr) throw txErr;
      }

      return { success: true };
    } catch (e: unknown) {
      let errorMsg = 'Supabase 재고 반영 실패';
      if (e instanceof Error) errorMsg = e.message;
      else if (typeof e === 'object' && e !== null) {
        const anyErr = e as { message?: string; error_description?: string; details?: string };
        errorMsg = anyErr.message || anyErr.error_description || anyErr.details || JSON.stringify(e);
      }
      console.error('Failed to persist inventory change to Supabase:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  public async registerBook(
    bookData: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>,
    initialQuantity: number = 1,
    note?: string,
    entryType: '초기 도서 입고' | '재입고' = '초기 도서 입고'
  ): Promise<BookWithStock> {
    const generatedBookId = generateUUID();
    const now = new Date().toISOString();
    const isReaderPick = Boolean(bookData.isReaderPick ?? false);

    let finalBookId = generatedBookId;

    if (isSupabaseConfigured) {
      try {
        const bookPayload: Record<string, unknown> = {
          id: generatedBookId,
          isbn: bookData.isbn,
          title: bookData.title,
          author: bookData.author,
          publisher: bookData.publisher,
          price: bookData.price,
          category: bookData.category || '소설',
          description: bookData.description || null,
          cover_image_url: bookData.coverImage,
          is_reader_pick: isReaderPick,
          created_at: now,
          updated_at: now,
        };

        // Insert into Supabase books table
        let { data: insertedBook, error: bErr } = await supabase
          .from('books')
          .insert(bookPayload)
          .select('id, created_at, updated_at')
          .single();

        // If is_reader_pick column does not exist yet in db, retry without it
        if (bErr && (bErr.message?.includes('is_reader_pick') || (bErr as any).code === '42703')) {
          delete bookPayload.is_reader_pick;
          const retryRes = await supabase
            .from('books')
            .insert(bookPayload)
            .select('id, created_at, updated_at')
            .single();
          insertedBook = retryRes.data;
          bErr = retryRes.error;
        }

        if (bErr) throw bErr;
        if (insertedBook?.id) {
          finalBookId = insertedBook.id;
        }

        // Insert inventory row with the canonical Supabase book_id UUID
        const { error: iErr } = await supabase.from('inventory').insert({
          book_id: finalBookId,
          quantity: initialQuantity,
          location: bookData.location || 'A1 선반',
          updated_at: now,
        });

        if (iErr) throw iErr;

        // Record initial transaction with the canonical Supabase book_id UUID
        if (initialQuantity > 0) {
          await supabase.from('inventory_transactions').insert({
            book_id: finalBookId,
            change_quantity: initialQuantity,
            transaction_type: 'IN',
            note: note || (entryType === '초기 도서 입고' ? `신규 도서 초기 입고 (${initialQuantity}권)` : `신규 도서 재입고 (${initialQuantity}권)`),
            created_at: now,
          });
        }
      } catch (e) {
        console.error('Error inserting new book to Supabase:', e);
      }
    }

    const newBook: Book = {
      ...bookData,
      isReaderPick,
      id: finalBookId,
      createdAt: now,
      updatedAt: now,
      coverImage:
        bookData.coverImage ||
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
    };

    this.books.unshift(newBook);
    this.inventory[finalBookId] = initialQuantity;
    if (bookData.location) {
      this.locations[finalBookId] = bookData.location;
    }

    const newLog: InventoryLog = {
      id: generateUUID(),
      bookId: finalBookId,
      bookTitle: newBook.title,
      bookAuthor: newBook.author,
      bookCoverImage: newBook.coverImage,
      changeQuantity: initialQuantity,
      resultingQuantity: initialQuantity,
      reason: entryType,
      transactionType: 'IN',
      note: note || (entryType === '초기 도서 입고' ? `신규 도서 등록 및 초기 입고 (${initialQuantity}권)` : `신규 도서 등록 및 재입고 (${initialQuantity}권)`),
      createdAt: now,
    };

    this.logs.unshift(newLog);
    this.saveToStorage();

    return {
      ...newBook,
      quantity: initialQuantity,
    };
  }

  public async deleteLog(logId: string): Promise<boolean> {
    this.logs = this.logs.filter((l) => l.id !== logId);
    this.saveToStorage();
    this.notify();

    if (isSupabaseConfigured) {
      try {
        await supabase.from('inventory_transactions').delete().eq('id', logId);
      } catch (e) {
        console.error('Error deleting inventory transaction from Supabase:', e);
      }
    }
    return true;
  }

  public async updateBook(bookId: string, updates: Partial<Book>): Promise<boolean> {
    const index = this.books.findIndex((b) => b.id === bookId);
    if (index === -1) return false;

    const now = new Date().toISOString();
    this.books[index] = {
      ...this.books[index],
      ...updates,
      updatedAt: now,
    };

    if (updates.location) {
      this.locations[bookId] = updates.location;
    }

    this.saveToStorage();
    this.notify();

    if (isSupabaseConfigured) {
      await this.persistBookUpdateToSupabase(bookId, updates);
    }

    return true;
  }

  public async toggleReaderPick(bookId: string): Promise<boolean> {
    const book = this.books.find((b) => b.id === bookId);
    if (!book) return false;

    const newPickStatus = !book.isReaderPick;
    // 중요한 요구사항: 독자픽 변경 시 최근 수정일(updatedAt)은 변경하지 않는다!
    book.isReaderPick = newPickStatus;

    this.saveToStorage();
    this.notify();

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('books')
          .update({
            is_reader_pick: newPickStatus,
            updated_at: book.updatedAt, // 기존 수정일 유지
          })
          .eq('id', bookId);

        if (error) {
          console.warn('[InventoryStore] Supabase is_reader_pick update error (column might not exist yet):', error.message);
        }
      } catch (e) {
        console.warn('[InventoryStore] Error updating reader pick in Supabase:', e);
      }
    }

    return newPickStatus;
  }

  // 여러 도서의 서가 위치 일괄 변경
  public async batchUpdateLocation(
    bookIds: string[],
    newLocation: string
  ): Promise<{ successCount: number; failCount: number }> {
    // 관리자 모드에서만 실행 가능하도록 권한 검사
    if (!authStore.isAdmin) {
      console.warn('[InventoryStore] 관리자 권한이 없어 서가 위치 일괄 변경이 거부되었습니다.');
      return { successCount: 0, failCount: 0 };
    }

    if (!bookIds || bookIds.length === 0) {
      return { successCount: 0, failCount: 0 };
    }

    const now = new Date().toISOString();
    const validBookIds: string[] = [];

    // 1. Local Optimistic Update
    for (const id of bookIds) {
      const book = this.books.find((b) => b.id === id);
      if (book) {
        book.location = newLocation;
        // 서가 위치 변경은 일반 도서 정보 수정이므로 최근 수정일을 변경
        book.updatedAt = now;
        this.locations[id] = newLocation;
        validBookIds.push(id);
      }
    }

    this.saveToStorage();
    this.notify();

    // 2. Supabase Sync
    let failCount = 0;
    if (isSupabaseConfigured && validBookIds.length > 0) {
      try {
        // inventory 테이블의 서가 위치 일괄 갱신
        const { error: invErr } = await supabase
          .from('inventory')
          .update({
            location: newLocation,
            updated_at: now,
          })
          .in('book_id', validBookIds);

        if (invErr) {
          console.error('[InventoryStore] Batch update inventory location error:', invErr);
          failCount = validBookIds.length;
        }

        // books 테이블의 수정일 일괄 갱신
        const { error: bookErr } = await supabase
          .from('books')
          .update({
            updated_at: now,
          })
          .in('id', validBookIds);

        if (bookErr) {
          console.warn('[InventoryStore] Batch update books updated_at error:', bookErr);
        }
      } catch (err) {
        console.error('[InventoryStore] Exception in batchUpdateLocation:', err);
        failCount = validBookIds.length;
      }
    }

    const successCount = validBookIds.length - failCount;
    return { successCount, failCount };
  }

  private async persistBookUpdateToSupabase(bookId: string, updates: Partial<Book>) {
    try {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.author !== undefined) payload.author = updates.author;
      if (updates.publisher !== undefined) payload.publisher = updates.publisher;
      if (updates.price !== undefined) payload.price = updates.price;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.coverImage !== undefined) payload.cover_image_url = updates.coverImage;
      if (updates.isReaderPick !== undefined) payload.is_reader_pick = updates.isReaderPick;

      let { error } = await supabase.from('books').update(payload).eq('id', bookId);

      // If is_reader_pick column does not exist yet in db, retry without it
      if (error && (error.message?.includes('is_reader_pick') || (error as any).code === '42703')) {
        delete payload.is_reader_pick;
        const retry = await supabase.from('books').update(payload).eq('id', bookId);
        error = retry.error;
      }

      if (error) {
        console.error('Error updating book in Supabase:', error);
      }

      if (updates.location) {
        await supabase
          .from('inventory')
          .update({
            location: updates.location,
            updated_at: new Date().toISOString(),
          })
          .eq('book_id', bookId);
      }
    } catch (e) {
      console.error('Error updating book in Supabase:', e);
    }
  }

  public async deleteBook(bookId: string): Promise<boolean> {
    this.books = this.books.filter((b) => b.id !== bookId);
    delete this.inventory[bookId];
    delete this.locations[bookId];
    this.logs = this.logs.filter((l) => l.bookId !== bookId);
    this.saveToStorage();
    this.notify();

    if (isSupabaseConfigured) {
      await this.deleteFromSupabase(bookId);
    }

    return true;
  }

  private async deleteFromSupabase(bookId: string) {
    try {
      await supabase.from('inventory_transactions').delete().eq('book_id', bookId);
      await supabase.from('inventory').delete().eq('book_id', bookId);
      await supabase.from('books').delete().eq('id', bookId);
    } catch (e) {
      console.error('Error deleting book from Supabase:', e);
    }
  }

  public resetToSampleData() {
    this.books = [...INITIAL_BOOKS];
    this.inventory = { ...INITIAL_INVENTORY };
    this.logs = [...INITIAL_LOGS];
    this.orders = [...INITIAL_ORDERS];
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveToStorage();
  }

  // ==========================================
  // 📦 손님 주문 / 예약 도서 (Customer Orders)
  // ==========================================
  public getCustomerOrders(): CustomerOrder[] {
    return [...this.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getCustomerOrderById(orderId: string): CustomerOrder | undefined {
    return this.orders.find((o) => o.id === orderId);
  }

  private buildOrderDbPayload(order: CustomerOrder, overrides?: Partial<CustomerOrder>): Record<string, unknown> {
    const status = overrides?.status ?? order.status;
    const completedAt =
      status === '수령완료'
        ? (overrides?.completedAt ?? order.completedAt ?? new Date().toISOString())
        : (status === '취소됨' ? null : (overrides?.completedAt ?? order.completedAt ?? null));

    const depositAmt = overrides?.depositAmount !== undefined
      ? overrides.depositAmount
      : (order.depositAmount !== undefined ? order.depositAmount : (order.depositPaid ? (order.orderPrice || 0) : 0));
    const depositMeth = overrides?.depositMethod ?? order.depositMethod ?? (order.depositPaid ? 'CARD' : 'NONE');
    const orderPrice = overrides?.orderPrice !== undefined ? overrides.orderPrice : (order.orderPrice !== undefined ? order.orderPrice : null);

    return {
      id: order.id,
      customer_name: overrides?.customerName ?? order.customerName,
      contact: overrides?.customerContact ?? order.customerContact ?? '',
      book_title: overrides?.bookTitle ?? order.bookTitle,
      book_author: overrides?.bookAuthor ?? order.bookAuthor ?? null,
      publisher: overrides?.bookPublisher ?? order.bookPublisher ?? null,
      isbn: overrides?.isbn ?? order.isbn ?? null,
      quantity: overrides?.quantity ?? order.quantity ?? 1,
      order_type: overrides?.orderType ?? order.orderType ?? 'CUSTOMER_REQUEST',
      deposit_amount: depositAmt,
      deposit_method: depositMeth,
      total_price: orderPrice,
      status: status,
      memo: overrides?.note ?? order.note ?? null,
      created_at: order.createdAt || new Date().toISOString(),
      completed_at: completedAt,
    };
  }

  private async syncCustomerOrderToDb(order: CustomerOrder, overrides?: Partial<CustomerOrder>): Promise<{ success: boolean; data?: any; error?: any }> {
    if (!isSupabaseConfigured) return { success: true };

    const payload = this.buildOrderDbPayload(order, overrides);

    try {
      // 1차 시도: 표준 필드명으로 upsert
      const { data, error } = await supabase
        .from('customer_orders')
        .upsert(payload, { onConflict: 'id' })
        .select();

      if (!error && data && data.length > 0) {
        return { success: true, data: data[0] };
      }

      // 만약 컬럼명 불일치 에러(contact, memo, total_price 등)인 경우 대체 컬럼명으로 재시도
      if (error && (error.message.includes('column') || error.message.includes('does not exist') || error.code === '42703')) {
        console.warn('[InventoryStore] customer_orders 컬럼 대체 포맷으로 재시도:', error.message);
        const altPayload: Record<string, unknown> = {
          id: payload.id,
          book_title: payload.book_title,
          book_author: payload.book_author,
          book_publisher: payload.publisher,
          publisher: payload.publisher,
          quantity: payload.quantity,
          customer_name: payload.customer_name,
          customer_contact: payload.contact,
          contact: payload.contact,
          deposit_paid: Boolean(order.depositPaid),
          deposit_amount: payload.deposit_amount,
          order_price: payload.total_price,
          total_price: payload.total_price,
          status: payload.status,
          note: payload.memo,
          memo: payload.memo,
          created_at: payload.created_at,
          completed_at: payload.completed_at,
        };

        const { data: altData, error: altError } = await supabase
          .from('customer_orders')
          .upsert(altPayload, { onConflict: 'id' })
          .select();

        if (!altError && altData && altData.length > 0) {
          return { success: true, data: altData[0] };
        }
        return { success: false, error: altError || error };
      }

      return { success: false, data, error };
    } catch (e) {
      return { success: false, error: e };
    }
  }

  public async addCustomerOrder(
    orderData: Omit<CustomerOrder, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; order?: CustomerOrder; error?: any }> {
    const now = new Date().toISOString();
    const newId = generateUUID();
    const depositAmt =
      orderData.depositAmount !== undefined
        ? orderData.depositAmount
        : (orderData.depositPaid ? (orderData.orderPrice || 0) : 0);
    const depositMeth = orderData.depositMethod || (orderData.depositPaid ? 'CARD' : 'NONE');
    const orderDateStr = orderData.orderDate || now.split('T')[0].replace(/-/g, '.');

    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, unknown> = {
          id: newId,
          customer_name: orderData.customerName,
          contact: orderData.customerContact || '',
          book_title: orderData.bookTitle,
          book_author: orderData.bookAuthor || null,
          publisher: orderData.bookPublisher || null,
          isbn: orderData.isbn || null,
          quantity: Math.max(1, orderData.quantity || 1),
          order_type: orderData.orderType || 'CUSTOMER_REQUEST',
          deposit_amount: depositAmt,
          deposit_method: depositMeth,
          total_price: orderData.orderPrice !== undefined ? orderData.orderPrice : null,
          status: orderData.status || '주문접수',
          memo: orderData.note || null,
          created_at: now,
          completed_at: orderData.status === '수령완료' ? (orderData.completedAt || now) : null,
        };

        const { data, error } = await supabase
          .from('customer_orders')
          .insert(payload)
          .select('*')
          .single();

        console.log('[ORDER INSERT RESULT]', {
          data,
          error,
        });

        if (error) {
          console.error('[ORDER INSERT ERROR DETAILS]', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          return { success: false, error };
        }

        const insertedDbId = data?.id;
        const finalId = insertedDbId || newId;

        console.log('[ORDER ID CHECK]', {
          insertedDbId,
          frontendOrderId: finalId,
          same: insertedDbId === finalId,
        });

        const createdOrder: CustomerOrder = {
          ...orderData,
          id: String(finalId),
          orderDate: orderDateStr,
          depositAmount: depositAmt,
          depositMethod: depositMeth,
          createdAt: data?.created_at || now,
          completedAt: orderData.status === '수령완료' ? (orderData.completedAt || now) : undefined,
        };

        this.orders = [createdOrder, ...this.orders];
        this.saveToStorage();
        this.notify();
        return { success: true, order: createdOrder };
      } catch (e: any) {
        console.error('[ORDER INSERT EXCEPTION]', e);
        return { success: false, error: { message: e?.message || '주문 생성 중 예외 발생' } };
      }
    } else {
      const createdOrder: CustomerOrder = {
        ...orderData,
        id: newId,
        orderDate: orderDateStr,
        depositAmount: depositAmt,
        depositMethod: depositMeth,
        createdAt: now,
        completedAt: orderData.status === '수령완료' ? (orderData.completedAt || now) : undefined,
      };
      this.orders = [createdOrder, ...this.orders];
      this.saveToStorage();
      this.notify();
      return { success: true, order: createdOrder };
    }
  }

  public async updateCustomerOrderStatus(
    orderId: string,
    status: CustomerOrderStatus
  ): Promise<{ success: boolean; error?: any }> {
    const orderIndex = this.orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) {
      console.warn('[ORDER DEBUG] ❌ 로컬 orders에서 orderId를 찾을 수 없음:', orderId);
      return { success: false, error: { message: `로컬 주문 목록에서 ID(${orderId})를 찾을 수 없습니다.` } };
    }

    const existing = this.orders[orderIndex];

    // 1. Mandatory Debug Logs
    console.log('[ORDER DEBUG] orderId:', orderId);
    console.log('[ORDER DEBUG] orderId type:', typeof orderId);
    console.log('[ORDER DEBUG] target status:', status);
    console.log('[ORDER DEBUG] current order:', existing);

    const now = new Date().toISOString();
    const completedAt =
      status === '수령완료'
        ? (existing.completedAt || now)
        : (status === '취소됨' ? null : (existing.completedAt || null));

    if (isSupabaseConfigured) {
      try {
        // 3. Supabase DB Check before UPDATE
        const { data: dbOrder, error: findError } = await supabase
          .from('customer_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        console.log('[ORDER DB CHECK]', {
          orderId,
          dbOrder,
          findError,
        });

        if (findError) {
          console.error('[ORDER DB CHECK RESULT] C: DB 조회 중 findError가 발생했습니다.', {
            code: findError.code,
            message: findError.message,
            details: findError.details,
            hint: findError.hint,
          });
          return { success: false, error: findError };
        }

        if (!dbOrder) {
          console.warn('[ORDER DB CHECK RESULT] B: dbOrder가 null입니다. (DB에 해당 orderId row가 존재하지 않음)');
          const payload = this.buildOrderDbPayload(existing, { status, completedAt: completedAt || undefined });
          const { data: upsertData, error: upsertError } = await supabase
            .from('customer_orders')
            .upsert(payload)
            .select('*')
            .single();

          if (upsertError || !upsertData) {
            console.error('[ORDER DB CHECK RESULT] B: DB 행 부재로 인한 Upsert 시도 실패:', {
              code: upsertError?.code,
              message: upsertError?.message,
              details: upsertError?.details,
              hint: upsertError?.hint,
            });
            return { success: false, error: upsertError || { message: 'DB에 해당 주문이 존재하지 않습니다.' } };
          }

          console.log('[ORDER DB CHECK RESULT] B: DB 행 부재 -> Upsert 성공으로 DB 복구 완료:', upsertData);
          this.orders[orderIndex] = {
            ...existing,
            status,
            completedAt: upsertData.completed_at || (status === '수령완료' ? now : undefined),
          };
          this.saveToStorage();
          this.notify();
          return { success: true };
        }

        console.log('[ORDER DB CHECK RESULT] A: dbOrder가 DB에 정상 존재합니다.', dbOrder);

        // 6. Execute Supabase UPDATE
        const { data, error } = await supabase
          .from('customer_orders')
          .update({
            status,
            completed_at: completedAt,
          })
          .eq('id', orderId)
          .select('*');

        // 2. Output detailed UPDATE log
        console.error('[ORDER UPDATE DEBUG]', {
          orderId,
          status,
          data,
          error,
        });

        if (error) {
          console.error('[ORDER UPDATE ERROR FULL DETAILS]', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          return { success: false, error };
        }

        if (!data || data.length === 0) {
          const rlsError = {
            code: 'RLS_UPDATE_DENIED_OR_NO_MATCH',
            message: '수정된 DB 행이 0건입니다 (RLS UPDATE 정책 미허용 또는 id 불일치)',
            details: 'customer_orders 테이블에 anon/authenticated UPDATE 정책(allow all)이 필요합니다.',
            hint: 'Supabase SQL Editor에서 customer_orders 테이블에 UPDATE 정책을 설정해주세요.',
          };
          console.error('[ORDER UPDATE 0 ROWS MODIFIED]', rlsError);
          return { success: false, error: rlsError };
        }

        const updatedRow = data[0];
        if (updatedRow.status !== status) {
          console.error('[ORDER UPDATE STATUS MISMATCH]', {
            expected: status,
            actual: updatedRow.status,
          });
          return {
            success: false,
            error: { message: `DB 상태 불일치 (요청: ${status}, 실제: ${updatedRow.status})` },
          };
        }

        this.orders[orderIndex] = {
          ...existing,
          status,
          completedAt: updatedRow.completed_at || (status === '수령완료' ? now : undefined),
        };
        this.saveToStorage();
        this.notify();
        return { success: true };
      } catch (e: any) {
        console.error('[ORDER UPDATE EXCEPTION]', e);
        return { success: false, error: { message: e?.message || '주문 상태 변경 중 예외 발생' } };
      }
    } else {
      this.orders[orderIndex] = {
        ...existing,
        status,
        completedAt: completedAt || undefined,
      };
      this.saveToStorage();
      this.notify();
      return { success: true };
    }
  }

  public async updateCustomerOrder(
    orderId: string,
    updates: Partial<CustomerOrder>
  ): Promise<{ success: boolean; error?: any }> {
    const orderIndex = this.orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) {
      console.warn('[ORDER EDIT DEBUG] ❌ 로컬 orders에서 orderId를 찾을 수 없음:', orderId);
      return { success: false, error: { message: `주문 ID(${orderId})를 찾을 수 없습니다.` } };
    }

    const existing = this.orders[orderIndex];
    const now = new Date().toISOString();
    const nextStatus = updates.status ?? existing.status;
    const completedAt =
      nextStatus === '수령완료'
        ? (updates.completedAt ?? existing.completedAt ?? now)
        : (nextStatus === '취소됨' ? null : (updates.completedAt ?? existing.completedAt ?? null));

    if (isSupabaseConfigured) {
      try {
        const { data: dbOrder, error: findError } = await supabase
          .from('customer_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        console.log('[ORDER DB CHECK - EDIT]', { orderId, dbOrder, findError });

        if (findError) {
          console.error('[ORDER EDIT DB CHECK ERROR]', findError);
          return { success: false, error: findError };
        }

        if (!dbOrder) {
          const payload = this.buildOrderDbPayload(existing, { ...updates, completedAt: completedAt || undefined });
          const { data: upsertData, error: upsertError } = await supabase
            .from('customer_orders')
            .upsert(payload)
            .select('*')
            .single();

          if (upsertError || !upsertData) {
            console.error('[ORDER EDIT UPSERT ERROR]', upsertError);
            return { success: false, error: upsertError };
          }
          this.orders[orderIndex] = {
            ...existing,
            ...updates,
            completedAt: upsertData.completed_at || (nextStatus === '수령완료' ? now : undefined),
          };
          this.saveToStorage();
          this.notify();
          return { success: true };
        }

        const payload: Record<string, unknown> = {};
        if (updates.customerName !== undefined) payload.customer_name = updates.customerName;
        if (updates.customerContact !== undefined) payload.contact = updates.customerContact;
        if (updates.bookTitle !== undefined) payload.book_title = updates.bookTitle;
        if (updates.bookAuthor !== undefined) payload.book_author = updates.bookAuthor || null;
        if (updates.bookPublisher !== undefined) payload.publisher = updates.bookPublisher || null;
        if (updates.isbn !== undefined) payload.isbn = updates.isbn || null;
        if (updates.quantity !== undefined) payload.quantity = updates.quantity;
        if (updates.orderType !== undefined) payload.order_type = updates.orderType;
        if (updates.depositAmount !== undefined) {
          payload.deposit_amount = updates.depositAmount;
        } else if (updates.depositPaid !== undefined) {
          payload.deposit_amount = updates.depositPaid ? (updates.orderPrice ?? existing.orderPrice ?? 0) : 0;
          payload.deposit_method = updates.depositPaid ? 'CARD' : 'NONE';
        }
        if (updates.depositMethod !== undefined) payload.deposit_method = updates.depositMethod;
        if (updates.orderPrice !== undefined) payload.total_price = updates.orderPrice;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.note !== undefined) payload.memo = updates.note || null;
        if (completedAt !== undefined) payload.completed_at = completedAt;

        const { data, error } = await supabase
          .from('customer_orders')
          .update(payload)
          .eq('id', orderId)
          .select('*');

        console.error('[ORDER UPDATE DEBUG - EDIT]', { orderId, payload, data, error });

        if (error) {
          console.error('[ORDER EDIT ERROR DETAILS]', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          return { success: false, error };
        }

        if (!data || data.length === 0) {
          const rlsError = {
            code: 'RLS_UPDATE_DENIED_OR_NO_MATCH',
            message: '수정된 DB 행이 0건입니다 (RLS UPDATE 정책 확인 필요)',
          };
          console.error('[ORDER EDIT 0 ROWS]', rlsError);
          return { success: false, error: rlsError };
        }

        this.orders[orderIndex] = {
          ...existing,
          ...updates,
          completedAt: data[0].completed_at || (nextStatus === '수령완료' ? now : undefined),
        };
        this.saveToStorage();
        this.notify();
        return { success: true };
      } catch (e: any) {
        console.error('[ORDER EDIT EXCEPTION]', e);
        return { success: false, error: { message: e?.message || '주문 정보 수정 중 예외 발생' } };
      }
    } else {
      this.orders[orderIndex] = {
        ...existing,
        ...updates,
        completedAt: completedAt || undefined,
      };
      this.saveToStorage();
      this.notify();
      return { success: true };
    }
  }

  public deleteCustomerOrder(orderId: string): boolean {
    const previousOrders = [...this.orders];
    const prevLength = this.orders.length;
    this.orders = this.orders.filter((o) => o.id !== orderId);
    if (this.orders.length !== prevLength) {
      this.saveToStorage();

      if (isSupabaseConfigured) {
        (async () => {
          try {
            const { data, error } = await supabase
              .from('customer_orders')
              .delete()
              .eq('id', orderId)
              .select();

            if (error) {
              console.error('[InventoryStore] Supabase customer_orders DELETE 실패:', {
                orderId,
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint,
              });
              // Supabase 삭제 실패 시 로컬 상태 롤백
              this.orders = previousOrders;
              this.saveToStorage();
              this.fetchFromSupabase();
            } else if (!data || data.length === 0) {
              console.warn('[InventoryStore] Supabase customer_orders DELETE: 삭제된 DB 행(row)이 0건입니다.', {
                orderId,
                possibleCause: 'Supabase RLS DELETE 정책 부재(미허용) 또는 DB에 해당 orderId 행이 없음',
              });
            } else {
              console.log('[InventoryStore] Supabase customer_orders DELETE 성공:', {
                orderId,
                deletedCount: data.length,
                deletedData: data,
              });
            }
          } catch (e) {
            console.error('[InventoryStore] Supabase customer_orders DELETE 예외 발생:', {
              orderId,
              error: e,
            });
            // 예외 발생 시 로컬 상태 롤백
            this.orders = previousOrders;
            this.saveToStorage();
          }
        })();
      }

      return true;
    }
    return false;
  }

  public getCustomerOrderStats() {
    const pendingOrders = this.orders.filter((o) => o.status === '주문접수' || o.status === '입고완료' || o.status === '수령대기');
    const receivedOrders = this.orders.filter((o) => o.status === '주문접수');
    const arrivedOrders = this.orders.filter((o) => o.status === '입고완료' || o.status === '수령대기');
    const completedOrders = this.orders.filter((o) => o.status === '수령완료');

    return {
      total: this.orders.length,
      pending: pendingOrders.length,
      received: receivedOrders.length,
      arrived: arrivedOrders.length,
      completed: completedOrders.length,
    };
  }

  /**
   * Normalize raw scanned or input ISBN to valid 13-digit format with check digit validation
   */
  public normalizeIsbn(rawIsbn: string): string {
    if (!rawIsbn) return '';
    const clean = rawIsbn.replace(/[^0-9X]/gi, '').trim();
    if (clean.length === 10) {
      // Convert ISBN-10 to standard ISBN-13
      const base = '978' + clean.substring(0, 9);
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      return base + checkDigit;
    }
    return clean;
  }

  /**
   * Helper: Query Aladin Open API via Cloudflare Pages Function proxy (/api/aladin)
   */
  private async queryAladinApi(
    isbn13: string
  ): Promise<(Partial<Book> & { isExternalFound?: boolean }) | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`/api/aladin?isbn=${encodeURIComponent(isbn13)}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      clearTimeout(timeoutId);

      console.log(`[Aladin Proxy] ISBN: ${isbn13} | HTTP Status: ${res.status}`);

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (data?.success && data?.book) {
        console.log(`[Aladin Proxy] Result: found | Title: ${data.book.title}`);
        return {
          isbn: data.book.isbn || isbn13,
          title: data.book.title || '',
          author: data.book.author || '저자 미상',
          publisher: data.book.publisher || '출판사 미상',
          price: typeof data.book.price === 'number' ? data.book.price : 15000,
          category: data.book.category || '소설/일반',
          publishedDate: data.book.publishedDate || new Date().toISOString().split('T')[0].replace(/-/g, '.'),
          bindingType: '무선제본',
          location: '신간 매대',
          coverImage:
            data.book.coverImage ||
            'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
          description: data.book.description || '',
          isExternalFound: true,
        };
      }

      if (data?.reason) {
        console.log(`[Aladin Proxy] Result: ${data.reason}`);
      }
    } catch (err: any) {
      console.warn('[Aladin Proxy] Request error or timeout');
    }

    return null;
  }

  /**
   * Helper: Query Google Books API by ISBN-13
   */
  private async queryGoogleBooksApi(
    isbn13: string
  ): Promise<(Partial<Book> & { isExternalFound?: boolean }) | null> {
    console.log('[GoogleBooks] Request started');

    try {
      // 1st: Precise query with "isbn:"
      const primaryUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn13)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(primaryUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      console.log('[GoogleBooks] HTTP Status:', res.status);

      let gBooksData: any = null;
      if (res.ok) {
        gBooksData = await res.json();
      }

      let foundItem = gBooksData?.items?.[0];

      // 2nd: Fallback direct term query if isbn: search yields 0 items
      if (!foundItem && isbn13.length >= 10) {
        try {
          const fallbackUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(isbn13)}`;
          const fbController = new AbortController();
          const fbTimeout = setTimeout(() => fbController.abort(), 4000);
          const fbRes = await fetch(fallbackUrl, { signal: fbController.signal });
          clearTimeout(fbTimeout);
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            if (fbData?.items && fbData.items.length > 0) {
              foundItem = fbData.items[0];
            }
          }
        } catch {
          // Ignore fallback error
        }
      }

      if (foundItem) {
        const volumeInfo = foundItem.volumeInfo || {};
        const title = volumeInfo.title || '';
        const authors = Array.isArray(volumeInfo.authors)
          ? volumeInfo.authors.join(', ')
          : volumeInfo.authors || '저자 미상';
        const publisher = volumeInfo.publisher || '출판사 미상';

        let coverImg =
          volumeInfo.imageLinks?.thumbnail ||
          volumeInfo.imageLinks?.smallThumbnail ||
          '';

        if (coverImg.startsWith('http://')) {
          coverImg = coverImg.replace('http://', 'https://');
        }
        if (!coverImg) {
          coverImg =
            'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600';
        }

        const category =
          Array.isArray(volumeInfo.categories) && volumeInfo.categories.length > 0
            ? volumeInfo.categories[0]
            : '일반도서';

        const publishedDate = volumeInfo.publishedDate
          ? volumeInfo.publishedDate.replace(/-/g, '.')
          : new Date().toISOString().split('T')[0].replace(/-/g, '.');

        console.log('[GoogleBooks] Result: found');
        console.log('[GoogleBooks] Title:', title);

        return {
          isbn: isbn13,
          title,
          author: authors,
          publisher,
          price: 15000,
          category,
          publishedDate,
          bindingType: '무선제본',
          location: '신간 매대',
          coverImage: coverImg,
          description: volumeInfo.description || '',
          isExternalFound: true,
        };
      }
    } catch (err) {
      console.warn('[GoogleBooks] Search error or timeout');
    }

    console.log('[GoogleBooks] Result: not found');
    return null;
  }

  /**
   * External Book lookup with multi-tier API integration:
   * 1순위: 알라딘 Open API (국내 도서 특화)
   * 2순위: Google Books API (글로벌/국내 도서 Fallback)
   * 3순위: Open Library & 프리셋 카탈로그 보조 백업
   * 최종 실패 시: ISBN 유지 및 사용자 수동 입력 템플릿
   */
  public async lookupExternalBook(
    isbn: string
  ): Promise<(Partial<Book> & { isExternalFound?: boolean }) | null> {
    const clean = this.normalizeIsbn(isbn);
    if (!clean) return null;

    console.log(`[BookLookup] ISBN: ${clean}`);

    // Step 0. Check local / Supabase database first
    const supabaseMatch = await this.lookupBookByIsbnInSupabase(clean);
    if (supabaseMatch) {
      return { ...supabaseMatch, isExternalFound: true };
    }

    // Step 1 (1순위): Aladin Open API
    try {
      const aladinResult = await this.queryAladinApi(clean);
      if (aladinResult) {
        console.log('[BookLookup] Using Aladin result');
        return aladinResult;
      }
    } catch (errAladin) {
      console.warn('[BookLookup] Aladin API step error, proceeding to Google Books');
    }

    // Step 2 (2순위): Google Books API
    try {
      const gBooksResult = await this.queryGoogleBooksApi(clean);
      if (gBooksResult) {
        console.log('[BookLookup] Using Google Books result');
        return gBooksResult;
      }
    } catch (errGBooks) {
      console.warn('[BookLookup] Google Books step error, proceeding to fallback');
    }

    // Step 3 (3순위 보조 백업): Open Library API
    try {
      const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(clean)}&format=json&jscmd=data`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const olRes = await fetch(olUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (olRes.ok) {
        const olData = await olRes.json();
        const bookKey = `ISBN:${clean}`;
        if (olData && olData[bookKey]) {
          const item = olData[bookKey];
          const authors = Array.isArray(item.authors)
            ? item.authors.map((a: { name?: string }) => a.name).filter(Boolean).join(', ')
            : '저자 미상';
          const publishers = Array.isArray(item.publishers)
            ? item.publishers.map((p: { name?: string }) => p.name).filter(Boolean).join(', ')
            : '출판사 미상';
          let coverImg =
            item.cover?.large ||
            item.cover?.medium ||
            item.cover?.small ||
            'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600';
          if (coverImg.startsWith('http://')) {
            coverImg = coverImg.replace('http://', 'https://');
          }

          console.log('[BookLookup] Using Open Library result');
          return {
            isbn: clean,
            title: item.title || '',
            author: authors,
            publisher: publishers,
            price: 15000,
            category: '일반도서',
            publishedDate: item.publish_date || new Date().toISOString().split('T')[0].replace(/-/g, '.'),
            bindingType: '무선제본',
            location: '신간 매대',
            coverImage: coverImg,
            isExternalFound: true,
          };
        }
      }
    } catch {
      // Open Library search skipped
    }

    // Step 4. Preset Catalog for offline demo ISBNs
    const knownIsbnMap: Record<string, Partial<Book>> = {
      '9788937460005': {
        isbn: '9788937460005',
        title: '데미안',
        author: '헤르만 헤세',
        publisher: '민음사',
        price: 10000,
        category: '고전문학',
        publishedDate: '2000.11.20',
        bindingType: '무선제본',
        location: 'B3 선반, 민음사 세계문학',
        coverImage:
          'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
      },
      '9788932917245': {
        isbn: '9788932917245',
        title: '어린 왕자',
        author: '앙투안 드 생텍쥐페리',
        publisher: '열린책들',
        price: 10800,
        category: '소설',
        publishedDate: '2015.10.20',
        bindingType: '양장본',
        location: 'A5 선반, 스테디셀러',
        coverImage:
          'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
      },
      '9788954620000': {
        isbn: '9788954620000',
        title: '달과 6펜스',
        author: '서머싯 몸',
        publisher: '문학동네',
        price: 12000,
        category: '고전문학',
        publishedDate: '2014.08.10',
        bindingType: '무선제본',
        location: 'B4 선반, 고전문학',
        coverImage:
          'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600',
      },
      '9791190313186': {
        isbn: '9791190313186',
        title: '우리가 빛의 속도로 갈 수 없다면',
        author: '김초엽',
        publisher: '허블',
        price: 14000,
        category: 'SF소설',
        publishedDate: '2019.06.24',
        bindingType: '무선제본',
        location: 'A3 선반',
        coverImage:
          'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&q=80&w=600',
      },
    };

    if (knownIsbnMap[clean]) {
      console.log('[BookLookup] Using catalog demo result');
      return { ...knownIsbnMap[clean], isExternalFound: true };
    }

    // Step 5 (최종 실패): ISBN은 유지하고 제목/저자를 직접 입력할 수 있는 빈 템플릿 반환
    return {
      isbn: clean,
      title: '',
      author: '',
      publisher: '',
      price: 15000,
      category: '일반도서',
      publishedDate: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      bindingType: '무선제본',
      location: '신간 매대',
      coverImage:
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      isExternalFound: false,
    };
  }

  /**
   * Search books by keyword (title, author, publisher, isbn) across:
   * 1. Local bookstore inventory
   * 2. Preset catalog
   * 3. Google Books & Open Library APIs
   */
  public async searchBooksByKeyword(keyword: string): Promise<
    Array<{
      id?: string;
      isbn?: string;
      title: string;
      author: string;
      publisher: string;
      price: number;
      coverImage?: string;
      inStock: boolean;
      quantity: number;
      source: '매장 재고' | '도서 DB';
    }>
  > {
    const q = keyword.trim().toLowerCase();
    if (!q) return [];

    const results: Array<{
      id?: string;
      isbn?: string;
      title: string;
      author: string;
      publisher: string;
      price: number;
      coverImage?: string;
      inStock: boolean;
      quantity: number;
      source: '매장 재고' | '도서 DB';
    }> = [];

    const seenTitles = new Set<string>();

    // 1. Search local bookstore inventory
    const localBooks = this.getBooksWithStock();
    for (const b of localBooks) {
      const match =
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.publisher && b.publisher.toLowerCase().includes(q)) ||
        (b.isbn && b.isbn.toLowerCase().includes(q));

      if (match) {
        const key = `${b.title.trim().toLowerCase()}|${b.author.trim().toLowerCase()}`;
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          results.push({
            id: b.id,
            isbn: b.isbn,
            title: b.title,
            author: b.author,
            publisher: b.publisher || '독립출판',
            price: b.price || 15000,
            coverImage: b.coverImage,
            inStock: b.quantity > 0,
            quantity: b.quantity,
            source: '매장 재고',
          });
        }
      }
    }

    // 2. Query Server Aladin / Google Books Proxy (/api/aladin?query=...)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`/api/aladin?query=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.books)) {
          for (const item of data.books) {
            const key = `${item.title.trim().toLowerCase()}|${(item.author || '').trim().toLowerCase()}`;
            if (!seenTitles.has(key) && item.title) {
              seenTitles.add(key);
              results.push({
                isbn: item.isbn || '',
                title: item.title,
                author: item.author || '저자 미상',
                publisher: item.publisher || '출판사 미상',
                price: item.price || 15000,
                coverImage: item.coverImage,
                inStock: false,
                quantity: 0,
                source: '도서 DB',
              });
            }
          }
        }
      }
    } catch {
      // Ignore proxy error and continue to catalog & direct fallback
    }

    // 3. Preset catalog search (Rich Korean Independent Bookstore / Bestseller Library)
    const presetCatalog = [
      {
        isbn: '9791165341909',
        title: '달러구트 꿈 백화점 (주문하신 꿈은 매진입니다)',
        author: '이미예',
        publisher: '팩토리나인',
        price: 13800,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791165343729',
        title: '달러구트 꿈 백화점 2 (단골손님을 찾습니다)',
        author: '이미예',
        publisher: '팩토리나인',
        price: 13800,
        coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791161571188',
        title: '불편한 편의점',
        author: '김호연',
        publisher: '나무옆의자',
        price: 14000,
        coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791161571379',
        title: '불편한 편의점 2',
        author: '김호연',
        publisher: '나무옆의자',
        price: 14000,
        coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791197407772',
        title: '세이노의 가르침',
        author: '세이노(SayNo)',
        publisher: '데이원',
        price: 7200,
        coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788936434267',
        title: '소년이 온다',
        author: '한강',
        publisher: '창비',
        price: 15000,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788936433598',
        title: '채식주의자',
        author: '한강',
        publisher: '창비',
        price: 15000,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788954682152',
        title: '작별하지 않는다',
        author: '한강',
        publisher: '문학동네',
        price: 14000,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791188331796',
        title: '역행자',
        author: '자청',
        publisher: '웅진지식하우스',
        price: 17500,
        coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788937460005',
        title: '데미안',
        author: '헤르만 헤세',
        publisher: '민음사',
        price: 10000,
        coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788932917245',
        title: '어린 왕자',
        author: '앙투안 드 생텍쥐페리',
        publisher: '열린책들',
        price: 10800,
        coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788954620000',
        title: '달과 6펜스',
        author: '서머싯 몸',
        publisher: '문학동네',
        price: 12000,
        coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791190313186',
        title: '우리가 빛의 속도로 갈 수 없다면',
        author: '김초엽',
        publisher: '허블',
        price: 14000,
        coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791190030588',
        title: '지구 끝의 온실',
        author: '김초엽',
        publisher: '자이언트북스',
        price: 15000,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788936438012',
        title: '아몬드',
        author: '손원평',
        publisher: '창비',
        price: 12000,
        coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788998441012',
        title: '모순',
        author: '양귀자',
        publisher: '쓰다',
        price: 13000,
        coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791191043297',
        title: '물고기는 존재하지 않는다',
        author: '룰루 밀러',
        publisher: '곰출판',
        price: 17000,
        coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791167740985',
        title: '마흔에 읽는 쇼펜하우어',
        author: '강용수',
        publisher: '유노북스',
        price: 17000,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788936438838',
        title: '아버지의 해방일지',
        author: '정지아',
        publisher: '창비',
        price: 15000,
        coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791165343460',
        title: '긴긴밤',
        author: '루리',
        publisher: '문학동네',
        price: 11500,
        coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788954687591',
        title: '구의 증명',
        author: '최진영',
        publisher: '은행나무',
        price: 9500,
        coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791191043815',
        title: '어서 오세요, 휴남동 서점입니다',
        author: '황보름',
        publisher: '클레이하우스',
        price: 15000,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788934986652',
        title: '코스모스',
        author: '칼 세이건',
        publisher: '사이언스북스',
        price: 19800,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788934972464',
        title: '사피엔스 (유인원에서 사이보그까지)',
        author: '유발 하라리',
        publisher: '김영사',
        price: 22000,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791188331888',
        title: '돈의 속성',
        author: '김승호',
        publisher: '스노우폭스북스',
        price: 17800,
        coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788901243658',
        title: '아주 작은 습관의 힘 (Atomic Habits)',
        author: '제임스 클리어',
        publisher: '비즈니스북스',
        price: 16000,
        coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788901157697',
        title: '원씽 (The ONE Thing)',
        author: '게리 켈러, 제이 파파산',
        publisher: '비즈니스북스',
        price: 14000,
        coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788950986704',
        title: '총, 균, 쇠',
        author: '재레드 다이아몬드',
        publisher: '문학사상',
        price: 28000,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788932473901',
        title: '이기적 유전자',
        author: '리처드 도킨스',
        publisher: '을유문화사',
        price: 20000,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9791168340770',
        title: '도둑맞은 집중력',
        author: '요한 하리',
        publisher: '어크로스',
        price: 18800,
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788996991342',
        title: '미움받을 용기',
        author: '기시미 이치로, 고가 후미타케',
        publisher: '인플루엔셜',
        price: 14900,
        coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
      },
      {
        isbn: '9788966260959',
        title: '클린 코드 (Clean Code)',
        author: '로버트 C. 마틴',
        publisher: '인사이트',
        price: 33000,
        coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
      },
    ];

    for (const p of presetCatalog) {
      if (
        p.title.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.publisher.toLowerCase().includes(q) ||
        p.isbn.includes(q)
      ) {
        const key = `${p.title.trim().toLowerCase()}|${p.author.trim().toLowerCase()}`;
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          results.push({
            isbn: p.isbn,
            title: p.title,
            author: p.author,
            publisher: p.publisher,
            price: p.price,
            coverImage: p.coverImage,
            inStock: false,
            quantity: 0,
            source: '도서 DB',
          });
        }
      }
    }

    // 4. Online Google Books Direct Search (Fallback when results are few)
    if (results.length < 4 && q.length >= 2) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8&hl=ko`;
        const res = await fetch(searchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.items)) {
            for (const item of data.items) {
              const vi = item.volumeInfo || {};
              const title = vi.title || '';
              if (!title) continue;

              const author = Array.isArray(vi.authors)
                ? vi.authors.join(', ')
                : vi.authors || '저자 미상';
              const publisher = vi.publisher || '출판사 미상';

              let coverImg =
                vi.imageLinks?.thumbnail ||
                vi.imageLinks?.smallThumbnail ||
                undefined;
              if (coverImg && coverImg.startsWith('http://')) {
                coverImg = coverImg.replace('http://', 'https://');
              }

              // Extract ISBN if available
              let isbn = '';
              if (Array.isArray(vi.industryIdentifiers)) {
                const isbn13Obj = vi.industryIdentifiers.find(
                  (id: { type?: string; identifier?: string }) => id.type === 'ISBN_13'
                );
                isbn = isbn13Obj?.identifier || vi.industryIdentifiers[0]?.identifier || '';
              }

              const key = `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;
              if (!seenTitles.has(key)) {
                seenTitles.add(key);
                results.push({
                  isbn,
                  title,
                  author,
                  publisher,
                  price: 15000,
                  coverImage: coverImg,
                  inStock: false,
                  quantity: 0,
                  source: '도서 DB',
                });
              }
            }
          }
        }
      } catch {
        // Ignore Google Books timeout / network error
      }
    }

    return results.slice(0, 10);
  }
}

export const inventoryStore = new InventoryStore();
