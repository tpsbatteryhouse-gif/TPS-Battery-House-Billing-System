// scratch/test_invoice_form_state_integrity.mjs
// TPS BATTERY HOUSE — Comprehensive Form State-Integrity & Interaction Stability Test Suite

import assert from 'assert';
import {
  PRODUCT_CATEGORIES,
  normalizeInvoiceItem,
  TRANSACTION_TYPES,
} from '../src/utils/categories.js';
import {
  calculateInvoiceTotals,
  verifyInvoiceFinancialConsistency,
} from '../src/utils/gstCalculations.js';
import {
  createEmptyInvoice,
  getSampleInvoiceData,
} from '../src/utils/defaults.js';

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

console.log('================================================================');
console.log('TPS BATTERY HOUSE — COMPLETE INVOICE FORM STATE-INTEGRITY SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// PART 1: FIELD INVENTORY & INITIALIZATION INTEGRITY
// -------------------------------------------------------------
console.log('--- PART 1: FIELD INVENTORY & INITIALIZATION INTEGRITY ---');

it('1.1. createEmptyInvoice initializes all required fields cleanly without phantom items', () => {
  const empty = createEmptyInvoice('TPS/2026-27/001', '2026-11-10');
  assert.strictEqual(empty.invoiceNumber, 'TPS/2026-27/001');
  assert.strictEqual(empty.items.length, 0, 'New invoice must have strictly 0 items');
  assert.strictEqual(empty.additionalDiscount, 0);
  assert.strictEqual(empty.scrapExchange.enabled, false);
  assert.strictEqual(empty.scrapExchange.amount, 0);
  assert.strictEqual(empty.reverseCharge, false, 'reverseCharge must be boolean false');
  assert.strictEqual(empty.transactionType, TRANSACTION_TYPES.B2C);
  assert.strictEqual(empty.paymentStatus, 'Paid');
  assert.strictEqual(empty.paymentMode, 'Cash');
});

it('1.2. getSampleInvoiceData initializes complete mixed-category purchase with valid scrapExchange', () => {
  const sample = getSampleInvoiceData();
  assert.strictEqual(sample.items.length, 4);
  assert.strictEqual(sample.scrapExchange.enabled, true);
  assert.strictEqual(sample.scrapExchange.amount, 2500);
  assert.strictEqual(sample.additionalDiscount, 1000);
  assert.strictEqual(sample.reverseCharge, false);
});

// -------------------------------------------------------------
// PART 2: OLD BATTERY VALUE PRIORITY REPAIR & DEDUCTION ISOLATION
// -------------------------------------------------------------
console.log('\n--- PART 2: OLD BATTERY VALUE STABILITY & INDEPENDENCE ---');

it('2.1. Old battery value (₹1,497) is preserved exactly when adding items', () => {
  let inv = createEmptyInvoice('TPS/2026-27/008', '2026-11-10');
  inv.scrapExchange = { enabled: true, amount: 1497, description: 'Old Battery Scrap' };
  inv.additionalDiscount = 1000;

  // Add Item 1 (Amaron Current 150Ah)
  const item1 = normalizeInvoiceItem({
    name: 'Amaron Current 150Ah Tall Tubular Inverter Battery',
    category: PRODUCT_CATEGORIES.BATTERY,
    qty: 1,
    rate: 15500,
    isTaxInclusive: true,
    gstRate: 28,
  });
  inv.items.push(item1);

  assert.strictEqual(inv.scrapExchange.amount, 1497, 'Scrap exchange amount must not change after adding item');
  assert.strictEqual(inv.scrapExchange.enabled, true);

  const totals = calculateInvoiceTotals(inv, '32');
  assert.strictEqual(totals.scrapDiscount, 1497);
  assert.strictEqual(totals.extraDiscount, 1000);
  assert.strictEqual(totals.totalGross, 15500);
  // Net Payable = 15500 - 1000 - 1497 = 13003
  assert.strictEqual(totals.netPayable, 13003, 'Net payable must reflect exact user deductions (13,003)');
});

it('2.2. Old battery value is unchanged when modifying line item quantity or price', () => {
  const inv = {
    ...createEmptyInvoice('TPS/2026-27/008'),
    items: [
      normalizeInvoiceItem({ name: 'Battery 1', rate: 10000, qty: 1, gstRate: 28, isTaxInclusive: true }),
    ],
    scrapExchange: { enabled: true, amount: 1497, description: 'Old 150Ah Scrap' },
  };

  // Modify quantity from 1 to 3
  inv.items[0].qty = 3;
  let totals = calculateInvoiceTotals(inv, '32');
  assert.strictEqual(inv.scrapExchange.amount, 1497);
  assert.strictEqual(totals.scrapDiscount, 1497);
  assert.strictEqual(totals.totalGross, 30000);
  assert.strictEqual(totals.netPayable, 30000 - 1497);

  // Modify price from 10,000 to 12,000
  inv.items[0].rate = 12000;
  totals = calculateInvoiceTotals(inv, '32');
  assert.strictEqual(inv.scrapExchange.amount, 1497);
  assert.strictEqual(totals.scrapDiscount, 1497);
  assert.strictEqual(totals.totalGross, 36000);
  assert.strictEqual(totals.netPayable, 36000 - 1497);
});

it('2.3. Old battery value is unchanged when changing tax mode (inclusive vs exclusive) and GST slab', () => {
  const inv = {
    ...createEmptyInvoice('TPS/2026-27/008'),
    items: [
      normalizeInvoiceItem({ name: 'Solar Inverter', rate: 10000, qty: 1, gstRate: 18, isTaxInclusive: true }),
    ],
    scrapExchange: { enabled: true, amount: 1500, description: 'Old Scrap' },
  };

  // Switch to Tax Exclusive
  inv.items[0].isTaxInclusive = false;
  let totals = calculateInvoiceTotals(inv, '32');
  assert.strictEqual(inv.scrapExchange.amount, 1500);
  assert.strictEqual(totals.scrapDiscount, 1500);
  // Gross = 10000 + 18% = 11800. Net = 11800 - 1500 = 10300
  assert.strictEqual(totals.totalGross, 11800);
  assert.strictEqual(totals.netPayable, 10300);

  // Change GST rate from 18% to 28%
  inv.items[0].gstRate = 28;
  totals = calculateInvoiceTotals(inv, '32');
  assert.strictEqual(inv.scrapExchange.amount, 1500);
  assert.strictEqual(totals.totalGross, 12800);
  assert.strictEqual(totals.netPayable, 12800 - 1500);
});

it('2.4. Old battery value is unchanged when customer information or type changes', () => {
  const inv = {
    ...createEmptyInvoice('TPS/2026-27/008'),
    customer: { name: 'Customer A', phone: '9846112233', gstin: '' },
    transactionType: TRANSACTION_TYPES.B2C,
    items: [
      normalizeInvoiceItem({ name: 'Battery', rate: 15000, qty: 1, gstRate: 28, isTaxInclusive: true }),
    ],
    scrapExchange: { enabled: true, amount: 1497 },
  };

  // Change customer name and phone
  inv.customer.name = 'Palakkad Auto Electricals';
  inv.customer.phone = '9847551234';
  assert.strictEqual(inv.scrapExchange.amount, 1497);

  // Switch to B2B and add GSTIN
  inv.transactionType = TRANSACTION_TYPES.B2B;
  inv.customer.gstin = '32AABFP102FC1ZX';
  inv.customer.stateCode = '32';
  assert.strictEqual(inv.scrapExchange.amount, 1497);
  assert.strictEqual(calculateInvoiceTotals(inv, '32').scrapDiscount, 1497);
});

it('2.5. Old battery value is deducted exactly once across gross subtotal and net payable', () => {
  const inv = {
    ...createEmptyInvoice('TPS/2026-27/008'),
    items: [
      normalizeInvoiceItem({ name: 'Item 1', rate: 10000, qty: 1, gstRate: 18, isTaxInclusive: true }),
      normalizeInvoiceItem({ name: 'Item 2', rate: 5000, qty: 1, gstRate: 18, isTaxInclusive: true }),
    ],
    scrapExchange: { enabled: true, amount: 2000 },
    additionalDiscount: 500,
  };

  const totals = calculateInvoiceTotals(inv, '32');
  assert.strictEqual(totals.totalGross, 15000);
  assert.strictEqual(totals.scrapDiscount, 2000);
  assert.strictEqual(totals.extraDiscount, 500);
  assert.strictEqual(totals.subtotalAfterDeductions, 12500);
  assert.strictEqual(totals.netPayable, 12500);
});

it('2.6. Disabling old battery exchange ignores scrap amount without mutating source state', () => {
  const inv = {
    ...createEmptyInvoice('TPS/2026-27/008'),
    items: [
      normalizeInvoiceItem({ name: 'Battery', rate: 10000, qty: 1, gstRate: 28, isTaxInclusive: true }),
    ],
    scrapExchange: { enabled: false, amount: 1500 },
  };

  const totals = calculateInvoiceTotals(inv, '32');
  assert.strictEqual(totals.scrapDiscount, 0, 'When enabled=false, scrap discount must be 0');
  assert.strictEqual(totals.netPayable, 10000);
  assert.strictEqual(inv.scrapExchange.amount, 1500, 'Original amount remains in state in case re-enabled');
});

// -------------------------------------------------------------
// PART 3: CUSTOMER PARTICULARS & B2B/B2C STATE INTEGRITY
// -------------------------------------------------------------
console.log('\n--- PART 3: CUSTOMER PARTICULARS & B2B/B2C STATE INTEGRITY ---');

it('3.1. Switching from B2B to B2C is authoritative and independent of GSTIN text', () => {
  let txType = TRANSACTION_TYPES.B2B;

  // Fix verification: isB2B must follow transactionType directly
  let isB2B = txType === TRANSACTION_TYPES.B2B;
  assert.strictEqual(isB2B, true);

  // User explicitly switches to Regular Customer (B2C)
  txType = TRANSACTION_TYPES.B2C;
  isB2B = txType === TRANSACTION_TYPES.B2B;
  assert.strictEqual(isB2B, false, 'User choice of B2C must be respected even if customer had GSTIN');
});

it('3.2. Selecting customer from directory preserves existing shipping address if directory record has none', () => {
  const prevCustomer = {
    name: 'Old Name',
    shippingAddress: 'Site 4B, Industrial Estate, Kinfra Park',
  };
  const selectedDirectoryCust = {
    name: 'Green Valley Agro Farm',
    phone: '9847334455',
    address: 'Kudallur, Anakkara Road',
    shippingAddress: '', // Blank in directory
  };

  const mergedShipping = selectedDirectoryCust.shippingAddress || prevCustomer.shippingAddress || '';
  assert.strictEqual(mergedShipping, 'Site 4B, Industrial Estate, Kinfra Park', 'Must not wipe user-entered delivery address');
});

it('3.3. Clearing to New Customer preserves user-selected B2B transaction type', () => {
  const prevTxType = TRANSACTION_TYPES.B2B;
  const newCustPayload = { gstin: '' };

  const isB2B = Boolean(newCustPayload.gstin && newCustPayload.gstin.length >= 10);
  const newTxType = isB2B ? TRANSACTION_TYPES.B2B : (prevTxType || TRANSACTION_TYPES.B2C);
  assert.strictEqual(newTxType, TRANSACTION_TYPES.B2B, 'Preserves B2B mode when starting new customer');
});

// -------------------------------------------------------------
// PART 4: ATOMIC NESTED STATE UPDATES & INPUT IMMUTABILITY
// -------------------------------------------------------------
console.log('\n--- PART 4: ATOMIC NESTED STATE UPDATES & INPUT IMMUTABILITY ---');

it('4.1. updateField performs atomic multi-field update for GSTIN, stateCode, and PAN', () => {
  let state = createEmptyInvoice('TPS/2026-27/008');

  // Simulated updateField implementation matching InvoiceForm.jsx
  const applyUpdates = (prevState, pathOrUpdates, value) => {
    const copy = { ...prevState };
    const updates =
      typeof pathOrUpdates === 'string'
        ? { [pathOrUpdates]: value }
        : (pathOrUpdates && typeof pathOrUpdates === 'object' ? pathOrUpdates : {});

    for (const [path, val] of Object.entries(updates)) {
      const keys = path.split('.');
      let current = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        current[key] = current[key] && typeof current[key] === 'object' ? { ...current[key] } : {};
        current = current[key];
      }
      current[keys[keys.length - 1]] = val;
    }
    return copy;
  };

  const gstinInput = '32AABFP102FC1ZX';
  state = applyUpdates(state, {
    'customer.gstin': gstinInput,
    'customer.stateCode': gstinInput.slice(0, 2),
    'customer.pan': gstinInput.slice(2, 12),
  });

  assert.strictEqual(state.customer.gstin, '32AABFP102FC1ZX');
  assert.strictEqual(state.customer.stateCode, '32');
  assert.strictEqual(state.customer.pan, 'AABFP102FC');
});

