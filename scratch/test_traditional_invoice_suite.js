import { calculateInvoiceTotals } from '../src/utils/gstCalculations.js';
import { PRODUCT_CATEGORIES } from '../src/utils/categories.js';
import { DEFAULT_BUSINESS } from '../src/utils/defaults.js';
import { generateVectorPdf } from '../src/utils/pdfExport.js';

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
console.log('TPS BATTERYS HOUSE — TRADITIONAL INVOICE TEMPLATE VERIFICATION');
console.log('======================================================\n');

// ----------------------------------------------------
// TEST A: Battery Invoice (2 battery items + warranty + exchange deduction)
// ----------------------------------------------------
console.log('--- TEST A: Battery Invoice ---');
const invA = {
  id: 'inv-test-a',
  invoiceNumber: 'TPS/2026-27/001',
  invoiceDate: '2026-11-02',
  paymentMode: 'Cash',
  paymentStatus: 'Paid',
  customer: {
    name: 'Muhammed Shafi',
    phone: '9846112233',
    address: 'Kalladathur, Koottanad',
    city: 'Thrithala',
    district: 'Palakkad',
    state: 'Kerala',
    stateCode: '32',
    pincode: '679552',
    gstin: '',
  },
  items: [
    {
      id: 'it-a1',
      name: 'Exide InvaMaster 150Ah Tall Tubular Battery (IMTT1500)',
      category: PRODUCT_CATEGORIES.BATTERY,
      hsn: '8507',
      serialNo: 'EXD-IM-8812',
      warranty: '36 Months',
      qty: 1,
      unit: 'Nos',
      rate: 14800,
      isTaxInclusive: true,
      gstRate: 28,
      specs: { capacity: '150Ah', voltage: '12V', batteryType: 'Tall Tubular' },
    },
    {
      id: 'it-a2',
      name: 'Amaron Hi-Life 35Ah Maintenance Free Car Battery',
      category: PRODUCT_CATEGORIES.BATTERY,
      hsn: '8507',
      serialNo: 'AMR-FL-3312',
      warranty: '60 Months',
      qty: 1,
      unit: 'Nos',
      rate: 4300,
      isTaxInclusive: true,
      gstRate: 28,
      specs: { capacity: '35Ah', voltage: '12V', batteryType: 'SMF' },
    },
  ],
  scrapExchange: {
    enabled: true,
    description: 'Old 150Ah Battery Scrap Trade-in',
    amount: 2200,
  },
  additionalDiscount: 0,
};

const totalsA = calculateInvoiceTotals(invA, '32');
assert(totalsA.totalGross === 19100, 'Test A: Total gross is ₹19,100');
assert(totalsA.scrapDiscount === 2200, 'Test A: Scrap trade-in deduction is ₹2,200');
assert(totalsA.netPayable === 16900, 'Test A: Net payable is ₹16,900');
assert(totalsA.amountInWords.toLowerCase().includes('sixteen thousand'), 'Test A: Amount in words generated');

// ----------------------------------------------------
// TEST B: Inverter Invoice (1 inverter + capacity + warranty)
// ----------------------------------------------------
console.log('\n--- TEST B: Inverter Invoice ---');
const invB = {
  id: 'inv-test-b',
  invoiceNumber: 'TPS/2026-27/002',
  invoiceDate: '2026-11-02',
  paymentMode: 'UPI',
  paymentStatus: 'Paid',
  customer: {
    name: 'Dr. Radhakrishnan V.',
    phone: '9447556677',
    address: 'Near Govt Hospital, Thrithala',
    stateCode: '32',
  },
  items: [
    {
      id: 'it-b1',
      name: 'Luminous Eco Volt Neo 1050 Pure Sine Wave Inverter',
      category: PRODUCT_CATEGORIES.INVERTER,
      hsn: '8504',
      serialNo: 'LUM-EV-9921',
      warranty: '24 Months',
      qty: 1,
      unit: 'Nos',
      rate: 6800,
      isTaxInclusive: true,
      gstRate: 18,
      specs: { capacityVa: '900 VA', powerWatts: '756 Watts', voltage: '12V DC', waveform: 'Pure Sine Wave' },
    },
  ],
};

