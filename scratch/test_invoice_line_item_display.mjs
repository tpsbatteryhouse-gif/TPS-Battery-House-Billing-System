/**
 * TPS BATTERY HOUSE — INVOICE LINE ITEM DISPLAY & CARD TOTAL TEST SUITE
 *
 * Verifies all 14 required line item display & calculation scenarios:
 * 1. Battery: Qty 2 × Rate 14,800.00 (tax incl, 28%) -> Card shows ₹29,600.00 (NOT ₹0.00)
 * 2. Inverter: Qty 1 × Rate 28,500.00 (tax incl, 18%) -> Card shows ₹28,500.00 (NOT ₹0.00)
 * 3. Solar Panel: Qty 4 × Rate 12,000.00 (tax incl, 12%) -> Card shows ₹48,000.00
 * 4. Service: Qty 1 × Rate 1,500.00 (tax incl, 18%) -> Card shows ₹1,500.00
 * 5. Single item: Qty 1 × Rate 14,800.00 -> Card shows ₹14,800.00
 * 6. Tax-exclusive item: Qty 2 × Rate 10,000.00 + 18% GST -> Card shows ₹23,600.00
 * 7. Item with discount: Qty 2 × Rate 10,000.00 - 1,000.00 discount -> Card shows ₹19,000.00
 * 8. Decimal quantity: Qty 2.5 × Rate 1,000.00 -> Card shows ₹2,500.00
 * 9. Large quantity: Qty 100 × Rate 500.00 -> Card shows ₹50,000.00
 * 10. Zero-rate / promotional item: Qty 1 × Rate 0.00 -> Card shows ₹0.00 (valid zero, not undefined)
 * 11. Multi-item invoice: Card 1 (₹29,600.00) + Card 2 (₹28,500.00) = Summary Subtotal (₹58,100.00) EXACT MATCH
 * 12. Card total updates reactively when quantity increases (1 -> 2: ₹14,800 -> ₹29,600)
 * 13. Card total updates reactively when price changes (₹14,800 -> ₹15,000)
 * 14. Card total updates reactively when item discount is applied
 */

import assert from 'assert';
import {
  calculateLineItem,
  calculateInvoiceTotals,
} from '../src/utils/gstCalculations.js';
import { formatNumber } from '../src/utils/numberToWords.js';
import { PRODUCT_CATEGORIES } from '../src/utils/categories.js';

let passed = 0;
let failed = 0;