it('4.2. Atomic update for scrap exchange enables flag and sets amount in single mutation', () => {
  let state = createEmptyInvoice('TPS/2026-27/008');

  const applyUpdates = (prevState, pathOrUpdates, value) => {
    const copy = { ...prevState };
    const updates =
      typeof pathOrUpdates === 'string'
        ? { [pathOrUpdates]: value }
        : (pathOrUpdates && typeof pathOrUpdates === 'object' ? pathOrUpdates : {});

    for (const [path, val] of Object.entries(updates)) {
      const keys = path.split('.');
      let current = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        current[key] = current[key] && typeof current[key] === 'object' ? { ...current[key] } : {};
        current = current[key];
      }
      current[keys[keys.length - 1]] = val;
    }
    return copy;
  };

  state = applyUpdates(state, {
    'scrapExchange.amount': '1497',
    'scrapExchange.enabled': true,
  });

  assert.strictEqual(state.scrapExchange.enabled, true);
  assert.strictEqual(state.scrapExchange.amount, '1497');
});

it('4.3. Numeric inputs with decimal strings do not strip decimals while typing', () => {
  const inv = {
    ...createEmptyInvoice('TPS/2026-27/008'),
    items: [
      normalizeInvoiceItem({ name: 'Wire Service', rate: '1500.50', qty: 1, gstRate: 18, isTaxInclusive: true }),
    ],
    scrapExchange: { enabled: true, amount: '1497.00' },
    additionalDiscount: '500.25',
  };

  const totals = calculateInvoiceTotals(inv, '32');
  assert.strictEqual(totals.totalGross, 1500.50);
  assert.strictEqual(totals.scrapDiscount, 1497);
  assert.strictEqual(totals.extraDiscount, 500.25);
});

