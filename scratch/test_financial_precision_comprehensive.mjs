import assert from 'assert';
import {
  roundToTwoDecimals,
  calculateLineItem,
  calculateInvoiceTotals,
  buildUpiUri,
} from '../src/utils/gstCalculations.js';
import { numberToIndianWords } from '../src/utils/numberToWords.js';
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
console.log('TEST SUITE: COMPREHENSIVE FINANCIAL PRECISION & GST AUDIT');
console.log('================================================================\n');

console.log('1. Standalone Decimal & Round-Half-Up Mathematical Invariants');

it('correctly rounds mandatory midpoint decimals (1.005, 2.675, 10.005, 0.105, 0.015, 1.999, 99.995, 100.005)', () => {
  const midpoints = [
    [1.005, 1.01],
    [2.675, 2.68],
    [10.005, 10.01],
    [0.105, 0.11],
    [0.015, 0.02],
    [1.999, 2.00],
    [99.995, 100.00],
    [100.005, 100.01],
  ];

  for (const [val, expected] of midpoints) {
    const actual = roundToTwoDecimals(val);
    assert.strictEqual(
      actual,
      expected,
      `roundToTwoDecimals(${val}) returned ${actual}, expected ${expected}`
    );
  }
});

it('correctly rounds negative midpoint and asymmetric values', () => {
  assert.strictEqual(roundToTwoDecimals(-1.005), -1.01);
  assert.strictEqual(roundToTwoDecimals(-2.675), -2.68);
  assert.strictEqual(roundToTwoDecimals(-10.005), -10.01);
  assert.strictEqual(roundToTwoDecimals(-0.105), -0.11);
  assert.strictEqual(roundToTwoDecimals(-0.015), -0.02);
});

it('correctly handles zero, null, undefined, NaN, and string inputs', () => {
  assert.strictEqual(roundToTwoDecimals(0), 0);
  assert.strictEqual(roundToTwoDecimals(null), 0);
  assert.strictEqual(roundToTwoDecimals(undefined), 0);
  assert.strictEqual(roundToTwoDecimals(NaN), 0);
  assert.strictEqual(roundToTwoDecimals('abc'), 0);
  assert.strictEqual(roundToTwoDecimals('12.345'), 12.35);
  assert.strictEqual(roundToTwoDecimals('100.005'), 100.01);
});

it('handles micro-values and sub-cent fractional amounts', () => {
  assert.strictEqual(roundToTwoDecimals(0.0001), 0);
  assert.strictEqual(roundToTwoDecimals(0.0049), 0);
  assert.strictEqual(roundToTwoDecimals(0.005), 0.01);
  assert.strictEqual(roundToTwoDecimals(0.0051), 0.01);
});

it('handles large transaction scales (up to 100 Crores / 1 Billion INR)', () => {
  assert.strictEqual(roundToTwoDecimals(1000000000.005), 1000000000.01);
  assert.strictEqual(roundToTwoDecimals(999999999.995), 1000000000.00);
});

console.log('\n2. Line Item Calculations — Inclusive vs Exclusive, Dissected Rates');

it('calculates Tax-Exclusive line item with intrastate CGST + SGST split', () => {
  const item = {
    description: 'Tubular Battery 150Ah',
    hsn: '8507',
    qty: 2,
    rate: 10000,
    gstRate: 28,
    isTaxInclusive: false,
    discount: 500,
    category: PRODUCT_CATEGORIES.BATTERY,
  };

  const res = calculateLineItem(item, false);
  // taxableValue = (10000 * 2) - 500 = 19500
  assert.strictEqual(res.taxableValue, 19500);
  // total GST = 19500 * 28% = 5460
  assert.strictEqual(res.totalGstAmount, 5460);
  // CGST = 14% = 2730, SGST = 14% = 2730
  assert.strictEqual(res.cgstAmount, 2730);
  assert.strictEqual(res.sgstAmount, 2730);
  assert.strictEqual(res.igstAmount, 0);
  assert.strictEqual(res.lineTotal, 24960);
});

