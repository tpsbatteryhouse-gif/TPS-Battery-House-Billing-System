import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  X,
  Building,
  Phone,
  MapPin,
} from 'lucide-react';

export default function CustomerPickerModal({
  isOpen,
  onClose,
  customers = [],
  onSelectCustomer,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'b2b' | 'b2c'

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((cust) => {
      const isB2B = Boolean(cust.gstin && cust.gstin.trim().length >= 10);
      if (filterType === 'b2b' && !isB2B) return false;
      if (filterType === 'b2c' && isB2B) return false;

      if (!q) return true;
      return (
        (cust.name && cust.name.toLowerCase().includes(q)) ||
        (cust.phone && cust.phone.toLowerCase().includes(q)) ||
        (cust.gstin && cust.gstin.toLowerCase().includes(q)) ||
        (cust.city && cust.city.toLowerCase().includes(q)) ||
        (cust.district && cust.district.toLowerCase().includes(q))
      );
    });
  }, [customers, searchQuery, filterType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Select Customer / Buyer</h3>
              <p className="text-xs text-slate-400">
                Pick a registered business or repeat retail buyer to populate invoice particulars
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

        {/* Filter Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, GSTIN, city..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Type Pills */}
          <div className="flex items-center gap-1.5 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                filterType === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('b2b')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                filterType === 'b2b'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              B2B
            </button>
            <button
              type="button"
              onClick={() => setFilterType('b2c')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                filterType === 'b2c'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              B2C
            </button>
          </div>
        </div>

        {/* Customer Cards List */}
        <div className="overflow-y-auto p-4 space-y-2.5 flex-1 max-h-[50vh]">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-10 space-y-2 text-slate-400">
              <Users className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs">No matching customers found in the directory.</p>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-amber-400 hover:underline font-semibold"
              >
                Enter customer particulars manually
              </button>
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const isB2B = Boolean(cust.gstin && cust.gstin.trim().length >= 10);

              return (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => {
                    onSelectCustomer(cust);
                    onClose();
                  }}
                  className="w-full text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/50 p-3 rounded-xl transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-semibold border ${
                          isB2B
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {isB2B ? <Building className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                        <span>{isB2B ? 'B2B' : 'B2C'}</span>
                      </span>

                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                        {cust.name}
                      </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                      {cust.phone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-500" />
                          +91 {cust.phone}
                        </span>
                      )}

                      {(cust.city || cust.district) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {[cust.city, cust.district].filter(Boolean).join(', ')}
                        </span>
                      )}

                      {cust.gstin && (
                        <span className="font-mono text-amber-400/90 font-semibold">
                          GSTIN: {cust.gstin}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="px-3 py-1.5 bg-amber-500/10 group-hover:bg-amber-500 text-amber-400 group-hover:text-slate-950 rounded-lg text-xs font-bold transition-all shrink-0">
                    Select
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Showing {filteredCustomers.length} of {customers.length} customers
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
