// scratch/test_invoice_redesign.mjs
// Verification of TPS Battery House — New Invoice Screen Redesign (Simple New Bill – New Bill.html)

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  PRODUCT_CATEGORIES,
  TRANSACTION_TYPES,
} from '../src/utils/categories.js';
import {
  calculateInvoiceTotals,
  verifyInvoiceFinancialConsistency,
} from '../src/utils/gstCalculations.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(err);
  }
}

console.log('\n================================================================');
console.log('TPS BATTERY HOUSE — NEW INVOICE SCREEN REDESIGN TEST SUITE');
console.log('================================================================\n');

console.log('--- 1. DESIGN TOKENS & CSS SPECIFICATIONS ---');

const cssContent = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');

it('defines reference color tokens in index.css', () => {
  assert(cssContent.includes('#0F1216'), 'Canvas dark bg (#0F1216) must be defined');
  assert(cssContent.includes('#181C22'), 'Card container bg (#181C22) must be defined');
  assert(cssContent.includes('#12161B'), 'Item card bg (#12161B) must be defined');
  assert(cssContent.includes('#2A3039'), 'Card border (#2A3039) must be defined');
  assert(cssContent.includes('#7A7568'), 'Field border (#7A7568) must be defined');
  assert(cssContent.includes('#F2EFE9'), 'Text primary (#F2EFE9) must be defined');
  assert(cssContent.includes('#A8A294'), 'Text muted (#A8A294) must be defined');
  assert(cssContent.includes('#F2A516'), 'Accent amber (#F2A516) must be defined');
  assert(cssContent.includes('#FFC857'), 'Hero payable text (#FFC857) must be defined');
});

it('defines reusable invoice design utility classes', () => {
  assert(cssContent.includes('.inv-fld'), '.inv-fld input class must be defined');
  assert(cssContent.includes('.inv-pill'), '.inv-pill button class must be defined');
  assert(cssContent.includes('.inv-choice'), '.inv-choice selection card class must be defined');
  assert(cssContent.includes('.inv-chip'), '.inv-chip preset chip class must be defined');
  assert(cssContent.includes('.inv-step'), '.inv-step circle step indicator class must be defined');
  assert(cssContent.includes('.inv-link'), '.inv-link button class must be defined');
});

console.log('\n--- 2. COMPONENT ARCHITECTURE & NUMBERED SECTIONS ---');

const _invoiceFormCode = fs.readFileSync(path.resolve('src/components/InvoiceForm.jsx'), 'utf-8');
const customerSectionCode = fs.readFileSync(path.resolve('src/components/invoice/CustomerDetailsSection.jsx'), 'utf-8');
const itemsSectionCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceItemsSection.jsx'), 'utf-8');
const itemRowCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceItemRow.jsx'), 'utf-8');
const paymentSectionCode = fs.readFileSync(path.resolve('src/components/invoice/InvoicePaymentSection.jsx'), 'utf-8');
const metadataSectionCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceMetadataSection.jsx'), 'utf-8');
const summaryCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceSummary.jsx'), 'utf-8');
const headerCode = fs.readFileSync(path.resolve('src/components/invoice/InvoicePageHeader.jsx'), 'utf-8');

it('InvoicePageHeader displays New Bill title and bill number', () => {
  assert(headerCode.includes('New Bill'), 'Page title must be "New Bill"');
  assert(headerCode.includes('Bill number'), 'Header must display "Bill number"');
  assert(headerCode.includes('Clear everything'), 'Header must provide "Clear everything" button');
});

it('Section 1 implements "Who is buying?" with step 1 and B2C/B2B choices', () => {
  assert(customerSectionCode.includes('Who is buying?'), 'Section heading must be "Who is buying?"');
  assert(customerSectionCode.includes('inv-step'), 'Must render circle step 1');
  assert(customerSectionCode.includes('Regular customer (B2C)'), 'Must have B2C option');
  assert(customerSectionCode.includes('Business customer (B2B)'), 'Must have B2B option');
  assert(customerSectionCode.includes('Regular customer? Find them'), 'Must have customer finder field');
});

it('Section 2 implements "What are they buying?" with step 2 and card layout', () => {
  assert(itemsSectionCode.includes('What are they buying?'), 'Section heading must be "What are they buying?"');
  assert(itemsSectionCode.includes('inv-step'), 'Must render circle step 2');
  assert(itemsSectionCode.includes('Tap to add an item'), 'Must have "Tap to add an item" preset area');
  assert(itemsSectionCode.includes('See all items'), 'Must provide "See all items" catalog link');
});

it('InvoiceItemRow implements stepper (−/+) and price each inputs', () => {
  assert(itemRowCode.includes('aria-label="One less"'), 'Must have minus button');
  assert(itemRowCode.includes('aria-label="One more"'), 'Must have plus button');
  assert(itemRowCode.includes('Price each ₹'), 'Must have "Price each ₹" label');
  assert(itemRowCode.includes('Remove'), 'Must have Remove link');
});

it('Section 2 provides toggles for discount and old battery exchange', () => {
  assert(itemsSectionCode.includes('+ Give a discount'), 'Must have discount toggle');
  assert(itemsSectionCode.includes('Discount to give (₹)'), 'Must support discount input');
  assert(itemsSectionCode.includes('+ Customer is giving an old battery'), 'Must have scrap exchange toggle');
  assert(itemsSectionCode.includes('Old battery value (₹)'), 'Must support scrap amount input');
});

