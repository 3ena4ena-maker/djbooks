import React, { useState, useEffect } from 'react';
import { ViewType, InventoryFilter } from './types';
import { inventoryStore } from './services/inventoryStore';
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
  // Parse current route from window location hash or pathname fallback
  const parseHashRoute = (): { view: ViewType; bookId: string | null } => {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    // Pathname fallback if user navigates with direct path (e.g. /orders, /inventory)
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
      setCurrentView(view);
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
    setInventoryFilter('low_stock');
    setCurrentView('inventory');
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
          onOpenQuickRestock={() => setIsQuickRestockOpen(true)}
          onOpenAddBook={() => setIsAddBookOpen(true)}
        />

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
          {/* Global Sticky Header */}
          <TopHeader
            onNavigate={handleNavigate}
            onSearch={handleGlobalSearch}
            onOpenScanner={() => handleNavigate('scanner')}
            onOpenAddBook={() => setIsAddBookOpen(true)}
            currentView={currentView}
          />

          {/* Main View Router Container */}
          <main className="flex-1 pt-20 sm:pt-20 md:pt-22 px-4 sm:px-6 md:px-8 lg:px-10 pb-28 lg:pb-12 max-w-7xl w-full mx-auto">
            {currentView === 'dashboard' && (
              <DashboardView
                onNavigate={handleNavigate}
                onSelectBook={handleSelectBook}
                onOpenAddBook={() => setIsAddBookOpen(true)}
                onOpenQuickRestock={() => setIsQuickRestockOpen(true)}
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
                onOpenAddBook={() => setIsAddBookOpen(true)}
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
      {isAddBookOpen && (
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

      {isQuickRestockOpen && (
        <QuickRestockModal
          onClose={() => setIsQuickRestockOpen(false)}
          onSuccess={(msg) => showToast(msg)}
        />
      )}
    </div>
  );
}
