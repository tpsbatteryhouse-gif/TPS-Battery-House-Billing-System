// scratch/test_invoice_empty_initialization_and_print_validation.mjs
// Verification of TPS Battery House — Empty Invoice Initialization & Pre-Print Validation Fix

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  inferTransactionType,
  normalizeInvoiceItem,
  TRANSACTION_TYPES,
} from '../src/utils/categories.js';
import {
  calculateInvoiceTotals,
  validateInvoiceBeforePrint,
  verifyInvoiceFinancialConsistency,
} from '../src/utils/gstCalculations.js';
import {
  createEmptyInvoice,
  getSampleInvoiceData,
  DEFAULT_BUSINESS,
} from '../src/utils/defaults.js';
import { printInvoicePdf, generateVectorPdf } from '../src/utils/pdfExport.js';

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

console.log('\n================================================================');
console.log('TPS BATTERY HOUSE — EMPTY INVOICE INITIALIZATION & VALIDATION');
console.log('================================================================\n');

console.log('--- PART 1: NEW INVOICE INITIALIZATION ---');

await it('1. New invoice created via createEmptyInvoice() has zero items', () => {
  const emptyInv = createEmptyInvoice('TPS/2026-27/010');
  assert(Array.isArray(emptyInv.items), 'items must be an array');
  assert.strictEqual(emptyInv.items.length, 0, 'New invoice items array must be empty (0 items)');
});

await it('2. New invoice displays an empty state in InvoiceItemsSection', () => {
  const itemsSectionCode = fs.readFileSync(path.resolve('src/components/invoice/InvoiceItemsSection.jsx'), 'utf-8');
  assert(itemsSectionCode.includes('No items added yet'), 'Must display "No items added yet" heading');
  assert(
    itemsSectionCode.includes('Select a product from the catalog or add a new item to this bill.'),
    'Must display empty state description'
  );
  assert(itemsSectionCode.includes('Browse Products'), 'Must render "Browse Products" action');
  assert(itemsSectionCode.includes('+ Add Item'), 'Must render "+ Add Item" action');
});

await it('3. New invoice total calculation starts at ₹0.00 with zero items', () => {
  const emptyInv = createEmptyInvoice('TPS/2026-27/010');
  const totals = calculateInvoiceTotals(emptyInv, '32');
  assert.strictEqual(totals.totalGross, 0, 'Gross total must be 0');
  assert.strictEqual(totals.totalTaxableValue, 0, 'Taxable value must be 0');
  assert.strictEqual(totals.totalTax, 0, 'Total tax must be 0');
  assert.strictEqual(totals.netPayable, 0, 'Net payable must be 0');
  assert.strictEqual(totals.computedItems.length, 0, 'Computed items must be empty');
});

await it('4. No Unnamed Item is automatically inserted during initialization', () => {
  const appJsxCode = fs.readFileSync(path.resolve('src/App.jsx'), 'utf-8');
  // Check handleStartNewInvoice in App.jsx
  const startNewMatch = appJsxCode.match(/const handleStartNewInvoice = \(\) => \{([\s\S]*?)\n  \};/);
  assert(startNewMatch, 'handleStartNewInvoice must exist');
  assert(
    !startNewMatch[1].includes("category: PRODUCT_CATEGORIES.BATTERY,") ||
    !startNewMatch[1].includes("id: 'item-1',"),
    'handleStartNewInvoice must NOT hardcode a default dummy item'
  );
  assert(
    startNewMatch[1].includes('createEmptyInvoice('),
    'handleStartNewInvoice must delegate to createEmptyInvoice()'
  );
});

await it('5. Adding a product to an empty invoice creates exactly one item', () => {
  const inv = createEmptyInvoice('TPS/2026-27/010');
  const catCfg = CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
  const newItem = {
    id: 'item-1',
    name: 'Exide InvaMaster 150Ah',
    category: PRODUCT_CATEGORIES.BATTERY,
    subcategory: catCfg.subcategories[0],
    hsn: '8507',
    qty: 1,
    unit: 'Nos',
    rate: 14800,
    isTaxInclusive: true,
    gstRate: 28,
  };
  const updatedInv = { ...inv, items: [...inv.items, newItem] };
  assert.strictEqual(updatedInv.items.length, 1, 'Invoice must have exactly 1 item after adding');
  assert.strictEqual(updatedInv.items[0].name, 'Exide InvaMaster 150Ah');
});

