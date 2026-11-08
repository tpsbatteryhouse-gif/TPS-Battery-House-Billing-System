import assert from 'assert';
import {
  roundToTwoDecimals,
  validateFinancialInput,
  validateInvoiceFinancials,
  calculateLineItem,
  calculateInvoiceTotals,
  buildUpiUri,
} from '../src/utils/gstCalculations.js';
import { sanitizeInvoiceForFirestore } from '../src/firebase/services/invoiceService.js';
import { PRODUCT_CATEGORIES } from '../src/utils/categories.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
  }
}

console.log('================================================================');
console.log('TPS BATTERY HOUSE — PHASE 5.3 FINAL FINANCIAL CALCULATION SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// 1. INVALID FINANCIAL INPUT HANDLING & BOUNDARY VALIDATION
// -------------------------------------------------------------
console.log('--- 1. Invalid Financial Input Handling & Boundary Validation ---');

it('roundToTwoDecimals gracefully normalizes invalid / extreme numeric inputs without crashing', () => {
  // Edge case inputs specified in Phase 5.3 prompt
  assert.strictEqual(roundToTwoDecimals(null), 0, 'null -> 0');
  assert.strictEqual(roundToTwoDecimals(undefined), 0, 'undefined -> 0');
  assert.strictEqual(roundToTwoDecimals(''), 0, 'empty string -> 0');
  assert.strictEqual(roundToTwoDecimals('   '), 0, 'whitespace string -> 0');
  assert.strictEqual(roundToTwoDecimals('abc'), 0, 'non-numeric string -> 0');
  assert.strictEqual(roundToTwoDecimals(NaN), 0, 'NaN -> 0');
  assert.strictEqual(roundToTwoDecimals(Infinity), 0, 'Infinity -> 0');
  assert.strictEqual(roundToTwoDecimals(-Infinity), 0, '-Infinity -> 0');
  assert.strictEqual(Object.is(roundToTwoDecimals(-0), 0), true, '-0 -> 0 (positive zero)');
  assert.strictEqual(roundToTwoDecimals(-1), -1, '-1 -> -1');
  assert.strictEqual(roundToTwoDecimals('-1.005'), -1.01, '"-1.005" -> -1.01');
  assert.strictEqual(roundToTwoDecimals('1.005'), 1.01, '"1.005" -> 1.01');
  assert.strictEqual(roundToTwoDecimals(1e-7), 0, '1e-7 scientific notation -> 0');
  assert.strictEqual(roundToTwoDecimals(1e21), 1e21, '1e21 scientific notation preserved');
  assert.strictEqual(roundToTwoDecimals(true), 0, 'boolean true -> 0 (rejected)');
  assert.strictEqual(roundToTwoDecimals(false), 0, 'boolean false -> 0 (rejected)');
  assert.strictEqual(roundToTwoDecimals({}), 0, 'object -> 0 (rejected)');
  assert.strictEqual(roundToTwoDecimals([]), 0, 'array -> 0 (rejected)');
});

it('validateFinancialInput strictly rejects corrupted, non-finite, or malformed inputs', () => {
  const invalidInputs = ['abc', NaN, Infinity, -Infinity, '12.34.56', true, {}, [1]];
  for (const inv of invalidInputs) {
    let threw = false;
    try {
      validateFinancialInput(inv, 'Test Amount');
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, true, `validateFinancialInput should reject ${JSON.stringify(inv)}`);
  }
});

it('validateInvoiceFinancials prevents malformed financial data from silently becoming zero', () => {
  // Malformed rate must throw, NOT silently become zero
  const invoiceBadRate = {
    customer: { name: 'Test Buyer' },
    items: [{ name: 'Battery', rate: 'abc', qty: 10 }],
  };
  assert.throws(
    () => validateInvoiceFinancials(invoiceBadRate),
    /invalid characters/,
    'Rejected malformed rate "abc"'
  );

  // Negative rate must throw
  const invoiceNegRate = {
    customer: { name: 'Test Buyer' },
    items: [{ name: 'Battery', rate: -500, qty: 1 }],
  };
  assert.throws(
    () => validateInvoiceFinancials(invoiceNegRate),
    /cannot be less than 0/,
    'Rejected negative rate'
  );

  // Negative quantity must throw
  const invoiceNegQty = {
    customer: { name: 'Test Buyer' },
    items: [{ name: 'Battery', rate: 5000, qty: -2 }],
  };
  assert.throws(
    () => validateInvoiceFinancials(invoiceNegQty),
    /cannot be less than 0.001/,
    'Rejected negative quantity'
  );

  // Zero quantity must throw
  const invoiceZeroQty = {
    customer: { name: 'Test Buyer' },
    items: [{ name: 'Battery', rate: 5000, qty: 0 }],
  };
  assert.throws(
    () => validateInvoiceFinancials(invoiceZeroQty),
    /cannot be less than 0.001/,
    'Rejected zero quantity'
  );

  // Invalid GST slab must throw
  const invoiceBadGst = {
    customer: { name: 'Test Buyer' },
    items: [{ name: 'Battery', rate: 5000, qty: 1, gstRate: 35 }],
  };
  assert.throws(
    () => validateInvoiceFinancials(invoiceBadGst),
    /(invalid GST slab|exceeds maximum permitted value)/,
    'Rejected non-statutory GST slab'
  );

  // Excessive line discount must throw
  const invoiceExcessDiscount = {
    customer: { name: 'Test Buyer' },
    items: [{ name: 'Battery', rate: 5000, qty: 1, discount: 6000 }],
  };
  assert.throws(
    () => validateInvoiceFinancials(invoiceExcessDiscount),
    /cannot exceed line subtotal/,
    'Rejected discount exceeding item gross amount'
  );
});

it('sanitizeInvoiceForFirestore rejects invoices with invalid financial values at storage boundary', () => {
  const badInvoice = {
    id: 'inv_corrupt_test',
    invoiceNumber: 'TPS/2026-27/999',
    customer: { name: 'Corrupt Test' },
    items: [{ name: 'Battery', rate: 'FORGED_PRICE', qty: 1 }],
  };

  assert.throws(
    () => sanitizeInvoiceForFirestore(badInvoice),
    /contains invalid characters/,
    'Storage boundary blocked invalid invoice rate'
  );
});

it('legitimate zero-value items and services are correctly accepted', () => {
  // Free promotional testing service (rate: 0, gstRate: 0)
  const legitZeroInvoice = {
    customer: { name: 'Complimentary Checkup Customer' },
    items: [
      { name: 'Battery Terminal Voltage Check & Water Top-Up Service', rate: 0, qty: 1, gstRate: 0 },
    ],
  };

  assert.doesNotThrow(() => validateInvoiceFinancials(legitZeroInvoice), 'Legitimate zero rate service accepted');
  const totals = calculateInvoiceTotals(legitZeroInvoice);
  assert.strictEqual(totals.netPayable, 0);
  assert.strictEqual(totals.amountInWords, 'Zero Rupees Only');
});

// -------------------------------------------------------------
// 2. STATUTORY DECIMAL MIDPOINT BOUNDARIES MATRIX
// -------------------------------------------------------------
console.log('\n--- 2. Decimal Midpoint Boundaries Matrix ---');

it('evaluates all 10 statutory midpoint decimal boundary values with 100% precision', () => {
  const midpoints = [
    [1.005, 1.01],
    [2.675, 2.68],
    [10.005, 10.01],
    [0.105, 0.11],
    [0.015, 0.02],
    [1.999, 2.00],
    [99.995, 100.00],
    [100.005, 100.01],
    [-1.005, -1.01],
    [-2.675, -2.68],
  ];

  for (const [input, expected] of midpoints) {
    const actual = roundToTwoDecimals(input);
    assert.strictEqual(actual, expected, `roundToTwoDecimals(${input}) = ${actual}, expected ${expected}`);
  }
});

// -------------------------------------------------------------
// 3. LARGE FINANCIAL SCALES & POLICY RANGE LIMITS
// -------------------------------------------------------------
console.log('\n--- 3. Large Financial Scales & Range Limits ---');

it('calculates invoices across all supported commercial scales up to ₹10 Crores', () => {
  const scales = [
    { amount: 100000, label: '₹1 Lakh' },
    { amount: 1000000, label: '₹10 Lakhs' },
    { amount: 10000000, label: '₹1 Crore' },
    { amount: 100000000, label: '₹10 Crores (Maximum Supported Policy Limit)' },
  ];

  for (const { amount, label } of scales) {
    const invoice = {
      customer: { stateCode: '32' },
      items: [
        { name: `Large Project ${label}`, rate: amount, qty: 1, gstRate: 18, isTaxInclusive: false },
      ],
    };

    const totals = calculateInvoiceTotals(invoice);
    assert.strictEqual(totals.totalTaxableValue, amount);
    assert.strictEqual(totals.totalTax, roundToTwoDecimals(amount * 0.18));
    assert.strictEqual(totals.totalGross, roundToTwoDecimals(amount * 1.18));
    assert.strictEqual(totals.netPayable, roundToTwoDecimals(amount * 1.18));
  }
});

it('rejects values exceeding maximum supported financial policy limits', () => {
  const invoiceExceedingLimit = {
    customer: { name: 'Mega Corp' },
    items: [
      { name: 'Over-limit Item', rate: 10000001, qty: 1 }, // Exceeds ₹10 Lakhs unit price limit
    ],
  };

  assert.throws(
    () => validateInvoiceFinancials(invoiceExceedingLimit),
    /exceeds maximum permitted value of 10000000/,
    'Blocked item exceeding unit price policy limit'
  );
});

// -------------------------------------------------------------
// 4. QUANTITY BOUNDARIES
// -------------------------------------------------------------
console.log('\n--- 4. Quantity Boundaries ---');

it('handles standard and fractional quantities with exact precision', () => {
  const validQuantities = [
    { qty: 0.001, rate: 1000, expectedGross: 1.18 }, // Minimum quantity 1 ml / 1 g
    { qty: 0.25, rate: 200, expectedGross: 59.00 },   // Quarter unit
    { qty: 0.5, rate: 500, expectedGross: 295.00 },   // Half unit
    { qty: 1, rate: 10000, expectedGross: 11800.00 }, // Standard 1 unit
    { qty: 2.75, rate: 45.50, expectedGross: 147.65 },// Fractional electrolyte
    { qty: 100000, rate: 10, expectedGross: 1180000.00 }, // Max quantity 100,000 units
  ];

  for (const { qty, rate, expectedGross } of validQuantities) {
    const item = {
      name: `Qty Test ${qty}`,
      rate,
      qty,
      gstRate: 18,
      isTaxInclusive: false,
    };
    const res = calculateLineItem(item);
    assert.strictEqual(res.lineTotal, expectedGross, `Line total for qty ${qty} is ${res.lineTotal}, expected ${expectedGross}`);
  }
});

// -------------------------------------------------------------
// 5. INDEPENDENT REFERENCE ENGINE VERIFICATION (Big-Integer Paise)
// -------------------------------------------------------------
console.log('\n--- 5. Cross-Verification with Independent Integer Paise Engine ---');

it('cross-verifies production calculations against an independent big-integer paise reference engine', () => {
  // Independent reference engine: calculates purely in integer paise (cents) using exact string decimal scaling
  function referenceCalculateExclusive(rateRupees, qty, gstPercent) {
    // Exact conversion of rupees to paise without IEEE 754 midpoint binary float truncation
    const ratePaise = Math.round(Number(rateRupees + 'e2'));
    // Taxable paise = ratePaise * qty
    const taxablePaise = Math.round(Number((ratePaise * qty) + 'e0'));
    // GST paise = roundHalfUp(taxablePaise * gstPercent / 100)
    const totalGstPaise = Math.round(Number(((taxablePaise * gstPercent) / 100) + 'e0'));
    const grossPaise = taxablePaise + totalGstPaise;

    return {
      taxableRupees: taxablePaise / 100,
      totalGstRupees: totalGstPaise / 100,
      grossRupees: grossPaise / 100,
    };
  }

  const testCases = [
    { rate: 10000, qty: 2, gst: 28 },
    { rate: 8500, qty: 1, gst: 18 },
    { rate: 14500, qty: 4, gst: 12 },
    { rate: 45.50, qty: 2.75, gst: 18 },
    { rate: 100.50, qty: 2, gst: 18 },
  ];

  for (const tc of testCases) {
    const ref = referenceCalculateExclusive(tc.rate, tc.qty, tc.gst);
    const prod = calculateLineItem({
      name: 'Ref Test',
      rate: tc.rate,
      qty: tc.qty,
      gstRate: tc.gst,
      isTaxInclusive: false,
    });

    assert.strictEqual(prod.taxableValue, ref.taxableRupees, `Taxable value matches reference for rate ${tc.rate}`);
    assert.strictEqual(prod.totalGstAmount, ref.totalGstRupees, `Total GST matches reference for rate ${tc.rate}`);
    assert.strictEqual(prod.lineTotal, ref.grossRupees, `Gross total matches reference for rate ${tc.rate}`);
  }

  // Fractional 3-decimal rates component variance check
  const fracItem = calculateLineItem({
    name: 'Frac Test',
    rate: 99.995,
    qty: 1,
    gstRate: 12,
    isTaxInclusive: false,
  });
  const compDiff = roundToTwoDecimals(Math.abs(roundToTwoDecimals(fracItem.taxableValue + fracItem.totalGstAmount) - fracItem.lineTotal));
  assert.ok(compDiff <= 0.01, `Fractional rate component variance ${compDiff} is within 1 paisa`);
});

// -------------------------------------------------------------
// 6. END-TO-END INVOICE RECONCILIATION & SNAPSHOT PRESERVATION
// -------------------------------------------------------------
console.log('\n--- 6. End-to-End Invoice Reconciliation & Snapshot Preservation ---');

it('preserves complete mathematical reconciliation across Editor -> Stored -> Printable -> PDF -> UPI QR', () => {
  const invoice = {
    id: 'inv_e2e_signoff_001',
    invoiceNumber: 'TPS/2026-27/777',
    customer: {
      name: 'Kalyan Residency PVT LTD',
      phone: '9846830532',
      gstin: '32AABCK1234F1Z5',
      stateCode: '32',
    },
    items: [
      {
        id: 'i1',
        name: 'Amaron Current 150Ah Tall Tubular Battery',
        hsn: '8507',
        qty: 2,
        rate: 14000, // MRP Tax-Inclusive
        gstRate: 28,
        isTaxInclusive: true,
        discount: 1000,
        category: PRODUCT_CATEGORIES.BATTERY,
      },
      {
        id: 'i2',
        name: 'Luminous Solarverter PRO 2kVA Hybrid Inverter',
        hsn: '8504',
        qty: 1,
        rate: 18500, // Exclusive of 18% GST
        gstRate: 18,
        isTaxInclusive: false,
        discount: 500,
        category: PRODUCT_CATEGORIES.INVERTER,
      },
    ],
    scrapExchange: { enabled: true, amount: 3500 },
    additionalDiscount: 500,
    businessSnapshot: {
      businessName: 'TPS BATTERYS HOUSE',
      stateCode: '32',
      upiId: '9846830532@okaxis',
      gstin: '32DIUPP1211B2ZN',
    },
  };

  // Step 1: Editor / Calculation Layer
  const totals = calculateInvoiceTotals(invoice);

  // Item 1 (Inclusive 28%): gross = (14000 * 2) - 1000 = 27000
  // taxable = 27000 / 1.28 = 21093.75
  // gst = 5906.25 (CGST 2953.13, SGST 2953.13)
  // Item 2 (Exclusive 18%): taxable = (18500 * 1) - 500 = 18000
  // gst = 18000 * 0.18 = 3240 (CGST 1620, SGST 1620)
  // gross = 18000 + 3240 = 21240
  // Total Gross = 27000 + 21240 = 48240
  // Deductions = Scrap 3500 + ExtraDiscount 500 = 4000
  // Subtotal after deductions = 48240 - 4000 = 44240
  // Round off = 0
  // Net Payable = 44240

  assert.strictEqual(totals.totalGross, 48240);
  assert.strictEqual(totals.subtotalAfterDeductions, 44240);
  assert.strictEqual(totals.netPayable, 44240);
  assert.strictEqual(totals.amountInWords, 'Forty Four Thousand Two Hundred Forty Rupees Only');

  // Step 2: Storage Layer (sanitizeInvoiceForFirestore)
  const stored = sanitizeInvoiceForFirestore(invoice);
  assert.strictEqual(stored.netPayable, 44240);

  // Step 3: Printable & UPI Layer
  const upiUri = buildUpiUri(
    invoice.businessSnapshot.upiId,
    invoice.businessSnapshot.businessName,
    stored.netPayable,
    invoice.invoiceNumber
  );

  assert.strictEqual(
    upiUri,
    'upi://pay?pa=9846830532@okaxis&pn=TPS%20BATTERYS%20HOUSE&am=44240.00&cu=INR&tn=Bill%20TPS%2F2026-27%2F777'
  );

  // Verification that am= matches stored netPayable with exactly 2 decimal places
  assert(upiUri.includes('am=44240.00'), 'UPI URI contains exact statutory 2-decimal payable');
});

console.log('\n================================================================');
console.log(`PHASE 5.3 CALCULATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
