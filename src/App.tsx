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
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const handleNavigate = (view: ViewType) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    setCurrentView('detail');
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
              />
            )}

            {currentView === 'scanner' && (
              <ScannerView
                onSelectBook={handleSelectBook}
                onNavigateHome={() => handleNavigate('dashboard')}
                onShowToast={showToast}
              />
            )}

            {currentView === 'inventory' && (
              <InventoryView
                onSelectBook={handleSelectBook}
                onOpenAddBook={() => setIsAddBookOpen(true)}
                initialFilter={inventoryFilter}
                searchQuery={searchQuery}
                onShowToast={showToast}
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
            showToast(msg);
            setSelectedBookId(newBookId);
            setCurrentView('detail');
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