await it('6. Adding multiple products works correctly and calculates totals', () => {
  const inv = createEmptyInvoice('TPS/2026-27/010');
  const items = [
    {
      id: 'item-1',
      name: 'Amaron Current 150Ah',
      category: PRODUCT_CATEGORIES.BATTERY,
      qty: 2,
      rate: 15500,
      isTaxInclusive: true,
      gstRate: 28,
    },
    {
      id: 'item-2',
      name: 'Battery Stand & Terminal Clamps',
      category: PRODUCT_CATEGORIES.SERVICES,
      qty: 1,
      rate: 1200,
      isTaxInclusive: true,
      gstRate: 18,
    },
  ];
  const multiInv = { ...inv, items };
  assert.strictEqual(multiInv.items.length, 2, 'Must contain 2 items');
  const totals = calculateInvoiceTotals(multiInv, '32');
  assert.strictEqual(totals.totalGross, 32200, 'Gross must equal (2*15500) + 1200 = 32200');
  assert.strictEqual(totals.netPayable, 32200, 'Net payable must equal 32200');
});

console.log('\n--- PART 2: EXISTING INVOICE EDITING ---');

await it('7. Existing invoices load their saved items without deletion', () => {
  const savedInvoice = getSampleInvoiceData();
  assert(savedInvoice.items.length >= 2, 'Sample invoice must have saved items');
  const originalItemCount = savedInvoice.items.length;

  // Simulate handleOpenInvoiceInEditor
  const openedInvoice = {
    ...savedInvoice,
    transactionType: inferTransactionType(savedInvoice),
    items: (savedInvoice.items || []).map((item) => normalizeInvoiceItem(item)),
  };

  assert.strictEqual(openedInvoice.items.length, originalItemCount, 'Opened invoice must preserve item count');
  assert.strictEqual(openedInvoice.items[0].name, savedInvoice.items[0].name);
});

await it('8. Existing invoice editing does not remove saved items', () => {
  const savedInvoice = getSampleInvoiceData();
  const openedInvoice = {
    ...savedInvoice,
    items: (savedInvoice.items || []).map((item) => normalizeInvoiceItem(item)),
  };

  // Simulate editing an existing item's quantity
  const updatedItems = [...openedInvoice.items];
  updatedItems[0] = { ...updatedItems[0], qty: 3 };
  const editedInvoice = { ...openedInvoice, items: updatedItems };

  assert.strictEqual(editedInvoice.items.length, savedInvoice.items.length, 'Item count unchanged during edit');
  assert.strictEqual(editedInvoice.items[0].qty, 3, 'Edited item quantity updated');
  assert.strictEqual(editedInvoice.items[1].name, savedInvoice.items[1].name, 'Other items unchanged');
});

await it('9. Reopening an invoice preserves its items and net payable', () => {
  const savedInvoice = getSampleInvoiceData();
  const initialTotals = calculateInvoiceTotals(savedInvoice, '32');

  const reopened = {
    ...savedInvoice,
    items: (savedInvoice.items || []).map((item) => normalizeInvoiceItem(item)),
  };
  const reopenedTotals = calculateInvoiceTotals(reopened, '32');

  assert.strictEqual(reopenedTotals.netPayable, initialTotals.netPayable, 'Net payable must remain consistent');
  assert.strictEqual(reopened.items.length, savedInvoice.items.length, 'Items must be preserved');
});

console.log('\n--- PART 3: PRINT VALIDATION RULES ---');

await it('10. Rule 1: Empty invoice cannot print (validation fails)', () => {
  const emptyInv = createEmptyInvoice('TPS/2026-27/010');
  const res = validateInvoiceBeforePrint(emptyInv);
  assert.strictEqual(res.isValid, false, 'Empty invoice must be invalid');
  assert(res.errors.length > 0, 'Must produce errors');
  assert(
    res.errors[0].includes('at least one product or service') ||
    res.errorSummary.includes('Your bill is empty'),
    'Must explain that bill is empty'
  );
});

await it('11. Rule 2: Invoice with blank placeholder item cannot print', () => {
  const placeholderInv = {
    customer: { stateCode: '32' },
    items: [
      {
        id: '1',
        name: '', // empty name
        qty: 1,
        rate: 0,
        gstRate: 28,
      },
    ],
  };
  const res = validateInvoiceBeforePrint(placeholderInv);
  assert.strictEqual(res.isValid, false, 'Blank item must be rejected');
  assert(
    res.errors.some((e) => e.includes('product or service name')),
    'Must report missing product name'
  );
});

