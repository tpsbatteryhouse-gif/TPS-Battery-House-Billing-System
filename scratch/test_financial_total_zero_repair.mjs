// scratch/test_financial_total_zero_repair.mjs
// Dedicated regression test suite for TPS Battery House — Final Invoice Amount Reparation & Financial Consistency Guard

import assert from 'assert';
import {
  calculateInvoiceTotals,
  calculateLineItem,
  buildUpiUri,
  verifyInvoiceFinancialConsistency,
  FINANCIAL_VALIDATION_STATUS,
} from '../src/utils/gstCalculations.js';
import { generateVectorPdf } from '../src/utils/pdfExport.js';
import { sanitizeInvoiceForFirestore } from '../src/firebase/services/invoiceService.js';
import { calculateDashboardMetrics } from '../src/utils/dashboardFinancialMetrics.js';

let passed = 0;
let failed = 0;

async function it(desc, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(err);
  }
}

const DEFAULT_BUSINESS = {
  businessName: 'TPS BATTERYS HOUSE',
  gstin: '32DIUPP1211B2ZN',
  pan: 'DIUPP1211B',
  stateCode: '32',
  upiId: '9846830532@okaxis',
  bankName: 'Federal Bank',
  accountNo: '15240200008892',
  ifsc: 'FDRL0001524',
};

