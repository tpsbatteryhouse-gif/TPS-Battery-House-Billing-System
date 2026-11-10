// scratch/test_invoice_print_workflow.mjs
// Dedicated test suite for TPS Battery House — Invoice Print Workflow, PDF Generation & Black Page Prevention

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  calculateInvoiceTotals,
  buildUpiUri,
  verifyInvoiceFinancialConsistency,
} from '../src/utils/gstCalculations.js';
import { generateVectorPdf, printInvoicePdf } from '../src/utils/pdfExport.js';

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

const baseInvoice = {
  id: 'inv-print-001',
  invoiceNumber: 'TPS/2026-27/007',
  invoiceDate: '2026-11-08',
  dueDate: '2026-11-08',
  transactionType: 'B2C',
  paymentMode: 'Cash',
  paymentStatus: 'Draft',
  customer: {
    name: 'Green Valley Agro Farm',
    phone: '9847334455',
    address: 'Kudallur, Anakkara Road',
    city: 'Anakkara',
    district: 'Palakkad',
    state: 'Kerala',
    stateCode: '32',
    pincode: '679551',
  },
  items: [
    {
      id: 'item-1',
      name: 'Fuze 1100 Inverter + 150Ah Tubular Battery Combo',
      category: 'inverter',
      qty: 1,
      unit: 'Set',
      rate: 22000,
      isTaxInclusive: true,
      gstRate: 28,
      hsn: '8507',
    },
    {
      id: 'item-2',
      name: 'Solar Panel Charge Controller',
      category: 'solar',
      qty: 1,
      unit: 'Set',
      rate: 4500,
      isTaxInclusive: true,
      gstRate: 18,
      hsn: '8504',
    },
  ],
  scrapExchange: { enabled: false, amount: 0 },
  additionalDiscount: 500,
  roundOffManual: null,
};

console.log('================================================================');
console.log('TPS BATTERY HOUSE — INVOICE PRINT WORKFLOW & VECTOR VERIFICATION');
console.log('================================================================\n');

// -------------------------------------------------------------
// PART 1: STATIC AST & PRINT STYLESHEET AUDIT
// -------------------------------------------------------------
console.log('--- 1. STATIC AST & CSS AUDIT (BLACK / BLANK PAGE PREVENTION) ---');

const appJsx = fs.readFileSync(path.resolve('src/App.jsx'), 'utf-8');
const indexCss = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
const actionBarJsx = fs.readFileSync(path.resolve('src/components/invoice/InvoiceActionBar.jsx'), 'utf-8');

await it('1.1. CSS @media print forces #root, body, and .min-h-screen to white background', () => {
  assert(indexCss.includes('html, body, #root, #root > div, .min-h-screen'), 'Must target min-h-screen container');
  assert(indexCss.includes('background: #ffffff !important;'), 'Must set white background');
  assert(indexCss.includes('background-color: #ffffff !important;'), 'Must set white background-color');
});

await it('1.2. App.jsx always mounts a dedicated print-only container in editor view', () => {
  assert(appJsx.includes('print-only'), 'Must include print-only container');
  assert(appJsx.includes('<InvoicePreview'), 'Must render InvoicePreview in print container');
  assert(appJsx.includes('hidden print:block'), 'Print container must be hidden on screen and block in print');
});

await it('1.3. InvoiceActionBar Print button supports isPrinting state and spinner', () => {
  assert(actionBarJsx.includes('isPrinting'), 'Must accept isPrinting prop');
  assert(actionBarJsx.includes('Preparing Print...'), 'Must render loading message');
  assert(actionBarJsx.includes('disabled={isPrinting}'), 'Must disable button while printing');
});

// -------------------------------------------------------------
// PART 2: VECTOR PDF GENERATION FOR PRINT
// -------------------------------------------------------------
console.log('\n--- 2. VECTOR PDF GENERATION FOR PRINTING ---');

await it('2.1. Valid invoice produces a non-empty PDF with valid PDF magic bytes (%PDF)', async () => {
  const pdfDoc = await generateVectorPdf(baseInvoice, DEFAULT_BUSINESS, 'Original for Buyer');
  const buffer = Buffer.from(pdfDoc.output('arraybuffer'));
  assert(buffer.length > 20000, `PDF size must be substantial, got: ${buffer.length}`);
  const header = buffer.subarray(0, 5).toString('ascii');
  assert.strictEqual(header, '%PDF-', 'PDF must begin with valid magic bytes %PDF-');
});