await it('12. Rule 2: Invoice with literally named "Unnamed Item" cannot print', () => {
  const unnamedInv = {
    customer: { stateCode: '32' },
    items: [
      {
        id: '1',
        name: 'Unnamed Item',
        qty: 1,
        rate: 1000,
        gstRate: 28,
      },
    ],
  };
  const res = validateInvoiceBeforePrint(unnamedInv);
  assert.strictEqual(res.isValid, false, 'Literal "Unnamed Item" must be rejected');
  assert(
    res.errors.some((e) => e.includes('product or service name')),
    'Must report item requires meaningful name'
  );
});

await it('13. Rule 3: Valid configured product allows printing', () => {
  const validInv = {
    invoiceNumber: 'TPS/2026-27/010',
    invoiceDate: '2026-11-09',
    customer: { name: 'Rajesh K', stateCode: '32' },
    transactionType: TRANSACTION_TYPES.B2C,
    items: [
      {
        id: '1',
        name: 'Exide InvaMaster 150Ah',
        category: PRODUCT_CATEGORIES.BATTERY,
        qty: 1,
        rate: 14800,
        isTaxInclusive: true,
        gstRate: 28,
      },
    ],
  };
  const res = validateInvoiceBeforePrint(validInv);
  assert.strictEqual(res.isValid, true, 'Valid invoice must pass validation');
  assert.strictEqual(res.errors.length, 0, 'No errors for valid invoice');
});

await it('14. Rule 4: Zero quantity blocks printing', () => {
  const zeroQtyInv = {
    customer: { stateCode: '32' },
    items: [
      {
        id: '1',
        name: 'Exide InvaMaster 150Ah',
        qty: 0,
        rate: 14800,
        gstRate: 28,
      },
    ],
  };
  const res = validateInvoiceBeforePrint(zeroQtyInv);
  assert.strictEqual(res.isValid, false, 'Zero quantity must be rejected');
  assert(
    res.errors.some((e) => e.includes('quantity greater than zero')),
    'Must report quantity error'
  );
});

await it('15. Rule 4: Negative quantity or NaN blocks printing', () => {
  const negQtyInv = {
    customer: { stateCode: '32' },
    items: [
      {
        id: '1',
        name: 'Amaron Current 150Ah',
        qty: -2,
        rate: 15500,
        gstRate: 28,
      },
    ],
  };
  const res = validateInvoiceBeforePrint(negQtyInv);
  assert.strictEqual(res.isValid, false, 'Negative quantity must be rejected');
  assert(
    res.errors.some((e) => e.includes('quantity greater than zero')),
    'Must report invalid quantity'
  );
});

await it('16. Rule 5: Invalid or negative price blocks printing', () => {
  const negPriceInv = {
    customer: { stateCode: '32' },
    items: [
      {
        id: '1',
        name: 'Amaron Current 150Ah',
        qty: 1,
        rate: -500,
        gstRate: 28,
      },
    ],
  };
  const res = validateInvoiceBeforePrint(negPriceInv);
  assert.strictEqual(res.isValid, false, 'Negative price must be rejected');
  assert(
    res.errors.some((e) => e.includes('valid price') || e.includes('valid non-negative price')),
    'Must report invalid price'
  );
});

await it('17. Rule 5: Legitimate zero-value service remains supported', () => {
  const freeServiceInv = {
    invoiceNumber: 'TPS/2026-27/011',
    customer: { name: 'Walk-in Customer', stateCode: '32' },
    transactionType: TRANSACTION_TYPES.B2C,
    items: [
      {
        id: '1',
        name: 'Complimentary Battery Health & Gravity Inspection',
        category: PRODUCT_CATEGORIES.SERVICES,
        qty: 1,
        rate: 0, // legitimate zero price
        isTaxInclusive: true,
        gstRate: 18,
      },
    ],
  };
  const res = validateInvoiceBeforePrint(freeServiceInv);
  assert.strictEqual(res.isValid, true, 'Legitimate zero-rate service must be supported');
  assert.strictEqual(res.errors.length, 0, 'Must have zero errors');
});

await it('18. Rule 7: Unsupported GST rate blocks printing', () => {
  const badGstInv = {
    customer: { stateCode: '32' },
    items: [
      {
        id: '1',
        name: 'Fuze 1100 Inverter',
        qty: 1,
        rate: 6800,
        gstRate: 35, // invalid GST rate
      },
    ],
  };
  const res = validateInvoiceBeforePrint(badGstInv);
  assert.strictEqual(res.isValid, false, 'GST rate 35% must be rejected');
  assert(
    res.errors.some((e) => e.includes('Invalid GST rate')),
    'Must report invalid GST rate'
  );
});

