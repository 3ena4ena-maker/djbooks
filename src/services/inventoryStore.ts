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
import { supabase, isSupabaseConfigured, supabaseUrl } from '../lib/supabase';

const STORAGE_KEYS = {
  BOOKS: 'folio_books_v2',
  INVENTORY: 'folio_inventory_v2',
  LOGS: 'folio_logs_v2',
  SETTINGS: 'folio_settings_v2',
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

      this.books = storedBooks ? JSON.parse(storedBooks) : [...INITIAL_BOOKS];
      this.inventory = storedInventory ? JSON.parse(storedInventory) : { ...INITIAL_INVENTORY };
      this.logs = storedLogs ? JSON.parse(storedLogs) : [...INITIAL_LOGS];
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
      // 1. Fetch Books
      const { data: dbBooks, error: booksError } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false });

      if (booksError) throw booksError;

      // 2. Fetch Inventory
      const { data: dbInventory, error: invError } = await supabase
        .from('inventory')
        .select('*');

      if (invError) throw invError;

      // 3. Fetch Transactions (Recent 100)
      const { data: dbTransactions, error: txError } = await supabase
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (txError) throw txError;

      // If database is completely empty on first connection, optionally seed initial sample books
      if ((!dbBooks || dbBooks.length === 0) && (!dbInventory || dbInventory.length === 0)) {
        await this.seedInitialBooksToSupabase();
        return true;
      }

      // Map Supabase books to Frontend model
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
      this.saveToStorage();

      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Supabase 데이터 조회 실패';
      console.error('Supabase fetch error:', errorMsg);
      this.syncError = errorMsg;
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
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday, ...
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

    // Default fallback baseline if brand new state
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
  // ✍️ Write & Mutation Methods (Supabase Sync)
  // ==========================================
  public adjustStock(
    bookId: string,
    change: number,
    reason: StockReason,
    note?: string
  ): { success: boolean; newQuantity: number; error?: string } {
    const book = this.books.find((b) => b.id === bookId);
    if (!book) {
      return { success: false, newQuantity: 0, error: '도서를 찾을 수 없습니다.' };
    }

    const currentQty = this.inventory[bookId] ?? 0;
    const newQty = Math.max(0, currentQty + change);
    const nowIso = new Date().toISOString();

    // 1. Optimistic Local Update
    this.inventory[bookId] = newQty;
    book.updatedAt = nowIso;

    const txType = reasonToTransactionType(reason, change);
    const newLog: InventoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

    // 2. Persist to Supabase in Background
    if (isSupabaseConfigured) {
      this.syncStockChangeToSupabase(bookId, newQty, change, txType, newLog.note);
    }

    return { success: true, newQuantity: newQty };
  }

  public setExactStock(
    bookId: string,
    newQuantity: number,
    reason: StockReason,
    note?: string
  ): { success: boolean; newQuantity: number; error?: string } {
    const book = this.books.find((b) => b.id === bookId);
    if (!book) {
      return { success: false, newQuantity: 0, error: '도서를 찾을 수 없습니다.' };
    }

    const currentQty = this.inventory[bookId] ?? 0;
    const change = newQuantity - currentQty;
    const nowIso = new Date().toISOString();

    this.inventory[bookId] = newQuantity;
    book.updatedAt = nowIso;

    const txType = reasonToTransactionType(reason, change);
    const newLog: InventoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCoverImage: book.coverImage,
      changeQuantity: change,
      resultingQuantity: newQuantity,
      reason,
      transactionType: txType,
      note: note || `재고 직접 수정 (${currentQty}권 → ${newQuantity}권)`,
      createdAt: nowIso,
    };

    this.logs.unshift(newLog);
    this.saveToStorage();

    if (isSupabaseConfigured) {
      this.syncStockChangeToSupabase(bookId, newQuantity, change, txType, newLog.note);
    }

    return { success: true, newQuantity };
  }

  private async syncStockChangeToSupabase(
    bookId: string,
    newQuantity: number,
    changeQuantity: number,
    transactionType: TransactionType,
    note?: string
  ) {
    try {
      // Update inventory table
      const { data: existingInv } = await supabase
        .from('inventory')
        .select('id')
        .eq('book_id', bookId)
        .maybeSingle();

      if (existingInv?.id) {
        await supabase
          .from('inventory')
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('book_id', bookId);
      } else {
        await supabase.from('inventory').insert({
          book_id: bookId,
          quantity: newQuantity,
          location: this.locations[bookId] || 'A1 선반',
          updated_at: new Date().toISOString(),
        });
      }

      // Record transaction
      if (changeQuantity !== 0) {
        await supabase.from('inventory_transactions').insert({
          book_id: bookId,
          change_quantity: changeQuantity,
          transaction_type: transactionType,
          note: note || null,
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Failed to persist inventory change to Supabase:', e);
    }
  }

  public registerBook(
    bookData: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>,
    initialQuantity: number = 1,
    note?: string
  ): BookWithStock {
    // Generate UUID or standard unique ID
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `book-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const newBook: Book = {
      ...bookData,
      id: newId,
      createdAt: now,
      updatedAt: now,
      coverImage:
        bookData.coverImage ||
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
    };

    this.books.unshift(newBook);
    this.inventory[newId] = initialQuantity;
    if (bookData.location) {
      this.locations[newId] = bookData.location;
    }

    const newLog: InventoryLog = {
      id: `log-${Date.now()}`,
      bookId: newId,
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

    // Persist to Supabase
    if (isSupabaseConfigured) {
      this.persistNewBookToSupabase(newBook, initialQuantity, note);
    }

    return {
      ...newBook,
      quantity: initialQuantity,
    };
  }

  private async persistNewBookToSupabase(
    newBook: Book,
    initialQuantity: number,
    note?: string
  ) {
    try {
      const { error: bErr } = await supabase.from('books').insert({
        id: newBook.id,
        isbn: newBook.isbn,
        title: newBook.title,
        author: newBook.author,
        publisher: newBook.publisher,
        price: newBook.price,
        category: newBook.category || '소설',
        description: newBook.description || null,
        cover_image_url: newBook.coverImage,
        created_at: newBook.createdAt,
        updated_at: newBook.updatedAt,
      });

      if (bErr) throw bErr;

      const { error: iErr } = await supabase.from('inventory').insert({
        book_id: newBook.id,
        quantity: initialQuantity,
        location: newBook.location || 'A1 선반',
        updated_at: newBook.updatedAt,
      });

      if (iErr) throw iErr;

      if (initialQuantity > 0) {
        await supabase.from('inventory_transactions').insert({
          book_id: newBook.id,
          change_quantity: initialQuantity,
          transaction_type: 'IN',
          note: note || `신규 도서 초도 입고 (${initialQuantity}권)`,
          created_at: newBook.createdAt,
        });
      }
    } catch (e) {
      console.error('Error inserting new book to Supabase:', e);
    }
  }

  public updateBook(bookId: string, updates: Partial<Book>): boolean {
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
      this.persistBookUpdateToSupabase(bookId, updates);
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

  public deleteBook(bookId: string): boolean {
    this.books = this.books.filter((b) => b.id !== bookId);
    delete this.inventory[bookId];
    delete this.locations[bookId];
    this.logs = this.logs.filter((l) => l.bookId !== bookId);
    this.saveToStorage();

    if (isSupabaseConfigured) {
      this.deleteFromSupabase(bookId);
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
   * External Book lookup simulation or API wrapper for new ISBNs
   */
  public async lookupExternalBook(isbn: string): Promise<Partial<Book> | null> {
    const clean = isbn.replace(/[^0-9X]/gi, '');
    if (!clean) return null;

    // 1. Check local / Supabase database
    const supabaseMatch = await this.lookupBookByIsbnInSupabase(clean);
    if (supabaseMatch) {
      return supabaseMatch;
    }

    // 2. Preset catalog for known test ISBNs if scanned
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
      return knownIsbnMap[clean];
    }

    // 3. Fallback template for any other scanned ISBN
    return {
      isbn: clean,
      title: `신규 등록 도서 (ISBN: ${clean})`,
      author: '미상 / 직접 입력',
      publisher: '독립출판 / 미등록',
      price: 15000,
      category: '일반도서',
      publishedDate: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      bindingType: '무선제본',
      location: '신간 매대',
      coverImage:
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
    };
  }
}

export const inventoryStore = new InventoryStore();
