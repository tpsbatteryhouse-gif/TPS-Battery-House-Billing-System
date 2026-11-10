import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function InvoiceMetadataSection({
  invoice,
  onUpdateField,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleQuickTerms = (days) => {
    const baseDateStr = invoice?.invoiceDate || new Date().toISOString().split('T')[0];
    const baseDate = new Date(baseDateStr);
    if (!isNaN(baseDate.getTime())) {
      baseDate.setDate(baseDate.getDate() + days);
      const dueDateStr = baseDate.toISOString().split('T')[0];
      onUpdateField('dueDate', dueDateStr);
    }
  };

  return (
    <section className="bg-[#181C22] border border-[#2A3039] rounded-2xl p-5 sm:p-7">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between text-left cursor-pointer p-0 bg-transparent border-none"
      >
        <span className="text-lg sm:text-xl font-bold text-[#F2EFE9]">
          Extra details (not needed for most bills)
        </span>
        <span className="text-sm sm:text-[15px] font-semibold text-[#A8A294] flex items-center gap-1.5 hover:text-[#F2EFE9]">
          <span>{isExpanded ? 'Hide' : 'Show'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 pt-5 border-t border-[#2A3039] space-y-4 sm:space-y-5">
          {/* Invoice Date & Payment Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="m-date" className="block text-sm sm:text-base font-semibold text-[#F2EFE9] mb-1">
                Invoice Date
              </label>
              <input
                id="m-date"
                type="date"
                value={invoice?.invoiceDate || ''}
                onChange={(e) => onUpdateField('invoiceDate', e.target.value)}
                className="inv-fld font-mono"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="m-due" className="block text-sm sm:text-base font-semibold text-[#F2EFE9]">
                  Payment Due Date
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuickTerms(0)}
                    className="text-[11px] text-[#A8A294] hover:text-[#FFC857] px-1.5 py-0.5 rounded bg-[#20262E] border border-[#7A7568]"
                  >
                    Immediate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTerms(15)}
                    className="text-[11px] text-[#A8A294] hover:text-[#FFC857] px-1.5 py-0.5 rounded bg-[#20262E] border border-[#7A7568]"
                  >
                    15d
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTerms(30)}
                    className="text-[11px] text-[#A8A294] hover:text-[#FFC857] px-1.5 py-0.5 rounded bg-[#20262E] border border-[#7A7568]"
                  >
                    30d
                  </button>
                </div>
              </div>
              <input
                id="m-due"
                type="date"
                value={invoice?.dueDate || ''}
                onChange={(e) => onUpdateField('dueDate', e.target.value)}
                className="inv-fld font-mono"
              />
            </div>
          </div>

          {/* Customer's Order / PO Number */}
          <div>
            <label htmlFor="m-po" className="block text-sm sm:text-base font-semibold text-[#F2EFE9] mb-0.5">
              Customer's order number (PO)
            </label>
            <div className="text-xs sm:text-sm text-[#A8A294] mb-1.5">
              If the customer gave you a purchase order or reference
            </div>
            <input
              id="m-po"
              type="text"
              value={invoice?.orderNumber || ''}
              onChange={(e) => onUpdateField('orderNumber', e.target.value)}
              placeholder="e.g. PO-2026-4481"
              className="inv-fld"
            />
          </div>

          {/* Delivery Address */}
          <div>
            <label htmlFor="m-ship" className="block text-sm sm:text-base font-semibold text-[#F2EFE9] mb-0.5">
              Delivery address
            </label>
            <div className="text-xs sm:text-sm text-[#A8A294] mb-1.5">
              Leave empty if same as the address above
            </div>
            <input
              id="m-ship"
              type="text"
              value={invoice?.customer?.shippingAddress || ''}
              onChange={(e) => onUpdateField('customer.shippingAddress', e.target.value)}
              placeholder="Leave blank if identical to billing address"
              className="inv-fld"
            />
          </div>

          {/* E-way Bill Number */}
          <div>
            <label htmlFor="m-eway" className="block text-sm sm:text-base font-semibold text-[#F2EFE9] mb-0.5">
              E-way bill number
            </label>
            <div className="text-xs sm:text-sm text-[#A8A294] mb-1.5">
              Needed only for big goods transport (interstate &gt; ₹50,000)
            </div>
            <input
              id="m-eway"
              type="text"
              value={invoice?.ewayBillNo || ''}
              onChange={(e) => onUpdateField('ewayBillNo', e.target.value)}
              placeholder="e.g. 272584318992"
              className="inv-fld font-mono"
            />
          </div>

          {/* Private Note for Staff */}
          <div>
            <label htmlFor="m-staff" className="block text-sm sm:text-base font-semibold text-[#F2EFE9] mb-0.5">
              Private note for your staff
            </label>
            <div className="text-xs sm:text-sm text-[#A8A294] mb-1.5">
              Never printed or sent to the customer
            </div>
            <input
              id="m-staff"
              type="text"
              value={invoice?.staffNotes || ''}
              onChange={(e) => onUpdateField('staffNotes', e.target.value)}
              placeholder="Example: Technician Raju to install tomorrow morning. Battery scrap collected on site."
              className="inv-fld"
            />
          </div>

          {/* Reverse Charge Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="text-sm sm:text-base font-semibold text-[#F2EFE9]">
                Reverse Charge Applicable
              </div>
              <div className="text-xs text-[#A8A294]">
                Check only if tax is payable on reverse charge mechanism (RCM)
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={invoice?.reverseCharge === true || invoice?.reverseCharge === 'Yes'}
                onChange={(e) => onUpdateField('reverseCharge', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#20262E] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F2A516]"></div>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
