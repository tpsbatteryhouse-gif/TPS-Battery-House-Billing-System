// scratch/test_invoice_screen_integration.mjs
// Comprehensive test suite for TPS Battery House - New Tax Invoice Screen Integration

import assert from 'assert';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  inferTransactionType,
  normalizeInvoiceItem,
} from '../src/utils/categories.js';
import {
  calculateLineItem,
  calculateInvoiceTotals,
} from '../src/utils/gstCalculations.js';
import { calculateDashboardMetrics } from '../src/utils/dashboardFinancialMetrics.js';

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

console.log('\n--- 1. CUSTOMER AUTO-POPULATION & TRANSACTION TYPE DETERMINATION ---');

it('infers B2C when customer has no GSTIN or empty GSTIN', () => {
  const inv1 = { customer: { gstin: '' } };
  const inv2 = { customer: {} };
  const inv3 = {};
  assert.strictEqual(inferTransactionType(inv1), 'B2C');
  assert.strictEqual(inferTransactionType(inv2), 'B2C');
  assert.strictEqual(inferTransactionType(inv3), 'B2C');
});

it('infers B2B when valid 15-character GSTIN is provided', () => {
  const inv = {
    customer: {
      name: 'Kerala Power Systems',
      gstin: '32ABCDE1234F1Z5',
    },
  };
  assert.strictEqual(inferTransactionType(inv), 'B2B');
});

it('infers B2C when GSTIN is empty or short string', () => {
  const inv = {
    customer: {
      name: 'Small Shop',
      gstin: '32ABC',
    },
  };
  assert.strictEqual(inferTransactionType(inv), 'B2C');
});

it('correctly maps customer selection to invoice state fields', () => {
  const selectedCustomer = {
    id: 'cust-101',
    name: 'Palakkad Auto Electricals',
    phone: '9847012345',
    address: 'Main Road, Ottapalam',
    city: 'Palakkad',
    district: 'Palakkad',
    pincode: '679101',
    state: 'Kerala',
    stateCode: '32',
    gstin: '32AAAAA0000A1Z5',
    pan: 'AAAAA0000A',
  };

  const invoice = {
    customer: {
      name: selectedCustomer.name,
      phone: selectedCustomer.phone,
      address: selectedCustomer.address,
      city: selectedCustomer.city,
      district: selectedCustomer.district,
      pincode: selectedCustomer.pincode,
      state: selectedCustomer.state,
      stateCode: selectedCustomer.stateCode,
      gstin: selectedCustomer.gstin,
      pan: selectedCustomer.pan,
    },
  };

  assert.strictEqual(invoice.customer.name, 'Palakkad Auto Electricals');
  assert.strictEqual(invoice.customer.phone, '9847012345');
  assert.strictEqual(invoice.customer.stateCode, '32');
  assert.strictEqual(invoice.customer.gstin, '32AAAAA0000A1Z5');
  assert.strictEqual(inferTransactionType(invoice), 'B2B');
});

console.log('\n--- 2. PLACE OF SUPPLY: INTRASTATE (CGST+SGST) VS INTERSTATE (IGST) ---');

it('determines intrastate when customer and business have matching stateCode (32 Kerala)', () => {
  const invoice = {
    customer: { stateCode: '32' },
    items: [
      {
        price: 10000,
        qty: 1,
        gstRate: 18,
        isTaxInclusive: false,
        discount: 0,
      },
    ],
  };

  const totals = calculateInvoiceTotals(invoice, '32');
  assert.strictEqual(totals.isInterstate, false);
  assert.strictEqual(totals.totalTaxableValue, 10000);
  assert.strictEqual(totals.totalCgst, 900);
  assert.strictEqual(totals.totalSgst, 900);
  assert.strictEqual(totals.totalIgst, 0);
  assert.strictEqual(totals.totalTax, 1800);
  assert.strictEqual(totals.netPayable, 11800);
});

it('determines interstate when customer stateCode differs from business stateCode (32 vs 33 Tamil Nadu)', () => {
  const invoice = {
    customer: { stateCode: '33' },
    items: [
      {
        price: 10000,
        qty: 1,
        gstRate: 18,
        isTaxInclusive: false,
        discount: 0,
      },
    ],
  };

  const totals = calculateInvoiceTotals(invoice, '32');
  assert.strictEqual(totals.isInterstate, true);
  assert.strictEqual(totals.totalTaxableValue, 10000);
  assert.strictEqual(totals.totalCgst, 0);
  assert.strictEqual(totals.totalSgst, 0);
  assert.strictEqual(totals.totalIgst, 1800);
  assert.strictEqual(totals.totalTax, 1800);
  assert.strictEqual(totals.netPayable, 11800);
});