const totalsB = calculateInvoiceTotals(invB, '32');
assert(totalsB.netPayable === 6800, 'Test B: Net payable is ₹6,800');
assert(totalsB.hsnSummary[0].hsn === '8504', 'Test B: HSN 8504 captured');
assert(totalsB.hsnSummary[0].gstRate === 18, 'Test B: GST Rate is 18%');

// ----------------------------------------------------
// TEST C: Solar Invoice (Multiple solar panels + PCU)
// ----------------------------------------------------
console.log('\n--- TEST C: Solar Invoice ---');
const invC = {
  id: 'inv-test-c',
  invoiceNumber: 'TPS/2026-27/003',
  invoiceDate: '2026-11-02',
  paymentMode: 'Bank Transfer (NEFT/RTGS/IMPS)',
  paymentStatus: 'Paid',
  customer: {
    name: 'Kallada Agro Processing Units',
    gstin: '32AABCK9901A1Z5',
    stateCode: '32',
  },
  items: [
    {
      id: 'it-c1',
      name: 'Waaree 550Wp Bifacial Mono PERC Solar Panel Module',
      category: PRODUCT_CATEGORIES.SOLAR,
      hsn: '8541',
      qty: 4,
      unit: 'Nos',
      rate: 13750,
      isTaxInclusive: true,
      gstRate: 12,
      specs: { ratedCapacityWp: '550 Wp', panelTechnology: 'Bifacial Mono PERC' },
    },
  ],
};

const totalsC = calculateInvoiceTotals(invC, '32');
assert(totalsC.netPayable === 55000, 'Test C: Solar total is ₹55,000');
assert(totalsC.hsnSummary[0].hsn === '8541', 'Test C: Solar HSN 8541 captured');

// ----------------------------------------------------
// TEST D: Mixed Invoice (Battery + Inverter + Solar + Service)
// ----------------------------------------------------
console.log('\n--- TEST D: Mixed-Category Invoice ---');
const invD = {
  id: 'inv-test-d',
  invoiceNumber: 'TPS/2026-27/004',
  invoiceDate: '2026-11-02',
  paymentMode: 'Cheque',
  paymentStatus: 'Paid',
  customer: { name: 'Green Valley Agro Farm', stateCode: '32' },
  items: [
    { ...invA.items[0], qty: 1 },
    { ...invB.items[0], qty: 1 },
    { ...invC.items[0], qty: 1 },
    {
      id: 'it-d4',
      name: 'Rooftop Solar Installation & Structure Commissioning',
      category: PRODUCT_CATEGORIES.SERVICES,
      hsn: '9954',
      qty: 1,
      unit: 'Job',
      rate: 5500,
      isTaxInclusive: true,
      gstRate: 18,
      specs: { serviceCategory: 'Solar Installation' },
    },
  ],
  scrapExchange: { enabled: true, amount: 2000 },
};

const totalsD = calculateInvoiceTotals(invD, '32');
assert(totalsD.computedItems.length === 4, 'Test D: 4 distinct category items');
assert(totalsD.hsnSummary.length === 3 || totalsD.hsnSummary.length === 4, 'Test D: Multi-HSN summary map computed');
assert(totalsD.scrapDiscount === 2000, 'Test D: Scrap discount applied');

// ----------------------------------------------------
// TEST E: Multiple GST Rates (28%, 18%, 12%)
// ----------------------------------------------------
console.log('\n--- TEST E: Multiple GST Rates ---');
const ratesPresent = new Set(totalsD.hsnSummary.map((h) => h.gstRate));
assert(ratesPresent.has(28), 'Test E: 28% GST slab present');
assert(ratesPresent.has(18), 'Test E: 18% GST slab present');
assert(ratesPresent.has(12), 'Test E: 12% GST slab present');

// ----------------------------------------------------
// TEST F: Inter-state Invoice (IGST Presentation)
// ----------------------------------------------------
console.log('\n--- TEST F: Inter-State IGST Invoice ---');
const invF = {
  ...invA,
  invoiceNumber: 'TPS/2026-27/IGST-01',
  customer: {
    name: 'Coimbatore Auto Spares Ltd',
    state: 'Tamil Nadu',
    stateCode: '33', // Inter-state (KL -> TN)
    gstin: '33AABCT1234A1Z9',
  },
};

