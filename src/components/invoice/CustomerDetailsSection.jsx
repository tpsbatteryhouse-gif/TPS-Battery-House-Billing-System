import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  User,
  Users,
  Search,
  X,
  MapPin,
  PlusCircle,
} from 'lucide-react';

export default function CustomerDetailsSection({
  customer,
  onUpdateField,
  onSelectCustomer,
  customers = [],
  businessStateCode = '32',
  onOpenCustomerPicker,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter matching customers from directory
  const matchingCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return customers
      .filter((c) => {
        return (
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.gstin && c.gstin.toLowerCase().includes(q)) ||
          (c.city && c.city.toLowerCase().includes(q))
        );
      })
      .slice(0, 6);
  }, [customers, searchQuery]);

  const handlePickMatch = (cust) => {
    if (onSelectCustomer) {
      onSelectCustomer(cust);
    }
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleClearToNewCustomer = () => {
    if (onSelectCustomer) {
      onSelectCustomer({
        name: '',
        phone: '',
        address: '',
        shippingAddress: '',
        city: 'Thrithala',
        district: 'Palakkad',
        state: 'Kerala',
        stateCode: '32',
        pincode: '679552',
        gstin: '',
        pan: '',
      });
    }
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const gstinVal = (customer?.gstin || '').trim();
  const isGstinFormatValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinVal);
  const isB2B = Boolean(gstinVal && gstinVal.length >= 10);
  const custStateCode = String(customer?.stateCode || '32').trim();
  const isInterstate = custStateCode !== '' && custStateCode !== String(businessStateCode).trim();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header & Quick Lookup Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Customer / Buyer Particulars</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  isB2B
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {isB2B ? 'B2B Registered Entity' : 'B2C Retail Buyer'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Tax invoice particulars, billing address, and GSTIN registration
            </p>
          </div>
        </div>

        {/* Directory Picker Trigger */}
        <div className="flex items-center gap-2">
          {onOpenCustomerPicker && (
            <button
              type="button"
              onClick={onOpenCustomerPicker}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Browse Directory</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearToNewCustomer}
            className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* Inline Customer Search Autocomplete */}
      <div ref={dropdownRef} className="relative">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setIsDropdownOpen(true);
            }}
            placeholder="Search existing customer by name, phone, or GSTIN to autofill..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setIsDropdownOpen(false);
              }}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {isDropdownOpen && matchingCustomers.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden divide-y divide-slate-800/80">
            {matchingCustomers.map((cust) => {
              const custIsB2B = Boolean(cust.gstin && cust.gstin.trim().length >= 10);
              return (
                <div
                  key={cust.id || cust.phone || cust.name}
                  onClick={() => handlePickMatch(cust)}
                  className="p-3 hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{cust.name}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                          custIsB2B
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {custIsB2B ? 'B2B' : 'B2C'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      {cust.phone && <span>📞 {cust.phone}</span>}
                      {cust.city && <span>📍 {cust.city}</span>}
                      {cust.gstin && <span className="font-mono text-amber-400/80">GSTIN: {cust.gstin}</span>}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-400 shrink-0">
                    Select →
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Customer Particulars Form Grid */}
      <div className="grid grid-cols-12 gap-3 sm:gap-4 text-xs">
        {/* Name */}
        <div className="col-span-12 sm:col-span-6 space-y-1.5 min-w-0">
          <label className="text-[11px] font-medium text-slate-300">
            {isB2B ? 'Buyer / Entity Name *' : 'Customer Name *'}
          </label>
          <input
            type="text"
            value={customer?.name || ''}
            onChange={(e) => onUpdateField('customer.name', e.target.value)}
            placeholder={isB2B ? 'e.g. Kerala Solar & Power Solutions' : 'e.g. Rajesh Kumar'}
            className="w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* Phone */}
        <div className="col-span-12 sm:col-span-6 space-y-1.5 min-w-0">
          <label className="text-[11px] font-medium text-slate-300">
            Phone / Mobile Number
          </label>
          <input
            type="tel"
            value={customer?.phone || ''}
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d+ -]/g, '');
              onUpdateField('customer.phone', val);
            }}
            placeholder="e.g. +91 9846830532"
            className="w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* Billing Address */}
        <div className="col-span-12 sm:col-span-6 space-y-1.5 min-w-0">
          <label className="text-[11px] font-medium text-slate-300">
            Billing Address
          </label>
          <input
            type="text"
            value={customer?.address || ''}
            onChange={(e) => onUpdateField('customer.address', e.target.value)}
            placeholder="Building, Street, Junction..."
            className="w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* Shipping Address */}
        <div className="col-span-12 sm:col-span-6 space-y-1.5 min-w-0">
          <label className="text-[11px] font-medium text-slate-300">
            Shipping / Delivery Address (Optional)
          </label>
          <input
            type="text"
            value={customer?.shippingAddress || ''}
            onChange={(e) => onUpdateField('customer.shippingAddress', e.target.value)}
            placeholder="Leave blank if identical to billing address"
            className="w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* City */}
        <div className="col-span-6 sm:col-span-3 space-y-1.5 min-w-0">
          <label className="text-[11px] font-medium text-slate-300">City / Town</label>
          <input
            type="text"
            value={customer?.city || ''}
            onChange={(e) => onUpdateField('customer.city', e.target.value)}
            placeholder="Thrithala"
            className="w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* District */}
        <div className="col-span-6 sm:col-span-3 space-y-1.5 min-w-0">
          <label className="text-[11px] font-medium text-slate-300">District</label>
          <input
            type="text"
            value={customer?.district || ''}
            onChange={(e) => onUpdateField('customer.district', e.target.value)}
            placeholder="Palakkad"
            className="w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* PIN Code */}
        <div className="col-span-6 sm:col-span-3 space-y-1.5 min-w-0">
          <label className="text-[11px] font-medium text-slate-300">PIN Code</label>
          <input
            type="text"
            value={customer?.pincode || ''}
            onChange={(e) =>
              onUpdateField('customer.pincode', e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="679534"
            className="w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* State Code */}
        <div className="col-span-6 sm:col-span-3 space-y-1.5 min-w-0">
          <label className="text-[11px] font-medium text-slate-300">State Code</label>
          <input
            type="text"
            value={customer?.stateCode || '32'}
            onChange={(e) => onUpdateField('customer.stateCode', e.target.value)}
            placeholder="32"
            className="w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* Customer GSTIN */}
        <div className="col-span-12 sm:col-span-6 space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <label className="text-[11px] font-medium text-slate-300">
              {isB2B ? 'Customer GSTIN (Required for B2B ITC) *' : 'Customer GSTIN (If registered)'}
            </label>
            {gstinVal && (
              <span
                className={`text-[10px] font-medium ${
                  isGstinFormatValid ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {isGstinFormatValid ? '✓ Valid format' : '⚠ Check format'}
              </span>
            )}
          </div>
          <input
            type="text"
            value={customer?.gstin || ''}
            onChange={(e) => {
              const val = e.target.value.toUpperCase().trim();
              onUpdateField('customer.gstin', val);
              // Auto-derive PAN if 15 chars
              if (val.length >= 12 && (!customer?.pan || customer?.pan.trim() === '')) {
                onUpdateField('customer.pan', val.slice(2, 12));
              }
            }}
            placeholder="e.g. 32AABCK9921B1Z2"
            className="w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono uppercase text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* Customer PAN */}
        <div className="col-span-12 sm:col-span-6 space-y-1.5 min-w-0">
          <label className="text-[11px] font-medium text-slate-300">
            Customer PAN (Optional)
          </label>
          <input
            type="text"
            value={customer?.pan || ''}
            onChange={(e) => onUpdateField('customer.pan', e.target.value.toUpperCase())}
            placeholder="e.g. AABCK9921B"
            className="w-full min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono uppercase text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Place of Supply Status Pill */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Place of Supply: <strong className="text-white">{customer?.state || 'Kerala'} ({custStateCode})</strong>
          </span>
        </div>
        <span
          className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
            isInterstate
              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}
        >
          {isInterstate ? 'Interstate Supply (IGST Applicable)' : 'Intrastate Supply (CGST 50% + SGST 50%)'}
        </span>
      </div>
    </div>
  );
}