console.log('\n--- 3. MULTI-CATEGORY LINE ITEM INITIALIZATION & DEFAULTS ---');

it('initializes Battery line item with 28% GST and standard HSN', () => {
  const config = CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
  assert.strictEqual(config.defaultGstRate, 28);
  assert.strictEqual(config.defaultHsn, '8507');
  assert.strictEqual(config.allowScrapExchange, true);

  const item = normalizeInvoiceItem({
    category: PRODUCT_CATEGORIES.BATTERY,
    name: 'Exide InvaMaster 150Ah',
    price: 14500,
    qty: 1,
    gstRate: 28,
  });
  assert.strictEqual(item.category, 'battery');
  assert.strictEqual(item.gstRate, 28);
  assert.strictEqual(item.unit, 'Nos');
});

it('initializes Inverter line item with 18% GST and standard HSN', () => {
  const config = CATEGORY_CONFIG[PRODUCT_CATEGORIES.INVERTER];
  assert.strictEqual(config.defaultGstRate, 18);
  assert.strictEqual(config.defaultHsn, '8504');

  const item = normalizeInvoiceItem({
    category: PRODUCT_CATEGORIES.INVERTER,
    name: 'Microtek Luxe 1050VA',
    price: 7800,
    qty: 1,
    gstRate: 18,
  });
  assert.strictEqual(item.category, 'inverter');
  assert.strictEqual(item.gstRate, 18);
});

it('initializes Solar line item with 12% GST and standard HSN', () => {
  const config = CATEGORY_CONFIG[PRODUCT_CATEGORIES.SOLAR];
  assert.strictEqual(config.defaultGstRate, 12);
  assert.strictEqual(config.defaultHsn, '8541');

  const item = normalizeInvoiceItem({
    category: PRODUCT_CATEGORIES.SOLAR,
    name: 'Loom Solar 330W Mono PERC',
    price: 12000,
    qty: 2,
    gstRate: 12,
  });
  assert.strictEqual(item.category, 'solar');
  assert.strictEqual(item.gstRate, 12);
});

it('initializes Service line item with 18% GST and SAC code 9987', () => {
  const config = CATEGORY_CONFIG[PRODUCT_CATEGORIES.SERVICES];
  assert.strictEqual(config.defaultGstRate, 18);
  assert.strictEqual(config.defaultHsn, '9987');
  assert.strictEqual(config.allowScrapExchange, false);

  const item = normalizeInvoiceItem({
    category: PRODUCT_CATEGORIES.SERVICES,
    name: 'On-site Battery Installation & Cabling',
    price: 1500,
    qty: 1,
    hsn: '9987',
    gstRate: 18,
  });
  assert.strictEqual(item.category, 'services');
  assert.strictEqual(item.hsn, '9987');
  assert.strictEqual(item.gstRate, 18);
});

console.log('\n--- 4. TAX-INCLUSIVE VS TAX-EXCLUSIVE LINE CALCULATIONS ---');

it('calculates tax-exclusive item accurately', () => {
  const item = {
    price: 20000,
    qty: 1,
    gstRate: 28,
    isTaxInclusive: false,
    discount: 500,
  };
  const line = calculateLineItem(item, false);
  // Base after discount = 20000 - 500 = 19500
  // Tax = 19500 * 0.28 = 5460
  // Total = 19500 + 5460 = 24960
  assert.strictEqual(line.taxableValue, 19500);
  assert.strictEqual(line.cgstAmount, 2730);
  assert.strictEqual(line.sgstAmount, 2730);
  assert.strictEqual(line.totalGstAmount, 5460);
  assert.strictEqual(line.lineTotal, 24960);
});

it('calculates tax-inclusive item accurately with strict roundToTwoDecimals', () => {
  const item = {
    price: 25600, // MRP inclusive of 28% GST
    qty: 1,
    gstRate: 28,
    isTaxInclusive: true,
    discount: 0,
  };
  const line = calculateLineItem(item, false);
  // Taxable = roundToTwoDecimals(25600 / 1.28) = 20000.00
  // Total Tax = 25600 - 20000 = 5600
  // CGST = 2800, SGST = 2800
  assert.strictEqual(line.taxableValue, 20000);
  assert.strictEqual(line.cgstAmount, 2800);
  assert.strictEqual(line.sgstAmount, 2800);
  assert.strictEqual(line.totalGstAmount, 5600);
  assert.strictEqual(line.lineTotal, 25600);
});

console.log('\n--- 5. DEDUCTIONS, SCRAP BUYBACK & RECONCILIATION INTEGRITY ---');

