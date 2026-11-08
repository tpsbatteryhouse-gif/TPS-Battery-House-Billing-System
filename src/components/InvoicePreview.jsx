import React from 'react';
import { formatNumber } from '../utils/numberToWords.js';
import { calculateInvoiceTotals, buildUpiUri } from '../utils/gstCalculations.js';
import {
  formatItemSpecifications,
  inferTransactionType,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_CONFIG,
} from '../utils/categories.js';
import UpiQrCode from './UpiQrCode';

/**
 * Traditional Accounting GST Tax Invoice Template
 * Modeled strictly after authentic retail GST accounting software invoices.
 * Layout:
 * 1. Top Bar: PAN, Tax Invoice Title, Copy Designation
 * 2. Seller Details (Left) & GSTIN / Registration (Right)
 * 3. Enclosed 3-Column Meta Grid (Bill To, Shipped To, Invoice Details Table)
 * 4. Main Product Table with full-height borders & Sl, HSN, Item, Qty, Price, Dis Amt, GrossAmt, GST (%), GST (Amt), Total
 * 5. Subtotal Row
 * 6. Amount in Words + Statutory HSN Tax Computation Table (Left) & Totals / Bank Details (Right)
 * 7. Bordered Bottom Grid: Terms & Conditions + Operator Stamp (Left), UPI Scan to Pay QR (Middle), Authorized Signatory (Right)
 */
