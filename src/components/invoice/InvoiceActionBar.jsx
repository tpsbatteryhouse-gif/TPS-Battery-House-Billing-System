import React from 'react';
import {
  Save,
  CheckCircle2,
  FileEdit,
  Eye,
  Printer,
  Download,
  Share2,
  Loader2,
} from 'lucide-react';
import { formatNumber } from '../../utils/numberToWords';

export default function InvoiceActionBar({
  itemsCount,
  taxableValue,
  netPayable,
  onSaveDraft,
  onSaveInvoice,
  onPreview,
  onPrint,
  onDownloadPdf,
  onShareWhatsApp,
  isSaved = false,
  isPdfGenerating = false,
  isSaving = false,
}) {
  return (
    <div className="sticky bottom-4 z-30 bg-slate-900/95 backdrop-blur-xl border border-slate-800 p-3.5 sm:px-6 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl">
      {/* Live Financial Overview & Compliance Notice */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
          <span className="hidden sm:inline text-[11px] text-slate-400">GST 2026 Compliant •</span>
          <span className="font-mono text-slate-300">
            {itemsCount} {itemsCount === 1 ? 'item' : 'items'} (₹{formatNumber(taxableValue)} taxable)
          </span>
        </div>
        <span className="text-xs sm:text-sm font-bold font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/30">
          Net: ₹{formatNumber(netPayable)}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Save as Draft */}
        {onSaveDraft && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Save invoice in draft state without finalizing billing"
          >
            <FileEdit className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Save Draft</span>
          </button>
        )}

        {/* Preview Invoice */}
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center gap-1.5 transition-colors"
            title="Preview A4 Tax Invoice document"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </button>
        )}

        {/* WhatsApp Share */}
        {onShareWhatsApp && (
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="px-2.5 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center gap-1.5 transition-colors"
            title="Share bill details on WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">WhatsApp</span>
          </button>
        )}

        {/* Print */}
        {onPrint && (
          <button
            type="button"
            onClick={onPrint}
            className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
            title="Print A4 Tax Invoice"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Print</span>
          </button>
        )}

        {/* Download PDF */}
        {onDownloadPdf && (
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={isPdfGenerating}
            className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            title="Generate & Download A4 PDF"
          >
            {isPdfGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span className="hidden sm:inline">Generating...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">PDF</span>
              </>
            )}
          </button>
        )}

        {/* Primary Save & Print / Save Bill */}
        <button
          type="button"
          onClick={onSaveInvoice}
          disabled={isSaving}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-lg active:scale-95 disabled:opacity-50 ${
            isSaved
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
          }`}
        >
          {isSaved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved!</span>
            </>
          ) : isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>Save & Issue Bill</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

