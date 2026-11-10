import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  Search,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TRANSACTION_TYPES } from '../../utils/categories';

export default function CustomerDetailsSection({
  customer,
  onUpdateField,
  onSelectCustomer,
  customers = [],
  businessStateCode = '32',
  onOpenCustomerPicker,
  transactionType = TRANSACTION_TYPES.B2C,
  onSetTransactionType,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAddressDetails, setShowAddressDetails] = useState(false);
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
  const isB2B = transactionType === TRANSACTION_TYPES.B2B;
  const isInterstate = customer?.stateCode && String(customer.stateCode).trim() !== String(businessStateCode).trim();

  const handleChooseType = (type) => {
    if (onSetTransactionType) {
      onSetTransactionType(type);
    } else {
      onUpdateField('transactionType', type);
    }
  };

  return (
    <section className="bg-[#181C22] border border-[#2A3039] rounded-2xl p-6 sm:p-7">
      {/* 1 — Section Heading */}
      <div className="flex items-center gap-3.5 mb-5 sm:mb-6">
        <div className="inv-step">1</div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#F2EFE9] leading-tight m-0">
            Who is buying?
          </h2>
          <div className="text-sm sm:text-base text-[#A8A294] flex items-center gap-2">
            <span>Type the customer's name and phone number.</span>
            {isInterstate && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Interstate (IGST)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-5">
        {/* Type of Customer Choice Cards */}
        <div>
          <div className="text-sm sm:text-base font-semibold text-[#F2EFE9] mb-2">
            Type of customer
          </div>
          <div className="flex flex-wrap gap-3.5">
            <button
              type="button"
              onClick={() => handleChooseType(TRANSACTION_TYPES.B2C)}
              className={`inv-choice ${!isB2B ? 'on' : ''}`}
            >
              <span className="text-lg sm:text-xl font-bold">Regular customer (B2C)</span>
              <span className="text-sm sm:text-[15px] text-[#A8A294]">
                Buying for themselves or for home use
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleChooseType(TRANSACTION_TYPES.B2B)}
              className={`inv-choice ${isB2B ? 'on' : ''}`}
            >
              <span className="text-lg sm:text-xl font-bold">Business customer (B2B)</span>
              <span className="text-sm sm:text-[15px] text-[#A8A294]">
                A shop or company with its own GST number
              </span>
            </button>
          </div>
        </div>

        {/* Existing Customer Autocomplete Search */}
        <div ref={dropdownRef} className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="f-find" className="block text-sm sm:text-base font-semibold text-[#F2EFE9]">
              Regular customer? Find them
            </label>
            <div className="flex items-center gap-3 text-xs sm:text-sm">
              {onOpenCustomerPicker && (
                <button
                  type="button"
                  onClick={onOpenCustomerPicker}
                  className="text-[#FFC857] hover:underline flex items-center gap-1 font-medium"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Browse Directory</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClearToNewCustomer}
                className="text-[#A8A294] hover:text-[#F2EFE9] hover:underline"
              >
                New Customer
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              id="f-find"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsDropdownOpen(true);
              }}
              placeholder="Search by name or phone number"
              className="inv-fld pr-9"
              autoComplete="off"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsDropdownOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A294] hover:text-[#F2EFE9] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <Search className="w-4 h-4 text-[#7A7568] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
          </div>

          {/* Autocomplete Results Dropdown */}
          {isDropdownOpen && matchingCustomers.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#12161B] border border-[#2A3039] rounded-xl shadow-2xl z-30 overflow-hidden divide-y divide-[#2A3039]">
              {matchingCustomers.map((cust) => {
                const custIsB2B = Boolean(cust.gstin && cust.gstin.trim().length >= 10);
                return (
                  <div
                    key={cust.id || cust.phone || cust.name}
                    onClick={() => handlePickMatch(cust)}
                    className="p-3.5 hover:bg-[#20262E] cursor-pointer transition-colors flex items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <div className="font-bold text-[#F2EFE9] flex items-center gap-2">
                        <span>{cust.name}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            custIsB2B
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {custIsB2B ? 'B2B' : 'B2C'}
                        </span>
                      </div>
                      <div className="text-xs text-[#A8A294] flex items-center gap-3 mt-0.5">
                        {cust.phone && <span>📞 {cust.phone}</span>}
                        {cust.city && <span>📍 {cust.city}</span>}
                        {cust.gstin && <span className="font-mono text-[#F2A516]">GST: {cust.gstin}</span>}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#F2A516] shrink-0">
                      Select →
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Customer Name and Phone Number */}
        <div className="flex flex-wrap gap-4 sm:gap-4.5">
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="f-name" className="block text-sm sm:text-base font-semibold text-[#F2EFE9] mb-1.5">
              {isB2B ? 'Business / Company Name *' : 'Customer Name *'}
            </label>
            <input
              id="f-name"
              type="text"
              value={customer?.name || ''}
              onChange={(e) => onUpdateField('customer.name', e.target.value)}
              placeholder={isB2B ? 'e.g. Kerala Solar & Power Solutions' : 'e.g. Sujith Kumar P.'}
              className="inv-fld min-w-0"
              autoComplete="off"
            />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="f-phone" className="block text-sm sm:text-base font-semibold text-[#F2EFE9] mb-1.5">
              Phone number
            </label>
            <input
              id="f-phone"
              type="tel"
              inputMode="tel"
              value={customer?.phone || ''}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d+ -]/g, '');
                onUpdateField('customer.phone', val);
              }}
              placeholder="e.g. 9846112244"
              className="inv-fld min-w-0"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Conditional B2B GSTIN */}
        {isB2B && (
          <div>
            <label htmlFor="f-gst" className="block text-sm sm:text-base font-semibold text-[#F2EFE9] mb-0.5">
              Business GST number
            </label>
            <div className="text-xs sm:text-sm text-[#A8A294] mb-1.5">
              15 letters and numbers. It is printed on the bill so the business can claim back the GST.
            </div>
            <input
              id="f-gst"
              type="text"
              value={customer?.gstin || ''}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);
                const updates = { 'customer.gstin': val };
                if (val.length >= 2) {
                  const stateCode = val.slice(0, 2);
                  if (/^\d{2}$/.test(stateCode)) {
                    updates['customer.stateCode'] = stateCode;
                  }
                }
                if (val.length >= 12) {
                  updates['customer.pan'] = val.slice(2, 12);
                }
                onUpdateField(updates);
              }}
              placeholder="Example: 32AABCU9603R1ZX"
              className={`inv-fld font-mono uppercase tracking-wider ${
                gstinVal && !isGstinFormatValid ? 'border-amber-400' : ''
              }`}
              autoComplete="off"
            />
            {gstinVal && !isGstinFormatValid && (
              <div className="text-xs text-[#FFC857] mt-1">
                Format: 2 state digits + 10 PAN characters + 1 entity + 1 'Z' + 1 checksum
              </div>
            )}
          </div>
        )}

        {/* Billing Address */}
        <div>
          <label htmlFor="f-addr" className="block text-sm sm:text-base font-semibold text-[#F2EFE9] mb-1.5">
            Address
          </label>
          <input
            id="f-addr"
            type="text"
            value={customer?.address || ''}
            onChange={(e) => onUpdateField('customer.address', e.target.value)}
            placeholder="e.g. Padinarangadi Temple Road"
            className="inv-fld min-w-0"
            autoComplete="off"
          />
        </div>

        {/* Optional City/District/State details for GST calculation */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAddressDetails((prev) => !prev)}
            className="text-xs sm:text-sm text-[#A8A294] hover:text-[#F2EFE9] flex items-center gap-1 font-medium"
          >
            {showAddressDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showAddressDetails ? 'Hide city / state details' : 'Edit city, district & GST state code'}</span>
          </button>

          {showAddressDetails && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 p-3.5 bg-[#12161B] border border-[#2A3039] rounded-xl text-xs">
              <div>
                <label className="text-[11px] text-[#A8A294] block mb-1">City / Town</label>
                <input
                  type="text"
                  value={customer?.city || ''}
                  onChange={(e) => onUpdateField('customer.city', e.target.value)}
                  className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-2.5 py-1.5 text-xs text-[#F2EFE9]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#A8A294] block mb-1">District</label>
                <input
                  type="text"
                  value={customer?.district || ''}
                  onChange={(e) => onUpdateField('customer.district', e.target.value)}
                  className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-2.5 py-1.5 text-xs text-[#F2EFE9]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#A8A294] block mb-1">PIN Code</label>
                <input
                  type="text"
                  value={customer?.pincode || ''}
                  onChange={(e) => onUpdateField('customer.pincode', e.target.value)}
                  className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-2.5 py-1.5 text-xs text-[#F2EFE9]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#A8A294] block mb-1">State Code (GST)</label>
                <input
                  type="text"
                  value={customer?.stateCode || '32'}
                  onChange={(e) => onUpdateField('customer.stateCode', e.target.value)}
                  className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-2.5 py-1.5 text-xs text-[#F2EFE9] font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
