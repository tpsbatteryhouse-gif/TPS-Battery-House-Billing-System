// scratch/test_invoice_layout_responsive.mjs
// Verification of responsive layout, unified 2-column sidebar grid, card-based items, and overflow prevention

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { calculateInvoiceTotals } from '../src/utils/gstCalculations.js';

let passed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('Testing Invoice Screen Redesign Responsive Layout & Card Structure...');

// 1. Inspect InvoiceForm.jsx
const invoiceFormCode = fs.readFileSync(path.resolve('src/components/InvoiceForm.jsx'), 'utf-8');

it('InvoiceForm uses responsive 12-column layout with left form and right sticky sidebar', () => {
  assert(
    invoiceFormCode.includes('grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'),
    'Expected 12-column grid container matching reference design'
  );
  assert(
    invoiceFormCode.includes('lg:col-span-7') && invoiceFormCode.includes('CustomerDetailsSection'),
    'Expected left panel to contain CustomerDetailsSection with lg:col-span-7'
  );
  assert(
    invoiceFormCode.includes('lg:col-span-5') && invoiceFormCode.includes('InvoiceSummary'),
    'Expected right sidebar to contain InvoiceSummary with lg:col-span-5'
  );
  assert(
    invoiceFormCode.includes('sticky top-6'),
    'Expected InvoiceSummary container to have sticky positioning'
  );
});

// 2. Inspect CustomerDetailsSection.jsx
const customerCode = fs.readFileSync(path.resolve('src/components/invoice/CustomerDetailsSection.jsx'), 'utf-8');

it('CustomerDetailsSection implements Section 1 with circle step, B2C/B2B choices, and autocomplete', () => {
  assert(customerCode.includes('inv-step'), 'Expected .inv-step circle icon');
  assert(customerCode.includes('Who is buying?'), 'Expected "Who is buying?" heading');
  assert(customerCode.includes('Regular customer (B2C)'), 'Expected B2C choice');
  assert(customerCode.includes('Business customer (B2B)'), 'Expected B2B choice');
  assert(customerCode.includes('inv-choice'), 'Expected .inv-choice styling classes');
  assert(customerCode.includes('min-w-0'), 'Expected min-w-0 on input containers to prevent blowout');
});

// 3. Inspect InvoiceItemsSection.jsx & InvoiceItemRow.jsx
const itemsSectionCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceItemsSection.jsx'), 'utf-8');
const itemRowCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceItemRow.jsx'), 'utf-8');

it('InvoiceItemsSection implements Section 2 with card layout, stepper, price, line total, and toggles', () => {
  assert(itemsSectionCode.includes('What are they buying?'), 'Expected "What are they buying?" heading');
  assert(itemsSectionCode.includes('Tap to add an item'), 'Expected quick item addition prompt');
  assert(itemsSectionCode.includes('inv-chip'), 'Expected .inv-chip fast add presets');
  assert(itemsSectionCode.includes('+ Give a discount'), 'Expected discount toggle button');
  assert(itemsSectionCode.includes('+ Customer is giving an old battery'), 'Expected scrap exchange toggle');
});

it('InvoiceItemRow implements stepper controls and price input', () => {
  assert(itemRowCode.includes('aria-label="One less"'), 'Expected decrement button');
  assert(itemRowCode.includes('aria-label="One more"'), 'Expected increment button');
  assert(itemRowCode.includes('Price each ₹'), 'Expected "Price each ₹" label');
  assert(itemRowCode.includes('inv-link') && itemRowCode.includes('Remove'), 'Expected Remove link');
});

// 4. Inspect InvoicePaymentSection.jsx
const paymentCode = fs.readFileSync(path.resolve('src/components/invoice/InvoicePaymentSection.jsx'), 'utf-8');

it('InvoicePaymentSection implements Section 3 with Paid now/Pay later and mode pills', () => {
  assert(paymentCode.includes('How is the customer paying?'), 'Expected Section 3 heading');
  assert(paymentCode.includes('Paid now'), 'Expected Paid now choice');
  assert(paymentCode.includes('Pay later'), 'Expected Pay later choice');
  assert(paymentCode.includes('inv-pill'), 'Expected payment method pills');
  assert(paymentCode.includes('Message for the customer'), 'Expected customer note textarea');
});

// 5. Inspect InvoiceMetadataSection.jsx
const metadataCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceMetadataSection.jsx'), 'utf-8');

it('InvoiceMetadataSection implements collapsible extra details accordion', () => {
  assert(
    metadataCode.includes('Extra details (not needed for most bills)'),
    'Expected collapsible extra details heading'
  );
  assert(
    metadataCode.includes('Customer\'s order number'),
    'Expected PO / order number field'
  );
  assert(
    metadataCode.includes('Delivery address'),
    'Expected Delivery address field'
  );
  assert(
    metadataCode.includes('Private note for your staff'),
    'Expected staff internal note field'
  );
});

// 6. Inspect InvoiceSummary.jsx
const summaryCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceSummary.jsx'), 'utf-8');

it('InvoiceSummary renders sticky Bill total sidebar with hero payable box and actions', () => {
  assert(summaryCode.includes('aside aria-label="Bill total"') || summaryCode.includes('aria-label="Bill total"'), 'Expected Bill total aside tag');
  assert(summaryCode.includes('Customer pays'), 'Expected "Customer pays" hero label');
  assert(summaryCode.includes('Save & Print Bill'), 'Expected Save & Print Bill button');
  assert(summaryCode.includes('Send on WhatsApp'), 'Expected Send on WhatsApp button');
  assert(summaryCode.includes('whitespace-nowrap'), 'Expected whitespace-nowrap on monetary numbers');
  assert(summaryCode.includes('break-words'), 'Expected break-words on amount in words');
});

// 7. Verify GST calculation accuracy is untouched
it('Authoritative GST calculations remain numerically exact', () => {
  const mockInvoice = {
    customer: { stateCode: '32' },
    additionalDiscount: 500,
    scrapExchange: { enabled: true, amount: 0 },
    items: [
      {
        id: '1',
        name: 'Fuze 1100 Inverter Combo',
        category: 'inverter',
        qty: 1,
        rate: 22000,
        isTaxInclusive: true,
        gstRate: 28,
      },
      {
        id: '2',
        name: 'Solar Panel Controller',
        category: 'solar',
        qty: 1,
        rate: 4500,
        isTaxInclusive: true,
        gstRate: 18,
      },
    ],
  };

  const totals = calculateInvoiceTotals(mockInvoice, '32');
  assert.strictEqual(totals.totalGross, 26500, 'Gross must equal 26500');
  assert.strictEqual(totals.netPayable, 26000, 'Net payable must equal 26000');
  assert.strictEqual(totals.extraDiscount, 500, 'Discount must equal 500');
  assert.strictEqual(totals.isInterstate, false, 'Must be intrastate');
  assert(totals.totalTax > 0, 'Total tax must be > 0');
});

console.log(`\nAll ${passed} layout responsive assertions PASSED.`);
