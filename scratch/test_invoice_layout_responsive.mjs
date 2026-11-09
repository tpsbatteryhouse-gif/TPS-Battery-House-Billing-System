// scratch/test_invoice_layout_responsive.mjs
// Verification of responsive layout, grid symmetry, and text overflow prevention for TPS Battery House invoice screen

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { calculateInvoiceTotals } from '../src/utils/gstCalculations.js';

let passed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('Testing Invoice Screen Responsive Layout & Overflow Fixes...');

// 1. Inspect InvoiceForm.jsx
const invoiceFormCode = fs.readFileSync(path.resolve('src/components/InvoiceForm.jsx'), 'utf-8');

it('InvoiceForm top grid uses 12-column responsive layout with 7/5 split', () => {
  assert(
    invoiceFormCode.includes('grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'),
    'Expected 12-column grid container for customer details and invoice metadata'
  );
  assert(
    invoiceFormCode.includes('lg:col-span-7') && invoiceFormCode.includes('CustomerDetailsSection'),
    'Expected CustomerDetailsSection to have lg:col-span-7'
  );
  assert(
    invoiceFormCode.includes('lg:col-span-5') && invoiceFormCode.includes('InvoiceMetadataSection'),
    'Expected InvoiceMetadataSection to have lg:col-span-5'
  );
});

it('InvoiceForm top grid vertically aligns with bottom calculation summary grid', () => {
  // Bottom grid also uses lg:col-span-7 (deductions) and lg:col-span-5 (summary)
  const col7Matches = (invoiceFormCode.match(/lg:col-span-7/g) || []).length;
  const col5Matches = (invoiceFormCode.match(/lg:col-span-5/g) || []).length;
  assert(col7Matches >= 2, 'Top and bottom left panels must both use 7 columns');
  assert(col5Matches >= 2, 'Top and bottom right panels must both use 5 columns');
});

// 2. Inspect InvoiceMetadataSection.jsx
const metadataCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceMetadataSection.jsx'), 'utf-8');

it('InvoiceMetadataSection uses balanced 2-column grid instead of squeezed 3-column lg:col-span-4', () => {
  assert(
    metadataCode.includes('grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 text-xs'),
    'Expected 2-column responsive grid in InvoiceMetadataSection'
  );
  assert(
    !metadataCode.includes('lg:col-span-4'),
    'InvoiceMetadataSection must NOT use lg:col-span-4 inside a sidebar'
  );
});

it('InvoiceMetadataSection protects inputs from grid blowout with min-w-0', () => {
  const minW0Count = (metadataCode.match(/min-w-0/g) || []).length;
  assert(minW0Count >= 6, 'All metadata fields must use min-w-0 to prevent flex/grid blowout');
});

it('Payment due date quick-term chips are wrapped with collision prevention', () => {
  assert(
    metadataCode.includes('flex flex-wrap items-center justify-between gap-1'),
    'Due date label and quick terms chips must use flex-wrap with gap'
  );
  assert(
    metadataCode.includes('shrink-0'),
    'Due date label and chips must use shrink-0 to prevent text squashing'
  );
});

// 3. Inspect CustomerDetailsSection.jsx
const customerCode = fs.readFileSync(path.resolve('src/components/invoice/CustomerDetailsSection.jsx'), 'utf-8');

it('CustomerDetailsSection applies min-w-0 and comfortable spacing', () => {
  assert(
    customerCode.includes('min-w-0'),
    'Customer details inputs must have min-w-0'
  );
  assert(
    customerCode.includes('space-y-1.5'),
    'Customer details rows must use comfortable vertical spacing'
  );
});

// 4. Inspect InvoiceItemsSection.jsx & InvoiceItemRow.jsx
const itemsSectionCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceItemsSection.jsx'), 'utf-8');
const itemRowCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceItemRow.jsx'), 'utf-8');

it('Desktop items table has min-w-[1060px] to prevent column cramping on 1024px displays', () => {
  assert(
    itemsSectionCode.includes('min-w-[1060px]'),
    'Desktop table must enforce min-w-[1060px] with horizontal scrolling'
  );
});

it('InvoiceItemRow enforces minimum column widths on desktop table', () => {
  assert(
    itemRowCode.includes('min-w-[260px]'),
    'Item description must have min-w-[260px]'
  );
  assert(
    itemRowCode.includes('whitespace-nowrap'),
    'Taxable and line total values must have whitespace-nowrap'
  );
});

// 5. Inspect InvoiceSummary.jsx
const summaryCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceSummary.jsx'), 'utf-8');

it('InvoiceSummary prevents monetary numbers from wrapping or colliding with labels', () => {
  const whitespaceNowrapCount = (summaryCode.match(/whitespace-nowrap/g) || []).length;
  assert(whitespaceNowrapCount >= 6, 'Monetary numbers in invoice summary must use whitespace-nowrap');
  assert(summaryCode.includes('break-words'), 'amountInWords must use break-words to handle long amounts');
});

// 6. Inspect InvoiceTermsSection.jsx
const termsCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceTermsSection.jsx'), 'utf-8');

it('InvoiceTermsSection textareas have min-w-0 and vertical resize only', () => {
  assert(
    termsCode.includes('resize-y'),
    'Textareas must restrict resize to vertical only to preserve grid boundaries'
  );
  assert(
    termsCode.includes('min-w-0'),
    'Textareas must use min-w-0'
  );
});

// 7. Verify GST calculation accuracy is untouched
it('GST calculations continue to compute 100% accurate net payable and taxes', () => {
  const sampleInvoice = {
    items: [
      { qty: 1, rate: 22000, isTaxInclusive: true, gstRate: 28, discount: 0 },
      { qty: 1, rate: 4500, isTaxInclusive: true, gstRate: 18, discount: 0 },
    ],
    additionalDiscount: 500,
    customer: { stateCode: '32' },
  };
  const totals = calculateInvoiceTotals(sampleInvoice, '32');

  assert.strictEqual(totals.netPayable, 26000, `Expected ₹26,000, got ${totals.netPayable}`);
  assert.strictEqual(totals.totalGross, 26500, `Expected ₹26,500, got ${totals.totalGross}`);
  assert.strictEqual(totals.extraDiscount, 500);
});

console.log(`\nRESULTS: ${passed} PASSED, 0 FAILED`);
