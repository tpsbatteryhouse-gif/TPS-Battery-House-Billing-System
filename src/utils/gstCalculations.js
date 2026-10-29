import { numberToIndianWords } from './numberToWords';

/**
 * Calculates line-level and invoice-level GST values.
 * Handles both Tax Inclusive (MRP reverse calculation) and Tax Exclusive pricing.
 */
export function calculateLineItem(item, isInterstate = false) {
  const qty = Number(item.qty) || 0;
  const rate = Number(item.rate) || 0;
  const gstRate = Number(item.gstRate) || 0;
  const isInclusive = Boolean(item.isTaxInclusive);

  let taxableValue = 0;
  let grossAmount = 0;

  if (isInclusive) {
    // If rate includes GST, the total gross is rate * qty
    grossAmount = rate * qty;
    taxableValue = grossAmount / (1 + gstRate / 100);
  } else {
    // If rate is exclusive of GST
    taxableValue = rate * qty;
    grossAmount = taxableValue * (1 + gstRate / 100);
  }

  const totalGstAmount = grossAmount - taxableValue;

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (isInterstate) {
    igstRate = gstRate;
    igstAmount = totalGstAmount;
  } else {
    cgstRate = gstRate / 2;
    cgstAmount = totalGstAmount / 2;
    sgstRate = gstRate / 2;
    sgstAmount = totalGstAmount / 2;
  }

  return {
    ...item,
    qty,
    rate,
    gstRate,
    taxableValue: Number(taxableValue.toFixed(2)),
    cgstRate,
    cgstAmount: Number(cgstAmount.toFixed(2)),
    sgstRate,
    sgstAmount: Number(sgstAmount.toFixed(2)),
    igstRate,
    igstAmount: Number(igstAmount.toFixed(2)),
    totalGstAmount: Number(totalGstAmount.toFixed(2)),
    lineTotal: Number(grossAmount.toFixed(2)),
  };
}

export function calculateInvoiceTotals(invoice, businessStateCode = '32') {
  const customerStateCode = (invoice.customer?.stateCode || '32').trim();
  const isInterstate = customerStateCode !== '' && customerStateCode !== businessStateCode;

  const computedItems = (invoice.items || []).map((item) =>
    calculateLineItem(item, isInterstate)
  );

  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalGross = 0;

  // HSN Tax Breakdown Map
  const hsnMap = {};

  computedItems.forEach((item) => {
    totalTaxableValue += item.taxableValue;
    totalCgst += item.cgstAmount;
    totalSgst += item.sgstAmount;
    totalIgst += item.igstAmount;
    totalGross += item.lineTotal;

    const hsnKey = `${item.hsn || '8507'}_${item.gstRate}`;
    if (!hsnMap[hsnKey]) {
      hsnMap[hsnKey] = {
        hsn: item.hsn || '8507',
        gstRate: item.gstRate,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
      };
    }
    hsnMap[hsnKey].taxableValue += item.taxableValue;
    hsnMap[hsnKey].cgstAmount += item.cgstAmount;
    hsnMap[hsnKey].sgstAmount += item.sgstAmount;
    hsnMap[hsnKey].igstAmount += item.igstAmount;
    hsnMap[hsnKey].totalTax += item.totalGstAmount;
  });

  const hsnSummary = Object.values(hsnMap).map((h) => ({
    ...h,
    taxableValue: Number(h.taxableValue.toFixed(2)),
    cgstAmount: Number(h.cgstAmount.toFixed(2)),
    sgstAmount: Number(h.sgstAmount.toFixed(2)),
    igstAmount: Number(h.igstAmount.toFixed(2)),
    totalTax: Number(h.totalTax.toFixed(2)),
  }));

  // Scrap / Old Battery Buyback deduction
  const scrapDiscount =
    invoice.scrapExchange && invoice.scrapExchange.enabled
      ? Number(invoice.scrapExchange.amount) || 0
      : 0;

  // Additional Special Discount
  const extraDiscount = Number(invoice.additionalDiscount) || 0;

  // Amount after deductions
  const subtotalAfterDeductions = Math.max(0, totalGross - scrapDiscount - extraDiscount);

  // Round-off handling
  let roundOff = 0;
  let netPayable = 0;

  if (invoice.roundOffManual !== null && invoice.roundOffManual !== undefined && invoice.roundOffManual !== '') {
    roundOff = Number(invoice.roundOffManual) || 0;
    netPayable = Math.max(0, subtotalAfterDeductions + roundOff);
  } else {
    // Auto round-off to nearest integer
    const rounded = Math.round(subtotalAfterDeductions);
    roundOff = Number((rounded - subtotalAfterDeductions).toFixed(2));
    netPayable = rounded;
  }

  const amountInWords = numberToIndianWords(netPayable);

  return {
    computedItems,
    isInterstate,
    totalTaxableValue: Number(totalTaxableValue.toFixed(2)),
    totalCgst: Number(totalCgst.toFixed(2)),
    totalSgst: Number(totalSgst.toFixed(2)),
    totalIgst: Number(totalIgst.toFixed(2)),
    totalTax: Number((totalCgst + totalSgst + totalIgst).toFixed(2)),
    totalGross: Number(totalGross.toFixed(2)),
    scrapDiscount,
    extraDiscount,
    subtotalAfterDeductions: Number(subtotalAfterDeductions.toFixed(2)),
    roundOff,
    netPayable: Number(netPayable.toFixed(2)),
    amountInWords,
    hsnSummary,
  };
}

/**
 * Builds standard UPI Payment URI compatible with GPay, PhonePe, Paytm, BHIM, etc.
 * Example: upi://pay?pa=9846830532@okaxis&pn=TPS%20BATTERYS%20HOUSE&am=20000.00&cu=INR&tn=Invoice%20TPS/2026-27/001
 */
export function buildUpiUri(upiId, businessName, amount, invoiceNumber) {
  if (!upiId) return '';
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent(businessName.trim());
  const cleanAmount = Number(amount || 0).toFixed(2);
  const note = encodeURIComponent(`Bill ${invoiceNumber || 'TPS'}`);
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${note}`;
}
