import React, { useState } from 'react';
import {
  X,
  Search,
  FileText,
  Trash2,
  ExternalLink,
  Calendar,
  Phone,
  User,
  ArrowRightLeft,
} from 'lucide-react';
import { formatINR } from '../utils/numberToWords';

export default function InvoiceHistoryModal({
  isOpen,
  onClose,
  history,
  onSelectInvoice,
  onDeleteInvoice,
  onClearHistory,
}) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredHistory = history.filter((inv) => {
    const term = searchTerm.toLowerCase();
    const invNo = (inv.invoiceNumber || '').toLowerCase();
    const custName = (inv.customer?.name || '').toLowerCase();
    const phone = (inv.customer?.phone || '').toLowerCase();
    return invNo.includes(term) || custName.includes(term) || phone.includes(term);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Invoice Records & History</h2>
              <p className="text-xs text-slate-400">
                {history.length} {history.length === 1 ? 'bill' : 'bills'} saved locally in this browser
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Invoice #, Customer Name, or Phone..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-500/30 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {/* Invoice List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <FileText className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-medium">No invoice records found</p>
              <p className="text-xs text-slate-500">
                {searchTerm ? 'Try adjusting your search query' : 'Saved invoices will appear here automatically'}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id || item.invoiceNumber}
                className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 hover:border-amber-500/50 rounded-xl p-3.5 transition-all flex flex-wrap items-center justify-between gap-3 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {item.invoiceNumber || 'No Number'}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {item.invoiceDate}
                    </span>
                    {item.scrapExchange?.enabled && (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                        <ArrowRightLeft className="w-2.5 h-2.5" />
                        Scrap Buyback
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <span className="font-semibold text-white flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {item.customer?.name || 'Cash Customer'}
                    </span>
                    {item.customer?.phone && (
                      <span className="text-slate-400 flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3" />
                        +91 {item.customer.phone}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400">
                    {item.items?.length || 0} line item(s):{' '}
                    <span className="text-slate-300 truncate inline-block max-w-[280px] align-bottom">
                      {item.items?.map((it) => it.name).join(', ') || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Net Total
                    </div>
                    <div className="text-sm font-mono font-bold text-white">
                      {formatINR(item.netPayable || 0)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                    <button
                      type="button"
                      onClick={() => onSelectInvoice(item)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Load into invoice editor"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Load</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteInvoice(item.id || item.invoiceNumber)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Delete bill from records"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