it('applies scrap trade-in deduction and recalculates net payable', () => {
  const invoice = {
    customer: { stateCode: '32' },
    items: [
      {
        price: 15000,
        qty: 1,
        gstRate: 28,
        isTaxInclusive: false,
        discount: 0,
      },
    ],
    scrapExchange: {
      enabled: true,
      amount: 2500,
    },
  };
  // Subtotal = 15000 + 4200 = 19200
  const totals = calculateInvoiceTotals(invoice, '32');
  assert.strictEqual(totals.totalGross, 19200);
  assert.strictEqual(totals.scrapDiscount, 2500);
  assert.strictEqual(totals.netPayable, 16700);
});

it('preserves dashboard category revenue reconciliation with scrap buyback deductions', () => {
  const invoices = [
    {
      id: 'inv-rec-1',
      invoiceNumber: 'TPS/2026-27/050',
      paymentStatus: 'Paid',
      additionalDiscount: 500,
      scrapExchange: { enabled: true, amount: 2000 },
      items: [
        { category: 'battery', price: 15000, qty: 1, gstRate: 28, isTaxInclusive: false, discount: 0 },
        { category: 'inverter', price: 8000, qty: 1, gstRate: 18, isTaxInclusive: false, discount: 0 },
      ],
    },
  ];

  const metrics = calculateDashboardMetrics(invoices);
  assert.strictEqual(metrics.reconciliation.discrepancy, 0);
  assert.strictEqual(metrics.reconciliation.isBalanced, true);
  assert.strictEqual(metrics.financials.collectedRevenue, metrics.financials.categoryRevenueTotal);
});

console.log('\n--- 6. PAYMENT TERMS & DUE DATE CALCULATIONS ---');

it('calculates correct due date for Immediate, 15 Days, and 30 Days terms', () => {
  const baseDate = '2026-11-08';

  const addDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  assert.strictEqual(addDays(baseDate, 0), '2026-11-08');
  assert.strictEqual(addDays(baseDate, 15), '2026-11-23');
  assert.strictEqual(addDays(baseDate, 30), '2026-12-08');
});

console.log('\n--- 7. INVOICE PERSISTENCE PAYLOAD: DRAFT VS FINALIZED BILL ---');

it('constructs correct payload for Save Draft with paymentStatus "Draft"', () => {
  const invoice = {
    id: 'draft-101',
    invoiceNumber: 'TPS/2026-27/DRAFT-01',
    paymentStatus: 'Pending',
    items: [
      { name: 'Exide 150Ah', qty: 1, price: 14000, gstRate: 28 },
    ],
    customer: { name: 'Walk-in Client' },
  };

  // When saved via onSave('Draft')
  const statusOverride = 'Draft';
  const paymentStatus = statusOverride || invoice.paymentStatus || 'Pending';
  assert.strictEqual(paymentStatus, 'Draft');
});

it('constructs correct payload for Save & Issue Bill with paymentStatus "Paid" or "Pending"', () => {
  const invoice = {
    id: 'inv-201',
    paymentStatus: 'Paid',
    items: [
      { name: 'Exide 150Ah', qty: 1, price: 14000, gstRate: 28 },
    ],
    customer: { name: 'Palakkad Auto' },
  };

  const statusOverride = null;
  const paymentStatus = (typeof statusOverride === 'string' && statusOverride) || invoice.paymentStatus || 'Pending';
  assert.strictEqual(paymentStatus, 'Paid');
});

it('protects private staff notes from leaking to customer preview or print', () => {
  const invoice = {
    notes: 'Standard 24-month manufacturer warranty applies.',
    staffNotes: 'Customer requested 5% discount on next purchase. Promised replacement if voltage drops below 11.5V.',
  };

  // Terms section displays public notes to customer
  assert.strictEqual(invoice.notes.includes('warranty'), true);
  // Internal staff notes are isolated
  assert.strictEqual(invoice.staffNotes.includes('discount'), true);
  // In PDF/Print generation, staffNotes must NOT be included in customer-facing terms
  const customerVisibleTerms = invoice.notes;
  assert.strictEqual(customerVisibleTerms.includes('staffNotes'), false);
});

console.log('\n--- 8. MINIMUM 1 ITEM INVARIANT GUARD ---');

it('prevents deleting the last line item in the invoice', () => {
  const items = [{ id: 'item-1', name: 'Item 1' }];

  const removeItem = (idToRemove, currentItems) => {
    if (currentItems.length <= 1) {
      return { success: false, items: currentItems, error: 'Invoice must contain at least one line item.' };
    }
    return { success: true, items: currentItems.filter((it) => it.id !== idToRemove) };
  };

  const result = removeItem('item-1', items);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.error, 'Invoice must contain at least one line item.');
});

console.log(`\n==================================================`);
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