console.log('================================================================');
console.log('TPS BATTERY HOUSE — REPRODUCTION CASE & FINANCIAL INTEGRITY SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// PART 1: EXACT USER REPRODUCTION CASE
// -------------------------------------------------------------
console.log('--- PART 1: EXACT USER REPRODUCTION TEST CASE (₹13,800.00) ---');

const reproductionInvoice = {
  id: 'inv-repro-001',
  invoiceNumber: 'TPS/2026-27/007',
  invoiceDate: '2026-11-08',
  dueDate: '2026-11-08',
  transactionType: 'B2C',
  paymentMode: 'Cash',
  paymentStatus: 'Draft',
  placeOfSupply: 'Kerala (32)',
  reverseCharge: 'No',
  customer: {
    name: 'Green Valley Agro Farm',
    phone: '9846001122',
    address: 'Near Govt Hospital, Thrithala',
    city: 'Thrithala',
    district: 'Palakkad',
    state: 'Kerala',
    stateCode: '32',
    pincode: '679552',
    gstin: '',
  },
  items: [
    {
      id: 'item-1',
      name: 'Amaron Current 150Ah Tall Tubular Battery',
      category: 'battery',
      subcategory: 'Tubular Battery',
      brand: 'Amaron',
      model: 'Current 150Ah',
      specs: {},
      hsn: '8507',
      serialNo: 'AM150-998822',
      warranty: '36 Months',
      qty: 1,
      unit: 'Nos',
      rate: 14800,
      isTaxInclusive: true,
      gstRate: 28,
      discount: 0,
    },
  ],
  scrapExchange: {
    enabled: true,
    description: 'Old 150Ah Scrap Battery Buyback',
    amount: 1000,
  },
  additionalDiscount: 0,
  roundOffManual: null,
  netPayable: 0, // Stale/fresh form default that previously caused ₹0.00 bug!
};

await it('1.1. Exact line item calculation matches screenshot (₹11,562.50 taxable, ₹3,237.50 GST, ₹14,800.00 line total)', () => {
  const line = calculateLineItem(reproductionInvoice.items[0], false);
  assert.strictEqual(line.taxableValue, 11562.5);
  assert.strictEqual(line.cgstAmount, 1618.75);
  assert.strictEqual(line.sgstAmount, 1618.75);
  assert.strictEqual(line.totalGstAmount, 3237.5);
  assert.strictEqual(line.lineTotal, 14800);
});

await it('1.2. Authoritative calculateInvoiceTotals computes exact net payable ₹13,800.00 and matching words', () => {
  const totals = calculateInvoiceTotals(reproductionInvoice, '32');
  assert.strictEqual(totals.totalTaxableValue, 11562.5);
  assert.strictEqual(totals.totalTax, 3237.5);
  assert.strictEqual(totals.totalGross, 14800);
  assert.strictEqual(totals.scrapDiscount, 1000);
  assert.strictEqual(totals.subtotalAfterDeductions, 13800);
  assert.strictEqual(totals.roundOff, 0);
  assert.strictEqual(totals.netPayable, 13800);
  assert(totals.amountInWords.includes('Thirteen Thousand Eight Hundred'));
});

await it('1.3. Centralized financial consistency guard validates reproduction invoice as VALID_NONZERO with ₹13,800.00', () => {
  const check = verifyInvoiceFinancialConsistency(reproductionInvoice, '32');
  assert.strictEqual(check.isValid, true);
  assert.strictEqual(check.status, FINANCIAL_VALIDATION_STATUS.VALID_NONZERO);
  assert.strictEqual(check.authoritativeNetPayable, 13800);
  assert.strictEqual(check.error, null);
});

await it('1.4. UPI URI encodes authoritative payable amount ₹13,800.00 (not ₹0.00)', () => {
  const totals = calculateInvoiceTotals(reproductionInvoice, '32');
  const upi = buildUpiUri(DEFAULT_BUSINESS.upiId, DEFAULT_BUSINESS.businessName, totals.netPayable, reproductionInvoice.invoiceNumber);
  assert(upi.includes('am=13800.00'), `UPI URI must contain am=13800.00, got: ${upi}`);
  assert(!upi.includes('am=0.00'), 'UPI URI must NOT contain am=0.00');
});

await it('1.5. Vector PDF generation completes without error and encodes authoritative payable amount', async () => {
  const pdfDoc = await generateVectorPdf(reproductionInvoice, DEFAULT_BUSINESS, 'Original for Buyer');
  assert(pdfDoc !== null, 'PDF must be generated');
  const buffer = Buffer.from(pdfDoc.output('arraybuffer'));
  assert(buffer.length > 25000, 'PDF buffer must be valid size');
});

await it('1.6. Firestore serialization persists netPayable = 13800 even if rawInvoice had stale netPayable = 0', () => {
  const sanitized = sanitizeInvoiceForFirestore(reproductionInvoice);
  assert.strictEqual(sanitized.netPayable, 13800, 'Persisted invoice must save authoritative ₹13,800.00');
});

await it('1.7. Reopening saved record preserves exact ₹13,800.00 and consistency', () => {
  const saved = sanitizeInvoiceForFirestore(reproductionInvoice);
  const reopenedTotals = calculateInvoiceTotals(saved, '32');
  assert.strictEqual(reopenedTotals.netPayable, 13800);
  assert.strictEqual(saved.netPayable, reopenedTotals.netPayable);
});

await it('1.8. Dashboard aggregation calculates ₹13,800.00 for settled or pending invoice', () => {
  const saved = sanitizeInvoiceForFirestore({ ...reproductionInvoice, paymentStatus: 'Paid' });
  const metrics = calculateDashboardMetrics([saved]);
  assert.strictEqual(metrics.financials.collectedRevenue, 13800);
  assert.strictEqual(metrics.financials.totalBilled, 13800);
});

// -------------------------------------------------------------
// PART 2: GST SLABS & TAX STRUCTURES
// -------------------------------------------------------------
console.log('\n--- PART 2: GST SLABS, TAX EXCLUSIVE & INTERSTATE MATRICES ---');

await it('2.1. Tax-exclusive line calculation reproduces identical ₹13,800.00 net payable', () => {
  const exclusiveInv = {
    ...reproductionInvoice,
    items: [
      {
        ...reproductionInvoice.items[0],
        rate: 11562.5,
        isTaxInclusive: false,
        gstRate: 28,
      },
    ],
  };
  const totals = calculateInvoiceTotals(exclusiveInv, '32');
  assert.strictEqual(totals.totalTaxableValue, 11562.5);
  assert.strictEqual(totals.totalTax, 3237.5);
  assert.strictEqual(totals.netPayable, 13800);
});

await it('2.2. Interstate IGST calculation routes all tax to IGST with identical payable amount', () => {
  const interstateInv = {
    ...reproductionInvoice,
    customer: {
      ...reproductionInvoice.customer,
      state: 'Tamil Nadu',
      stateCode: '33',
    },
  };
  const totals = calculateInvoiceTotals(interstateInv, '32');
  assert.strictEqual(totals.isInterstate, true);
  assert.strictEqual(totals.totalCgst, 0);
  assert.strictEqual(totals.totalSgst, 0);
  assert.strictEqual(totals.totalIgst, 3237.5);
  assert.strictEqual(totals.totalTax, 3237.5);
  assert.strictEqual(totals.netPayable, 13800);
});

await it('2.3. Multiple items across 18% and 28% GST slabs calculate and sum coherently', () => {
  const multiTaxInv = {
    ...reproductionInvoice,
    items: [
      {
        name: 'Battery 150Ah',
        rate: 12800,
        isTaxInclusive: true,
        gstRate: 28,
        qty: 1,
      },
      {
        name: 'Pure Sine Wave Inverter 1050VA',
        rate: 7080,
        isTaxInclusive: true,
        gstRate: 18,
        qty: 1,
      },
    ],
    scrapExchange: { enabled: false, amount: 0 },
  };
  const totals = calculateInvoiceTotals(multiTaxInv, '32');
  // Total Gross = 12,800 + 7,080 = 19,880
  assert.strictEqual(totals.totalGross, 19880);
  assert.strictEqual(totals.netPayable, 19880);
  assert.strictEqual(totals.hsnSummary.length, 2);
});

// -------------------------------------------------------------
// PART 3: DEDUCTIONS, DISCOUNTS & ROUND-OFF
// -------------------------------------------------------------
console.log('\n--- PART 3: DEDUCTIONS, SCRAP BUYBACK & ROUND-OFF MATRICES ---');

await it('3.1. Combination of Scrap Buyback, Extra Discount, and Manual Round-Off computes correctly', () => {
  const complexDeductionInv = {
    ...reproductionInvoice,
    scrapExchange: { enabled: true, amount: 1500 },
    additionalDiscount: 500,
    roundOffManual: -0.4,
  };
  // Gross: 14800, Deductions: 1500 + 500 = 2000 => Subtotal: 12800. Round-off: -0.4 => 12799.6
  const totals = calculateInvoiceTotals(complexDeductionInv, '32');
  assert.strictEqual(totals.scrapDiscount, 1500);
  assert.strictEqual(totals.extraDiscount, 500);
  assert.strictEqual(totals.subtotalAfterDeductions, 12800);
  assert.strictEqual(totals.roundOff, -0.4);
  assert.strictEqual(totals.netPayable, 12799.6);
});

await it('3.2. Legitimate zero-value service bill is recognized as VALID_ZERO without corruption', () => {
  const zeroServiceInv = {
    ...reproductionInvoice,
    items: [
      {
        name: 'Complimentary Battery Health Check & Terminal Cleaning',
        category: 'services',
        rate: 0,
        qty: 1,
        isTaxInclusive: true,
        gstRate: 18,
      },
    ],
    scrapExchange: { enabled: false, amount: 0 },
    additionalDiscount: 0,
  };
  const check = verifyInvoiceFinancialConsistency(zeroServiceInv, '32');
  assert.strictEqual(check.isValid, true);
  assert.strictEqual(check.status, FINANCIAL_VALIDATION_STATUS.VALID_ZERO);
  assert.strictEqual(check.authoritativeNetPayable, 0);
  assert.strictEqual(check.totals.amountInWords, 'Zero Rupees Only');
});

// -------------------------------------------------------------
// PART 4: FINANCIAL INTEGRITY & DEFENSIVE GUARDS
// -------------------------------------------------------------
console.log('\n--- PART 4: FINANCIAL INTEGRITY & DEFENSIVE GUARDS ---');

await it('4.1. Blocks invoice with billable items if calculation artificially produces zero', () => {
  // If someone passes negative deductions or corrupted state
  const corruptedInv = {
    ...reproductionInvoice,
    items: [{ name: 'Battery', rate: -500, qty: 1 }],
  };
  const check = verifyInvoiceFinancialConsistency(corruptedInv, '32');
  assert.strictEqual(check.isValid, false);
  assert.strictEqual(check.status, FINANCIAL_VALIDATION_STATUS.INVALID_FINANCIAL_INPUT);
});

await it('4.2. Vector PDF refuses generation and throws explicit error when given invalid financial payload', async () => {
  const invalidInv = {
    ...reproductionInvoice,
    items: [{ name: 'Corrupted Item', rate: 'INVALID_PRICE', qty: 1 }],
  };
  let errorCaught = null;
  try {
    await generateVectorPdf(invalidInv, DEFAULT_BUSINESS, 'Original for Buyer');
  } catch (err) {
    errorCaught = err;
  }
  assert(errorCaught !== null, 'Must throw error on invalid invoice');
  assert(errorCaught.message.includes('Cannot generate PDF for invalid invoice'));
});

await it('4.3. Firestore persistence refuses to save invoice when financial consistency check fails', () => {
  const invalidInv = {
    ...reproductionInvoice,
    items: [{ name: 'Corrupted Item', rate: 'NOT_A_NUMBER', qty: 1 }],
  };
  assert.throws(() => {
    sanitizeInvoiceForFirestore(invalidInv);
  }, /Financial consistency check failed|cannot be converted to a number/);
});

console.log('\n================================================================');
console.log(`TOTAL FINANCIAL REPAIR TESTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