function it(title, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${title}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${title}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('TPS BATTERY HOUSE — LINE ITEM DISPLAY & CARD TOTAL TEST SUITE');
console.log('================================================================\n');

// Helper simulating InvoiceItemRow display logic
function getCardTotalDisplay(item, isInterstate = false) {
  const lineCalcs = calculateLineItem(item, isInterstate);
  assert(lineCalcs.lineTotal !== undefined, 'lineCalcs.lineTotal must be defined');
  assert(lineCalcs.total !== undefined, 'lineCalcs.total must be defined as an alias');
  assert.strictEqual(
    lineCalcs.lineTotal,
    lineCalcs.total,
    'lineCalcs.lineTotal and lineCalcs.total must match exactly'
  );
  const totalVal = lineCalcs.lineTotal ?? lineCalcs.total;
  return `₹${formatNumber(totalVal)}`;
}

// SCENARIO 1
it('Scenario 1: Battery Qty 2 × Rate 14,800.00 (tax incl, 28%) -> Card shows ₹29,600.00 (NOT ₹0.00)', () => {
  const item = {
    category: PRODUCT_CATEGORIES.BATTERY,
    description: 'Exide InvaMaster 150Ah Tall Tubular Battery',
    qty: 2,
    rate: 14800,
    gstRate: 28,
    isTaxInclusive: true,
  };
  const display = getCardTotalDisplay(item);
  assert.strictEqual(display, '₹29,600.00');
  assert.notStrictEqual(display, '₹0.00');
});

// SCENARIO 2
it('Scenario 2: Inverter Qty 1 × Rate 28,500.00 (tax incl, 18%) -> Card shows ₹28,500.00 (NOT ₹0.00)', () => {
  const item = {
    category: PRODUCT_CATEGORIES.INVERTER,
    description: 'Luminous Cruze 2.5kVA Pure Sine Wave Inverter',
    qty: 1,
    rate: 28500,
    gstRate: 18,
    isTaxInclusive: true,
  };
  const display = getCardTotalDisplay(item);
  assert.strictEqual(display, '₹28,500.00');
  assert.notStrictEqual(display, '₹0.00');
});

// SCENARIO 3
it('Scenario 3: Solar Panel Qty 4 × Rate 12,000.00 (tax incl, 12%) -> Card shows ₹48,000.00', () => {
  const item = {
    category: PRODUCT_CATEGORIES.SOLAR,
    description: 'Waaree 550Wp Bifacial Solar Panel',
    qty: 4,
    rate: 12000,
    gstRate: 12,
    isTaxInclusive: true,
  };
  const display = getCardTotalDisplay(item);
  assert.strictEqual(display, '₹48,000.00');
});

// SCENARIO 4
it('Scenario 4: Service Qty 1 × Rate 1,500.00 (tax incl, 18%) -> Card shows ₹1,500.00', () => {
  const item = {
    category: PRODUCT_CATEGORIES.SERVICE,
    description: 'Home Inverter Wiring & Installation',
    qty: 1,
    rate: 1500,
    gstRate: 18,
    isTaxInclusive: true,
  };
  const display = getCardTotalDisplay(item);
  assert.strictEqual(display, '₹1,500.00');
});

// SCENARIO 5
it('Scenario 5: Single item Qty 1 × Rate 14,800.00 -> Card shows ₹14,800.00', () => {
  const item = {
    category: PRODUCT_CATEGORIES.BATTERY,
    description: 'Exide InvaMaster 150Ah Tall Tubular Battery',
    qty: 1,
    rate: 14800,
    gstRate: 28,
    isTaxInclusive: true,
  };
  const display = getCardTotalDisplay(item);
  assert.strictEqual(display, '₹14,800.00');
});

// SCENARIO 6
it('Scenario 6: Tax-exclusive item Qty 2 × Rate 10,000.00 + 18% GST -> Card shows ₹23,600.00', () => {
  const item = {
    category: PRODUCT_CATEGORIES.INVERTER,
    description: 'Commercial Backup System',
    qty: 2,
    rate: 10000,
    gstRate: 18,
    isTaxInclusive: false,
  };
  const display = getCardTotalDisplay(item);
  assert.strictEqual(display, '₹23,600.00');
});

// SCENARIO 7
it('Scenario 7: Item with discount Qty 2 × Rate 10,000.00 - 1,000.00 discount -> Card shows ₹19,000.00', () => {
  const item = {
    category: PRODUCT_CATEGORIES.BATTERY,
    description: 'Discounted Battery Pack',
    qty: 2,
    rate: 10000,
    gstRate: 18,
    isTaxInclusive: true,
    discount: 1000,
  };
  const display = getCardTotalDisplay(item);
  assert.strictEqual(display, '₹19,000.00');
});

// SCENARIO 8
it('Scenario 8: Decimal quantity Qty 2.5 × Rate 1,000.00 -> Card shows ₹2,500.00', () => {
  const item = {
    category: PRODUCT_CATEGORIES.SERVICE,
    description: 'Electrical Cabling Work',
    qty: 2.5,
    rate: 1000,
    gstRate: 18,
    isTaxInclusive: true,
  };
  const display = getCardTotalDisplay(item);
  assert.strictEqual(display, '₹2,500.00');
});

// SCENARIO 9
it('Scenario 9: Large quantity Qty 100 × Rate 500.00 -> Card shows ₹50,000.00', () => {
  const item = {
    category: PRODUCT_CATEGORIES.BATTERY,
    description: 'Battery Terminals & Connectors',
    qty: 100,
    rate: 500,
    gstRate: 18,
    isTaxInclusive: true,
  };
  const display = getCardTotalDisplay(item);
  assert.strictEqual(display, '₹50,000.00');
});

// SCENARIO 10
it('Scenario 10: Zero-rate / promotional item Qty 1 × Rate 0.00 -> Card shows ₹0.00 (not undefined or missing)', () => {
  const item = {
    category: PRODUCT_CATEGORIES.SERVICE,
    description: 'Complimentary Battery Health Checkup',
    qty: 1,
    rate: 0,
    gstRate: 18,
    isTaxInclusive: true,
  };
  const lineCalcs = calculateLineItem(item);
  assert.strictEqual(lineCalcs.lineTotal, 0);
  assert.strictEqual(lineCalcs.total, 0);
  const display = getCardTotalDisplay(item);
  assert.strictEqual(display, '₹0.00');
});

// SCENARIO 11
it('Scenario 11: Multi-item invoice Card 1 (₹29,600.00) + Card 2 (₹28,500.00) = Summary Subtotal (₹58,100.00) EXACT MATCH', () => {
  const item1 = {
    category: PRODUCT_CATEGORIES.BATTERY,
    description: 'Exide InvaMaster 150Ah Tall Tubular Battery',
    qty: 2,
    rate: 14800,
    gstRate: 28,
    isTaxInclusive: true,
  };
  const item2 = {
    category: PRODUCT_CATEGORIES.INVERTER,
    description: 'Luminous Cruze 2.5kVA Pure Sine Wave Inverter',
    qty: 1,
    rate: 28500,
    gstRate: 18,
    isTaxInclusive: true,
  };

  const calc1 = calculateLineItem(item1);
  const calc2 = calculateLineItem(item2);

  assert.strictEqual(calc1.lineTotal, 29600);
  assert.strictEqual(calc2.lineTotal, 28500);

  const cardSum = calc1.lineTotal + calc2.lineTotal;
  assert.strictEqual(cardSum, 58100);

  const invoice = {
    items: [item1, item2],
    customer: { stateCode: '32' },
  };

  const totals = calculateInvoiceTotals(invoice, '32');
  assert.strictEqual(totals.totalGross, 58100);
  assert.strictEqual(cardSum, totals.totalGross, 'Card sum must equal Bill Summary totalGross');
});

// SCENARIO 12
it('Scenario 12: Card total updates reactively when quantity increases (1 -> 2: ₹14,800 -> ₹29,600)', () => {
  const item = {
    category: PRODUCT_CATEGORIES.BATTERY,
    qty: 1,
    rate: 14800,
    gstRate: 28,
    isTaxInclusive: true,
  };
  assert.strictEqual(getCardTotalDisplay(item), '₹14,800.00');

  const updatedItem = { ...item, qty: 2 };
  assert.strictEqual(getCardTotalDisplay(updatedItem), '₹29,600.00');
});

// SCENARIO 13
it('Scenario 13: Card total updates reactively when price changes (₹14,800 -> ₹15,000)', () => {
  const item = {
    category: PRODUCT_CATEGORIES.BATTERY,
    qty: 2,
    rate: 14800,
    gstRate: 28,
    isTaxInclusive: true,
  };
  assert.strictEqual(getCardTotalDisplay(item), '₹29,600.00');

  const updatedItem = { ...item, rate: 15000 };
  assert.strictEqual(getCardTotalDisplay(updatedItem), '₹30,000.00');
});

// SCENARIO 14
it('Scenario 14: Card total updates reactively when item discount is applied', () => {
  const item = {
    category: PRODUCT_CATEGORIES.BATTERY,
    qty: 2,
    rate: 14800,
    gstRate: 28,
    isTaxInclusive: true,
    discount: 0,
  };
  assert.strictEqual(getCardTotalDisplay(item), '₹29,600.00');

  const discountedItem = { ...item, discount: 600 };
  assert.strictEqual(getCardTotalDisplay(discountedItem), '₹29,000.00');
});

console.log('\n================================================================');
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
