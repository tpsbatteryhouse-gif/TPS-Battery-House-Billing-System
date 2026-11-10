import React from 'react';
import {
  Printer,
  Share2,
  Eye,
  Download,
  Loader2,
  FileEdit,
} from 'lucide-react';
import { formatNumber } from '../../utils/numberToWords';

export default function InvoiceSummary({
  invoice,
  totals,
  isInterstate = false,
  onSaveInvoice,
  onSaveDraft,
  onPreview,
  onPrint,
  onDownloadPdf,
  onShareWhatsApp,
  isPrinting = false,
  isPdfGenerating = false,
  isSaving = false,
}) {
  const isB2B = invoice?.transactionType === 'B2B';
  const typeLabel = isB2B ? 'Business customer (B2B)' : 'Regular customer (B2C)';
  const customerName = (invoice?.customer?.name || '').trim() || 'New Customer';

  const itemsCount = invoice?.items?.length || 0;
  const countText = `${itemsCount} ${itemsCount === 1 ? 'item' : 'items'}`;
  const payStatus = invoice?.paymentStatus === 'Paid' ? 'Paid' : 'Pay later';
  const payMode = invoice?.paymentMode || 'Cash';
  const payLine = `${payStatus} · ${payMode}`;

  // Average or predominant GST rate label
  const gstLabel = isInterstate
    ? 'IGST (already included)'
    : 'GST (CGST + SGST included)';

  const handleSaveAndPrint = async () => {
    if (isSaving || isPrinting) return;
    if (onSaveInvoice) {
      const saved = await onSaveInvoice();
      if (!saved || saved === false || !saved.invoiceNumber) {
        // Saving failed, was aborted, or rejected by permissions: do NOT open print dialog
        return;
      }
      // Confirm that the saved invoice has its permanent sequential invoice number
      if (
        saved.paymentStatus !== 'Draft' &&
        (saved.invoiceNumber.startsWith('DRAFT') || saved.invoiceNumber.endsWith('/000') || !saved.invoiceNumber.includes('/'))
      ) {
        return;
      }
    }
    if (onPrint) {
      onPrint();
    }
  };

  return (
    <aside
      aria-label="Bill total"
      className="bg-[#181C22] border border-[#2A3039] rounded-2xl p-6 sm:p-7 flex flex-col gap-4 sm:gap-4.5 sticky top-6 shadow-2xl"
    >
      <h2 className="text-xl sm:text-2xl font-bold text-[#F2EFE9] m-0">
        Bill total
      </h2>

      {/* Customer & Item Overview */}
      <div className="flex flex-col gap-1 pb-4 border-b border-[#2A3039]">
        <div className="text-sm sm:text-[15px] text-[#A8A294]">{typeLabel}</div>
        <div className="text-lg sm:text-xl font-bold text-[#F2EFE9] truncate">
          {customerName}
        </div>
        <div className="text-sm sm:text-[15px] text-[#A8A294]">
          {countText} · {payLine}
        </div>
      </div>

      {/* Authoritative Financial Breakdown Rows */}
      <div className="flex flex-col gap-2.5 text-base sm:text-[17px]">
        {/* Gross Items Subtotal */}
        <div className="flex justify-between items-baseline gap-3">
          <span className="text-[#F2EFE9]">Items total</span>
          <span className="font-bold font-mono text-[#F2EFE9] whitespace-nowrap">
            ₹{formatNumber(totals.totalGross)}
          </span>
        </div>

        {/* Special Discount */}
        {totals.extraDiscount > 0 && (
          <div className="flex justify-between items-baseline gap-3 text-[#FFC857]">
            <span>Discount</span>
            <span className="font-bold font-mono whitespace-nowrap">
              − ₹{formatNumber(totals.extraDiscount)}
            </span>
          </div>
        )}

        {/* Scrap Battery Exchange */}
        {totals.scrapDiscount > 0 && (
          <div className="flex justify-between items-baseline gap-3 text-[#FFC857]">
            <span>Old battery value</span>
            <span className="font-bold font-mono whitespace-nowrap">
              − ₹{formatNumber(totals.scrapDiscount)}
            </span>
          </div>
        )}

        {/* Taxable Subtotal Before GST */}
        <div className="flex justify-between items-baseline gap-3 text-[#A8A294]">
          <span>Price before GST</span>
          <span className="font-mono whitespace-nowrap">
            ₹{formatNumber(totals.totalTaxableValue)}
          </span>
        </div>

        {/* GST Breakdown */}
        {isInterstate ? (
          <div className="flex justify-between items-baseline gap-3 text-[#A8A294]">
            <span>IGST</span>
            <span className="font-mono whitespace-nowrap">
              ₹{formatNumber(totals.totalIgst)}
            </span>
          </div>
        ) : (
          <div className="flex justify-between items-baseline gap-3 text-[#A8A294]">
            <span>{gstLabel}</span>
            <span className="font-mono whitespace-nowrap">
              ₹{formatNumber(totals.totalTax)}
            </span>
          </div>
        )}

        {/* Round-off Adjustment */}
        {totals.roundOff !== 0 && (
          <div className="flex justify-between items-baseline gap-3 text-[#A8A294]">
            <span>Round-off</span>
            <span className="font-mono whitespace-nowrap">
              {totals.roundOff >= 0 ? `+₹${formatNumber(totals.roundOff)}` : `−₹${formatNumber(Math.abs(totals.roundOff))}`}
            </span>
          </div>
        )}
      </div>

      {/* Customer Pays — Hero Metric Box */}
      <div className="bg-[#2A2210] border border-[#5C4513] rounded-xl p-4 sm:p-5">
        <div className="text-sm sm:text-base font-semibold text-[#F2EFE9] mb-1">
          Customer pays
        </div>
        <div className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold font-mono text-[#FFC857] leading-tight whitespace-nowrap tracking-tight">
          ₹{formatNumber(totals.netPayable)}
        </div>
      </div>

      {/* Amount In Words */}
      {totals.amountInWords && (
        <div className="text-xs sm:text-sm text-[#A8A294] italic leading-relaxed break-words">
          <strong className="text-[#F2EFE9] not-italic">In Words:</strong> {totals.amountInWords}
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="flex flex-col gap-3 pt-2">
        {/* Save & Print Bill (Hero Action) */}
        <button
          type="button"
          onClick={handleSaveAndPrint}
          disabled={isPrinting || isSaving}
          className="w-full h-14 sm:h-[60px] rounded-xl bg-[#F2A516] hover:bg-[#ffb52e] text-[#1F1A14] text-lg sm:text-xl font-extrabold flex items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
        >
          {isPrinting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Printer className="w-5 h-5" />
          )}
          <span>Save &amp; Print Bill</span>
        </button>

        {/* Send on WhatsApp */}
        {onShareWhatsApp && (
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="inv-pill w-full justify-center"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>Send on WhatsApp</span>
          </button>
        )}

        {/* Secondary Actions: Preview, PDF, Save for later */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              className="text-xs sm:text-sm font-semibold text-[#A8A294] hover:text-[#F2EFE9] flex items-center gap-1.5 py-1"
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </button>
          )}

          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isPdfGenerating}
              className="text-xs sm:text-sm font-semibold text-[#A8A294] hover:text-[#F2EFE9] flex items-center gap-1.5 py-1 disabled:opacity-50"
            >
              {isPdfGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>PDF</span>
            </button>
          )}

          {onSaveDraft && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSaving}
              className="text-xs sm:text-sm font-semibold text-[#A8A294] hover:text-[#F2EFE9] flex items-center gap-1.5 py-1 disabled:opacity-50"
            >
              <FileEdit className="w-4 h-4" />
              <span>Save for later</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
