import React, { useState } from 'react';
import { AgroProvider } from './context/AgroContext';
import Navbar from './components/Navbar';
import Home from './components/public/Home';
import ProductCatalog from './components/public/ProductCatalog';
import AboutCompany from './components/public/AboutCompany';
import Footer from './components/public/Footer';

// Admin / ERP Modules
import InvoiceGenerator from './components/admin/InvoiceGenerator';
import InvoiceList from './components/admin/InvoiceList';
import StockManagement from './components/admin/StockManagement';
import DamageReturns from './components/admin/DamageReturns';
import DealerLedger from './components/admin/DealerLedger';
import OfficerPerformance from './components/admin/OfficerPerformance';
import MonthlyReport from './components/admin/MonthlyReport';

function AppContent() {
  const [activeTab, setActiveTab] = useState('website-home');
  const [editingInvoice, setEditingInvoice] = useState(null);

  const handleStartNewInvoice = () => {
    setEditingInvoice(null);
    setActiveTab('new-invoice');
  };

  const handleEditInvoice = (inv) => {
    setEditingInvoice(inv);
    setActiveTab('new-invoice');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'new-invoice' && activeTab !== 'new-invoice') {
            setEditingInvoice(null);
          }
          setActiveTab(tab);
        }}
      />

      {/* Main View Router */}
      <main className="flex-grow">
        {activeTab === 'website-home' && (
          <Home onNavigate={setActiveTab} />
        )}

        {activeTab === 'website-products' && (
          <ProductCatalog
            onSelectProductForInvoice={handleStartNewInvoice}
          />
        )}

        {activeTab === 'website-about' && (
          <AboutCompany />
        )}

        {activeTab === 'new-invoice' && (
          <InvoiceGenerator
            onViewInvoices={() => setActiveTab('invoice-list')}
            editInvoiceData={editingInvoice}
            onCancelEdit={() => setEditingInvoice(null)}
          />
        )}

        {activeTab === 'invoice-list' && (
          <InvoiceList
            onNewInvoiceClick={handleStartNewInvoice}
            onEditInvoice={handleEditInvoice}
          />
        )}

        {activeTab === 'inventory' && (
          <StockManagement />
        )}

        {activeTab === 'damage-returns' && (
          <DamageReturns />
        )}

        {activeTab === 'dealer-ledger' && (
          <DealerLedger />
        )}

        {activeTab === 'officer-tracking' && (
          <OfficerPerformance />
        )}

        {activeTab === 'monthly-reports' && (
          <MonthlyReport />
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={setActiveTab} />
    </div>
  );
}

export default function App() {
  return (
    <AgroProvider>
      <AppContent />
    </AgroProvider>
  );
}