it('calculates Tax-Inclusive line item with intrastate CGST + SGST reverse computation', () => {
  const item = {
    description: 'Inverter 1100VA MRP',
    hsn: '8504',
    qty: 1,
    rate: 8500, // MRP inclusive of 18% GST
    gstRate: 18,
    isTaxInclusive: true,
    discount: 0,
    category: PRODUCT_CATEGORIES.INVERTER,
  };

  const res = calculateLineItem(item, false);
  // gross = 8500
  // taxable = 8500 / 1.18 = 7203.38983... -> 7203.39
  // totalGst = 8500 - 7203.38983... = 1296.61016... -> 1296.61
  // cgst = 648.305... -> 648.31, sgst = 648.305... -> 648.31
  assert.strictEqual(res.lineTotal, 8500);
  assert.strictEqual(res.taxableValue, 7203.39);
  assert.strictEqual(res.totalGstAmount, 1296.61);
  assert.strictEqual(res.cgstAmount, 648.31);
  assert.strictEqual(res.sgstAmount, 648.31);
  assert.strictEqual(res.igstAmount, 0);
});

it('calculates Tax-Exclusive interstate IGST (100% to IGST)', () => {
  const item = {
    description: 'Solar Panel 540W Mono PERC',
    hsn: '8541',
    qty: 4,
    rate: 14500,
    gstRate: 12,
    isTaxInclusive: false,
    discount: 1000,
    category: PRODUCT_CATEGORIES.SOLAR,
  };

  const res = calculateLineItem(item, true); // isInterstate = true
  // taxable = (14500 * 4) - 1000 = 57000
  // igst = 57000 * 12% = 6840
  assert.strictEqual(res.taxableValue, 57000);
  assert.strictEqual(res.cgstAmount, 0);
  assert.strictEqual(res.sgstAmount, 0);
  assert.strictEqual(res.igstAmount, 6840);
  assert.strictEqual(res.totalGstAmount, 6840);
  assert.strictEqual(res.lineTotal, 63840);
});

it('handles fractional quantity correctly (e.g. 2.75 Liters electrolyte @ 45.50/L)', () => {
  const item = {
    description: 'Battery Grade Distilled Water / Acid',
    hsn: '2807',
    qty: 2.75,
    rate: 45.50,
    gstRate: 18,
    isTaxInclusive: false,
    discount: 0,
    category: PRODUCT_CATEGORIES.SERVICES,
  };

  const res = calculateLineItem(item, false);
  // taxable = 2.75 * 45.50 = 125.125 -> 125.13
  // totalGst = 125.125 * 0.18 = 22.5225 -> 22.52
  // gross = 125.125 * 1.18 = 147.6475 -> 147.65
  // cgst = 22.5225 / 2 = 11.26125 -> 11.26
  // sgst = 11.26
  assert.strictEqual(res.taxableValue, 125.13);
  assert.strictEqual(res.cgstAmount, 11.26);
  assert.strictEqual(res.sgstAmount, 11.26);
  assert.strictEqual(res.totalGstAmount, 22.52);
  assert.strictEqual(res.lineTotal, 147.65);
});

console.log('\n3. Multi-Rate & Multi-Category Invoice Totals Reconciliation');