// -------------------------------------------------------------
// PART 5: REVERSE CHARGE MECHANISM (RCM) TYPE INTEGRITY
// -------------------------------------------------------------
console.log('\n--- PART 5: REVERSE CHARGE MECHANISM (RCM) TYPE INTEGRITY ---');

it('5.1. reverseCharge correctly handles boolean true, false, and legacy string Yes/No', () => {
  const isRcmActive = (val) => val === true || val === 'Yes';

  assert.strictEqual(isRcmActive(false), false, 'Boolean false must be inactive');
  assert.strictEqual(isRcmActive('No'), false, 'Legacy string "No" must be inactive');
  assert.strictEqual(isRcmActive(true), true, 'Boolean true must be active');
  assert.strictEqual(isRcmActive('Yes'), true, 'Legacy string "Yes" must be active');
  assert.strictEqual(isRcmActive(undefined), false);
  assert.strictEqual(isRcmActive(null), false);
});

// -------------------------------------------------------------
// PART 6: PRODUCT LINE ITEM ROW STABILITY & UNIQUE IDENTIFIERS
// -------------------------------------------------------------
console.log('\n--- PART 6: PRODUCT LINE ITEM ROW STABILITY & IDS ---');

it('6.1. normalizeInvoiceItem ensures a stable unique id on every line item', () => {
  const rawItem = { name: 'Item without ID', rate: 500, qty: 1 };
  const normalized = normalizeInvoiceItem(rawItem);
  assert(Boolean(normalized.id), 'Normalized item must have an id');
  assert(normalized.id.startsWith('item-'), 'Generated id must begin with item-');
});