const totalsF = calculateInvoiceTotals(invF, '32');
assert(totalsF.isInterstate === true, 'Test F: Inter-state detected');
assert(totalsF.totalCgst === 0 && totalsF.totalSgst === 0, 'Test F: CGST & SGST are 0');
assert(totalsF.totalIgst > 0, 'Test F: IGST is calculated');
assert(totalsF.totalTax === totalsF.totalIgst, 'Test F: Total tax equals IGST');

// ----------------------------------------------------
// TEST G: Long Invoice (8 items with long descriptions)
// ----------------------------------------------------
console.log('\n--- TEST G: Long Invoice (8 Items) ---');
const longItems = [];
for (let i = 1; i <= 8; i++) {
  longItems.push({
    id: `item-long-${i}`,
    name: `High Performance Power Equipment Model Series #${i} - Heavy Duty Commercial Grade with Extended Reliability`,
    category: i % 2 === 0 ? PRODUCT_CATEGORIES.BATTERY : PRODUCT_CATEGORIES.SOLAR,
    hsn: i % 2 === 0 ? '8507' : '8541',
    qty: i,
    unit: 'Nos',
    rate: 2500 + i * 500,
    isTaxInclusive: true,
    gstRate: i % 2 === 0 ? 28 : 12,
    specs: { capacity: `${100 + i * 20}Ah`, voltage: '12V', warranty: '36 Months Onsite' },
  });
}

const invG = {
  ...invA,
  invoiceNumber: 'TPS/2026-27/LONG-01',
  items: longItems,
};

const totalsG = calculateInvoiceTotals(invG, '32');
assert(totalsG.computedItems.length === 8, 'Test G: 8 items rendered');
assert(totalsG.totalGross > 0, 'Test G: Total gross calculated for long bill');

// ----------------------------------------------------
// TEST H: Empty Optional Fields
// ----------------------------------------------------
console.log('\n--- TEST H: Empty Optional Fields ---');
const invH = {
  invoiceNumber: 'TPS/2026-27/BLANK-01',
  invoiceDate: '2026-11-02',
  paymentMode: 'Cash',
  customer: {
    name: '', // Empty customer name
    phone: '',
    address: '',
    city: '',
    district: '',
    stateCode: '',
    gstin: '',
    pan: '',
  },
  ewayBillNo: '',
  poNumber: '',
  irn: '',
  items: [
    {
      name: 'General Battery Item',
      hsn: '',
      qty: 1,
      rate: 1000,
      isTaxInclusive: true,
      gstRate: 28,
    },
  ],
};

const totalsH = calculateInvoiceTotals(invH, '32');
assert(totalsH.netPayable === 1000, 'Test H: Gracefully computes with missing fields');

// ----------------------------------------------------
// TEST I: PDF Generation for Traditional Template
// ----------------------------------------------------
console.log('\n--- TEST I: PDF Generation ---');
async function runPdfTests() {
  const pdfDocA = await generateVectorPdf(invA, DEFAULT_BUSINESS, 'Original for Buyer');
  const bufferA = Buffer.from(pdfDocA.output('arraybuffer'));
  assert(bufferA.length > 20000 && bufferA.length < 200000, `Test I.1: Vector PDF A generated (${Math.round(bufferA.length / 1024)} KB)`);

  const pdfDocD = await generateVectorPdf(invD, DEFAULT_BUSINESS, 'Original for Buyer');
  const bufferD = Buffer.from(pdfDocD.output('arraybuffer'));
  assert(bufferD.length > 20000 && bufferD.length < 200000, `Test I.2: Vector PDF D generated (${Math.round(bufferD.length / 1024)} KB)`);

  const pdfDocG = await generateVectorPdf(invG, DEFAULT_BUSINESS, 'Original for Buyer');
  const bufferG = Buffer.from(pdfDocG.output('arraybuffer'));
  assert(bufferG.length > 20000 && bufferG.length < 250000, `Test I.3: Vector PDF G (Long invoice) generated (${Math.round(bufferG.length / 1024)} KB)`);

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passCount} Passed, ${failCount} Failed.`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPdfTests();