export default function InvoicePreview({ invoice, business: propBusiness, invoiceCopy = 'Original for Buyer' }) {
  const business = invoice?.businessSnapshot || propBusiness;
  const totals = calculateInvoiceTotals(invoice, business?.stateCode || '32');
  const payableAmount = typeof invoice?.netPayable === 'number' && invoice.netPayable >= 0
    ? invoice.netPayable
    : totals.netPayable;
  const upiUri = buildUpiUri(business?.upiId, business?.businessName, payableAmount, invoice.invoiceNumber);

  // Derive business PAN from GSTIN (chars 3 to 12)
  const businessPan = (business?.gstin || '').length >= 12 ? business.gstin.slice(2, 12) : (business?.pan || '—');
  const customerPan = invoice?.customer?.pan || ((invoice?.customer?.gstin || '').length >= 12 ? invoice.customer.gstin.slice(2, 12) : '—');

  // Transaction classification
  const currentTxType = invoice.transactionType || inferTransactionType(invoice);
  const _txConfig = TRANSACTION_TYPE_CONFIG[currentTxType] || TRANSACTION_TYPE_CONFIG[TRANSACTION_TYPES.B2B];

  // Format date helper: YYYY-MM-DD -> DD-MM-YYYY
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}-${m}-${y}`;
    }
    return dateStr;
  };

  // Determine invoice type designation based on payment mode / status and transaction type
  const isCredit = invoice.paymentStatus === 'Pending' || invoice.paymentMode === 'Credit' || invoice.paymentMode === 'On Credit';
  const taxInvoiceTitle = isCredit
    ? `TAX INVOICE - CREDIT (${currentTxType})`
    : currentTxType === TRANSACTION_TYPES.B2C
      ? 'RETAIL TAX INVOICE (B2C)'
      : `TAX INVOICE (${currentTxType})`;

  // Format timestamp for operator footer
  const generatedDateStr = formatDate(invoice.invoiceDate || '2026-11-02');
  const generatedTimeStr = '04:30:00 PM';

  // Shipping address (default to billing address if not explicitly specified)
  const shippingAddress = invoice.customer?.shippingAddress || invoice.customer?.address || '';
  const shippingCity = invoice.customer?.shippingCity || invoice.customer?.city || 'Thrithala';
  const shippingDistrict = invoice.customer?.shippingDistrict || invoice.customer?.district || 'Palakkad';
  const shippingPin = invoice.customer?.shippingPincode || invoice.customer?.pincode || '679552';

  return (
    <div
      id="invoice-printable"
      className="bg-white text-black mx-auto w-full max-w-[210mm] min-h-[297mm] print:min-h-[297mm] p-[8mm] print:p-0 text-[10.5px] leading-tight font-sans shadow-lg print:shadow-none print:border-none print:max-w-none print:w-full flex flex-col justify-between"
      style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}
    >
      {/* Outer Border wrapping traditional accounting invoice */}
      <div className="border-2 border-black flex-1 flex flex-col justify-between">
        {/* ======================================================== */}
        {/* SECTION A: TOP BAR & SELLER HEADER                       */}
        {/* ======================================================== */}
        {/* Top line: PAN NO | TAX INVOICE | Original for Buyer */}
        <div className="flex justify-between items-center px-3 py-1.5 border-b border-black text-[10px] font-semibold uppercase tracking-wide">
          <div className="font-mono">
            PAN NO : <span className="font-bold">{businessPan}</span>
          </div>
          <div className="text-[12px] font-extrabold tracking-wider text-black">
            {taxInvoiceTitle}
          </div>
          <div className="text-[10px] font-bold">
            {invoiceCopy}
          </div>
        </div>

        {/* Seller Information */}
        <div className="p-3 border-b border-black">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
            <div className="space-y-0.5">
              <h1 className="text-xl font-black tracking-tight text-black uppercase">
                {business.businessName || 'TPS BATTERYS HOUSE'}
              </h1>
              {business.tagline && (
                <div className="text-[9.5px] font-bold text-slate-800 tracking-wide uppercase">
                  {business.tagline}
                </div>
              )}
              <div className="text-[10.5px] text-slate-900 leading-snug pt-0.5 space-y-0.5">
                <div>
                  {business.addressLine1}{business.roadStreet ? `, ${business.roadStreet}` : ''}
                </div>
                <div>
                  {business.cityDistrict}{business.state ? `, ${business.state}` : 'Kerala'} - <span className="font-bold">{business.pinCode}</span>
                </div>
                <div>
                  <span className="font-semibold">Ph:</span> {business.phone}
                  {business.altPhone && <span> | {business.altPhone}</span>}
                </div>
                <div>
                  <span className="font-semibold">GSTIN/UIN :</span> <span className="font-mono font-bold">{business.gstin}</span>
                </div>
                <div>
                  <span className="font-semibold">State :</span> {business.state || 'KERALA'}&nbsp;&nbsp;
                  <span className="font-semibold">Code :</span> {business.stateCode || '32'}&nbsp;&nbsp;
                  {business.email && <span><span className="font-semibold">Email :</span> {business.email}</span>}
                </div>
              </div>
            </div>

            {/* Small Brand Accent Stamp (Compact) */}
            <div className="hidden sm:flex flex-col items-end text-right text-[9px] text-slate-600 space-y-0.5 pt-1">
              <div className="px-2 py-0.5 border border-black font-bold uppercase tracking-wider text-black">
                Authorized GST Tax Invoice
              </div>
              <div>Government of India • Kerala State GST</div>
              <div>Reverse Charge: <span className="font-bold text-black">{invoice.reverseCharge || 'No'}</span></div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION B: BUYER, SHIPPING & INVOICE DETAILS GRID        */}
        {/* ======================================================== */}
        <div className="grid grid-cols-12 border-b border-black divide-y sm:divide-y-0 sm:divide-x divide-black text-[10px]">
          {/* Column 1: Bill To (Customer Details) */}
          <div className="col-span-12 sm:col-span-5 p-2.5 flex flex-col justify-between">
            <div>
              <div className="font-bold uppercase tracking-wider text-[10px] text-black border-b border-slate-300 pb-0.5 mb-1.5">
                Bill To
              </div>
              <div className="font-bold text-[11px] text-black uppercase leading-tight">
                {invoice?.customer?.name || 'CASH CUSTOMER'}
              </div>
              <div className="text-slate-900 leading-snug mt-1 space-y-0.5">
                <div>{invoice?.customer?.address || 'Padinarangadi, Koottanad Road'}</div>
                <div>
                  {[invoice?.customer?.city, invoice?.customer?.district].filter(Boolean).join(', ') || 'Thrithala, Palakkad'}
                  {invoice?.customer?.pincode ? ` Pin:${invoice.customer.pincode}` : ' Pin:679552'}
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-slate-200 space-y-0.5 text-slate-900 font-mono text-[9.5px]">
              <div>
                <span className="font-sans font-semibold">Ph :</span> {invoice?.customer?.phone ? `+91 ${invoice.customer.phone}` : '—'}
              </div>
              <div>
                <span className="font-sans font-semibold">GSTNO :</span> <span className="font-bold">{invoice?.customer?.gstin || '—'}</span>
              </div>
              <div>
                <span className="font-sans font-semibold">PAN NO :</span> <span>{customerPan}</span>
              </div>
              <div className="font-sans">
                <span className="font-semibold">STATE :</span> {(invoice?.customer?.state || 'KERALA').toUpperCase()} , <span className="font-semibold">CODE :</span> {invoice?.customer?.stateCode || '32'}
              </div>
            </div>
          </div>

          {/* Column 2: Shipped To / Delivery (Consignee) */}
          <div className="col-span-12 sm:col-span-3 p-2.5 flex flex-col justify-between">
            <div>
              <div className="font-bold uppercase tracking-wider text-[10px] text-black border-b border-slate-300 pb-0.5 mb-1.5">
                Shipped To
              </div>
              <div className="font-bold text-[10.5px] text-black uppercase leading-tight">
                {invoice?.customer?.name || 'CASH CUSTOMER'}
              </div>
              <div className="text-slate-900 leading-snug mt-1 space-y-0.5 text-[9.5px]">
                <div>{shippingAddress}</div>
                <div>{shippingCity}, {shippingDistrict}</div>
                <div>Kerala Pin:{shippingPin}</div>
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-slate-200 space-y-0.5 text-slate-900 font-mono text-[9px]">
              <div>
                <span className="font-sans font-semibold">Ph :</span> {invoice?.customer?.phone || '—'}
              </div>
              <div>
                <span className="font-sans font-semibold">GSTNO :</span> {invoice?.customer?.gstin || '—'}
              </div>
            </div>
          </div>

          {/* Column 3: Invoice Details Table */}
          <div className="col-span-12 sm:col-span-4 p-0">
            <table className="w-full text-left border-collapse text-[10px]">
              <tbody>
                <tr className="border-b border-black">
                  <td className="p-1.5 font-semibold text-slate-800 w-[42%] border-r border-black bg-slate-50">Invoice Date</td>
                  <td className="p-1.5 font-mono font-bold text-black">{formatDate(invoice.invoiceDate)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-1.5 font-semibold text-slate-800 border-r border-black bg-slate-50">Invoice No</td>
                  <td className="p-1.5 font-mono font-black text-black">{invoice.invoiceNumber || '—'}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-1.5 font-semibold text-slate-800 border-r border-black bg-slate-50">Payment Mode</td>
                  <td className="p-1.5 font-medium text-black">{invoice.paymentMode || 'Cash'}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-1.5 font-semibold text-slate-800 border-r border-black bg-slate-50">Place of Supply</td>
                  <td className="p-1.5 font-medium text-black">{invoice.placeOfSupply || 'Kerala (32)'}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-1.5 font-semibold text-slate-800 border-r border-black bg-slate-50">EWay Bill No</td>
                  <td className="p-1.5 font-mono text-black">{invoice.ewayBillNo || '—'}</td>
                </tr>
                <tr>
                  <td className="p-1.5 font-semibold text-slate-800 border-r border-black bg-slate-50">IRN No</td>
                  <td className="p-1.5 font-mono text-[8.5px] text-slate-800 break-all leading-tight">
                    {invoice.irn || '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION C: MAIN PRODUCT TABLE                            */}
        {/* ======================================================== */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-black text-black text-[9.5px] uppercase font-bold tracking-tight bg-slate-100/70">
                <th className="py-2 px-1 text-center w-7 border-r border-black">Sl</th>
                <th className="py-2 px-1 text-center w-14 border-r border-black">HSN Code</th>
                <th className="py-2 px-2 border-r border-black">Item Name</th>
                <th className="py-2 px-1.5 text-center w-16 border-r border-black">Quantity</th>
                <th className="py-2 px-1.5 text-right w-16 border-r border-black">Price</th>
                <th className="py-2 px-1 text-right w-12 border-r border-black">Dis Amt</th>
                <th className="py-2 px-1.5 text-right w-18 border-r border-black">GrossAmt</th>
                <th colSpan={2} className="py-1 px-1 text-center border-r border-black">
                  <div>GST</div>
                  <div className="grid grid-cols-2 border-t border-black text-[8px] mt-0.5">
                    <span className="border-r border-black">%</span>
                    <span>Amt</span>
                  </div>
                </th>
                <th className="py-2 px-2 text-right w-20">Total</th>
              </tr>
            </thead>
            <tbody className="text-[10px]">
              {totals.computedItems.map((item, idx) => {
                const specs = formatItemSpecifications(item);
                // Pre-tax unit price
                const unitPrice = item.isTaxInclusive
                  ? (item.qty > 0 ? item.taxableValue / item.qty : 0)
                  : item.rate;

                return (
                  <tr key={item.id || idx} className="border-b border-slate-300">
                    <td className="py-2 px-1 text-center font-medium text-black border-r border-black align-top">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-1 text-center font-mono text-[9px] text-black border-r border-black align-top">
                      {item.hsn || '8507'}
                    </td>
                    <td className="py-2 px-2 border-r border-black align-top">
                      <div className="font-bold text-black uppercase leading-tight">
                        {item.name}
                      </div>
                      {specs && (
                        <div className="text-[9px] text-slate-700 font-medium mt-0.5">
                          {specs}
                        </div>
                      )}
                      {(item.serialNo || item.warranty) && (
                        <div className="text-[8.5px] text-slate-600 mt-0.5 flex flex-wrap gap-x-2">
                          {item.serialNo && <span>S/N: <span className="font-mono font-medium text-black">{item.serialNo}</span></span>}
                          {item.warranty && <span>Warranty: <span className="font-medium text-black">{item.warranty}</span></span>}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-1.5 text-center font-medium text-black border-r border-black align-top whitespace-nowrap">
                      {Number(item.qty).toFixed(2)} <span className="text-[8.5px] text-slate-600 uppercase">{item.unit || 'NOS'}</span>
                    </td>
                    <td className="py-2 px-1.5 text-right font-mono text-black border-r border-black align-top">
                      {formatNumber(unitPrice)}
                    </td>
                    <td className="py-2 px-1 text-right font-mono text-black border-r border-black align-top">
                      {Number(item.discount) > 0 ? formatNumber(item.discount) : '0.00'}
                    </td>
                    <td className="py-2 px-1.5 text-right font-mono font-medium text-black border-r border-black align-top">
                      {formatNumber(item.taxableValue)}
                    </td>
                    {/* GST % */}
                    <td className="py-2 px-1 text-center font-mono text-[9px] text-black border-r border-black align-top w-9">
                      {item.gstRate}
                    </td>
                    {/* GST Amt */}
                    <td className="py-2 px-1 text-right font-mono text-[9.5px] text-black border-r border-black align-top w-14">
                      {formatNumber(item.totalGstAmount)}
                    </td>
                    {/* Total */}
                    <td className="py-2 px-2 text-right font-mono font-bold text-black align-top">
                      {formatNumber(item.lineTotal)}
                    </td>
                  </tr>
                );
              })}

              {/* Flexible visual padding row with vertical lines to anchor financial summary towards bottom of A4 */}
              <tr className="border-b border-black flex-1 h-full min-h-[40px]">
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td></td>
              </tr>
            </tbody>

            {/* ======================================================== */}
            {/* SECTION D: ITEM SUBTOTAL ROW                             */}
            {/* ======================================================== */}
            <tfoot>
              <tr className="border-b border-black font-bold text-black text-[10px] bg-slate-50">
                <td colSpan={3} className="py-2 px-3 text-right uppercase tracking-wider border-r border-black">
                  Sub Total
                </td>
                <td className="py-2 px-1.5 text-center font-mono border-r border-black whitespace-nowrap">
                  {totals.computedItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0).toFixed(2)}
                </td>
                <td className="border-r border-black"></td>
                <td className="py-2 px-1 text-right font-mono border-r border-black">
                  {totals.computedItems.reduce((acc, it) => acc + (Number(it.discount) || 0), 0) > 0
                    ? formatNumber(totals.computedItems.reduce((acc, it) => acc + (Number(it.discount) || 0), 0))
                    : '0.00'}
                </td>
                <td className="py-2 px-1.5 text-right font-mono border-r border-black">
                  {formatNumber(totals.totalTaxableValue)}
                </td>
                <td className="border-r border-black"></td>
                <td className="py-2 px-1 text-right font-mono border-r border-black">
                  {formatNumber(totals.totalTax)}
                </td>
                <td className="py-2 px-2 text-right font-mono font-black text-black">
                  {formatNumber(totals.totalGross)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ======================================================== */}
        {/* SECTION E: AMOUNT IN WORDS, GST SUMMARY & TOTALS / BANK  */}
        {/* ======================================================== */}
        <div className="grid grid-cols-12 border-b border-black divide-y sm:divide-y-0 sm:divide-x divide-black text-[10px]">
          {/* Left Column: Words & Statutory GST Computation Table */}
          <div className="col-span-12 sm:col-span-7 p-2.5 flex flex-col justify-between">
            {/* Amount in words */}
            <div className="pb-2 border-b border-slate-200">
              <span className="font-bold uppercase tracking-wider text-[9.5px]">Rupees </span>
              <span className="font-bold text-black text-[10.5px] uppercase">
                {(totals.amountInWords || '').replace(/^rupees\s*/i, '').replace(/\s*rupees\s*(only)?$/i, '').replace(/\s*only$/i, '').trim()} Only
              </span>
            </div>

            {/* HSN/SAC GST Tax Computation Summary */}
            <div className="mt-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-black pb-1">
                GST Tax Computation Summary (HSN/SAC Wise)
              </div>
              <div className="border border-black overflow-hidden">
                <table className="w-full text-left border-collapse text-[9px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black text-black font-bold">
                      <th className="py-1 px-1.5 border-r border-black">Taxable Value</th>
                      {!totals.isInterstate ? (
                        <>
                          <th className="py-1 px-1 text-center border-r border-black" colSpan={2}>CGST</th>
                          <th className="py-1 px-1 text-center border-r border-black" colSpan={2}>SGST</th>
                        </>
                      ) : (
                        <th className="py-1 px-1 text-center border-r border-black" colSpan={2}>IGST</th>
                      )}
                      <th className="py-1 px-1.5 text-right">Total Tax Amount</th>
                    </tr>
                    <tr className="bg-slate-50 border-b border-black text-[8px] text-slate-700 font-semibold">
                      <th className="py-0.5 px-1.5 border-r border-black">HSN/Rate</th>
                      {!totals.isInterstate ? (
                        <>
                          <th className="py-0.5 px-1 text-center w-10 border-r border-black">Rate</th>
                          <th className="py-0.5 px-1 text-right w-14 border-r border-black">Amount</th>
                          <th className="py-0.5 px-1 text-center w-10 border-r border-black">Rate</th>
                          <th className="py-0.5 px-1 text-right w-14 border-r border-black">Amount</th>
                        </>
                      ) : (
                        <>
                          <th className="py-0.5 px-1 text-center w-12 border-r border-black">Rate</th>
                          <th className="py-0.5 px-1 text-right w-16 border-r border-black">Amount</th>
                        </>
                      )}
                      <th className="py-0.5 px-1.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black font-mono text-[9px]">
                    {totals.hsnSummary.map((h, i) => (
                      <tr key={i}>
                        <td className="py-1 px-1.5 border-r border-black">
                          <span className="font-bold text-black">{formatNumber(h.taxableValue)}</span>
                          <span className="text-[7.5px] font-sans text-slate-600 block">({h.hsn} - {h.gstRate}%)</span>
                        </td>
                        {!totals.isInterstate ? (
                          <>
                            <td className="py-1 px-1 text-center border-r border-black">{(h.gstRate / 2)}%</td>
                            <td className="py-1 px-1 text-right border-r border-black">{formatNumber(h.cgstAmount)}</td>
                            <td className="py-1 px-1 text-center border-r border-black">{(h.gstRate / 2)}%</td>
                            <td className="py-1 px-1 text-right border-r border-black">{formatNumber(h.sgstAmount)}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-1 px-1 text-center border-r border-black">{h.gstRate}%</td>
                            <td className="py-1 px-1 text-right border-r border-black">{formatNumber(h.igstAmount)}</td>
                          </>
                        )}
                        <td className="py-1 px-1.5 text-right font-bold text-black">{formatNumber(h.totalTax)}</td>
                      </tr>
                    ))}
                    {/* HSN Totals Row */}
                    <tr className="border-t border-black bg-slate-100 font-bold">
                      <td className="py-1 px-1.5 border-r border-black">{formatNumber(totals.totalTaxableValue)}</td>
                      {!totals.isInterstate ? (
                        <>
                          <td className="border-r border-black"></td>
                          <td className="py-1 px-1 text-right border-r border-black">{formatNumber(totals.totalCgst)}</td>
                          <td className="border-r border-black"></td>
                          <td className="py-1 px-1 text-right border-r border-black">{formatNumber(totals.totalSgst)}</td>
                        </>
                      ) : (
                        <>
                          <td className="border-r border-black"></td>
                          <td className="py-1 px-1 text-right border-r border-black">{formatNumber(totals.totalIgst)}</td>
                        </>
                      )}
                      <td className="py-1 px-1.5 text-right font-black">{formatNumber(totals.totalTax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Round Off, Deductions, Final Bill Amount & Bank Details */}
          <div className="col-span-12 sm:col-span-5 p-2.5 flex flex-col justify-between">
            <div className="space-y-1.5 text-[10px]">
              {/* Optional Deductions */}
              {totals.scrapDiscount > 0 && (
                <div className="flex justify-between py-0.5 border-b border-slate-200 text-slate-800">
                  <span className="font-medium">Old Battery Scrap Buyback:</span>
                  <span className="font-mono font-bold">- {formatNumber(totals.scrapDiscount)}</span>
                </div>
              )}
              {totals.extraDiscount > 0 && (
                <div className="flex justify-between py-0.5 border-b border-slate-200 text-slate-800">
                  <span className="font-medium">Special Discount:</span>
                  <span className="font-mono font-bold">- {formatNumber(totals.extraDiscount)}</span>
                </div>
              )}

              {/* Round Off */}
              <div className="flex justify-between items-center py-0.5">
                <span className="font-medium text-slate-800">Round Off :</span>
                <span className="font-mono font-semibold text-black">
                  {totals.roundOff >= 0 ? `+${formatNumber(totals.roundOff)}` : formatNumber(totals.roundOff)}
                </span>
              </div>

              {/* Final Bill Amount Row (Boxed, Prominent) */}
              <div className="border-2 border-black p-2 flex justify-between items-center bg-slate-50">
                <div className="font-black text-[13px] tracking-tight uppercase">
                  Bill Amount :
                </div>
                <div className="text-[17px] font-mono font-black tracking-tight text-black">
                  {formatNumber(payableAmount)}
                </div>
              </div>
            </div>

            {/* Bank Details Table */}
            <div className="mt-3 pt-2 border-t border-slate-300 text-[9.5px] space-y-0.5 font-mono">
              <div className="grid grid-cols-12">
                <span className="col-span-4 font-sans font-semibold text-slate-800">Bank Name :</span>
                <span className="col-span-8 font-bold text-black">{business.bankName || 'Federal Bank'}</span>
              </div>
              <div className="grid grid-cols-12">
                <span className="col-span-4 font-sans font-semibold text-slate-800">Account No :</span>
                <span className="col-span-8 font-bold text-black">{business.accountNo || '15240200008892'}</span>
              </div>
              <div className="grid grid-cols-12">
                <span className="col-span-4 font-sans font-semibold text-slate-800">IFSC Code :</span>
                <span className="col-span-8 font-bold text-black">{business.ifsc || 'FDRL0001524'}</span>
              </div>
              {business.branch && (
                <div className="grid grid-cols-12">
                  <span className="col-span-4 font-sans font-semibold text-slate-800">Branch :</span>
                  <span className="col-span-8 text-black">{business.branch}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION G & H: TERMS & CONDITIONS, QR & SIGNATORY        */}
        {/* ======================================================== */}
        <div className="grid grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-black text-[9.5px]">
          {/* Terms & Conditions (Left) */}
          <div className="col-span-12 sm:col-span-6 p-2.5 flex flex-col justify-between">
            <div>
              <div className="font-bold uppercase tracking-wider text-[9.5px] text-black pb-1">
                TERMS & CONDITIONS OF SALE
              </div>
              <ol className="list-none space-y-1 text-[9px] text-slate-900 leading-tight">
                <li>1) Goods once sold will not be taken back or exchanged except as per warranty terms.</li>
                <li>2) Seller is not responsible for any loss or damaged of goods in transit after delivery dispatch.</li>
                <li>3) Buyer undertakes to submit prescribed ST/GST declaration to sender on demand. Disputes if any will be subject to Thrithala / Palakkad court jurisdiction.</li>
              </ol>
            </div>

            {/* Operator Stamp & Timestamp */}
            <div className="mt-3 pt-1 border-t border-slate-300 text-[8.5px] font-mono text-slate-700">
              TPS OPERATOR on {generatedDateStr} {generatedTimeStr}
            </div>
          </div>

          {/* Payment QR Code (Middle Box - Matching Reference Photo) */}
          <div className="col-span-12 sm:col-span-3 p-2 flex flex-col items-center justify-center text-center bg-slate-50/50">
            {business?.upiId ? (
              <div className="flex flex-col items-center">
                <div className="text-[8.5px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Scan to Pay (UPI)
                </div>
                <div className="bg-white p-1 border border-black shadow-xs">
                  <UpiQrCode upiUri={upiUri} size={92} className="border-none p-0 shadow-none" />
                </div>
                <div className="text-[7.5px] font-mono text-slate-600 mt-1">
                  {business.upiId}
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-[8px] italic">No UPI Configured</div>
            )}
          </div>

          {/* Authorized Signatory (Right) */}
          <div className="col-span-12 sm:col-span-3 p-2.5 flex flex-col justify-between text-right">
            <div className="font-bold text-[10px] text-black uppercase">
              For {business.businessName || 'TPS BATTERYS HOUSE'}
            </div>

            <div className="my-5">
              {/* Blank stamp / signature space */}
            </div>

            <div className="pt-1 border-t border-black text-center text-[9px] font-semibold text-black">
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>

      {/* Print Safe Footer */}
      <div className="mt-1.5 flex justify-between items-center text-[8px] text-slate-500 px-1 print:text-[7.5px]">
        <div>TPS BATTERYS HOUSE GST Billing System • Computer Generated Tax Invoice</div>
        <div>Page 1 of 1</div>
      </div>
    </div>
  );
}
