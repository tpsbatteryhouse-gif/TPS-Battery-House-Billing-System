/**
 * TPS Battery House — Phase 5.1 Independent GST Calculation Verification Suite
 */

import { calculateLineItem, calculateInvoiceTotals, buildUpiUri } from '../src/utils/gstCalculations.js';
import { PRODUCT_CATEGORIES } from '../src/utils/categories.js';

console.log('=== STARTING INDEPENDENT GST & FINANCIAL ENGINE VERIFICATION ===\n');

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ✖ [FAIL] ${message}`);
  }
}

function runGstVerification() {
  console.log('--- 1. GST SLABS & TAX INCLUSIVE PRICING ---');
  // Slabs: 0%, 5%, 12%, 18%, 28%
  const slabs = [0, 5, 12, 18, 28];
  for (const slab of slabs) {
    const item = calculateLineItem({
      qty: 1,
      rate: 1000,
      gstRate: slab,
      isTaxInclusive: true
    }, false);

    assert(item.lineTotal === 1000, `Inclusive slab ${slab}% lineTotal is exact ₹1,000.00`);
    const expectedTaxable = slab === 0 ? 1000 : Number((1000 / (1 + slab / 100)).toFixed(2));
    assert(item.taxableValue === expectedTaxable, `Inclusive slab ${slab}% taxableValue matches formula (${expectedTaxable})`);
    const expectedTotalTax = Number((1000 - expectedTaxable).toFixed(2));
    assert(item.totalGstAmount === expectedTotalTax, `Inclusive slab ${slab}% totalGstAmount is ${expectedTotalTax}`);
    assert(item.cgstAmount === Number((expectedTotalTax / 2).toFixed(2)), `Inclusive slab ${slab}% CGST is exactly half`);
    assert(item.sgstAmount === Number((expectedTotalTax / 2).toFixed(2)), `Inclusive slab ${slab}% SGST is exactly half`);
  }

  console.log('\n--- 2. GST EXCLUSIVE PRICING ---');
  for (const slab of slabs) {
    const item = calculateLineItem({
      qty: 2,
      rate: 500, // Subtotal 1,000
      gstRate: slab,
      isTaxInclusive: false
    }, false);

    assert(item.taxableValue === 1000, `Exclusive slab ${slab}% taxableValue is exact ₹1,000.00`);
    const expectedTax = Number((1000 * (slab / 100)).toFixed(2));
    assert(item.totalGstAmount === expectedTax, `Exclusive slab ${slab}% totalGstAmount is ${expectedTax}`);
    assert(item.lineTotal === Number((1000 + expectedTax).toFixed(2)), `Exclusive slab ${slab}% lineTotal includes tax (${1000 + expectedTax})`);
  }

  console.log('\n--- 3. INTRASTATE (CGST + SGST) VS INTERSTATE (IGST) ---');
  // Intrastate: Kerala (32) to Kerala (32)
  const intraInvoice = {
    customer: { stateCode: '32' },
    items: [{ qty: 1, rate: 10000, gstRate: 18, isTaxInclusive: false }]
  };
  const intraTotals = calculateInvoiceTotals(intraInvoice, '32');
  assert(intraTotals.isInterstate === false, 'Intrastate detected correctly');
  assert(intraTotals.totalCgst === 900, 'Intrastate CGST is 9% (₹900.00)');
  assert(intraTotals.totalSgst === 900, 'Intrastate SGST is 9% (₹900.00)');
  assert(intraTotals.totalIgst === 0, 'Intrastate IGST is 0');
  assert(intraTotals.totalTax === 1800, 'Intrastate total tax is ₹1,800.00');

  // Interstate: Kerala (32) to Karnataka (29)
  const interInvoice = {
    customer: { stateCode: '29' },
    items: [{ qty: 1, rate: 10000, gstRate: 18, isTaxInclusive: false }]
  };
  const interTotals = calculateInvoiceTotals(interInvoice, '32');
  assert(interTotals.isInterstate === true, 'Interstate detected correctly');
  assert(interTotals.totalCgst === 0, 'Interstate CGST is 0');
  assert(interTotals.totalSgst === 0, 'Interstate SGST is 0');
  assert(interTotals.totalIgst === 1800, 'Interstate IGST is full 18% (₹1,800.00)');
  assert(interTotals.totalTax === 1800, 'Interstate total tax is ₹1,800.00');

  console.log('\n--- 4. ITEM DISCOUNTS, INVOICE DISCOUNTS & SCRAP BUYBACK ---');
  const discountInvoice = {
    customer: { stateCode: '32' },
    items: [
      {
        qty: 1,
        rate: 10000,
        gstRate: 18,
        discount: 1000, // Item discount ₹1,000
        isTaxInclusive: false,
        category: PRODUCT_CATEGORIES.BATTERY,
        hsn: '8507'
      }
    ],
    scrapExchange: { enabled: true, amount: 1500 }, // Scrap exchange ₹1,500
    additionalDiscount: 500 // Special invoice discount ₹500
  };
  const discountTotals = calculateInvoiceTotals(discountInvoice, '32');
  assert(discountTotals.totalTaxableValue === 9000, 'Taxable value after line discount is ₹9,000.00');
  assert(discountTotals.totalTax === 1620, 'Tax 18% on ₹9,000 is ₹1,620.00');
  assert(discountTotals.totalGross === 10620, 'Gross total before deductions is ₹10,620.00');
  assert(discountTotals.scrapDiscount === 1500, 'Scrap discount recorded as ₹1,500.00');
  assert(discountTotals.extraDiscount === 500, 'Extra discount recorded as ₹500.00');
  // Net = 10,620 - 1,500 - 500 = 8,620
  assert(discountTotals.subtotalAfterDeductions === 8620, 'Subtotal after deductions is ₹8,620.00');
  assert(discountTotals.netPayable === 8620, 'Net payable matches ₹8,620.00');

  console.log('\n--- 5. FRACTIONAL QUANTITIES ---');
  const fractionalItem = calculateLineItem({
    qty: 2.75, // 2.75 Liters or meters
    rate: 150.50,
    gstRate: 18,
    isTaxInclusive: false
  });
  // 2.75 * 150.50 = 413.875 -> 413.88
  assert(fractionalItem.taxableValue === 413.88, 'Fractional quantity taxable value correctly rounded to 2 decimals');
  // 413.875 * 0.18 = 74.4975 -> 74.50
  assert(fractionalItem.totalGstAmount === 74.50, 'Fractional quantity tax correctly rounded');

  console.log('\n--- 6. MULTI-TAX RATE INVOICE & HSN SUMMARY ---');
  const multiTaxInvoice = {
    customer: { stateCode: '32' },
    items: [
      { name: 'Lead Acid Battery', qty: 1, rate: 8000, gstRate: 28, isTaxInclusive: false, hsn: '8507', category: PRODUCT_CATEGORIES.BATTERY },
      { name: 'Solar Inverter', qty: 1, rate: 12000, gstRate: 18, isTaxInclusive: false, hsn: '8504', category: PRODUCT_CATEGORIES.INVERTER },
      { name: 'Solar Panel', qty: 1, rate: 5000, gstRate: 12, isTaxInclusive: false, hsn: '8541', category: PRODUCT_CATEGORIES.SOLAR },
      { name: 'Installation Service', qty: 1, rate: 1500, gstRate: 18, isTaxInclusive: false, hsn: '9987', category: PRODUCT_CATEGORIES.SERVICES }
    ]
  };
  const multiTotals = calculateInvoiceTotals(multiTaxInvoice, '32');
  assert(multiTotals.hsnSummary.length === 4, 'HSN summary groups into 4 distinct entries');
  const hsn8507 = multiTotals.hsnSummary.find(h => h.hsn === '8507');
  assert(hsn8507.taxableValue === 8000 && hsn8507.totalTax === 2240, 'HSN 8507 (28%) tax accurately computed (₹2,240.00)');
  const hsn8504 = multiTotals.hsnSummary.find(h => h.hsn === '8504');
  assert(hsn8504.taxableValue === 12000 && hsn8504.totalTax === 2160, 'HSN 8504 (18%) tax accurately computed (₹2,160.00)');
  
  // Category sales breakdown
  assert(multiTotals.categorySales[PRODUCT_CATEGORIES.BATTERY] === 10240, 'Battery category total matches ₹10,240.00');
  assert(multiTotals.categorySales[PRODUCT_CATEGORIES.INVERTER] === 14160, 'Inverter category total matches ₹14,160.00');
  assert(multiTotals.categorySales[PRODUCT_CATEGORIES.SOLAR] === 5600, 'Solar category total matches ₹5,600.00');
  assert(multiTotals.categorySales[PRODUCT_CATEGORIES.SERVICES] === 1770, 'Services category total matches ₹1,770.00');

  console.log('\n--- 7. EXTREME VALUES, DECIMALS & INVALID INPUTS ---');
  // Zero value item
  const zeroItem = calculateLineItem({ qty: 1, rate: 0, gstRate: 18 });
  assert(zeroItem.taxableValue === 0 && zeroItem.lineTotal === 0, 'Zero-value item returns zero without NaN');

  // Small decimal value
  const smallItem = calculateLineItem({ qty: 1, rate: 0.05, gstRate: 18, isTaxInclusive: false });
  assert(smallItem.taxableValue === 0.05 && smallItem.lineTotal === 0.06, 'Small decimal values handle rounding cleanly');

  // Large total (10 Crores)
  const largeInvoice = {
    customer: { stateCode: '32' },
    items: [{ qty: 10000, rate: 100000, gstRate: 18, isTaxInclusive: false }] // 100 Cr
  };
  const largeTotals = calculateInvoiceTotals(largeInvoice, '32');
  assert(largeTotals.totalTaxableValue === 1000000000, 'Large ₹100 Crore invoice taxable value is 1,000,000,000.00');
  assert(largeTotals.totalTax === 180000000, 'Large invoice tax is ₹180,000,000.00');
  assert(largeTotals.amountInWords.includes('Arab') || largeTotals.amountInWords.includes('Crore') || largeTotals.amountInWords.includes('One Hundred'), 'Number to Indian words formats huge amounts');

  // Negative and invalid inputs clamped
  const negItem = calculateLineItem({ qty: -5, rate: -100, gstRate: -18, discount: -50 });
  assert(negItem.rate === 0 && negItem.lineTotal === 0 && negItem.qty >= 0, 'Negative rate clamped to 0, qty clamped to safe minimum');

  console.log('\n--- 8. ROUNDING POLICIES & BOUNDARIES ---');
  // Auto round-off
  const boundaryInvoice1 = {
    customer: { stateCode: '32' },
    items: [{ qty: 1, rate: 100.49, gstRate: 0, isTaxInclusive: false }]
  };
  const b1 = calculateInvoiceTotals(boundaryInvoice1, '32');
  assert(b1.netPayable === 100 && b1.roundOff === -0.49, '100.49 rounds DOWN to 100 with roundOff -0.49');

  const boundaryInvoice2 = {
    customer: { stateCode: '32' },
    items: [{ qty: 1, rate: 100.50, gstRate: 0, isTaxInclusive: false }]
  };
  const b2 = calculateInvoiceTotals(boundaryInvoice2, '32');
  assert(b2.netPayable === 101 && b2.roundOff === 0.50, '100.50 rounds UP to 101 with roundOff +0.50');

  // Manual round-off
  const manualRoundInvoice = {
    customer: { stateCode: '32' },
    items: [{ qty: 1, rate: 1000, gstRate: 0, isTaxInclusive: false }],
    roundOffManual: -25
  };
  const manualTotals = calculateInvoiceTotals(manualRoundInvoice, '32');
  assert(manualTotals.roundOff === -25 && manualTotals.netPayable === 975, 'Manual roundOff overrides auto round-off accurately');

  console.log('\n--- 9. STORED INVOICE VS PDF EXPORT TOTALS RECONCILIATION ---');
  // Verify that UPI URI and amount in words reconcile exactly
  const upiUri = buildUpiUri('9846830532@okaxis', 'TPS BATTERYS HOUSE', intraTotals.netPayable, 'TPS/2026-27/001');
  assert(upiUri.includes('am=11800.00'), 'UPI URI includes exact formatted net payable (am=11800.00)');
  assert(upiUri.includes('tn=Bill%20TPS%2F2026-27%2F001'), 'UPI URI includes invoice number reference');

  console.log('\n======================================================');
  console.log(`GST & FINANCIAL ENGINE VERIFICATION COMPLETE`);
  console.log(`TOTAL TESTS:  ${total}`);
  console.log(`PASSED TESTS: ${passed}`);
  console.log(`FAILED TESTS: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runGstVerification();