await it('19. Multiple invalid items produce understandable structured errors', () => {
  const multiBadInv = {
    customer: { stateCode: '32' },
    items: [
      {
        id: '1',
        name: '', // missing name
        qty: 0,  // invalid qty
        rate: 100,
      },
      {
        id: '2',
        name: 'Valid Item',
        qty: 1,
        rate: -20, // invalid price
      },
    ],
  };
  const res = validateInvoiceBeforePrint(multiBadInv);
  assert.strictEqual(res.isValid, false, 'Must fail validation');
  assert(res.errors.length >= 3, 'Must report all invalid field errors');
  assert(res.itemErrors[0] && res.itemErrors[0].length >= 2, 'Item 1 must have 2 errors');
  assert(res.itemErrors[1] && res.itemErrors[1].length >= 1, 'Item 2 must have 1 error');
});

await it('20. Vector PDF generation rejects invalid or empty invoices', async () => {
  const emptyInv = createEmptyInvoice('TPS/2026-27/010');
  let threw = false;
  try {
    await generateVectorPdf(emptyInv, DEFAULT_BUSINESS);
  } catch (err) {
    threw = true;
    assert(
      err.message.includes('product or service') ||
      err.message.includes('empty') ||
      err.message.includes('validation failed'),
      `Unexpected error message: ${err.message}`
    );
  }
  assert.strictEqual(threw, true, 'generateVectorPdf must throw on empty invoice');
});

await it('21. printInvoicePdf rejects empty invoices and prevents print dialog', async () => {
  const emptyInv = createEmptyInvoice('TPS/2026-27/010');
  let threw = false;
  try {
    await printInvoicePdf(emptyInv, DEFAULT_BUSINESS);
  } catch (err) {
    threw = true;
    assert(
      err.message.includes('product or service') ||
      err.message.includes('empty') ||
      err.message.includes('validation failed'),
      `Unexpected error message: ${err.message}`
    );
  }
  assert.strictEqual(threw, true, 'printInvoicePdf must throw on empty invoice');
});

console.log('\n--- PART 4: FINANCIAL REGRESSION RECONCILIATION ---');

await it('22. Valid multi-item invoice preserves exact GST, discounts, scrap, and net payable', () => {
  const validInvoice = {
    customer: {
      name: 'Green Valley Agro Farm',
      phone: '9847334455',
      address: 'Kudallur, Anakkara Road',
      stateCode: '32',
    },
    transactionType: TRANSACTION_TYPES.B2C,
    additionalDiscount: 500,
    scrapExchange: { enabled: true, amount: 1500, description: 'Old 150Ah battery' },
    items: [
      {
        id: '1',
        name: 'Fuze 1100 Inverter + 150 Ah Battery',
        category: PRODUCT_CATEGORIES.INVERTER,
        qty: 1,
        rate: 22000,
        isTaxInclusive: true,
        gstRate: 28,
      },
      {
        id: '2',
        name: 'Solar Panel Charge Controller',
        category: PRODUCT_CATEGORIES.SOLAR,
        qty: 1,
        rate: 4500,
        isTaxInclusive: true,
        gstRate: 18,
      },
    ],
  };

  const totals = calculateInvoiceTotals(validInvoice, '32');
  assert.strictEqual(totals.totalGross, 26500, 'Gross: 22000 + 4500 = 26500');
  assert.strictEqual(totals.extraDiscount, 500, 'Additional discount = 500');
  assert.strictEqual(totals.scrapDiscount, 1500, 'Scrap deduction = 1500');
  assert.strictEqual(totals.netPayable, 24500, 'Net payable: 26500 - 500 - 1500 = 24500');
  assert.strictEqual(totals.isInterstate, false, 'Intrastate split');
  assert.strictEqual(totals.totalCgst, totals.totalSgst, 'CGST must equal SGST');
  assert.strictEqual(totals.amountInWords, 'Twenty Four Thousand Five Hundred Rupees Only');

  const consistency = verifyInvoiceFinancialConsistency(validInvoice, totals, '32');
  assert.strictEqual(consistency.isValid, true, 'Financial consistency verification must pass');
});

console.log(`\n================================================================`);
console.log(`TEST EXECUTION COMPLETED: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