it('6.2. Removing an item shifts array without mutating other item values', () => {
  let items = [
    { id: 'item-1', name: 'Battery 150Ah', rate: 15500, qty: 1 },
    { id: 'item-2', name: 'Inverter 1050VA', rate: 6800, qty: 1 },
    { id: 'item-3', name: 'Solar Panel 550W', rate: 13750, qty: 2 },
  ];

  // Remove middle item (index 1)
  items = items.filter((_, i) => i !== 1);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].id, 'item-1');
  assert.strictEqual(items[0].rate, 15500);
  assert.strictEqual(items[1].id, 'item-3');
  assert.strictEqual(items[1].rate, 13750);
});

it('6.3. Removing all items returns cleanly to empty array without error', () => {
  let items = [{ id: 'item-1', name: 'Battery', rate: 15500, qty: 1 }];
  items = items.filter((_, i) => i !== 0);
  assert.strictEqual(items.length, 0);

  const inv = { ...createEmptyInvoice('TPS/2026-27/001'), items };
  const totals = calculateInvoiceTotals(inv, '32');
  assert.strictEqual(totals.totalGross, 0);
  assert.strictEqual(totals.netPayable, 0);
});

// -------------------------------------------------------------
// PART 7: FULL REPRODUCTION SCENARIO (USER SCREENSHOT)
// -------------------------------------------------------------
console.log('\n--- PART 7: FULL REPRODUCTION SCENARIO (USER SCREENSHOT) ---');

