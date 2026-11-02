import React from 'react';
import { formatINR, formatNumber } from '../utils/numberToWords.js';
import { calculateInvoiceTotals, buildUpiUri } from '../utils/gstCalculations.js';
import { formatItemSpecifications } from '../utils/categories.js';
import UpiQrCode from './UpiQrCode';
import { BatteryCharging } from 'lucide-react';

export default function InvoicePreview({ invoice, business, invoiceCopy = 'Original for Recipient' }) {
  const totals = calculateInvoiceTotals(invoice, business.stateCode || '32');
  const upiUri = buildUpiUri(business.upiId, business.businessName, totals.netPayable, invoice.invoiceNumber);

  const panNumber = (business?.gstin || '').length >= 12 ? business.gstin.slice(2, 12) : '—';
  const isB2B = Boolean(invoice?.customer?.gstin);

  return (
    <div
      id="invoice-printable"
      className="bg-white text-slate-900 mx-auto w-full max-w-[800px] border border-slate-300 p-6 text-[11px] leading-tight font-sans shadow-sm print:shadow-none print:border-none print:p-0"
    >
      {/* 1. Top Bar: Header Designation */}
      <div className="flex justify-between items-center border-b border-slate-900 pb-2 mb-3">
        <div className="flex items-center gap-1.5 text-slate-800 text-[11px] font-bold uppercase tracking-wider">
          <span className="w-2 h-2 bg-amber-600 rounded-xs inline-block"></span>
          GST TAX INVOICE
        </div>
        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-600 border border-slate-300 px-2 py-0.5 rounded-xs">
          {invoiceCopy}
        </div>
      </div>

      {/* 2. Company Header (Left) & GSTIN / Registration (Right) */}
      <div className="flex justify-between items-start gap-4 pb-3 border-b border-slate-200">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xs bg-slate-900 flex items-center justify-center text-white shrink-0 print:border print:border-slate-800">
              <BatteryCharging className="w-4 h-4 text-amber-400 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 uppercase">
                {business.businessName}
              </h1>
              <p className="text-[9px] font-semibold text-amber-800 uppercase tracking-wide">
                {business.tagline}
              </p>
            </div>
          </div>

          <div className="mt-2 text-[10.5px] text-slate-600 leading-snug space-y-0.5">
            <p>
              {business.addressLine1}, {business.roadStreet}
            </p>
            <p>
              {business.cityDistrict}, {business.state} - <span className="font-semibold text-slate-800">{business.pinCode}</span>
            </p>
            <p className="text-slate-700">
              <span className="font-medium text-slate-500">Phone:</span> {business.phone}
              {business.altPhone && <span> | {business.altPhone}</span>}
              {business.email && <span> | {business.email}</span>}
            </p>
          </div>
        </div>

        {/* GSTIN / PAN Details (Clean minimalist block, no heavy black card) */}
        <div className="text-right flex flex-col items-end">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
            GSTIN / UIN
          </div>
          <div className="text-[12px] font-mono font-bold tracking-wider text-slate-900 mt-0.5">
            {business.gstin}
          </div>
          <div className="mt-1 text-[10px] text-slate-600 space-y-0.5">
            <div>
              <span className="text-slate-500">State:</span> <span className="font-medium text-slate-800">{business?.state || 'Kerala'}</span> (Code: <span className="font-semibold text-slate-800">{business?.stateCode || '32'}</span>)
            </div>
            <div>
              <span className="text-slate-500">PAN:</span> <span className="font-mono font-medium text-slate-800">{panNumber}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Invoice Particulars (Left) & Customer Billed To (Right) */}
      <div className="grid grid-cols-2 border border-slate-300 mt-3 text-[10.5px]">
        {/* Left Column: Invoice Particulars */}
        <div className="p-2.5 bg-slate-50/70 border-r border-slate-300">
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-1.5">
            Invoice Particulars
          </div>
          <div className="space-y-1 text-slate-700">
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-5 text-slate-500 font-medium">Invoice No:</span>
              <span className="col-span-7 font-mono font-bold text-slate-900">{invoice.invoiceNumber || '—'}</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-5 text-slate-500 font-medium">Invoice Date:</span>
              <span className="col-span-7 font-medium text-slate-900">{invoice.invoiceDate || '—'}</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-5 text-slate-500 font-medium">Payment Mode:</span>
              <span className="col-span-7 font-medium text-slate-900">{invoice.paymentMode || 'Cash'}</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-5 text-slate-500 font-medium">Place of Supply:</span>
              <span className="col-span-7 font-medium text-slate-900">{invoice.placeOfSupply || 'Kerala (32)'}</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-5 text-slate-500 font-medium">Reverse Charge:</span>
              <span className="col-span-7 font-medium text-slate-900">{invoice.reverseCharge || 'No'}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Customer / Billed To */}
        <div className="p-2.5 bg-white flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-1 mb-1.5">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-800">
                Billed To / Buyer
              </span>
              <span className="text-[8.5px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded-xs border border-slate-200">
                {isB2B ? 'B2B (Registered)' : 'B2C (Consumer)'}
              </span>
            </div>
            <div className="text-[12px] font-bold text-slate-900">
              {invoice?.customer?.name || 'Cash Customer'}
            </div>
            {invoice?.customer?.phone && (
              <div className="text-slate-600 mt-0.5">
                <span className="text-slate-500 font-medium">Mobile:</span> +91 {invoice.customer.phone}
              </div>
            )}
            <div className="text-slate-600 leading-snug mt-0.5">
              {[
                invoice?.customer?.address,
                invoice?.customer?.city,
                invoice?.customer?.district,
                invoice?.customer?.state || 'Kerala',
              ]
                .filter(Boolean)
                .join(', ')}
              {invoice?.customer?.pincode ? ` - ${invoice.customer.pincode}` : ''}
            </div>
          </div>

          <div className="pt-1.5 flex gap-4 text-[10px] text-slate-600 border-t border-slate-100 mt-1">
            <div>
              <span className="text-slate-500">State Code:</span> <span className="font-semibold text-slate-800">{invoice?.customer?.stateCode || '32'}</span>
            </div>
            {invoice?.customer?.gstin && (
              <div>
                <span className="text-slate-500">GSTIN:</span> <span className="font-mono font-bold text-slate-900">{invoice.customer.gstin}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Products & Services Table */}
      <div className="mt-3 border border-slate-300 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-300 text-slate-700 text-[9.5px] uppercase font-semibold tracking-wider">
              <th className="py-2 px-1.5 text-center w-7 border-r border-slate-200">#</th>
              <th className="py-2 px-2 border-r border-slate-200">Description of Goods</th>
              <th className="py-2 px-1.5 text-center w-12 border-r border-slate-200">HSN</th>
              <th className="py-2 px-1 text-center w-12 border-r border-slate-200">Qty</th>
              <th className="py-2 px-2 text-right w-18 border-r border-slate-200">Rate</th>
              <th className="py-2 px-2 text-right w-18 border-r border-slate-200">Taxable</th>
              {!totals.isInterstate ? (
                <>
                  <th className="py-2 px-1.5 text-center w-15 border-r border-slate-200">CGST</th>
                  <th className="py-2 px-1.5 text-center w-15 border-r border-slate-200">SGST</th>
                </>
              ) : (
                <th className="py-2 px-1.5 text-center w-18 border-r border-slate-200">IGST</th>
              )}
              <th className="py-2 px-2 text-right w-20">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[10.5px]">
            {totals.computedItems.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="py-2 px-1.5 text-center font-medium text-slate-500 border-r border-slate-200 align-top">
                  {idx + 1}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 align-top">
                  <div className="font-bold text-slate-900 leading-snug">{item.name}</div>
                  {formatItemSpecifications(item) && (
                    <div className="text-[9.5px] text-slate-600 font-medium mt-0.5">
                      {formatItemSpecifications(item)}
                    </div>
                  )}
                  {(item.serialNo || item.warranty) && (
                    <div className="flex flex-wrap gap-x-2 text-[9px] text-slate-500 mt-0.5">
                      {item.serialNo && (
                        <span>
                          S/N: <span className="font-mono text-slate-700">{item.serialNo}</span>
                        </span>
                      )}
                      {item.warranty && (
                        <span>
                          Warranty: <span className="text-slate-700">{item.warranty}</span>
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-2 px-1.5 text-center font-mono text-[9.5px] text-slate-700 border-r border-slate-200 align-top">
                  {item.hsn || '8507'}
                </td>
                <td className="py-2 px-1 text-center font-medium text-slate-800 border-r border-slate-200 align-top">
                  {item.qty} <span className="text-[9px] text-slate-500">{item.unit || 'Nos'}</span>
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-700 border-r border-slate-200 align-top">
                  {formatNumber(item.rate)}
                  {item.isTaxInclusive && (
                    <div className="text-[8px] text-slate-400 font-sans">(Inc. GST)</div>
                  )}
                </td>
                <td className="py-2 px-2 text-right font-mono font-medium text-slate-900 border-r border-slate-200 align-top">
                  {formatNumber(item.taxableValue)}
                </td>
                {!totals.isInterstate ? (
                  <>
                    <td className="py-2 px-1.5 text-center font-mono text-[9.5px] text-slate-700 border-r border-slate-200 align-top">
                      <div className="text-[8.5px] text-slate-500">{item.cgstRate}%</div>
                      <div className="font-medium text-slate-900">₹{formatNumber(item.cgstAmount)}</div>
                    </td>
                    <td className="py-2 px-1.5 text-center font-mono text-[9.5px] text-slate-700 border-r border-slate-200 align-top">
                      <div className="text-[8.5px] text-slate-500">{item.sgstRate}%</div>
                      <div className="font-medium text-slate-900">₹{formatNumber(item.sgstAmount)}</div>
                    </td>
                  </>
                ) : (
                  <td className="py-2 px-1.5 text-center font-mono text-[9.5px] text-slate-700 border-r border-slate-200 align-top">
                    <div className="text-[8.5px] text-slate-500">{item.igstRate}%</div>
                    <div className="font-medium text-slate-900">₹{formatNumber(item.igstAmount)}</div>
                  </td>
                )}
                <td className="py-2 px-2 text-right font-mono font-bold text-slate-950 align-top">
                  {formatNumber(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Subtotal Footer */}
          <tfoot>
            <tr className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-300 text-[9.5px]">
              <td colSpan={3} className="py-1.5 px-2 text-right uppercase tracking-wider text-slate-600 border-r border-slate-200">
                Item Totals
              </td>
              <td className="py-1.5 px-1 text-center font-bold border-r border-slate-200">
                {totals.computedItems.reduce((acc, it) => acc + it.qty, 0)}
              </td>
              <td className="border-r border-slate-200"></td>
              <td className="py-1.5 px-2 text-right font-mono font-bold border-r border-slate-200">
                ₹{formatNumber(totals.totalTaxableValue)}
              </td>
              {!totals.isInterstate ? (
                <>
                  <td className="py-1.5 px-1 text-center font-mono font-bold border-r border-slate-200">
                    ₹{formatNumber(totals.totalCgst)}
                  </td>
                  <td className="py-1.5 px-1 text-center font-mono font-bold border-r border-slate-200">
                    ₹{formatNumber(totals.totalSgst)}
                  </td>
                </>
              ) : (
                <td className="py-1.5 px-1 text-center font-mono font-bold border-r border-slate-200">
                  ₹{formatNumber(totals.totalIgst)}
                </td>
              )}
              <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-950">
                ₹{formatNumber(totals.totalGross)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 5. Middle Split: HSN Summary & Bank/QR (Left) & Deductions/Payable (Right) */}
      <div className="grid grid-cols-12 gap-3 mt-3">
        {/* Left Column (col-span-7): HSN Summary + Bank/QR */}
        <div className="col-span-7 space-y-2.5">
          {/* Statutory HSN Breakdown Table */}
          <div className="border border-slate-300 text-[9px]">
            <div className="bg-slate-100/80 px-2 py-1 font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 text-[8.5px]">
              GST Tax Computation Summary (HSN/SAC Wise)
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[8px] uppercase">
                  <th className="py-1 px-1.5">HSN/SAC</th>
                  <th className="py-1 px-1.5 text-right">Taxable Val</th>
                  {!totals.isInterstate ? (
                    <>
                      <th className="py-1 px-1 text-center">CGST</th>
                      <th className="py-1 px-1 text-center">SGST</th>
                    </>
                  ) : (
                    <th className="py-1 px-1 text-center">IGST</th>
                  )}
                  <th className="py-1 px-1.5 text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[9px]">
                {totals.hsnSummary.map((h, i) => (
                  <tr key={i}>
                    <td className="py-1 px-1.5 font-bold text-slate-800">{h.hsn} ({h.gstRate}%)</td>
                    <td className="py-1 px-1.5 text-right text-slate-700">₹{formatNumber(h.taxableValue)}</td>
                    {!totals.isInterstate ? (
                      <>
                        <td className="py-1 px-1 text-center text-slate-700">₹{formatNumber(h.cgstAmount)}</td>
                        <td className="py-1 px-1 text-center text-slate-700">₹{formatNumber(h.sgstAmount)}</td>
                      </>
                    ) : (
                      <td className="py-1 px-1 text-center text-slate-700">₹{formatNumber(h.igstAmount)}</td>
                    )}
                    <td className="py-1 px-1.5 text-right font-bold text-slate-900">₹{formatNumber(h.totalTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bank Payment & Dynamic UPI QR Block */}
          <div className="border border-slate-300 p-2.5 bg-slate-50/50 flex items-center justify-between gap-3 text-[9.5px]">
            <div className="space-y-0.5 flex-1">
              <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-800 pb-0.5 border-b border-slate-200 mb-1">
                Bank Payment Details
              </div>
              <div className="text-slate-600 space-y-0.5">
                <div><span className="text-slate-500">Bank:</span> <span className="font-medium text-slate-800">{business.bankName}</span></div>
                <div><span className="text-slate-500">A/C No:</span> <span className="font-mono font-bold text-slate-900">{business.accountNo}</span></div>
                <div><span className="text-slate-500">A/C Name:</span> <span className="font-medium text-slate-800">{business.accountName}</span></div>
                <div><span className="text-slate-500">IFSC:</span> <span className="font-mono font-bold text-slate-900">{business.ifsc}</span></div>
                <div><span className="text-slate-500">Branch:</span> <span className="font-medium text-slate-800">{business.branch}</span></div>
              </div>
            </div>

            {/* Scannable UPI QR Code */}
            {business.upiId && (
              <div className="flex flex-col items-center bg-white p-1 rounded-xs border border-slate-200 text-center shrink-0">
                <UpiQrCode upiUri={upiUri} size={72} className="border-none p-0 shadow-none" />
                <div className="mt-0.5 text-[7.5px] font-bold text-slate-700 uppercase tracking-tight">
                  Scan to Pay
                </div>
                <div className="text-[7px] text-slate-500 font-mono">
                  {business.upiId}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (col-span-5): Totals & Final Amount */}
        <div className="col-span-5 flex flex-col justify-between">
          <div className="border border-slate-300 divide-y divide-slate-200 text-[10.5px]">
            <div className="flex justify-between py-1.5 px-3">
              <span className="text-slate-600">Total Taxable Value:</span>
              <span className="font-mono font-semibold text-slate-800">₹{formatNumber(totals.totalTaxableValue)}</span>
            </div>

            <div className="flex justify-between py-1.5 px-3">
              <span className="text-slate-600">Total GST ({totals.isInterstate ? 'IGST' : 'CGST+SGST'}):</span>
              <span className="font-mono font-semibold text-slate-800">₹{formatNumber(totals.totalTax)}</span>
            </div>

            <div className="flex justify-between py-1.5 px-3 font-semibold bg-slate-50/50">
              <span className="text-slate-700">Gross Invoice Amount:</span>
              <span className="font-mono font-bold text-slate-900">₹{formatNumber(totals.totalGross)}</span>
            </div>

            {/* Scrap Buyback deduction if any */}
            {totals.scrapDiscount > 0 && (
              <div className="py-1.5 px-3 bg-amber-50/40 text-amber-900">
                <div className="flex justify-between font-bold text-[10px]">
                  <span>Old Battery Scrap Buyback:</span>
                  <span className="font-mono">- ₹{formatNumber(totals.scrapDiscount)}</span>
                </div>
                {invoice.scrapExchange?.description && (
                  <div className="text-[8.5px] text-amber-700/80 italic mt-0.5 truncate">
                    {invoice.scrapExchange.description}
                  </div>
                )}
              </div>
            )}

            {/* Special Discount if any */}
            {totals.extraDiscount > 0 && (
              <div className="flex justify-between py-1.5 px-3 text-emerald-800 font-medium">
                <span>Special Discount:</span>
                <span className="font-mono">- ₹{formatNumber(totals.extraDiscount)}</span>
              </div>
            )}

            {/* Round off */}
            <div className="flex justify-between py-1 px-3 text-[9.5px] text-slate-500">
              <span>Round Off:</span>
              <span className="font-mono">
                {totals.roundOff >= 0 ? `+₹${formatNumber(totals.roundOff)}` : `-₹${formatNumber(Math.abs(totals.roundOff))}`}
              </span>
            </div>

            {/* Net Amount Payable Banner (Clean minimalist emphasis) */}
            <div className="p-2.5 bg-slate-900 text-white print:bg-slate-950">
              <div className="flex justify-between items-baseline">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-amber-400 font-bold">
                    Net Payable Amount
                  </div>
                  <div className="text-[7.5px] text-slate-400">
                    (Inclusive of all taxes)
                  </div>
                </div>
                <div className="text-lg font-mono font-bold text-white tracking-tight">
                  {formatINR(totals.netPayable)}
                </div>
              </div>
            </div>
          </div>

          {/* Amount In Words */}
          <div className="mt-2 p-1.5 bg-slate-50 border border-slate-200 text-[9.5px]">
            <span className="font-bold text-slate-700">Amount in Words: </span>
            <span className="text-slate-800 italic capitalize">
              {totals.amountInWords}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Bottom Section: Declarations, Terms & Signatures */}
      <div className="mt-3 pt-2.5 border-t border-slate-300 grid grid-cols-12 gap-3 text-[9px]">
        {/* Left: Declaration & Terms */}
        <div className="col-span-8 space-y-2">
          {/* Statutory Declaration */}
          <div className="border-l-2 border-slate-400 pl-2 text-slate-600 leading-snug">
            <span className="font-bold uppercase tracking-wider text-[8px] block text-slate-800 mb-0.5">
              Statutory Declaration:
            </span>
            "Certified that all particulars shown in this tax invoice are true and correct, and that our registration under the GST Act 2017 is valid as on the date of this bill."
          </div>

          {/* Terms & Conditions */}
          <div>
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[8.5px] mb-0.5">
              Terms & Conditions:
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-600 leading-tight">
              {business.terms && business.terms.slice(0, 4).map((t, idx) => (
                <li key={idx}>{t.replace(/^\d+\.\s*/, '')}</li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right: Signature Blocks */}
        <div className="col-span-4 flex flex-col justify-between text-center pt-1">
          <div>
            <div className="h-8 border-b border-dashed border-slate-300"></div>
            <div className="text-[8.5px] text-slate-500 mt-1 font-medium">
              Customer Signature
            </div>
          </div>

          <div className="pt-2">
            <div className="text-[9px] font-bold text-slate-900 uppercase">
              For {business.businessName}
            </div>
            <div className="h-7 flex items-center justify-center">
              <span className="text-[8px] text-slate-400 italic">
                [Authorized Signatory / Stamp]
              </span>
            </div>
            <div className="border-t border-slate-400 pt-0.5 text-[8.5px] font-semibold text-slate-700">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      {/* 7. Bottom Watermark & Jurisdiction */}
      <div className="mt-2.5 pt-1.5 border-t border-slate-200 flex justify-between items-center text-[7.5px] text-slate-400">
        <div>Generated via TPS BATTERYS HOUSE GST Billing System</div>
        <div>Subject to Thrithala / Palakkad Jurisdiction</div>
      </div>
    </div>
  );
}
