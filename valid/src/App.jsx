import React, { useState } from 'react';
import { AgroProvider, useAgro } from './context/AgroContext';
import Navbar from './components/Navbar';
import Home from './components/public/Home';
import ProductCatalog from './components/public/ProductCatalog';
import AboutCompany from './components/public/AboutCompany';
import Footer from './components/public/Footer';
import AuthPage from './components/AuthPage';
import OfficerDashboard from './components/OfficerDashboard';
import DamageReturns from './components/admin/DamageReturns';
import { UiPreferencesProvider } from './context/UiPreferencesContext';

// Admin / ERP Modules
import AdminAccess from './components/admin/AdminAccess';
import InvoiceGenerator from './components/admin/InvoiceGenerator';
import InvoiceList from './components/admin/InvoiceList';
import StockManagement from './components/admin/StockManagement';
import DealerLedger from './components/admin/DealerLedger';
import OfficerPerformance from './components/admin/OfficerPerformance';
import DashboardReports from './components/admin/DashboardReports';
import SalesAgreement from './components/admin/SalesAgreement';
import MonthlyTargetReports from './components/admin/MonthlyTargetReports';
import AdminDataManagement from './components/admin/AdminDataManagement';
import FactoryDataReset from './components/admin/FactoryDataReset';
import {
  ASM_ROLE,
  LOGISTIC_OFFICER_ROLE,
  OFFICER_ROLE,
  RSM_ROLE,
  SO_ROLE,
  isAdminRole
} from '../shared/roles';

