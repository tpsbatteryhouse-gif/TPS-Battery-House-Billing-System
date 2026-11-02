import { calculateInvoiceTotals } from '../src/utils/gstCalculations.js';
import {
  PRODUCT_CATEGORIES,
  normalizeInvoiceItem,
  formatItemSpecifications,
  INITIAL_PRODUCT_CATALOG,
} from '../src/utils/categories.js';
import { getSampleInvoiceData, DEFAULT_BUSINESS } from '../src/utils/defaults.js';
import { generateVectorPdf } from '../src/utils/pdfExport.js';
import fs from 'fs';
import path from 'path';

let passCount = 0;
let failCount = 0;

function assert(condition, testName, message = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${message}`);
    failCount++;
  }
}

console.log('\n======================================================');
console.log('TPS BATTERYS HOUSE — MULTI-CATEGORY SYSTEM VERIFICATION');
console.log('======================================================\n');

// ----------------------------------------------------
// TEST A: Battery-Only Invoice
// ----------------------------------------------------
console.log('--- TEST A: Battery-Only Invoice ---');
const batteryInvoice = {
  id: 'inv-test-battery',
  invoiceNumber: 'TPS/2026-27/TEST-A',
  invoiceDate: '2026-11-02',
  dueDate: '2026-11-09',
  customer: { stateCode: '32', name: 'Rajan P.' },
  items: [
    {
      id: 'bat-1',
      category: PRODUCT_CATEGORIES.BATTERY,
      name: 'Exide InvaTubular IT500',
      specs: { capacity: '150Ah', voltage: '12V', batteryType: 'Tall Tubular' },
      hsn: '8507',
      serialNo: 'BAT-EX-001',
      warranty: '36 Months',
      qty: 1,
      unit: 'Nos',
      rate: 15500,
      isTaxInclusive: true,
      gstRate: 28,
    },
    {
      id: 'bat-2',
      category: PRODUCT_CATEGORIES.BATTERY,
      name: 'Amaron Current CR1500TT',
      specs: { capacity: '150Ah', voltage: '12V', batteryType: 'Short Tubular' },
      hsn: '8507',
      serialNo: 'BAT-AM-002',
      warranty: '48 Months',
      qty: 1,
      unit: 'Nos',
      rate: 14800,
      isTaxInclusive: true,
      gstRate: 28,
    },
  ],
  scrapExchange: {
    enabled: true,
    description: 'Old 150Ah Scrap Battery Buyback',
    amount: 2200,
  },
  additionalDiscount: 0,
};

const totalsA = calculateInvoiceTotals(batteryInvoice, '32');
assert(totalsA.computedItems.length === 2, 'Test A: Item count is 2');
assert(totalsA.totalGross === 30300, 'Test A: Total gross is ₹30,300');
assert(totalsA.scrapDiscount === 2200, 'Test A: Scrap buyback deduction is ₹2,200');
assert(totalsA.netPayable === 28100, 'Test A: Net payable is ₹28,100 (30,300 - 2,200)');
assert(totalsA.categorySales.battery === 30300, 'Test A: Category sales Battery is ₹30,300');
assert(totalsA.hsnSummary[0].hsn === '8507', 'Test A: HSN 8507 recorded');
assert(totalsA.hsnSummary[0].cgstAmount + totalsA.hsnSummary[0].sgstAmount > 0, 'Test A: CGST+SGST calculated');

// ----------------------------------------------------
// TEST B: Inverter-Only Invoice
// ----------------------------------------------------
console.log('\n--- TEST B: Inverter-Only Invoice ---');
const inverterInvoice = {
  id: 'inv-test-inverter',
  invoiceNumber: 'TPS/2026-27/TEST-B',
  invoiceDate: '2026-11-02',
  dueDate: '2026-11-09',
  customer: { stateCode: '32', name: 'Suresh Kumar' },
  items: [
    {
      id: 'inv-1',
      category: PRODUCT_CATEGORIES.INVERTER,
      name: 'Luminous EcoVolt Neo 1050',
      specs: { capacityVa: '900VA', powerWatts: '756W', waveform: 'Pure Sine Wave' },
      hsn: '8504',
      serialNo: 'INV-LUM-991',
      warranty: '24 Months',
      qty: 1,
      unit: 'Nos',
      rate: 6800,
      isTaxInclusive: true,
      gstRate: 18,
    },
  ],
  scrapExchange: { enabled: false, amount: 0 },
};

const totalsB = calculateInvoiceTotals(inverterInvoice, '32');
assert(totalsB.computedItems.length === 1, 'Test B: 1 Inverter item');
assert(totalsB.categorySales.inverter === 6800, 'Test B: Inverter sales is ₹6,800');
assert(totalsB.hsnSummary[0].hsn === '8504', 'Test B: HSN is 8504');
assert(totalsB.hsnSummary[0].gstRate === 18, 'Test B: GST rate is 18%');
assert(totalsB.netPayable === 6800, 'Test B: Net payable is ₹6,800');

// ----------------------------------------------------
// TEST C: Solar-Only Invoice
// ----------------------------------------------------
console.log('\n--- TEST C: Solar-Only Invoice ---');
const solarInvoice = {
  id: 'inv-test-solar',
  invoiceNumber: 'TPS/2026-27/TEST-C',
  invoiceDate: '2026-11-02',
  dueDate: '2026-11-09',
  customer: { stateCode: '32', name: 'Green Farm' },
  items: [
    {
      id: 'sol-1',
      category: PRODUCT_CATEGORIES.SOLAR,
      name: 'Tata Power Solar 550W Mono PERC Panel',
      specs: { ratedCapacityWp: '550Wp', panelTechnology: 'Mono PERC' },
      hsn: '8541',
      serialNo: 'SOL-TP-550-1, SOL-TP-550-2',
      warranty: '25 Years Performance',
      qty: 2,
      unit: 'Nos',
      rate: 13500,
      isTaxInclusive: true,
      gstRate: 12,
    },
    {
      id: 'sol-2',
      category: PRODUCT_CATEGORIES.SOLAR,
      name: 'Microtek Solar PCU 1435/12V',
      specs: { capacityVa: '1000VA', systemCapacityKw: '1kW' },
      hsn: '8504',
      serialNo: 'PCU-MT-101',
      warranty: '24 Months',
      qty: 1,
      unit: 'Nos',
      rate: 8900,
      isTaxInclusive: true,
      gstRate: 12,
    },
  ],
  scrapExchange: { enabled: false, amount: 0 },
};

const totalsC = calculateInvoiceTotals(solarInvoice, '32');
assert(totalsC.computedItems.length === 2, 'Test C: 2 solar items');
assert(totalsC.totalGross === 2 * 13500 + 8900, 'Test C: Gross is ₹35,900');
assert(totalsC.categorySales.solar === 35900, 'Test C: Solar sales is ₹35,900');
assert(totalsC.hsnSummary.length >= 1, 'Test C: HSN Summary generated');

// ----------------------------------------------------
// TEST D: Mixed-Category Invoice (All 4 categories on one bill!)
// ----------------------------------------------------
console.log('\n--- TEST D: Mixed-Category Invoice (Battery + Inverter + Solar + Service) ---');
const mixedInvoice = getSampleInvoiceData();
const totalsD = calculateInvoiceTotals(mixedInvoice, '32');

assert(totalsD.computedItems.length === 4, 'Test D: 4 distinct line items');
assert(totalsD.categorySales.battery > 0, 'Test D: Battery sales present');
assert(totalsD.categorySales.inverter > 0, 'Test D: Inverter sales present');
assert(totalsD.categorySales.solar > 0, 'Test D: Solar sales present');
assert(totalsD.categorySales.services > 0, 'Test D: Services sales present');

const sumCatSales =
  totalsD.categorySales.battery +
  totalsD.categorySales.inverter +
  totalsD.categorySales.solar +
  totalsD.categorySales.services;
assert(
  Math.abs(sumCatSales - totalsD.totalGross) < 0.05,
  'Test D: Sum of category sales exactly equals total gross (no double counting!)'
);
assert(totalsD.hsnSummary.length === 4, 'Test D: 4 distinct HSN/GST configurations in summary');
assert(totalsD.scrapDiscount === 2500, 'Test D: Scrap battery trade-in deduction active (₹2,500)');
assert(
  totalsD.netPayable === Math.round(totalsD.totalGross - totalsD.scrapDiscount - totalsD.extraDiscount),
  'Test D: Net payable formula matches exactly'
);

// ----------------------------------------------------
// TEST E: Inter-State GST Verification
// ----------------------------------------------------
console.log('\n--- TEST E: GST Verification (Inter-State IGST vs Intra-State CGST/SGST) ---');
const interstateMixed = {
  ...mixedInvoice,
  customer: { ...mixedInvoice.customer, stateCode: '33', state: 'Tamil Nadu' },
};
const totalsE = calculateInvoiceTotals(interstateMixed, '32');
assert(totalsE.isInterstate === true, 'Test E: Detected inter-state supply (KL -> TN)');
assert(totalsE.totalCgst === 0, 'Test E: CGST is 0 for inter-state');
assert(totalsE.totalSgst === 0, 'Test E: SGST is 0 for inter-state');
assert(totalsE.totalIgst > 0, 'Test E: IGST is calculated for all items');
assert(totalsE.totalTax === totalsE.totalIgst, 'Test E: Total tax equals IGST');

// ----------------------------------------------------
// TEST F: Product Catalog Verification
// ----------------------------------------------------
console.log('\n--- TEST F: Product Catalog Functionality ---');
assert(Array.isArray(INITIAL_PRODUCT_CATALOG), 'Test F: Catalog is an array');
assert(INITIAL_PRODUCT_CATALOG.length >= 10, 'Test F: Pre-seeded with realistic TPS products');
const categoriesInCatalog = new Set(INITIAL_PRODUCT_CATALOG.map((p) => p.category));
assert(categoriesInCatalog.has('battery'), 'Test F: Has Battery products');
assert(categoriesInCatalog.has('inverter'), 'Test F: Has Inverter products');
assert(categoriesInCatalog.has('solar'), 'Test F: Has Solar products');
assert(categoriesInCatalog.has('services'), 'Test F: Has Service items');

// Test formatItemSpecifications
const testBatItem = INITIAL_PRODUCT_CATALOG.find((p) => p.category === 'battery');
const specsFormatted = formatItemSpecifications(testBatItem);
assert(specsFormatted.includes('Ah') || specsFormatted.includes('12V'), 'Test F: formatItemSpecifications renders Ah/Voltage');

// ----------------------------------------------------
// TEST G: Backward Compatibility (Legacy Invoices)
// ----------------------------------------------------
console.log('\n--- TEST G: Backward Compatibility with Legacy Invoices ---');
const legacyRawItem = {
  id: 'item-legacy-1',
  name: 'Old Battery 150Ah',
  hsn: '8507',
  qty: 1,
  rate: 12000,
  // NO category field!
};
const normalized = normalizeInvoiceItem(legacyRawItem);
assert(normalized.category === PRODUCT_CATEGORIES.BATTERY, 'Test G: Legacy battery item normalized to "battery"');
assert(normalized.specs !== undefined, 'Test G: Safe specs object assigned');

const legacyServiceItem = {
  id: 'item-legacy-2',
  name: 'Installation and Wiring Charges',
  hsn: '9987',
  qty: 1,
  rate: 1500,
  // NO category field!
};
const normalizedService = normalizeInvoiceItem(legacyServiceItem);
assert(normalizedService.category === PRODUCT_CATEGORIES.SERVICES, 'Test G: Legacy service HSN normalized to "services"');

// ----------------------------------------------------
// TEST H: PDF Generation
// ----------------------------------------------------
console.log('\n--- TEST H: PDF Export Generation ---');
async function testPdfExport() {
  const outputDir = path.resolve('scratch/test_results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const pdfDoc = await generateVectorPdf(mixedInvoice, DEFAULT_BUSINESS, 'Original for Recipient');
  const pdfBytes = pdfDoc.output('arraybuffer');
  const pdfBuffer = Buffer.from(pdfBytes);
  const outPath = path.join(outputDir, 'Test_MultiCategory_Vector.pdf');
  fs.writeFileSync(outPath, pdfBuffer);

  const stats = fs.statSync(outPath);
  assert(stats.size > 0 && stats.size < 120000, `Test H: Vector PDF generated (${Math.round(stats.size / 1024)} KB, ultra-lightweight < 120KB)`);
}

testPdfExport().then(() => {
  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passCount} Passed, ${failCount} Failed.`);
  console.log('======================================================\n');
  if (failCount > 0) {
    process.exit(1);
  }
});
