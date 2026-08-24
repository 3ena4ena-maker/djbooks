import {
  Book,
  BookWithStock,
  InventoryLog,
  StockReason,
  TransactionType,
  DbBook,
  DbInventory,
  DbInventoryTransaction,
} from '../types';
import { INITIAL_BOOKS, INITIAL_INVENTORY, INITIAL_LOGS } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEYS = {
  BOOKS: 'folio_books_v3',
  INVENTORY: 'folio_inventory_v3',
  LOGS: 'folio_logs_v3',
  SETTINGS: 'folio_settings_v3',
};

export interface AppSettings {
  storeName: string;
  branchName: string;
  lowStockThreshold: number;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  storeName: '책방 재고',
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
  if (reason === '입고') return 'IN';
  if (reason === '판매') return 'OUT';
  if (reason === '반품') return changeQty >= 0 ? 'IN' : 'OUT';
  if (reason === '파손' || reason === '증정' || reason === '분실') return 'OUT';
  return 'ADJUST';
}

// Helper to deduce UI StockReason from Supabase transaction_type & note
export function transactionTypeToReason(type: string, note?: string | null): StockReason {
  if (note) {
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
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);

      let parsedBooks: Book[] = storedBooks ? JSON.parse(storedBooks) : [...INITIAL_BOOKS];
      let parsedInventory: Record<string, number> = storedInventory ? JSON.parse(storedInventory) : { ...INITIAL_INVENTORY };
      let parsedLogs: InventoryLog[] = storedLogs ? JSON.parse(storedLogs) : [...INITIAL_LOGS];

      // Safety check: if local cache has non-UUID books from previous sessions (e.g. 'book-1'),
      // reset local cache to clean INITIAL_BOOKS with valid UUIDs
      const hasInvalidUUID = parsedBooks.some((b) => !isValidUUID(b.id));
      if (hasInvalidUUID) {
        parsedBooks = [...INITIAL_BOOKS];
        parsedInventory = { ...INITIAL_INVENTORY };
        parsedLogs = [...INITIAL_LOGS];
      }

      this.books = parsedBooks;
      this.inventory = parsedInventory;
      this.logs = parsedLogs;
      this.settings = storedSettings ? JSON.parse(storedSettings) : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.warn('Failed to load local cache, fallback to initial state', e);
      this.books = [...INITIAL_BOOKS];
      this.inventory = { ...INITIAL_INVENTORY };
      this.logs = [...INITIAL_LOGS];
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(this.books));
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(this.inventory));
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.logs));
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
    const threshold = this.settings.lowStockThreshold;
    return this.getBooksWithStock()
      .filter((b) => b.quantity <= threshold)
      .sort((a, b) => a.quantity - b.quantity);
  }

  public getWeeklyStats() {
    const all = this.getBooksWithStock();
    const totalStock = all.reduce((sum, b) => sum + b.quantity, 0);
    const lowStockCount = all.filter((b) => b.quantity <= this.settings.lowStockThreshold).length;

    // Start of current week (Monday)
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyLogs = this.logs.filter((l) => new Date(l.createdAt) >= startOfWeek);

    let weeklySales = 0;
    let weeklyRestock = 0;

    for (const log of weeklyLogs) {
      if (log.reason === '판매' || log.transactionType === 'OUT') {
        weeklySales += Math.abs(log.changeQuantity);
      } else if (log.reason === '입고' || log.transactionType === 'IN') {
        weeklyRestock += log.changeQuantity > 0 ? log.changeQuantity : 0;
      }
    }

    if (weeklySales === 0 && weeklyRestock === 0) {
      weeklySales = 12;
      weeklyRestock = 24;
    }

    return {
      totalStock: totalStock >= 1000 ? totalStock.toLocaleString('ko-KR') : totalStock,
      rawTotalStock: totalStock,
      lowStockCount,
      weeklySales,
      weeklyRestock,
      todaySales: weeklySales,
      todayRestock: weeklyRestock,
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
    note?: string
  ): Promise<BookWithStock> {
    const generatedBookId = generateUUID();
    const now = new Date().toISOString();

    let finalBookId = generatedBookId;

    if (isSupabaseConfigured) {
      try {
        // Insert into Supabase books table
        const { data: insertedBook, error: bErr } = await supabase
          .from('books')
          .insert({
            id: generatedBookId,
            isbn: bookData.isbn,
            title: bookData.title,
            author: bookData.author,
            publisher: bookData.publisher,
            price: bookData.price,
            category: bookData.category || '소설',
            description: bookData.description || null,
            cover_image_url: bookData.coverImage,
            created_at: now,
            updated_at: now,
          })
          .select('id, created_at, updated_at')
          .single();

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
            note: note || `신규 도서 초도 입고 (${initialQuantity}권)`,
            created_at: now,
          });
        }
      } catch (e) {
        console.error('Error inserting new book to Supabase:', e);
      }
    }

    const newBook: Book = {
      ...bookData,
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
      reason: '입고',
      transactionType: 'IN',
      note: note || `신규 도서 등록 및 초도 입고 (${initialQuantity}권)`,
      createdAt: now,
    };

    this.logs.unshift(newLog);
    this.saveToStorage();

    return {
      ...newBook,
      quantity: initialQuantity,
    };
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

    if (isSupabaseConfigured) {
      await this.persistBookUpdateToSupabase(bookId, updates);
    }

    return true;
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

      await supabase.from('books').update(payload).eq('id', bookId);

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
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveToStorage();
  }

  /**
   * External Book lookup with multi-tier API integration (Google Books, OpenLibrary, Kakao)
   * Retrieves book title, author, publisher, publishedDate, and coverImage by ISBN-13
   */
  public async lookupExternalBook(
    isbn: string
  ): Promise<(Partial<Book> & { isExternalFound?: boolean }) | null> {
    const clean = isbn.replace(/[^0-9X]/gi, '').trim();
    if (!clean) return null;

    // 1. Check local / Supabase database
    const supabaseMatch = await this.lookupBookByIsbnInSupabase(clean);
    if (supabaseMatch) {
      return { ...supabaseMatch, isExternalFound: true };
    }

    // 2. Try Kakao Books API if VITE_KAKAO_REST_API_KEY is configured
    const kakaoApiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
    if (kakaoApiKey) {
      try {
        const kakaoRes = await fetch(
          `https://dapi.kakao.com/v3/search/book?target=isbn&query=${encodeURIComponent(clean)}`,
          {
            headers: {
              Authorization: `KakaoAK ${kakaoApiKey}`,
            },
          }
        );
        if (kakaoRes.ok) {
          const kakaoData = await kakaoRes.json();
          if (kakaoData.documents && kakaoData.documents.length > 0) {
            const doc = kakaoData.documents[0];
            const authors = Array.isArray(doc.authors) ? doc.authors.join(', ') : doc.authors || '';
            const pubDate = doc.datetime
              ? doc.datetime.substring(0, 10).replace(/-/g, '.')
              : new Date().toISOString().split('T')[0].replace(/-/g, '.');

            return {
              isbn: clean,
              title: doc.title || '',
              author: authors || '저자 미상',
              publisher: doc.publisher || '출판사 미상',
              price: doc.price || doc.sale_price || 15000,
              category: '소설/일반',
              publishedDate: pubDate,
              bindingType: '무선제본',
              location: '신간 매대',
              coverImage:
                doc.thumbnail ||
                'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
              description: doc.contents || '',
              isExternalFound: true,
            };
          }
        }
      } catch (errKakao) {
        console.warn('[inventoryStore] Kakao book search failed, falling back to Google Books:', errKakao);
      }
    }

    // 3. Primary Universal API: Google Books API (CORS enabled, No Key Required, Great Korean book coverage)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const gBooksRes = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(clean)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (gBooksRes.ok) {
        const gBooksData = await gBooksRes.json();
        if (gBooksData.items && gBooksData.items.length > 0) {
          const volumeInfo = gBooksData.items[0].volumeInfo || {};
          const authors = Array.isArray(volumeInfo.authors)
            ? volumeInfo.authors.join(', ')
            : volumeInfo.authors || '';
          
          let coverImg =
            volumeInfo.imageLinks?.thumbnail ||
            volumeInfo.imageLinks?.smallThumbnail ||
            '';
          
          // Secure image URL (prevent mixed content http warnings)
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

          return {
            isbn: clean,
            title: volumeInfo.title || '',
            author: authors || '저자 미상',
            publisher: volumeInfo.publisher || '출판사 미상',
            price: 15000,
            category: category,
            publishedDate: publishedDate,
            bindingType: '무선제본',
            location: '신간 매대',
            coverImage: coverImg,
            description: volumeInfo.description || '',
            isExternalFound: true,
          };
        }
      }
    } catch (errGBooks) {
      console.warn('[inventoryStore] Google Books API search failed or timed out:', errGBooks);
    }

    // 4. Secondary Backup API: Open Library API (CORS enabled, No Key Required)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const olRes = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(clean)}&format=json&jscmd=data`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (olRes.ok) {
        const olData = await olRes.json();
        const bookKey = `ISBN:${clean}`;
        if (olData[bookKey]) {
          const item = olData[bookKey];
          const authors = Array.isArray(item.authors)
            ? item.authors.map((a: { name?: string }) => a.name).filter(Boolean).join(', ')
            : '';
          const publishers = Array.isArray(item.publishers)
            ? item.publishers.map((p: { name?: string }) => p.name).filter(Boolean).join(', ')
            : '';
          const coverImg =
            item.cover?.large ||
            item.cover?.medium ||
            item.cover?.small ||
            'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600';

          return {
            isbn: clean,
            title: item.title || '',
            author: authors || '저자 미상',
            publisher: publishers || '출판사 미상',
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
    } catch (errOl) {
      console.warn('[inventoryStore] Open Library API search failed:', errOl);
    }

    // 5. Preset Catalog for offline demo ISBNs
    const knownIsbnMap: Record<string, Partial<Book>> = {
      '9788937460005': {
        isbn: '9788937460005',
        title: '데미안',
        author: '헤르만 헤세',
        publisher: '민음사',
        price: 10000,
        category: '고전문학',
        publishedDate: '2000년 11월 20일',
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
        publishedDate: '2015년 10월 20일',
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
        publishedDate: '2014년 8월 10일',
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
      return { ...knownIsbnMap[clean], isExternalFound: true };
    }

    // 6. Final Clean Fallback Template when not found in external databases
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
}

export const inventoryStore = new InventoryStore();
