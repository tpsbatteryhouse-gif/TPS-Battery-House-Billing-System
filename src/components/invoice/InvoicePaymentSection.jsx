import React from 'react';
import { INVOICE_STATUSES } from '../../data/mockData';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank transfer'];

export default function InvoicePaymentSection({
  invoice,
  onUpdateField,
}) {
  const currentStatus = invoice?.paymentStatus || INVOICE_STATUSES.PAID;
  const isPaid = currentStatus === INVOICE_STATUSES.PAID;
  const isPending = currentStatus === INVOICE_STATUSES.PENDING || currentStatus === INVOICE_STATUSES.OVERDUE;
  const currentMode = invoice?.paymentMode || 'Cash';
  const isUpi = currentMode.toLowerCase() === 'upi';

  const setStatus = (status) => {
    onUpdateField('paymentStatus', status);
  };

  const setMode = (mode) => {
    onUpdateField('paymentMode', mode);
  };

  return (
    <section className="bg-[#181C22] border border-[#2A3039] rounded-2xl p-6 sm:p-7">
      {/* 3 — Section Heading */}
      <div className="flex items-center gap-3.5 mb-5 sm:mb-6">
        <div className="inv-step">3</div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#F2EFE9] leading-tight m-0">
            How is the customer paying?
          </h2>
          <div className="text-sm sm:text-base text-[#A8A294]">
            Pick one option in each row.
          </div>
        </div>
      </div>

      {/* Payment Status Choice Cards */}
      <div className="flex flex-wrap gap-3.5 mb-6">
        <button
          type="button"
          onClick={() => setStatus(INVOICE_STATUSES.PAID)}
          className={`inv-choice ${isPaid ? 'on' : ''}`}
        >
          <span className="text-lg sm:text-xl font-bold">Paid now</span>
          <span className="text-sm sm:text-[15px] text-[#A8A294]">
            The customer has paid the full amount
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStatus(INVOICE_STATUSES.PENDING)}
          className={`inv-choice ${isPending ? 'on' : ''}`}
        >
          <span className="text-lg sm:text-xl font-bold">Pay later</span>
          <span className="text-sm sm:text-[15px] text-[#A8A294]">
            The customer will pay after some days
          </span>
        </button>
      </div>

      {/* Payment Method Pills */}
      <div>
        <div className="text-sm sm:text-base font-semibold text-[#F2EFE9] mb-2.5">
          Payment method
        </div>
        <div className="flex flex-wrap gap-2.5">
          {PAYMENT_MODES.map((mode) => {
            const isSelected = currentMode.toLowerCase() === mode.toLowerCase();
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setMode(mode)}
                className={`inv-pill ${isSelected ? 'on' : ''}`}
              >
                {mode}
              </button>
            );
          })}
        </div>
        {isUpi && (
          <div className="mt-3 text-sm sm:text-base text-[#A8A294]">
            A QR code will be printed on the bill so the customer can scan and pay.
          </div>
        )}
      </div>

      {/* Message for the Customer (Printed on Bill) */}
      <div className="mt-6">
        <label htmlFor="f-note" className="block text-sm sm:text-base font-semibold text-[#F2EFE9] mb-1.5">
          Message for the customer (printed on the bill)
        </label>
        <textarea
          id="f-note"
          value={invoice?.notes || ''}
          onChange={(e) => onUpdateField('notes', e.target.value)}
          placeholder="Thank you for your business! Warranty valid on production of this bill."
          className="inv-fld h-24 p-3 sm:p-4 leading-relaxed resize-y"
        />
      </div>
    </section>
  );
}