it('computes mixed multi-rate invoice (0%, 5%, 12%, 18%, 28%) with accurate HSN aggregation', () => {
  const invoice = {
    customer: { stateCode: '32' }, // Intrastate Kerala
    items: [
      {
        description: 'Exempt Agricultural Battery Maintenance Manual',
        hsn: '4901',
        qty: 1,
        rate: 200,
        gstRate: 0,
        isTaxInclusive: false,
        discount: 0,
        category: PRODUCT_CATEGORIES.SERVICES,
      },
      {
        description: 'Solar Cable 4sqmm (5% GST)',
        hsn: '8544',
        qty: 10,
        rate: 50,
        gstRate: 5,
        isTaxInclusive: false,
        discount: 0,
        category: PRODUCT_CATEGORIES.SOLAR,
      },
      {
        description: 'Solar Inverter Accessories (12% GST)',
        hsn: '8504',
        qty: 2,
        rate: 1500,
        gstRate: 12,
        isTaxInclusive: false,
        discount: 0,
        category: PRODUCT_CATEGORIES.SOLAR,
      },
      {
        description: 'Pure Sine Wave Inverter (18% GST)',
        hsn: '8504',
        qty: 1,
        rate: 10000,
        gstRate: 18,
        isTaxInclusive: false,
        discount: 500,
        category: PRODUCT_CATEGORIES.INVERTER,
      },
      {
        description: 'Lead Acid Solar Battery (28% GST)',
        hsn: '8507',
        qty: 1,
        rate: 15000,
        gstRate: 28,
        isTaxInclusive: false,
        discount: 1000,
        category: PRODUCT_CATEGORIES.BATTERY,
      },
    ],
    scrapExchange: { enabled: true, amount: 2500 },
    additionalDiscount: 500,
  };

  const totals = calculateInvoiceTotals(invoice, '32');

  // Item 1: 0% -> Taxable 200, GST 0, Total 200
  // Item 2: 5% -> Taxable 500, GST 25 (CGST 12.5, SGST 12.5), Total 525
  // Item 3: 12% -> Taxable 3000, GST 360 (CGST 180, SGST 180), Total 3360
  // Item 4: 18% -> Taxable 9500, GST 1710 (CGST 855, SGST 855), Total 11210
  // Item 5: 28% -> Taxable 14000, GST 3920 (CGST 1960, SGST 1960), Total 17920

  assert.strictEqual(totals.totalTaxableValue, 200 + 500 + 3000 + 9500 + 14000); // 27200
  assert.strictEqual(totals.totalCgst, 0 + 12.5 + 180 + 855 + 1960); // 3007.5
  assert.strictEqual(totals.totalSgst, 0 + 12.5 + 180 + 855 + 1960); // 3007.5
  assert.strictEqual(totals.totalIgst, 0);
  assert.strictEqual(totals.totalTax, 6015);
  assert.strictEqual(totals.totalGross, 200 + 525 + 3360 + 11210 + 17920); // 33215

  // Deductions: Scrap 2500 + Additional Discount 500 = 3000
  assert.strictEqual(totals.scrapDiscount, 2500);
  assert.strictEqual(totals.extraDiscount, 500);
  assert.strictEqual(totals.subtotalAfterDeductions, 33215 - 3000); // 30215
  assert.strictEqual(totals.netPayable, 30215);
  assert.strictEqual(totals.roundOff, 0);

  // Check HSN Summary items
  assert.strictEqual(totals.hsnSummary.length, 5);
  const totalTaxFromHsn = totals.hsnSummary.reduce((acc, h) => acc + h.totalTax, 0);
  assert.strictEqual(roundToTwoDecimals(totalTaxFromHsn), totals.totalTax);
});

console.log('\n4. Round-Off Handling & Payment Formatting');

it('computes automatic round-off to nearest whole rupee (+0.35)', () => {
  const invoice = {
    customer: { stateCode: '32' },
    items: [
      {
        description: 'Minor Spares',
        hsn: '8507',
        qty: 1,
        rate: 100.55,
        gstRate: 18,
        isTaxInclusive: false,
        discount: 0,
      },
    ],
  };

  // Gross = 100.55 * 1.18 = 118.649 -> 118.65
  // Rounded = 119
  // RoundOff = +0.35
  const totals = calculateInvoiceTotals(invoice, '32');
  assert.strictEqual(totals.totalGross, 118.65);
  assert.strictEqual(totals.netPayable, 119);
  assert.strictEqual(totals.roundOff, 0.35);
  assert.strictEqual(totals.amountInWords, 'One Hundred Nineteen Rupees Only');
});

it('computes automatic round-off downwards (-0.40)', () => {
  const invoice = {
    customer: { stateCode: '32' },
    items: [
      {
        description: 'Minor Spares',
        hsn: '8507',
        qty: 1,
        rate: 85.08,
        gstRate: 18,
        isTaxInclusive: false,
        discount: 0,
      },
    ],
  };

  // Gross = 85.08 * 1.18 = 100.3944 -> 100.39
  // Rounded = 100
  // RoundOff = -0.39
  const totals = calculateInvoiceTotals(invoice, '32');
  assert.strictEqual(totals.totalGross, 100.39);
  assert.strictEqual(totals.netPayable, 100);
  assert.strictEqual(totals.roundOff, -0.39);
  assert.strictEqual(totals.amountInWords, 'One Hundred Rupees Only');
});

