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
  Calendar,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { MOCK_USER, INVOICE_STATUSES } from '../data/mockData';
import { formatINR } from '../utils/numberToWords';
import { getTimeBasedGreeting } from '../utils/idGenerator';

export default function Dashboard({
  invoices,
  onNewInvoice,
  onOpenInvoice,
  onViewAllInvoices,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [greeting] = useState(() => getTimeBasedGreeting());

  // Compute Dashboard Metrics dynamically from invoice dataset
  const metrics = useMemo(() => {
    const totalCount = invoices.length;
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let draftCount = 0;
    let totalRevenue = 0;
    let pendingAmount = 0;

    invoices.forEach((inv) => {
      const status = inv.paymentStatus || 'Pending';
      const amount = Number(inv.netPayable) || 0;

      if (status === INVOICE_STATUSES.PAID) {
        paidCount++;
        totalRevenue += amount;
      } else if (status === INVOICE_STATUSES.PENDING) {
        pendingCount++;
        pendingAmount += amount;
      } else if (status === INVOICE_STATUSES.OVERDUE) {
        overdueCount++;
      } else if (status === INVOICE_STATUSES.DRAFT) {
        draftCount++;
      }
    });

    return {
      totalCount,
      paidCount,
      pendingCount,
      overdueCount,
      draftCount,
      totalRevenue,
      pendingAmount,
    };
  }, [invoices]);

  // Filter and search invoices
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        // Status filter
        if (selectedStatus !== 'All' && inv.paymentStatus !== selectedStatus) {
          return false;
        }
        // Search query (case-insensitive for invoiceNumber and customer.name)
        if (searchQuery.trim() !== '') {
          const query = searchQuery.toLowerCase().trim();
          const invNo = (inv.invoiceNumber || '').toLowerCase();
          const client = (inv.customer?.name || '').toLowerCase();
          return invNo.includes(query) || client.includes(query);
        }
        return true;
      })
      .sort((a, b) => {
        // Sort newest first with safe NaN fallback
        const rawA = new Date(a.createdAt || a.invoiceDate).getTime();
        const rawB = new Date(b.createdAt || b.invoiceDate).getTime();
        const dateA = !isNaN(rawA) ? rawA : 0;
        const dateB = !isNaN(rawB) ? rawB : 0;
        return dateB - dateA;
      });
  }, [invoices, searchQuery, selectedStatus]);

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

  return (
    <div className="space-y-6">
      {/* B. Welcome Section */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/30 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                TPS BATTERYS HOUSE Portal
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              {greeting}, {MOCK_USER.name}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Manage your invoices, track payments, and keep your business organized.
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

      {/* C. Dashboard Summary Cards */}
      <section aria-label="Dashboard Metrics Summary">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Invoices */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-3.5 sm:p-5 transition-all shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Invoices
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                {metrics.totalCount}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                {metrics.draftCount > 0 ? `${metrics.draftCount} in draft state` : 'All invoices created'}
              </p>
            </div>
          </div>

          {/* Card 2: Paid Invoices */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-3.5 sm:p-5 transition-all shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Paid
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight">
                {metrics.paidCount}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                {metrics.totalCount > 0
                  ? `${Math.round((metrics.paidCount / metrics.totalCount) * 100)}% payment rate`
                  : '0% completed'}
              </p>
            </div>
          </div>

          {/* Card 3: Pending Invoices */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-3.5 sm:p-5 transition-all shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pending
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 tracking-tight">
                {metrics.pendingCount}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                {formatINR(metrics.pendingAmount)} uncollected
              </p>
            </div>
          </div>

          {/* Card 4: Total Revenue */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-3.5 sm:p-5 transition-all shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Revenue
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight truncate">
                {formatINR(metrics.totalRevenue)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-emerald-400 mt-0.5 truncate">
                From settled invoices
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* D. Recent Invoices Section */}
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

        {/* E. Invoice Search & Status Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Functional Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice number or client name..."
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
            {['All', INVOICE_STATUSES.PAID, INVOICE_STATUSES.PENDING, INVOICE_STATUSES.OVERDUE, INVOICE_STATUSES.DRAFT].map((status) => (
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
            ))}
          </div>
        </div>

        {/* Invoices List Display */}
        {filteredInvoices.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">No matching invoices found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery || selectedStatus !== 'All'
                  ? `No invoices matched your filter (${selectedStatus}) or query "${searchQuery}".`
                  : 'Get started by creating your first invoice for TPS BATTERYS HOUSE.'}
              </p>
            </div>
            <div className="pt-1 flex items-center justify-center gap-2">
              {(searchQuery || selectedStatus !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedStatus('All');
                  }}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition-colors"
                >
                  Clear Filters
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
            {/* Desktop Table View (visible md and above) */}
            <div className="hidden md:block overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="py-3 px-3.5">Invoice #</th>
                    <th className="py-3 px-3.5">Client Name</th>
                    <th className="py-3 px-3.5">Invoice Date</th>
                    <th className="py-3 px-3.5">Due Date</th>
                    <th className="py-3 px-3.5 text-right">Amount (₹)</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredInvoices.slice(0, 7).map((inv) => (
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
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {inv.customer?.city ? `${inv.customer.city}, ` : ''}{inv.customer?.district || 'Palakkad'}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-300 font-mono text-[11px]">
                        {inv.invoiceDate}
                      </td>
                      <td className="py-3 px-3.5 text-slate-400 font-mono text-[11px]">
                        {inv.dueDate || inv.invoiceDate}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-white text-sm">
                        {formatINR(inv.netPayable || 0)}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {renderStatusBadge(inv.paymentStatus || 'Pending')}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenInvoice(inv);
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 group-hover:bg-amber-500 text-slate-300 group-hover:text-slate-950 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all"
                          title="View / Edit Invoice"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (visible below md) */}
            <div className="grid grid-cols-1 gap-2.5 md:hidden">
              {filteredInvoices.slice(0, 6).map((inv) => (
                <div
                  key={inv.id || inv.invoiceNumber}
                  onClick={() => onOpenInvoice(inv)}
                  className="bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 rounded-xl p-3.5 space-y-2.5 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-amber-400 text-xs">
                      {inv.invoiceNumber}
                    </span>
                    {renderStatusBadge(inv.paymentStatus || 'Pending')}
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-semibold text-white text-sm truncate">
                      {inv.customer?.name || 'Walk-in Customer'}
                    </div>
                    <div className="font-mono font-black text-white text-sm shrink-0">
                      {formatINR(inv.netPayable || 0)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {inv.invoiceDate}
                    </span>
                    <span className="text-amber-400 flex items-center gap-0.5 font-sans font-semibold">
                      Open <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom summary bar */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>
                Showing {Math.min(filteredInvoices.length, 7)} of {filteredInvoices.length} invoices
              </span>
              {filteredInvoices.length > 7 && (
                <button
                  type="button"
                  onClick={onViewAllInvoices}
                  className="text-amber-400 hover:underline font-semibold flex items-center gap-1"
                >
                  View remaining {filteredInvoices.length - 7} invoices <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