function AppContent() {
  const {
    currentUser,
    authLoading,
    authError,
    cloudError
  } = useAgro();
  const [activeTab, setActiveTab] = useState('website-home');
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [invoiceToPrintId, setInvoiceToPrintId] = useState('');
  const [invoiceFormKey, setInvoiceFormKey] = useState(0);

  const handleNavigate = (tab) => {
    const publicTabs = ['website-home', 'website-products', 'website-about'];
    const authTabs = ['admin-login', 'officer-login', 'officer-register'];
    if (publicTabs.includes(tab) || authTabs.includes(tab)) {
      setActiveTab(tab);
      return;
    }

    if (isAdminRole(currentUser?.role)) {
      setActiveTab(tab);
    } else if (currentUser?.role === RSM_ROLE || currentUser?.role === ASM_ROLE) {
      const reportTabs = [
        'inventory',
        'invoice-list',
        'dealer-ledger',
        'dashboard-reports',
        'monthly-sales-reports'
      ];
      setActiveTab((currentUser?.role === ASM_ROLE && tab === 'admin-access')
        || reportTabs.includes(tab) ? tab : 'dashboard-reports');
    } else if (currentUser?.role === LOGISTIC_OFFICER_ROLE) {
      setActiveTab([
        'admin-access',
        'inventory',
        'invoice-list',
        'new-invoice',
        'dealer-ledger',
        'damage-returns'
      ].includes(tab) ? tab : 'inventory');
    } else if ([OFFICER_ROLE, SO_ROLE].includes(currentUser?.role)) {
      setActiveTab(tab === 'officer-dashboard' ? tab : 'officer-dashboard');
    } else {
      setActiveTab(tab === 'officer-dashboard' ? 'officer-login' : 'admin-login');
    }
  };

  const handleStartNewInvoice = () => {
    setEditingInvoice(null);
    setInvoiceToPrintId('');
    setInvoiceFormKey((key) => key + 1);
    handleNavigate('new-invoice');
  };

  const handleEditInvoice = (inv) => {
    setEditingInvoice(inv);
    handleNavigate('new-invoice');
  };

  const handleLoginSuccess = (user) => {
    setActiveTab(isAdminRole(user.role)
      ? 'admin-access'
      : user.role === ASM_ROLE
        ? 'admin-access'
        : user.role === RSM_ROLE
          ? 'dashboard-reports'
        : user.role === LOGISTIC_OFFICER_ROLE
          ? 'admin-access'
          : 'officer-dashboard');
  };

  const renderActivePage = () => {
    if (['admin-login', 'officer-login', 'officer-register'].includes(activeTab)) {
      return (
        <AuthPage
          key={activeTab}
          initialRole={activeTab}
          onNavigate={handleNavigate}
          onLoginSuccess={handleLoginSuccess}
        />
      );
    }
    if (
      [OFFICER_ROLE, SO_ROLE].includes(currentUser?.role)
      && !['website-home', 'website-products', 'website-about'].includes(activeTab)
    ) return <OfficerDashboard />;
    if (!currentUser && !['website-home', 'website-products', 'website-about'].includes(activeTab)) {
      return <AuthPage key="admin-login" initialRole="admin-login" onNavigate={handleNavigate} onLoginSuccess={handleLoginSuccess} />;
    }
    if (activeTab === 'website-home') return <Home onNavigate={handleNavigate} />;
    if (activeTab === 'website-products') {
      return (
        <ProductCatalog
          onSelectProductForInvoice={[OFFICER_ROLE, SO_ROLE].includes(currentUser?.role)
            ? () => handleNavigate('officer-dashboard')
            : handleStartNewInvoice}
          actionLabel={[OFFICER_ROLE, SO_ROLE].includes(currentUser?.role) ? 'অর্ডার করুন' : 'ইনভয়েসে যোগ করুন'}
        />
      );
    }
    if (activeTab === 'website-about') return <AboutCompany />;
    if (activeTab === 'admin-access') {
      return <AdminAccess onInvoiceCreated={(invoice) => {
        setInvoiceToPrintId(invoice.id);
        setActiveTab('invoice-list');
      }} />;
    }
    if (activeTab === 'new-invoice') {
      return (
        <InvoiceGenerator
          key={invoiceFormKey}
          onViewInvoices={() => handleNavigate('invoice-list')}
          onInvoiceCreated={() => {
            setEditingInvoice(null);
            setInvoiceToPrintId('');
            setInvoiceFormKey((key) => key + 1);
          }}
          editInvoiceData={editingInvoice}
          onCancelEdit={() => {
            setEditingInvoice(null);
            setInvoiceFormKey((key) => key + 1);
          }}
        />
      );
    }
    if (activeTab === 'invoice-list') {
      return (
        <InvoiceList
          onNewInvoiceClick={handleStartNewInvoice}
          onEditInvoice={handleEditInvoice}
          initialInvoiceId={invoiceToPrintId}
        />
      );
    }
    if (activeTab === 'inventory') return <StockManagement />;
    if (activeTab === 'damage-returns') return <DamageReturns />;
    if (activeTab === 'dealer-ledger') return <DealerLedger />;
    if (activeTab === 'officer-tracking') return <OfficerPerformance />;
    if (activeTab === 'dashboard-reports') return <DashboardReports />;
    if (activeTab === 'data-management') return <AdminDataManagement />;
    if (activeTab === 'factory-reset') return <FactoryDataReset />;
    if (activeTab === 'sales-agreements') return <SalesAgreement />;
    if (activeTab === 'monthly-sales-reports') return <MonthlyTargetReports />;
    return <Home onNavigate={handleNavigate} />;
  };

  return (
    <UiPreferencesProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        <Navbar
          activeTab={activeTab}
          setActiveTab={handleNavigate}
        />

        <main className="flex-grow">
          {authLoading && !currentUser ? (
            <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-slate-500">সেশন যাচাই হচ্ছে...</div>
          ) : (
            <>
              {cloudError && currentUser && (
                <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  অনলাইন ডেটা সিঙ্ক হয়নি: {cloudError}
                </div>
              )}
              {authError && !currentUser && activeTab.includes('login') && (
                <div role="alert" className="mx-auto mt-4 max-w-2xl rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  {authError}
                </div>
              )}
              {renderActivePage()}
            </>
          )}
        </main>

        <Footer onNavigate={handleNavigate} />
      </div>
    </UiPreferencesProvider>
  );
}

export default function App() {
  return (
    <AgroProvider>
      <AppContent />
    </AgroProvider>
  );
}