it('respects manual round-off override when provided', () => {
  const invoice = {
    customer: { stateCode: '32' },
    items: [
      {
        description: 'Service Labor',
        hsn: '9987',
        qty: 1,
        rate: 500,
        gstRate: 18,
        isTaxInclusive: false,
        discount: 0,
      },
    ],
    roundOffManual: -10, // Explicit customer concession
  };

  // Gross = 500 * 1.18 = 590
  // Manual roundOff = -10
  // NetPayable = 580
  const totals = calculateInvoiceTotals(invoice, '32');
  assert.strictEqual(totals.totalGross, 590);
  assert.strictEqual(totals.roundOff, -10);
  assert.strictEqual(totals.netPayable, 580);
  assert.strictEqual(totals.amountInWords, 'Five Hundred Eighty Rupees Only');
});

console.log('\n5. Indian Number Words Currency Integrity & UPI URI Verification');

it('converts complex currency figures to Indian English words', () => {
  assert.strictEqual(numberToIndianWords(0), 'Zero Rupees Only');
  assert.strictEqual(numberToIndianWords(1), 'One Rupees Only');
  assert.strictEqual(numberToIndianWords(1500), 'One Thousand Five Hundred Rupees Only');
  assert.strictEqual(numberToIndianWords(100000), 'One Lakh Rupees Only');
  assert.strictEqual(numberToIndianWords(10000000), 'One Crore Rupees Only');
  assert.strictEqual(numberToIndianWords(254890), 'Two Lakh Fifty Four Thousand Eight Hundred Ninety Rupees Only');
});

it('builds compliant UPI payment URI with exact 2-decimal formatted amount', () => {
  const uri1 = buildUpiUri('9846830532@okaxis', 'TPS BATTERYS HOUSE', 20000, 'TPS/2026-27/001');
  assert.strictEqual(
    uri1,
    'upi://pay?pa=9846830532@okaxis&pn=TPS%20BATTERYS%20HOUSE&am=20000.00&cu=INR&tn=Bill%20TPS%2F2026-27%2F001'
  );

  const uri2 = buildUpiUri('tps@bank', 'TPS Battery House', 1.005, 'TPS/2026-27/002');
  assert.strictEqual(
    uri2,
    'upi://pay?pa=tps@bank&pn=TPS%20Battery%20House&am=1.01&cu=INR&tn=Bill%20TPS%2F2026-27%2F002'
  );
});

console.log('\n6. Full Midpoint Dataset Invoice Integration & Exact Reconciliation');

it('verifies all 8 critical midpoint decimals in invoice line items and totals', () => {
  const midpointRates = [1.005, 2.675, 10.005, 0.105, 0.015, 1.999, 99.995, 100.005];

  for (const rate of midpointRates) {
    const invoice = {
      customer: { stateCode: '32' },
      items: [
        {
          description: `Item with rate ${rate}`,
          hsn: '8507',
          qty: 1,
          rate,
          gstRate: 18,
          isTaxInclusive: false,
          discount: 0,
        },
      ],
    };

    const totals = calculateInvoiceTotals(invoice, '32');
    const item = totals.computedItems[0];

    // Verify line level round half up
    assert.strictEqual(item.rate, rate);
    assert.strictEqual(totals.totalTaxableValue, item.taxableValue);
    assert.strictEqual(totals.totalGross, item.lineTotal);
    assert.strictEqual(totals.totalTax, item.totalGstAmount);
    // Difference between lineTotal and sum of rounded components never exceeds 1 paisa (component rounding variance)
    const diff = roundToTwoDecimals(Math.abs(roundToTwoDecimals(item.taxableValue + item.totalGstAmount) - item.lineTotal));
    assert.ok(diff <= 0.01, `Variance ${diff} exceeded 0.01 for rate ${rate}`);
  }
});

console.log('\n================================================================');
console.log(`FINANCIAL PRECISION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
