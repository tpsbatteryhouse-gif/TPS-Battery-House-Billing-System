import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Plus,
  ArrowLeft,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileEdit,
  Trash2,
  Eye,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { INVOICE_STATUSES } from '../data/mockData';
import { formatINR } from '../utils/numberToWords';

export default function AllInvoicesView({
  invoices,
  onBackToDashboard,
  onNewInvoice,
  onOpenInvoice,
  onDeleteInvoice,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'amount-high', 'amount-low'

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (selectedStatus !== 'All' && inv.paymentStatus !== selectedStatus) {
          return false;
        }
        if (searchQuery.trim() !== '') {
          const query = searchQuery.toLowerCase().trim();
          const invNo = (inv.invoiceNumber || '').toLowerCase();
          const client = (inv.customer?.name || '').toLowerCase();
          return invNo.includes(query) || client.includes(query);
        }
        return true;
      })
      .sort((a, b) => {
        const rawA = new Date(a.createdAt || a.invoiceDate).getTime();
        const rawB = new Date(b.createdAt || b.invoiceDate).getTime();
        const timeA = !isNaN(rawA) ? rawA : 0;
        const timeB = !isNaN(rawB) ? rawB : 0;

        if (sortBy === 'newest') {
          return timeB - timeA;
        }
        if (sortBy === 'oldest') {
          return timeA - timeB;
        }
        if (sortBy === 'amount-high') {
          return (Number(b.netPayable) || 0) - (Number(a.netPayable) || 0);
        }
        if (sortBy === 'amount-low') {
          return (Number(a.netPayable) || 0) - (Number(b.netPayable) || 0);
        }
        return 0;
      });
  }, [invoices, searchQuery, selectedStatus, sortBy]);

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
    <div className="space-y-5">
      {/* Top Bar with Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors border border-slate-700"
            title="Return to Home Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">All Invoices & Records</h1>
            <p className="text-xs text-slate-400">
              Total {invoices.length} invoices registered in TPS BATTERYS HOUSE system
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewInvoice}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/10"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ New Invoice</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Field */}
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

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount-high">Amount: High to Low</option>
              <option value="amount-low">Amount: Low to High</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-800/80 pt-3">
          {['All', INVOICE_STATUSES.PAID, INVOICE_STATUSES.PENDING, INVOICE_STATUSES.OVERDUE, INVOICE_STATUSES.DRAFT].map((status) => {
            const count = status === 'All'
              ? invoices.length
              : invoices.filter((i) => i.paymentStatus === status).length;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedStatus === status
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>{status}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedStatus === status ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Invoice Records Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl space-y-3">
            <FileText className="w-10 h-10 mx-auto text-slate-600" />
            <h3 className="text-sm font-bold text-white">No invoices found</h3>
            <p className="text-xs text-slate-400">
              {searchQuery ? `No invoices matched query "${searchQuery}"` : 'No invoices in this status.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="py-3 px-3.5">Invoice #</th>
                    <th className="py-3 px-3.5">Client Name & Phone</th>
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Due Date</th>
                    <th className="py-3 px-3.5">Payment Mode</th>
                    <th className="py-3 px-3.5 text-right">Amount (₹)</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id || inv.invoiceNumber}
                      onClick={() => onOpenInvoice(inv)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-amber-400 group-hover:text-amber-300">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-white truncate max-w-[220px]">
                          {inv.customer?.name || 'Walk-in Customer'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {inv.customer?.phone ? `+91 ${inv.customer.phone}` : 'No phone'}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-300 font-mono text-[11px]">
                        {inv.invoiceDate}
                      </td>
                      <td className="py-3 px-3.5 text-slate-400 font-mono text-[11px]">
                        {inv.dueDate || inv.invoiceDate}
                      </td>
                      <td className="py-3 px-3.5 text-slate-300 text-[11px] truncate max-w-[140px]">
                        {inv.paymentMode || 'Cash'}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-white text-sm">
                        {formatINR(inv.netPayable || 0)}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {renderStatusBadge(inv.paymentStatus || 'Pending')}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onOpenInvoice(inv)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-amber-500 text-slate-300 hover:text-slate-950 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all"
                            title="Open in Tax Bill Generator"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Open</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteInvoice(inv.id || inv.invoiceNumber)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete invoice record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredInvoices.map((inv) => (
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
                      Open Bill <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