it('Section 3 implements "How is the customer paying?" with step 3 and mode pills', () => {
  assert(paymentSectionCode.includes('How is the customer paying?'), 'Section heading must be "How is the customer paying?"');
  assert(paymentSectionCode.includes('Paid now'), 'Must have "Paid now" choice card');
  assert(paymentSectionCode.includes('Pay later'), 'Must have "Pay later" choice card');
  assert(paymentSectionCode.includes('Cash') && paymentSectionCode.includes('UPI'), 'Must include Cash and UPI modes');
  assert(paymentSectionCode.includes('Message for the customer'), 'Must have customer note field');
});

it('Collapsible Extra details section handles order number, delivery, e-way bill, staff notes', () => {
  assert(metadataSectionCode.includes('Extra details (not needed for most bills)'), 'Must have extra details accordion');
  assert(metadataSectionCode.includes('Customer\'s order number'), 'Must have PO number field');
  assert(metadataSectionCode.includes('Delivery address'), 'Must have shipping address field');
  assert(metadataSectionCode.includes('E-way bill number'), 'Must have e-way bill field');
  assert(metadataSectionCode.includes('Private note for your staff'), 'Must have staff private note field');
});

it('Sticky Bill total sidebar displays customer overview, breakdown, hero net payable, and actions', () => {
  assert(summaryCode.includes('Bill total'), 'Sidebar title must be "Bill total"');
  assert(summaryCode.includes('Customer pays'), 'Hero box must say "Customer pays"');
  assert(summaryCode.includes('Save & Print Bill'), 'Hero action must be "Save & Print Bill"');
  assert(summaryCode.includes('Send on WhatsApp'), 'Must have WhatsApp share button');
  assert(summaryCode.includes('Save for later'), 'Must have "Save for later" draft option');
});

console.log('\n--- 3. AUTHORITATIVE GST & FINANCIAL LOGIC PRESERVATION ---');

it('Computes multi-item invoice accurately matching reference bill', () => {
  const invoice = {
    customer: {
      name: 'Green Valley Agro Farm',
      phone: '9847334455',
      address: 'Kudallur, Anakkara Road',
      stateCode: '32',
    },
    transactionType: TRANSACTION_TYPES.B2C,
    additionalDiscount: 500,
    scrapExchange: { enabled: false, amount: 0 },
    items: [
      {
        id: 'item-1',
        name: 'Fuze 1100 Inverter + 150 Ah Tubular Battery Combo',
        category: PRODUCT_CATEGORIES.INVERTER,
        qty: 1,
        rate: 22000,
        isTaxInclusive: true,
        gstRate: 28,
      },
      {
        id: 'item-2',
        name: 'Solar Panel Charge Controller & High-Grade Terminal Kit',
        category: PRODUCT_CATEGORIES.SOLAR,
        qty: 1,
        rate: 4500,
        isTaxInclusive: true,
        gstRate: 18,
      },
    ],
  };

  const totals = calculateInvoiceTotals(invoice, '32');
  assert.strictEqual(totals.totalGross, 26500, 'Gross items subtotal must be 26500.00');
  assert.strictEqual(totals.extraDiscount, 500, 'Additional discount must be 500.00');
  assert.strictEqual(totals.netPayable, 26000, 'Net payable must equal exactly 26000.00');
  assert.strictEqual(totals.isInterstate, false, 'Kerala to Kerala must be intrastate');
  assert(totals.totalCgst > 0 && totals.totalSgst > 0, 'Intrastate must split CGST and SGST equally');
  assert.strictEqual(totals.totalCgst, totals.totalSgst, 'CGST must equal SGST');
  assert.strictEqual(totals.totalTax, totals.totalCgst + totals.totalSgst, 'Total GST must equal CGST + SGST');

  const consistency = verifyInvoiceFinancialConsistency(invoice, totals, '32');
  assert.strictEqual(consistency.isValid, true, 'Invoice totals must satisfy consistency audit');
});

it('Handles old battery exchange deduction correctly', () => {
  const invoice = {
    customer: { stateCode: '32' },
    transactionType: TRANSACTION_TYPES.B2C,
    additionalDiscount: 0,
    scrapExchange: { enabled: true, amount: 2000 },
    items: [
      {
        id: 'bat-1',
        name: 'Exide InvaMaster 150Ah',
        category: PRODUCT_CATEGORIES.BATTERY,
        qty: 1,
        rate: 14800,
        isTaxInclusive: true,
        gstRate: 28,
      },
    ],
  };

  const totals = calculateInvoiceTotals(invoice, '32');
  assert.strictEqual(totals.totalGross, 14800, 'Gross must be 14800');
  assert.strictEqual(totals.scrapDiscount, 2000, 'Scrap deduction must be 2000');
  assert.strictEqual(totals.netPayable, 12800, 'Net payable must be 14800 - 2000 = 12800');
});

it('Handles interstate transactions with IGST routing', () => {
  const invoice = {
    customer: {
      name: 'Coimbatore Spares',
      stateCode: '33', // Tamil Nadu
    },
    transactionType: TRANSACTION_TYPES.B2B,
    additionalDiscount: 0,
    items: [
      {
        id: 'inv-1',
        name: 'Solar Inverter 5kVA',
        category: PRODUCT_CATEGORIES.INVERTER,
        qty: 1,
        rate: 50000,
        isTaxInclusive: true,
        gstRate: 18,
      },
    ],
  };

  const totals = calculateInvoiceTotals(invoice, '32'); // Kerala business
  assert.strictEqual(totals.isInterstate, true, 'Interstate flag must be true');
  assert.strictEqual(totals.totalCgst, 0, 'CGST must be zero for interstate');
  assert.strictEqual(totals.totalSgst, 0, 'SGST must be zero for interstate');
  assert(totals.totalIgst > 0, 'IGST must be computed for interstate');
  assert.strictEqual(totals.netPayable, 50000, 'Inclusive rate net payable must be 50000');
});

console.log(`\n================================================================`);
console.log(`REDESIGN TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