await it('2.2. Generated PDF contains exact calculated net payable and amount in words', async () => {
  const totals = calculateInvoiceTotals(baseInvoice, '32');
  // Gross = 22,000 + 4,500 = 26,500. Discount = 500. Net = 26,000.
  assert.strictEqual(totals.netPayable, 26000);
  assert(totals.amountInWords.includes('Twenty Six Thousand'));

  const pdfDoc = await generateVectorPdf({ ...baseInvoice, netPayable: totals.netPayable }, DEFAULT_BUSINESS, 'Original for Buyer');
  assert(pdfDoc !== null);
});

await it('2.3. Dedicated printInvoicePdf function validates consistency and returns valid blob', async () => {
  const result = await printInvoicePdf(baseInvoice, DEFAULT_BUSINESS, 'Original for Buyer');
  assert(result.success === true, 'printInvoicePdf must succeed');
  assert(result.size > 20000, 'Returned print blob must have valid non-zero size');
});

// -------------------------------------------------------------
// PART 3: FINANCIAL CONSISTENCY IN PRINT OUTPUT
// -------------------------------------------------------------
console.log('\n--- 3. FINANCIAL CONSISTENCY IN PRINT OUTPUT ---');

await it('3.1. Print output matches screenshot values (₹13,800.00) without divergence', async () => {
  const reproInvoice = {
    ...baseInvoice,
    items: [
      {
        id: 'item-1',
        name: 'Amaron Current 150Ah Tall Tubular Battery',
        qty: 1,
        rate: 14800,
        isTaxInclusive: true,
        gstRate: 28,
        hsn: '8507',
      },
    ],
    scrapExchange: { enabled: true, amount: 1000 },
    additionalDiscount: 0,
    roundOffManual: null,
  };
  const totals = calculateInvoiceTotals(reproInvoice, '32');
  assert.strictEqual(totals.netPayable, 13800);

  const check = verifyInvoiceFinancialConsistency(reproInvoice, '32');
  assert.strictEqual(check.isValid, true);
  assert.strictEqual(check.authoritativeNetPayable, 13800);

  const upi = buildUpiUri(DEFAULT_BUSINESS.upiId, DEFAULT_BUSINESS.businessName, totals.netPayable, reproInvoice.invoiceNumber);
  assert(upi.includes('am=13800.00'), 'UPI URI must encode 13800.00');

  const printRes = await printInvoicePdf(reproInvoice, DEFAULT_BUSINESS, 'Original for Buyer');
  assert(printRes.success === true);
});

// -------------------------------------------------------------
// PART 4: EDGE CASES
// -------------------------------------------------------------
console.log('\n--- 4. PRINT EDGE CASES ---');

await it('4.1. Single-item invoice prints cleanly', async () => {
  const single = { ...baseInvoice, items: [baseInvoice.items[0]] };
  const res = await printInvoicePdf(single, DEFAULT_BUSINESS);
  assert(res.success === true);
});

await it('4.2. Long multi-item invoice spanning multiple items prints cleanly', async () => {
  const longItems = [];
  for (let i = 1; i <= 12; i++) {
    longItems.push({
      id: `item-${i}`,
      name: `Solar Battery Extra Heavy Duty Grade #${i}`,
      qty: i,
      rate: 12000,
      isTaxInclusive: true,
      gstRate: 28,
      hsn: '8507',
    });
  }
  const longInv = { ...baseInvoice, items: longItems };
  const res = await printInvoicePdf(longInv, DEFAULT_BUSINESS);
  assert(res.success === true);
});

await it('4.3. Service-only zero-value invoice prints without corruption', async () => {
  const zeroInv = {
    ...baseInvoice,
    items: [
      {
        id: 'svc-1',
        name: 'Complimentary Battery Inspection',
        category: 'services',
        qty: 1,
        rate: 0,
        isTaxInclusive: true,
        gstRate: 18,
      },
    ],
    scrapExchange: { enabled: false, amount: 0 },
    additionalDiscount: 0,
  };
  const res = await printInvoicePdf(zeroInv, DEFAULT_BUSINESS);
  assert(res.success === true);
});

await it('4.4. Refuses print and throws meaningful error on corrupted financial input', async () => {
  const corrupted = {
    ...baseInvoice,
    items: [{ name: 'Bad Item', rate: -999, qty: 1 }],
  };
  let errorCaught = null;
  try {
    await printInvoicePdf(corrupted, DEFAULT_BUSINESS);
  } catch (err) {
    errorCaught = err;
  }
  assert(errorCaught !== null, 'Must reject printing corrupted invoice');
  assert(errorCaught.message.includes('Cannot print invoice with invalid financial data'));
});

console.log('\n================================================================');
console.log(`TOTAL PRINT WORKFLOW TESTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

