import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read Supabase credentials safely from env or localStorage
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {}) as any;

const STORAGE_KEYS = {
  URL: 'folio_supabase_url',
  KEY: 'folio_supabase_key',
};

export const DEFAULT_SUPABASE_URL = 'https://moubboivhveqdqrwmlkq.supabase.co';

export function getStoredSupabaseConfig(): { url: string; key: string } {
  let url = env.VITE_SUPABASE_URL || '';
  let key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';

  if (typeof window !== 'undefined' && window.localStorage) {
    const localUrl = localStorage.getItem(STORAGE_KEYS.URL);
    const localKey = localStorage.getItem(STORAGE_KEYS.KEY);
    if (localUrl && localUrl.trim()) url = localUrl.trim();
    if (localKey && localKey.trim()) key = localKey.trim();
  }

  if (!url || !url.trim()) {
    url = DEFAULT_SUPABASE_URL;
  }

  return { url: url.trim(), key: key.trim() };
}

export function saveStoredSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (url && url.trim()) {
      localStorage.setItem(STORAGE_KEYS.URL, url.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.URL);
    }

    if (key && key.trim()) {
      localStorage.setItem(STORAGE_KEYS.KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.KEY);
    }
  }
}

// Fallback dummy client if key is not configured, to prevent startup crashes
const fallbackDummyClient = {
  from: () => ({
    select: () => Promise.resolve({ data: [], error: new Error('Supabase Publishable Key not configured') }),
    insert: () => Promise.resolve({ data: null, error: new Error('Supabase Publishable Key not configured') }),
    update: () => Promise.resolve({ data: null, error: new Error('Supabase Publishable Key not configured') }),
    upsert: () => Promise.resolve({ data: null, error: new Error('Supabase Publishable Key not configured') }),
    delete: () => Promise.resolve({ data: null, error: new Error('Supabase Publishable Key not configured') }),
  }),
  channel: () => ({
    on: () => ({
      subscribe: () => ({}),
    }),
  }),
} as unknown as SupabaseClient;

let currentConfig = getStoredSupabaseConfig();

export let isSupabaseConfigured = Boolean(
  currentConfig.url &&
    currentConfig.key &&
    currentConfig.key.trim() !== '' &&
    !currentConfig.key.startsWith('MY_')
);

export let supabaseUrl = currentConfig.url;

export let supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(currentConfig.url, currentConfig.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : fallbackDummyClient;

export function reconfigureSupabase(url: string, key: string): { client: SupabaseClient; isConfigured: boolean } {
  saveStoredSupabaseConfig(url, key);
  currentConfig = getStoredSupabaseConfig();
  
  isSupabaseConfigured = Boolean(
    currentConfig.url &&
      currentConfig.key &&
      currentConfig.key.trim() !== '' &&
      !currentConfig.key.startsWith('MY_')
  );
  
  supabaseUrl = currentConfig.url;
  
  if (isSupabaseConfigured) {
    supabase = createClient(currentConfig.url, currentConfig.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } else {
    supabase = fallbackDummyClient;
  }
  
  return { client: supabase, isConfigured: isSupabaseConfigured };
}

export async function testSupabaseConnection(url: string, key: string): Promise<{
  success: boolean;
  message: string;
  tables?: { books: boolean; inventory: boolean; logs: boolean; orders: boolean };
}> {
  if (!url || !key || !key.trim()) {
    return { success: false, message: 'Supabase URL과 Anon Key를 모두 입력해주세요.' };
  }

  try {
    const testClient = createClient(url.trim(), key.trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tables = { books: false, inventory: false, logs: false, orders: false };

    // Test books table
    const { data: booksData, error: booksErr } = await testClient.from('books').select('id').limit(1);
    if (booksErr) {
      return { success: false, message: `books 테이블 조회 실패: ${booksErr.message}` };
    }
    tables.books = true;

    // Test inventory table
    const { error: invErr } = await testClient.from('inventory').select('book_id').limit(1);
    if (!invErr) tables.inventory = true;

    // Test transactions or logs table
    const { error: txErr } = await testClient.from('inventory_transactions').select('id').limit(1);
    if (!txErr) {
      tables.logs = true;
    } else {
      const { error: logsErr } = await testClient.from('inventory_logs').select('id').limit(1);
      if (!logsErr) tables.logs = true;
    }

    // Test customer orders table
    const { error: ordersErr } = await testClient.from('customer_orders').select('id').limit(1);
    if (!ordersErr) tables.orders = true;

    return {
      success: true,
      message: `Supabase 연결 성공! (도서 ${booksData?.length !== undefined ? '정상' : ''})`,
      tables,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `연결 오류: ${err?.message || '알 수 없는 네트워크 오류'}`,
    };
  }
}