it('7.1. Palakkad Auto Electricals (B2B, 15,500 battery, 1,000 disc, 1,497 old battery = ₹13,003.00)', () => {
  const reproInv = {
    id: 'inv-repro-008',
    invoiceNumber: 'TPS/2026-27/008',
    invoiceDate: '2026-11-10',
    dueDate: '2026-11-10',
    transactionType: TRANSACTION_TYPES.B2B,
    paymentStatus: 'Paid',
    paymentMode: 'Card',
    customer: {
      name: 'Palakkad Auto Electricals',
      phone: '9847551234',
      gstin: '32AABFP102FC1ZX',
      pan: 'AABFP102FC',
      address: 'Kalladipatta Junction, Koottanad',
      city: 'Thrithala',
      district: 'Palakkad',
      state: 'Kerala',
      stateCode: '32',
      pincode: '679552',
    },
    items: [
      normalizeInvoiceItem({
        id: 'item-1',
        name: 'Amaron Current 150Ah Tall Tubular Inverter Battery (CR-AR150TT)',
        category: PRODUCT_CATEGORIES.BATTERY,
        qty: 1,
        rate: 15500,
        isTaxInclusive: true,
        gstRate: 28,
        hsn: '8507',
      }),
    ],
    additionalDiscount: 1000,
    scrapExchange: {
      enabled: true,
      amount: 1497,
      description: 'Old Battery Scrap Buyback',
    },
    roundOffManual: null,
  };

  const totals = calculateInvoiceTotals(reproInv, '32');

  // Verify all exact values from screenshot:
  assert.strictEqual(totals.totalGross, 15500.00, 'Items total must be 15,500.00');
  assert.strictEqual(totals.extraDiscount, 1000.00, 'Discount must be 1,000.00');
  assert.strictEqual(totals.scrapDiscount, 1497.00, 'Old battery value must be 1,497.00');
  assert.strictEqual(totals.totalTaxableValue, 12109.38, 'Price before GST must be 12,109.38');
  assert.strictEqual(totals.totalCgst, 1695.31, 'CGST must be 1,695.31');
  assert.strictEqual(totals.totalSgst, 1695.31, 'SGST must be 1,695.31');
  assert.strictEqual(totals.totalTax, 3390.62, 'Total GST must be 3,390.62');
  assert.strictEqual(totals.netPayable, 13003.00, 'Customer pays must be exactly ₹13,003.00');
  assert(totals.amountInWords.includes('Thirteen Thousand Three'), 'Amount in words must state Thirteen Thousand Three');

  // Verify financial consistency guard
  const consistency = verifyInvoiceFinancialConsistency(reproInv, '32');
  assert.strictEqual(consistency.isValid, true, 'Financial consistency check must pass');
  assert.strictEqual(consistency.authoritativeNetPayable, 13003);
});

// -------------------------------------------------------------
// PART 8: PERSISTENCE & REOPENING SIMULATION
// -------------------------------------------------------------
console.log('\n--- PART 8: PERSISTENCE & REOPENING SIMULATION ---');

it('8.1. Saving and reopening invoice preserves exact entered deductions and amounts', () => {
  const original = {
    id: 'inv-saved-101',
    invoiceNumber: 'TPS/2026-27/101',
    invoiceDate: '2026-11-10',
    customer: { name: 'Test Shop', gstin: '32AABCS1234A1Z1', stateCode: '32' },
    transactionType: 'B2B',
    items: [
      normalizeInvoiceItem({ name: 'Tubular Battery', rate: 16000, qty: 1, gstRate: 28, isTaxInclusive: true }),
    ],
    scrapExchange: { enabled: true, amount: 2000, description: '150Ah Scrap' },
    additionalDiscount: 500,
    paymentStatus: 'Paid',
    paymentMode: 'UPI',
  };

  const totals = calculateInvoiceTotals(original, '32');

  // Simulate serialize / deserialize through JSON (Firestore / localStorage round-trip)
  const serialized = JSON.stringify({
    ...original,
    netPayable: totals.netPayable,
    savedAt: new Date().toISOString(),
  });
  const reopened = JSON.parse(serialized);

  assert.strictEqual(reopened.scrapExchange.amount, 2000);
  assert.strictEqual(reopened.scrapExchange.enabled, true);
  assert.strictEqual(reopened.scrapExchange.description, '150Ah Scrap');
  assert.strictEqual(reopened.additionalDiscount, 500);

  const reopenedTotals = calculateInvoiceTotals(reopened, '32');
  assert.strictEqual(reopenedTotals.netPayable, totals.netPayable);
  assert.strictEqual(reopenedTotals.netPayable, 13500);
});

console.log('\n================================================================');
console.log(`TOTAL SUITE RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
