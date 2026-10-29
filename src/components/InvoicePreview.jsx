import React from 'react';
import { formatINR, formatNumber } from '../utils/numberToWords';
import { calculateInvoiceTotals, buildUpiUri } from '../utils/gstCalculations';
import UpiQrCode from './UpiQrCode';
import { BatteryCharging, ShieldCheck, QrCode } from 'lucide-react';

export default function InvoicePreview({ invoice, business, invoiceCopy = 'Original for Recipient' }) {
  const totals = calculateInvoiceTotals(invoice, business.stateCode || '32');
  const upiUri = buildUpiUri(business.upiId, business.businessName, totals.netPayable, invoice.invoiceNumber);

  return (
    <div
      id="invoice-printable"
      className="bg-white text-slate-900 mx-auto w-full max-w-[800px] shadow-2xl rounded-sm p-6 text-[12px] leading-tight font-sans border border-slate-300 print:shadow-none print:border-none print:p-0"
      style={{ minHeight: '1050px' }}
    >
      {/* Top Bar: GST Tax Invoice Tag & Copy Designation */}
      <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2 mb-3">
        <div className="flex items-center gap-1.5 text-slate-700 text-[11px] font-semibold uppercase tracking-wider">
          <span className="inline-block w-2.5 h-2.5 bg-amber-500 rounded-sm"></span>
          GST TAX INVOICE
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300 print:border-slate-400">
          {invoiceCopy}
        </div>
      </div>

      {/* Header: Business Details & Brand */}
      <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-300">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-sm print:border print:border-amber-600">
              <BatteryCharging className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">
                {business.businessName}
              </h1>
              <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide">
                {business.tagline}
              </p>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-slate-600 leading-snug space-y-0.5">
            <p>
              {business.addressLine1}, {business.roadStreet}
            </p>
            <p>
              {business.cityDistrict}, {business.state} - <span className="font-semibold text-slate-800">{business.pinCode}</span>
            </p>
            <p className="text-slate-700">
              <span className="font-semibold">Phone:</span> {business.phone}
              {business.altPhone && <span> | {business.altPhone}</span>}
              {business.email && <span> | {business.email}</span>}
            </p>
          </div>
        </div>

        {/* GSTIN Badge & State Info */}
        <div className="text-right flex flex-col items-end">
          <div className="bg-slate-900 text-white px-3 py-1.5 rounded shadow-sm text-right print:bg-slate-950">
            <div className="text-[9px] uppercase tracking-wider text-amber-400 font-bold">
              GSTIN / UIN
            </div>
            <div className="text-[13px] font-mono font-bold tracking-wider">
              {business.gstin}
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-600">
            <div>State: <span className="font-semibold text-slate-800">{business.state}</span> (Code: <span className="font-semibold text-slate-800">{business.stateCode}</span>)</div>
            <div>PAN: <span className="font-mono font-semibold text-slate-700">{business.gstin.slice(2, 12)}</span></div>
          </div>
        </div>
      </div>

      {/* Meta Grid: Invoice Meta (Left) & Customer / Consignee (Right) */}
      <div className="grid grid-cols-2 border border-slate-300 mt-3 rounded-sm overflow-hidden text-[11px]">
        {/* Left Column: Invoice Particulars */}
        <div className="p-3 bg-slate-50 border-r border-slate-300 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 border-b border-slate-200 pb-1">
              Invoice Particulars
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-700">
              <span className="font-medium">Invoice No:</span>
              <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber || '—'}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-700">
              <span className="font-medium">Invoice Date:</span>
              <span className="font-semibold text-slate-900">{invoice.invoiceDate || '—'}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-700">
              <span className="font-medium">Payment Mode:</span>
              <span className="font-semibold text-slate-900">{invoice.paymentMode || 'Cash'}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-700">
              <span className="font-medium">Place of Supply:</span>
              <span className="font-semibold text-slate-900">{invoice.placeOfSupply || 'Kerala (32)'}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-700">
              <span className="font-medium">Reverse Charge:</span>
              <span className="font-semibold text-slate-900">{invoice.reverseCharge || 'No'}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Customer / Billed To */}
        <div className="p-3 bg-white flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
                Details of Buyer / Billed To
              </span>
              <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                {invoice.customer.gstin ? 'B2B (Registered)' : 'B2C (Consumer)'}
              </span>
            </div>
            <div className="text-[13px] font-bold text-slate-900 pt-0.5">
              {invoice.customer.name || 'Cash Customer'}
            </div>
            {invoice.customer.phone && (
              <div className="text-slate-700">
                <span className="font-medium">Mobile:</span> +91 {invoice.customer.phone}
              </div>
            )}
            <div className="text-slate-600 leading-snug">
              {invoice.customer.address && <span>{invoice.customer.address}, </span>}
              {invoice.customer.city && <span>{invoice.customer.city}, </span>}
              {invoice.customer.district && <span>{invoice.customer.district}, </span>}
              <span>{invoice.customer.state || 'Kerala'}</span>
              {invoice.customer.pincode && <span> - {invoice.customer.pincode}</span>}
            </div>
            <div className="pt-1 flex gap-4 text-[10px] text-slate-700">
              <div>
                <span className="font-medium">State Code:</span> <span className="font-bold">{invoice.customer.stateCode || '32'}</span>
              </div>
              {invoice.customer.gstin && (
                <div>
                  <span className="font-medium">GSTIN:</span> <span className="font-mono font-bold text-slate-900">{invoice.customer.gstin}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mt-3 border border-slate-300 rounded-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white text-[10px] uppercase font-bold tracking-wider print:bg-slate-900">
              <th className="py-2 px-1.5 text-center w-8 border-r border-slate-700">#</th>
              <th className="py-2 px-2 border-r border-slate-700">Description of Goods</th>
              <th className="py-2 px-1.5 text-center w-14 border-r border-slate-700">HSN</th>
              <th className="py-2 px-1 text-center w-12 border-r border-slate-700">Qty</th>
              <th className="py-2 px-2 text-right w-16 border-r border-slate-700">Rate</th>
              <th className="py-2 px-2 text-right w-18 border-r border-slate-700">Taxable</th>
              {!totals.isInterstate ? (
                <>
                  <th className="py-2 px-1.5 text-center w-16 border-r border-slate-700">CGST</th>
                  <th className="py-2 px-1.5 text-center w-16 border-r border-slate-700">SGST</th>
                </>
              ) : (
                <th className="py-2 px-1.5 text-center w-20 border-r border-slate-700">IGST</th>
              )}
              <th className="py-2 px-2 text-right w-20">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            {totals.computedItems.map((item, idx) => (
              <tr key={item.id || idx} className="hover:bg-amber-50/30 transition-colors">
                <td className="py-2.5 px-1.5 text-center font-medium text-slate-600 border-r border-slate-200 align-top">
                  {idx + 1}
                </td>
                <td className="py-2.5 px-2 border-r border-slate-200 align-top">
                  <div className="font-bold text-slate-900 leading-snug">{item.name}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.serialNo && (
                      <span className="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-mono border border-slate-200">
                        SN: {item.serialNo}
                      </span>
                    )}
                    {item.warranty && (
                      <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-semibold border border-amber-200">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Warranty: {item.warranty}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-1.5 text-center font-mono text-[10px] text-slate-700 border-r border-slate-200 align-top">
                  {item.hsn || '8507'}
                </td>
                <td className="py-2.5 px-1 text-center font-medium text-slate-800 border-r border-slate-200 align-top">
                  {item.qty} <span className="text-[9px] text-slate-500">{item.unit || 'Nos'}</span>
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-slate-800 border-r border-slate-200 align-top">
                  {formatNumber(item.rate)}
                  {item.isTaxInclusive && (
                    <div className="text-[8px] text-slate-400 font-sans">(Inc. GST)</div>
                  )}
                </td>
                <td className="py-2.5 px-2 text-right font-mono font-medium text-slate-900 border-r border-slate-200 align-top">
                  {formatNumber(item.taxableValue)}
                </td>
                {!totals.isInterstate ? (
                  <>
                    <td className="py-2.5 px-1.5 text-center font-mono text-[10px] text-slate-700 border-r border-slate-200 align-top">
                      <div>{item.cgstRate}%</div>
                      <div className="font-semibold text-slate-900">₹{formatNumber(item.cgstAmount)}</div>
                    </td>
                    <td className="py-2.5 px-1.5 text-center font-mono text-[10px] text-slate-700 border-r border-slate-200 align-top">
                      <div>{item.sgstRate}%</div>
                      <div className="font-semibold text-slate-900">₹{formatNumber(item.sgstAmount)}</div>
                    </td>
                  </>
                ) : (
                  <td className="py-2.5 px-1.5 text-center font-mono text-[10px] text-slate-700 border-r border-slate-200 align-top">
                    <div>{item.igstRate}%</div>
                    <div className="font-semibold text-slate-900">₹{formatNumber(item.igstAmount)}</div>
                  </td>
                )}
                <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-950 align-top">
                  {formatNumber(item.lineTotal)}
                </td>
              </tr>
            ))}

            {/* If rows are few, add empty spacer rows to preserve standard height */}
            {totals.computedItems.length === 1 && (
              <tr className="h-6">
                <td className="border-r border-slate-200"></td>
                <td className="border-r border-slate-200"></td>
                <td className="border-r border-slate-200"></td>
                <td className="border-r border-slate-200"></td>
                <td className="border-r border-slate-200"></td>
                <td className="border-r border-slate-200"></td>
                {!totals.isInterstate ? (
                  <>
                    <td className="border-r border-slate-200"></td>
                    <td className="border-r border-slate-200"></td>
                  </>
                ) : (
                  <td className="border-r border-slate-200"></td>
                )}
                <td></td>
              </tr>
            )}
          </tbody>

          {/* Subtotal Before Deductions Footer */}
          <tfoot>
            <tr className="bg-slate-100 font-semibold text-slate-800 border-t border-slate-300 text-[10px]">
              <td colSpan={3} className="py-1.5 px-2 text-right uppercase tracking-wider text-slate-600 border-r border-slate-300">
                Item Totals
              </td>
              <td className="py-1.5 px-1 text-center font-bold border-r border-slate-300">
                {totals.computedItems.reduce((acc, it) => acc + it.qty, 0)}
              </td>
              <td className="border-r border-slate-300"></td>
              <td className="py-1.5 px-2 text-right font-mono font-bold border-r border-slate-300">
                ₹{formatNumber(totals.totalTaxableValue)}
              </td>
              {!totals.isInterstate ? (
                <>
                  <td className="py-1.5 px-1 text-center font-mono font-bold border-r border-slate-300">
                    ₹{formatNumber(totals.totalCgst)}
                  </td>
                  <td className="py-1.5 px-1 text-center font-mono font-bold border-r border-slate-300">
                    ₹{formatNumber(totals.totalSgst)}
                  </td>
                </>
              ) : (
                <td className="py-1.5 px-1 text-center font-mono font-bold border-r border-slate-300">
                  ₹{formatNumber(totals.totalIgst)}
                </td>
              )}
              <td className="py-1.5 px-2 text-right font-mono font-extrabold text-slate-900">
                ₹{formatNumber(totals.totalGross)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Middle Split: Statutory HSN Tax Summary (Left) & Deductions/Payable Breakdown (Right) */}
      <div className="grid grid-cols-12 gap-3 mt-3">
        {/* Left: HSN Summary & Bank / UPI Details */}
        <div className="col-span-7 space-y-2.5">
          {/* Statutory HSN Breakdown Table */}
          <div className="border border-slate-300 rounded-sm overflow-hidden text-[9px]">
            <div className="bg-slate-200 px-2 py-1 font-bold text-slate-800 uppercase tracking-wider text-[9px]">
              GST Tax Computation Summary (HSN/SAC Wise)
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
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
              <tbody className="divide-y divide-slate-200 font-mono text-[9.5px]">
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

          {/* Bank & UPI QR Payment Block */}
          <div className="border border-slate-300 rounded-sm p-2.5 bg-slate-50 flex items-center justify-between gap-3 text-[10px]">
            <div className="space-y-1 flex-1">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1">
                <span>Bank Payment Details</span>
              </div>
              <div className="text-slate-700 space-y-0.5">
                <div><span className="font-semibold">Bank:</span> {business.bankName}</div>
                <div><span className="font-semibold">A/C No:</span> <span className="font-mono font-bold text-slate-900">{business.accountNo}</span></div>
                <div><span className="font-semibold">Account Name:</span> {business.accountName}</div>
                <div><span className="font-semibold">IFSC Code:</span> <span className="font-mono font-bold text-slate-900">{business.ifsc}</span></div>
                <div><span className="font-semibold">Branch:</span> {business.branch}</div>
              </div>
            </div>

            {/* Dynamic UPI QR Code */}
            {business.upiId && (
              <div className="flex flex-col items-center bg-white p-1.5 rounded border border-slate-300 shadow-xs text-center">
                <UpiQrCode upiUri={upiUri} size={84} />
                <div className="mt-1 text-[8px] font-bold text-slate-700 uppercase flex items-center gap-0.5">
                  <QrCode className="w-2.5 h-2.5 text-amber-600" />
                  Scan to Pay
                </div>
                <div className="text-[7.5px] text-slate-500 font-mono">
                  {business.upiId}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Deductions, Scrap Battery Exchange & Final Net Amount */}
        <div className="col-span-5 flex flex-col justify-between">
          <div className="border border-slate-300 rounded-sm bg-slate-50 divide-y divide-slate-200 text-[11px]">
            <div className="flex justify-between py-1.5 px-3">
              <span className="text-slate-600">Total Taxable Value:</span>
              <span className="font-mono font-semibold text-slate-800">₹{formatNumber(totals.totalTaxableValue)}</span>
            </div>

            <div className="flex justify-between py-1.5 px-3">
              <span className="text-slate-600">Total GST ({totals.isInterstate ? 'IGST' : 'CGST + SGST'}):</span>
              <span className="font-mono font-semibold text-slate-800">₹{formatNumber(totals.totalTax)}</span>
            </div>

            <div className="flex justify-between py-1.5 px-3 bg-white font-semibold">
              <span className="text-slate-700">Gross Invoice Amount:</span>
              <span className="font-mono font-bold text-slate-900">₹{formatNumber(totals.totalGross)}</span>
            </div>

            {/* Scrap Battery Exchange Buyback Deduction */}
            {totals.scrapDiscount > 0 && (
              <div className="py-2 px-3 bg-amber-50/70 border-y border-amber-200">
                <div className="flex justify-between items-center text-amber-900 font-bold">
                  <span className="text-[10px] uppercase tracking-wide flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-600 rounded-full inline-block"></span>
                    Old Battery Scrap Buyback:
                  </span>
                  <span className="font-mono text-[12px] text-amber-800">
                    - ₹{formatNumber(totals.scrapDiscount)}
                  </span>
                </div>
                <div className="text-[9px] text-amber-700 italic mt-0.5">
                  {invoice.scrapExchange.description || 'Old battery scrap buyback / exchange deduction'}
                </div>
              </div>
            )}

            {/* Additional Discount if any */}
            {totals.extraDiscount > 0 && (
              <div className="flex justify-between py-1.5 px-3 text-emerald-800 font-medium">
                <span>Special Discount:</span>
                <span className="font-mono">- ₹{formatNumber(totals.extraDiscount)}</span>
              </div>
            )}

            {/* Round off */}
            <div className="flex justify-between py-1 px-3 text-[10px] text-slate-500">
              <span>Round Off:</span>
              <span className="font-mono">
                {totals.roundOff >= 0 ? `+₹${formatNumber(totals.roundOff)}` : `-₹${formatNumber(Math.abs(totals.roundOff))}`}
              </span>
            </div>

            {/* Net Amount Payable Banner */}
            <div className="p-3 bg-slate-900 text-white rounded-b-sm print:bg-slate-950">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-amber-400 font-bold">
                    Net Payable Amount
                  </div>
                  <div className="text-[8px] text-slate-400">
                    (Inclusive of all taxes & exchange)
                  </div>
                </div>
                <div className="text-xl font-mono font-black text-white tracking-tight">
                  {formatINR(totals.netPayable)}
                </div>
              </div>
            </div>
          </div>

          {/* Amount In Words */}
          <div className="mt-2 p-2 bg-slate-100 rounded border border-slate-200 text-[10px]">
            <span className="font-bold text-slate-700">Amount in Words: </span>
            <span className="font-semibold text-slate-900 italic capitalize">
              {totals.amountInWords}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Terms & Conditions, Declarations & Signatures */}
      <div className="mt-3 pt-3 border-t border-slate-300 grid grid-cols-12 gap-3 text-[9.5px]">
        {/* Left: Terms & Declaration */}
        <div className="col-span-8 space-y-2">
          {/* Statutory Declaration as required by prompt */}
          <div className="p-2 bg-amber-50/60 rounded border border-amber-200/80 text-amber-950 leading-relaxed font-medium">
            <span className="font-bold uppercase tracking-wider text-[8.5px] block text-amber-900 mb-0.5">
              Statutory Declaration:
            </span>
            "Certified that all particulars shown in this tax invoice are true and correct, and that our registration under the GST Act 2017 is valid as on the date of this bill."
          </div>

          {/* Terms & Conditions */}
          <div>
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-1">
              Terms & Conditions:
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-600 leading-snug">
              {business.terms && business.terms.slice(0, 4).map((t, idx) => (
                <li key={idx}>{t.replace(/^\d+\.\s*/, '')}</li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right: Signature Blocks */}
        <div className="col-span-4 flex flex-col justify-between text-center pt-2">
          <div>
            <div className="h-10 border-b border-dashed border-slate-400"></div>
            <div className="text-[9px] text-slate-600 mt-1 font-medium">
              Customer Signature
            </div>
          </div>

          <div className="pt-4">
            <div className="text-[10px] font-bold text-slate-900 uppercase">
              For {business.businessName}
            </div>
            <div className="h-10 flex items-center justify-center">
              <span className="text-[9px] text-slate-400 italic">
                [Authorized Signatory / Stamp]
              </span>
            </div>
            <div className="border-t border-slate-400 pt-1 text-[9px] font-semibold text-slate-700">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      {/* Footer watermark note */}
      <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-center text-[8px] text-slate-400">
        <div>Generated via TPS BATTERYS HOUSE GST Billing System</div>
        <div>Subject to Thrithala / Palakkad Jurisdiction</div>
      </div>
    </div>
  );
}
