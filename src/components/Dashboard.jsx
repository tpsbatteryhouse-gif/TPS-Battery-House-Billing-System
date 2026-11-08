import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  X,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  FileEdit,
  ArrowRight,
  Eye,
  Sparkles,
  BatteryCharging,
  Zap,
  Sun,
  Wrench,
  Layers,
  Filter,
  Calendar,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { MOCK_USER, INVOICE_STATUSES } from '../data/mockData';
import { useAuth } from '../context/useAuth';
import { formatINR } from '../utils/numberToWords';
import { getTimeBasedGreeting } from '../utils/idGenerator';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  normalizeInvoiceItem,
} from '../utils/categories';
import {
  calculateDashboardMetrics,
  DASHBOARD_PERIODS,
  PERIOD_LABELS,
  getIndianFinancialYear,
} from '../utils/dashboardFinancialMetrics';

export default function Dashboard({
  invoices,
  onNewInvoice,
  onOpenInvoice,
  onViewAllInvoices,
}) {
  const [selectedPeriod, setSelectedPeriod] = useState(DASHBOARD_PERIODS.ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [greeting] = useState(() => getTimeBasedGreeting());
  const authContext = useAuth();
  const userName = authContext?.member?.displayName || authContext?.user?.displayName || MOCK_USER.name;

  // Compute Authoritative Dashboard Metrics using centralized engine
  const metrics = useMemo(() => {
    return calculateDashboardMetrics(invoices, { period: selectedPeriod });
  }, [invoices, selectedPeriod]);

  // Current Fiscal Year label (e.g. "FY 2026-27")
  const [currentFyLabel] = useState(() => `FY ${getIndianFinancialYear(new Date())}`);

  // Filter and search invoices for the Recent Invoices table
  // Synchronized with selected reporting period
  const filteredInvoices = useMemo(() => {
    const baseInvoices = metrics.invoices.all;

    return baseInvoices
      .filter((inv) => {
        // Status filter
        if (selectedStatus !== 'All' && inv.paymentStatus !== selectedStatus) {
          return false;
        }

        // Category filter: does invoice contain any item with selected category?
        if (selectedCategory !== 'All') {
          const hasCategory = (inv.items || []).some((rawItem) => {
            const item = normalizeInvoiceItem(rawItem);
            return item.category === selectedCategory;
          });
          if (!hasCategory) return false;
        }

        // Search query (case-insensitive for invoiceNumber, customer.name, and item names)
        if (searchQuery.trim() !== '') {
          const query = searchQuery.toLowerCase().trim();
          const invNo = (inv.invoiceNumber || '').toLowerCase();
          const client = (inv.customer?.name || '').toLowerCase();
          const itemsMatch = (inv.items || []).some((it) =>
            (it.name || '').toLowerCase().includes(query)
          );
          return invNo.includes(query) || client.includes(query) || itemsMatch;
        }

        return true;
      })
      .sort((a, b) => {
        const rawA = new Date(a.createdAt || a.invoiceDate).getTime();
        const rawB = new Date(b.createdAt || b.invoiceDate).getTime();
        const dateA = !isNaN(rawA) ? rawA : 0;
        const dateB = !isNaN(rawB) ? rawB : 0;
        return dateB - dateA;
      });
  }, [metrics.invoices.all, searchQuery, selectedStatus, selectedCategory]);

  // Status Badge Component
  const renderStatusBadge = (status) => {
    switch (status) {
      case INVOICE_STATUSES.PAID:
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            Paid
          </span>
        );
      case INVOICE_STATUSES.PENDING:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case INVOICE_STATUSES.OVERDUE:
        return (
          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <AlertTriangle className="w-3 h-3" />
            Overdue
          </span>
        );
      case INVOICE_STATUSES.DRAFT:
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-700/40 text-slate-400 border border-slate-600/30 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <FileEdit className="w-3 h-3" />
            Draft
          </span>
        );
    }
  };

  // Category Icon helper
  const getCatIcon = (cat, className = 'w-3.5 h-3.5') => {
    switch (cat) {
      case PRODUCT_CATEGORIES.BATTERY:
        return <BatteryCharging className={className} />;
      case PRODUCT_CATEGORIES.INVERTER:
        return <Zap className={className} />;
      case PRODUCT_CATEGORIES.SOLAR:
        return <Sun className={className} />;
      case PRODUCT_CATEGORIES.SERVICES:
        return <Wrench className={className} />;
      default:
        return <Layers className={className} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/30 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                TPS BATTERYS HOUSE • Multi-Category Portal
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              {greeting}, {userName}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Manage Batteries, Inverters, Solar Systems, and Installation Services billing.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={onNewInvoice}
              className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95 group"
            >
              <Plus className="w-4 h-4 stroke-[3] group-hover:rotate-90 transition-transform" />
              <span>+ New Invoice</span>
            </button>
          </div>
        </div>
      </section>

      {/* Reporting Period Selector Bar */}
      <section
        aria-label="Reporting Period Filter"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-2.5 shadow-sm"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span>Reporting Period:</span>
          <span className="text-white font-mono font-bold bg-slate-800/80 px-2 py-0.5 rounded text-[11px]">
            {selectedPeriod === DASHBOARD_PERIODS.THIS_FY ? currentFyLabel : (PERIOD_LABELS[selectedPeriod] || metrics.periodLabel)}
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Select reporting period"
          className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs no-scrollbar"
        >
          {[
            { id: DASHBOARD_PERIODS.ALL, label: 'All Time' },
            { id: DASHBOARD_PERIODS.THIS_FY, label: currentFyLabel },
            { id: DASHBOARD_PERIODS.THIS_MONTH, label: 'This Month' },
            { id: DASHBOARD_PERIODS.THIS_WEEK, label: 'This Week' },
            { id: DASHBOARD_PERIODS.TODAY, label: 'Today' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selectedPeriod === item.id}
              onClick={() => setSelectedPeriod(item.id)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-all text-xs ${
                selectedPeriod === item.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* Primary Redesigned KPI Metrics Hierarchy */}
      <section aria-label="Authoritative Financial KPI Hierarchy">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Invoices (Authoritative Issued vs Draft) */}
          <div
            onClick={() => setSelectedStatus('All')}
            className={`bg-slate-900/90 border rounded-2xl p-3.5 sm:p-5 transition-all shadow-lg flex flex-col justify-between cursor-pointer group ${
              selectedStatus === 'All' ? 'border-blue-500/50 bg-slate-900' : 'border-slate-800 hover:border-slate-700/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-blue-400 transition-colors">
                Total Invoices
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight flex items-baseline gap-1.5">
                <span>{metrics.counts.issuedCount}</span>
                <span className="text-xs font-normal text-slate-400">issued</span>
              </div>
              <div className="mt-1">
                {metrics.counts.draftCount > 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStatus(INVOICE_STATUSES.DRAFT);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium transition-colors"
                    title="Filter table by Draft invoices"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>{metrics.counts.draftCount} draft in progress</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                ) : (
                  <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                    All invoices finalized
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Collected Revenue (From Settled Paid Invoices) */}
          <div
            onClick={() => setSelectedStatus(INVOICE_STATUSES.PAID)}
            className={`bg-slate-900/90 border rounded-2xl p-3.5 sm:p-5 transition-all shadow-lg flex flex-col justify-between cursor-pointer group ${
              selectedStatus === INVOICE_STATUSES.PAID ? 'border-emerald-500/50 bg-slate-900' : 'border-slate-800 hover:border-slate-700/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">
                Collected Revenue
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight truncate">
                {formatINR(metrics.financials.collectedRevenue)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
                <span className="text-white font-semibold font-mono">{metrics.counts.paidCount}</span> settled •{' '}
                <span className="text-emerald-400 font-mono font-semibold">{metrics.rates.revenueCollectionRate}%</span> collected
              </p>
            </div>
          </div>

          {/* Card 3: Outstanding Balance (Pending within due terms) */}
          <div
            onClick={() => setSelectedStatus(INVOICE_STATUSES.PENDING)}
            className={`bg-slate-900/90 border rounded-2xl p-3.5 sm:p-5 transition-all shadow-lg flex flex-col justify-between cursor-pointer group ${
              selectedStatus === INVOICE_STATUSES.PENDING ? 'border-amber-500/50 bg-slate-900' : 'border-slate-800 hover:border-slate-700/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-amber-400 transition-colors">
                Outstanding
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 tracking-tight truncate">
                {formatINR(metrics.financials.pendingAmount)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
                <span className="text-white font-semibold font-mono">{metrics.counts.pendingCount}</span> pending within terms
              </p>
            </div>
          </div>

          {/* Card 4: Overdue Debt (Past due date requiring collection) */}
          <div
            onClick={() => setSelectedStatus(INVOICE_STATUSES.OVERDUE)}
            className={`bg-slate-900/90 border rounded-2xl p-3.5 sm:p-5 transition-all shadow-lg flex flex-col justify-between cursor-pointer group ${
              selectedStatus === INVOICE_STATUSES.OVERDUE ? 'border-rose-500/50 bg-slate-900' : 'border-slate-800 hover:border-slate-700/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-rose-400 transition-colors">
                Overdue Debt
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 tracking-tight truncate">
                {formatINR(metrics.financials.overdueAmount)}
              </div>
              <div className="mt-1 flex items-center justify-between gap-1">
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                  <span className="text-white font-semibold font-mono">{metrics.counts.overdueCount}</span> past due date
                </p>
                {metrics.counts.overdueCount > 0 && (
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                    Follow-up
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Debt Reconciliation Summary Bar */}
        <div className="mt-3 bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>
              Total Uncollected Debt: <strong className="text-amber-300 font-mono font-bold">{formatINR(metrics.financials.totalOutstanding)}</strong> ({metrics.counts.pendingCount + metrics.counts.overdueCount} invoices)
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span>
              Authoritative Billed: <strong className="text-white">{formatINR(metrics.financials.totalBilled)}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400">
              {metrics.rates.invoicePaymentRate}% Settled ({metrics.counts.paidCount}/{metrics.counts.issuedCount})
            </span>
          </div>
        </div>
      </section>

      {/* Category Business Performance Breakdown (Battery, Inverter, Solar, Services) */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Category Sales Performance & Revenue Distribution</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Pro-rated net revenue per category after scrap buyback and invoice discounts. Reconciles with authoritative billing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Reconciliation Status Badge */}
            {metrics.reconciliation.isBalanced ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5" />
                Reconciled (100% Balanced)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" />
                Discrepancy: {formatINR(metrics.reconciliation.discrepancy)}
              </span>
            )}

            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              Total Billed: <strong className="text-white">{formatINR(metrics.financials.totalBilled)}</strong>
            </span>
          </div>
        </div>

        {/* Invoice Deductions Bridge (if deductions exist) */}
        {metrics.financials.totalDeductions > 0 && (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Gross Item Subtotal: <strong className="text-slate-200 font-mono">{formatINR(metrics.financials.grossCategoryTotal)}</strong></span>
              <span className="text-slate-600">•</span>
              <span>Invoice Deductions (Buyback/Discounts): <strong className="text-amber-400 font-mono">-{formatINR(metrics.financials.totalDeductions)}</strong></span>
              <span className="text-slate-600">•</span>
              <span>Net Authoritative Billed: <strong className="text-white font-mono">{formatINR(metrics.financials.totalBilled)}</strong></span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Pro-rated across categories without residual loss
            </span>
          </div>
        )}

        {/* 4 Reconciled Category Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Battery */}
          <div className="bg-slate-950/70 border border-amber-500/20 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                <BatteryCharging className="w-3.5 h-3.5" />
                Battery Sales
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                {metrics.categories.percentages[PRODUCT_CATEGORIES.BATTERY]}%
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black font-mono text-white">
                {formatINR(metrics.categories.net[PRODUCT_CATEGORIES.BATTERY])}
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      metrics.categories.percentages[PRODUCT_CATEGORIES.BATTERY]
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Inverter */}
          <div className="bg-slate-950/70 border border-sky-500/20 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5 uppercase">
                <Zap className="w-3.5 h-3.5" />
                Inverter Sales
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                {metrics.categories.percentages[PRODUCT_CATEGORIES.INVERTER]}%
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black font-mono text-white">
                {formatINR(metrics.categories.net[PRODUCT_CATEGORIES.INVERTER])}
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-sky-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      metrics.categories.percentages[PRODUCT_CATEGORIES.INVERTER]
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Solar */}
          <div className="bg-slate-950/70 border border-emerald-500/20 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
                <Sun className="w-3.5 h-3.5" />
                Solar Sales
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                {metrics.categories.percentages[PRODUCT_CATEGORIES.SOLAR]}%
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black font-mono text-white">
                {formatINR(metrics.categories.net[PRODUCT_CATEGORIES.SOLAR])}
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      metrics.categories.percentages[PRODUCT_CATEGORIES.SOLAR]
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="bg-slate-950/70 border border-purple-500/20 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-400 flex items-center gap-1.5 uppercase">
                <Wrench className="w-3.5 h-3.5" />
                Service Revenue
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                {metrics.categories.percentages[PRODUCT_CATEGORIES.SERVICES]}%
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black font-mono text-white">
                {formatINR(metrics.categories.net[PRODUCT_CATEGORIES.SERVICES])}
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-purple-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      metrics.categories.percentages[PRODUCT_CATEGORIES.SERVICES]
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Invoices Section with Search & Multi-Category Filters */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        {/* Section Heading & View All Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Recent Invoices
            </h2>
            <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 font-mono rounded-full">
              {filteredInvoices.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onViewAllInvoices}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-amber-500/10"
            >
              <span>View All Invoices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Invoice Search & Category Filter Toolbar */}
        <div className="space-y-3">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3 h-3 text-amber-400" />
              Category:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedCategory === 'All'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Categories
            </button>
            {Object.values(CATEGORY_CONFIG).map((cfg) => (
              <button
                key={cfg.id}
                type="button"
                onClick={() => setSelectedCategory(cfg.id)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
                  selectedCategory === cfg.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {getCatIcon(cfg.id)}
                <span>{cfg.label}</span>
              </button>
            ))}
          </div>

          {/* Search Bar & Status Filters */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Functional Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice #, customer, or product name..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs">
              {['All', INVOICE_STATUSES.PAID, INVOICE_STATUSES.PENDING, INVOICE_STATUSES.OVERDUE, INVOICE_STATUSES.DRAFT].map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSelectedStatus(status)}
                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                      selectedStatus === status
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {status}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Invoices List Display */}
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">No matching invoices found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery || selectedStatus !== 'All' || selectedCategory !== 'All'
                  ? `No invoices matched your filter (${selectedStatus}, Category: ${selectedCategory}) or query "${searchQuery}".`
                  : `No invoices recorded for ${selectedPeriod === DASHBOARD_PERIODS.THIS_FY ? currentFyLabel : (PERIOD_LABELS[selectedPeriod] || metrics.periodLabel)}.`}
              </p>
            </div>
            <div className="pt-1 flex items-center justify-center gap-2">
              {(searchQuery || selectedStatus !== 'All' || selectedCategory !== 'All' || selectedPeriod !== DASHBOARD_PERIODS.ALL) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedStatus('All');
                    setSelectedCategory('All');
                    setSelectedPeriod(DASHBOARD_PERIODS.ALL);
                  }}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition-colors"
                >
                  Clear All Filters
                </button>
              )}
              <button
                type="button"
                onClick={onNewInvoice}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Invoice</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="py-3 px-3.5">Invoice #</th>
                    <th className="py-3 px-3.5">Client & Items</th>
                    <th className="py-3 px-3.5">Categories</th>
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5 text-right">Amount (₹)</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredInvoices.slice(0, 7).map((inv) => {
                    // Extract unique categories in this invoice
                    const itemCategories = Array.from(
                      new Set(
                        (inv.items || []).map((it) => normalizeInvoiceItem(it).category || PRODUCT_CATEGORIES.BATTERY)
                      )
                    );

                    return (
                      <tr
                        key={inv.id || inv.invoiceNumber}
                        onClick={() => onOpenInvoice(inv)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-3.5 font-mono font-bold text-amber-400 group-hover:text-amber-300">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-white truncate max-w-[200px]">
                            {inv.customer?.name || 'Walk-in Customer'}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                            {(inv.items || []).map((i) => i.name).filter(Boolean).join(', ') || 'Invoice items'}
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex flex-wrap gap-1">
                            {itemCategories.map((c) => {
                              const cfg = CATEGORY_CONFIG[c] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
                              return (
                                <span
                                  key={c}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.badgeClass} flex items-center gap-1`}
                                >
                                  {getCatIcon(c, 'w-2.5 h-2.5')}
                                  <span>{cfg.shortLabel}</span>
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-slate-300 font-mono text-[11px]">
                          {inv.invoiceDate}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-white text-xs">
                          {formatINR(inv.netPayable || 0)}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {renderStatusBadge(inv.paymentStatus)}
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenInvoice(inv);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Open in Tax Bill Studio"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
              {filteredInvoices.slice(0, 7).map((inv) => {
                const itemCategories = Array.from(
                  new Set(
                    (inv.items || []).map((it) => normalizeInvoiceItem(it).category || PRODUCT_CATEGORIES.BATTERY)
                  )
                );

                return (
                  <div
                    key={inv.id || inv.invoiceNumber}
                    onClick={() => onOpenInvoice(inv)}
                    className="p-3.5 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl space-y-2.5 cursor-pointer transition-all shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        {inv.invoiceNumber}
                      </span>
                      {renderStatusBadge(inv.paymentStatus)}
                    </div>

                    <div>
                      <h4 className="font-semibold text-white text-xs truncate">
                        {inv.customer?.name || 'Walk-in Customer'}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {(inv.items || []).map((i) => i.name).filter(Boolean).join(', ') || 'Invoice items'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {itemCategories.map((c) => {
                        const cfg = CATEGORY_CONFIG[c] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
                        return (
                          <span
                            key={c}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.badgeClass}`}
                          >
                            {cfg.shortLabel}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                      <span className="text-slate-400 font-mono">{inv.invoiceDate}</span>
                      <span className="font-mono font-bold text-white text-xs">
                        {formatINR(inv.netPayable || 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
