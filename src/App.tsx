import React, { useState, useEffect } from 'react';
import { ViewType, InventoryFilter } from './types';
import { inventoryStore } from './services/inventoryStore';
import { authStore } from './services/authStore';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { DashboardView } from './views/DashboardView';
import { ScannerView } from './views/ScannerView';
import { InventoryView } from './views/InventoryView';
import { BookDetailView } from './views/BookDetailView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { AddBookModal } from './components/modals/AddBookModal';
import { QuickRestockModal } from './components/modals/QuickRestockModal';
import { Toast } from './components/common/Toast';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(authStore.isAdmin);

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => {
      setIsAdmin(authStore.isAdmin);
    });
    return unsubscribe;
  }, []);

  // Parse current route from window location hash or pathname fallback
  const parseHashRoute = (): { view: ViewType; bookId: string | null } => {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    const path = window.location.pathname.replace(/^\//, '').trim();
    const route = hash || path;

    if (!route || route === 'dashboard' || route === 'home') {
      return { view: 'dashboard', bookId: null };
    }
    if (route.startsWith('book/') || route.startsWith('detail/')) {
      const bookId = route.split('/')[1] || null;
      return { view: 'detail', bookId };
    }
    if (route === 'inventory' || route === 'stock') return { view: 'inventory', bookId: null };
    if (route === 'orders' || route === 'order' || route === 'customer_orders') return { view: 'orders', bookId: null };
    if (route === 'scanner' || route === 'scan') return { view: 'scanner', bookId: null };
    if (route === 'history' || route === 'logs') return { view: 'history', bookId: null };
    if (route === 'settings') return { view: 'settings', bookId: null };
    return { view: 'dashboard', bookId: null };
  };

  const [currentView, setCurrentView] = useState<ViewType>(() => parseHashRoute().view);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(() => parseHashRoute().bookId);
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Clean initial hash if it is dashboard/home
  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (hash === 'dashboard' || hash === 'home') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // Modals state
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [isQuickRestockOpen, setIsQuickRestockOpen] = useState(false);

  // Guard admin routes if not in admin mode
  useEffect(() => {
    if (!isAdmin && (currentView === 'history' || currentView === 'settings')) {
      setCurrentView('dashboard');
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      setToastMessage('관리자 모드 전용 메뉴입니다. 메인 화면으로 이동합니다.');
    }
  }, [isAdmin, currentView]);

  // Re-render trigger when store changes
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = inventoryStore.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  // Sync state with browser hash navigation (Back/Forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const { view, bookId } = parseHashRoute();
      // Guard admin pages on direct hash change
      if (!authStore.isAdmin && (view === 'history' || view === 'settings')) {
        setCurrentView('dashboard');
        history.replaceState(null, '', window.location.pathname + window.location.search);
        setToastMessage('관리자 모드 전용 메뉴입니다.');
        return;
      }
      setCurrentView(view);
      if (view === 'inventory') {
        // Default to 'all' when navigating via hash unless specifically filtered
        setInventoryFilter((prev) => (prev === 'reader_pick_out_of_stock' || prev === 'reader_pick' ? prev : 'all'));
      }
      if (bookId) {
        setSelectedBookId(bookId);
      }
      if (view === 'dashboard' && window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (view: ViewType) => {
    if (!isAdmin && (view === 'history' || view === 'settings')) {
      setToastMessage('관리자 모드 전용 메뉴입니다.');
      return;
    }

    if (view === 'inventory') {
      setInventoryFilter('all');
      setSearchQuery('');
    }

    setCurrentView(view);
    if (view === 'dashboard') {
      if (window.location.hash) {
        history.pushState(null, '', window.location.pathname + window.location.search);
      }
    } else {
      window.location.hash = `#/${view}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    setCurrentView('detail');
    window.location.hash = `#/book/${bookId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterLowStock = () => {
    setInventoryFilter('reader_pick_out_of_stock');
    setCurrentView('inventory');
    window.location.hash = '#/inventory';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGlobalSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setCurrentView('inventory');
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#171e1e] flex flex-col font-['Public_Sans','Noto_Sans_KR',sans-serif] selection:bg-[#d6eaaf] selection:text-[#142000]">
      {/* Toast Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* Main Responsive Layout */}
      <div className="flex flex-1 min-h-screen">
        {/* Desktop Sidebar Navigation */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          onOpenQuickRestock={() => {
            if (!isAdmin) {
              showToast('관리자 모드에서만 사용 가능한 기능입니다.');
              return;
            }
            setIsQuickRestockOpen(true);
          }}
          onOpenAddBook={() => {
            if (!isAdmin) {
              showToast('관리자 모드에서만 사용 가능한 기능입니다.');
              return;
            }
            setIsAddBookOpen(true);
          }}
          onShowToast={showToast}
        />

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
          {/* Global Sticky Header */}
          <TopHeader
            onNavigate={handleNavigate}
            onSearch={handleGlobalSearch}
            onOpenScanner={() => handleNavigate('scanner')}
            onOpenAddBook={() => {
              if (!isAdmin) {
                showToast('관리자 모드에서만 사용 가능한 기능입니다.');
                return;
              }
              setIsAddBookOpen(true);
            }}
            onShowToast={showToast}
            currentView={currentView}
          />

          {/* Main View Router Container */}
          <main className="flex-1 pt-20 sm:pt-20 md:pt-22 px-4 sm:px-6 md:px-8 lg:px-10 pb-28 lg:pb-12 max-w-7xl w-full mx-auto">
            {currentView === 'dashboard' && (
              <DashboardView
                onNavigate={handleNavigate}
                onSelectBook={handleSelectBook}
                onOpenAddBook={() => {
                  if (!isAdmin) {
                    showToast('관리자 모드에서만 사용 가능한 기능입니다.');
                    return;
                  }
                  setIsAddBookOpen(true);
                }}
                onOpenQuickRestock={() => {
                  if (!isAdmin) {
                    showToast('관리자 모드에서만 사용 가능한 기능입니다.');
                    return;
                  }
                  setIsQuickRestockOpen(true);
                }}
                onFilterLowStock={handleFilterLowStock}
                onShowToast={showToast}
              />
            )}

            {currentView === 'scanner' && (
              <ScannerView
                onSelectBook={handleSelectBook}
                onNavigateHome={() => handleNavigate('dashboard')}
                onShowToast={showToast}
              />
            )}

            {(currentView === 'inventory' || currentView === 'orders') && (
              <InventoryView
                onSelectBook={handleSelectBook}
                onOpenAddBook={() => {
                  if (!isAdmin) {
                    showToast('관리자 모드에서만 사용 가능한 기능입니다.');
                    return;
                  }
                  setIsAddBookOpen(true);
                }}
                initialFilter={inventoryFilter}
                searchQuery={searchQuery}
                onShowToast={showToast}
                initialTab={currentView === 'orders' ? 'orders' : 'books'}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'detail' && selectedBookId && (
              <BookDetailView
                bookId={selectedBookId}
                onBack={() => handleNavigate('inventory')}
                onNavigate={handleNavigate}
                onShowToast={showToast}
              />
            )}

            {currentView === 'history' && (
              <HistoryView
                onSelectBook={handleSelectBook}
                onNavigateHome={() => handleNavigate('dashboard')}
                onShowToast={showToast}
              />
            )}

            {currentView === 'settings' && (
              <SettingsView onShowToast={showToast} />
            )}
          </main>
        </div>
      </div>

      {/* Mobile Sticky Bottom Navigation */}
      <BottomNavigation
        currentView={currentView}
        onNavigate={handleNavigate}
      />

      {/* Global Modals */}
      {isAdmin && isAddBookOpen && (
        <AddBookModal
          onClose={() => setIsAddBookOpen(false)}
          onSuccess={(newBookId, msg) => {
            setIsAddBookOpen(false);
            showToast(msg);
            setSelectedBookId(newBookId);
            setCurrentView('detail');
            window.location.hash = `#/book/${newBookId}`;
          }}
        />
      )}

      {isAdmin && isQuickRestockOpen && (
        <QuickRestockModal
          onClose={() => setIsQuickRestockOpen(false)}
          onSuccess={(msg) => showToast(msg)}
        />
      )}
    </div>
  );
}
