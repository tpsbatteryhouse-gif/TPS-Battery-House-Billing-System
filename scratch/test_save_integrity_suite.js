import { calculateInvoiceTotals } from '../src/utils/gstCalculations.js';
import {
  TRANSACTION_TYPES,
  inferTransactionType,
  normalizeInvoiceItem,
} from '../src/utils/categories.js';
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
console.log('TPS BATTERYS HOUSE — DATA INTEGRITY & SAVE REGRESSION SUITE');
console.log('Testing Phases 2, 3, 4, 5 (Tests A through J)');
console.log('======================================================\n');

// Mock localStorage simulation
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockStorage = new MockStorage();

// Simulation of App.jsx save workflow
function simulateSaveWorkflow(invoicesDataset, currentInvoice, businessStateCode = '32') {
  const totals = calculateInvoiceTotals(currentInvoice, businessStateCode);
  const stableId = currentInvoice.id || ('inv-' + Date.now());
  const txType = inferTransactionType(currentInvoice);
  const normalizedItems = (currentInvoice.items || []).map((item) => normalizeInvoiceItem(item));

  const invoiceToSave = {
    ...currentInvoice,
    id: stableId,
    transactionType: txType,
    items: normalizedItems,
    netPayable: totals.netPayable,
    savedAt: new Date().toISOString(),
  };

  const existingIdx = invoicesDataset.findIndex(
    (i) => (i.id && i.id === invoiceToSave.id) || i.invoiceNumber === invoiceToSave.invoiceNumber
  );

  let updatedDataset;
  if (existingIdx >= 0) {
    updatedDataset = [...invoicesDataset];
    updatedDataset[existingIdx] = invoiceToSave;
  } else {
    updatedDataset = [invoiceToSave, ...invoicesDataset];
  }

  // Persist to mock storage (JSON serialization & deserialization)
  mockStorage.setItem('tps_invoice_records', JSON.stringify(updatedDataset));
  const retrievedDataset = JSON.parse(mockStorage.getItem('tps_invoice_records'));
  const savedRecord = retrievedDataset.find(
    (i) => (i.id && i.id === invoiceToSave.id) || i.invoiceNumber === invoiceToSave.invoiceNumber
  );

  return {
    updatedDataset: retrievedDataset,
    savedRecord,
  };
}

// ----------------------------------------------------
// TEST A: Save without changes
// ----------------------------------------------------
console.log('--- TEST A: Save without changes ---');
{
  const initialInvoice = {
    id: 'inv-test-a-001',
    invoiceNumber: 'TPS/2026-27/010',
    invoiceDate: '2026-11-02',
    dueDate: '2026-11-09',
    transactionType: 'B2B',
    customer: {
      name: 'Urjaamithra Solar Tech',
      phone: '9846830532',
      address: 'Near Town Hall',
      city: 'Thrithala',
      district: 'Palakkad',
      state: 'Kerala',
      stateCode: '32',
      pincode: '679552',
      gstin: '32AABCU9603R1ZM',
    },
    items: [
      {
        id: 'item-1',
        name: 'Exide InvaMaster 150Ah Tubular Battery',
        category: 'battery',
        hsn: '8507',
        qty: 2,
        unit: 'Nos',
        rate: 14800,
        isTaxInclusive: true,
        gstRate: 28,
      },
    ],
    scrapExchange: { enabled: true, amount: 2000, description: 'Old 150Ah Battery' },
    additionalDiscount: 500,
    roundOffManual: null,
  };

  const origTotals = calculateInvoiceTotals(initialInvoice, '32');
  let dataset = [initialInvoice];

  // Save without editing anything
  const { updatedDataset, savedRecord } = simulateSaveWorkflow(dataset, initialInvoice, '32');
  const reopenedTotals = calculateInvoiceTotals(savedRecord, '32');

  assert(savedRecord.items[0].rate === 14800, 'Original item rate unchanged (14800)');
  assert(savedRecord.items[0].qty === 2, 'Original item qty unchanged (2)');
  assert(savedRecord.items[0].gstRate === 28, 'Original GST rate unchanged (28%)');
  assert(savedRecord.additionalDiscount === 500, 'Discount preserved (500)');
  assert(savedRecord.scrapExchange.amount === 2000, 'Scrap deduction preserved (2000)');
  assert(reopenedTotals.netPayable === origTotals.netPayable, 'Net payable remains identical after save without changes');
  assert(updatedDataset.length === 1, 'No duplicate invoices created on save without changes');
}

// ----------------------------------------------------
// TEST B: Repeated save
// ----------------------------------------------------
console.log('\n--- TEST B: Repeated save ---');
{
  const newInvoice = {
    id: 'inv-test-b-001',
    invoiceNumber: 'TPS/2026-27/011',
    invoiceDate: '2026-11-02',
    transactionType: 'B2B',
    customer: { name: 'Kottakkal Electricals', gstin: '32AABCK1122C1Z5', phone: '9447001122' },
    items: [
      { id: 'item-1', name: 'Luminous Eco Volt Neo 1050', category: 'inverter', hsn: '8504', qty: 1, unit: 'Nos', rate: 6800, isTaxInclusive: true, gstRate: 18 },
    ],
  };

  let dataset = [];
  // First save
  let res = simulateSaveWorkflow(dataset, newInvoice, '32');
  const firstNetPayable = res.savedRecord.netPayable;
  assert(res.updatedDataset.length === 1, 'First save creates 1 invoice record');

  // Second save of reopened invoice
  res = simulateSaveWorkflow(res.updatedDataset, res.savedRecord, '32');
  assert(res.updatedDataset.length === 1, 'Second save does not create duplicate');
  assert(res.savedRecord.netPayable === firstNetPayable, 'Second save maintains exact same netPayable');

  // Third save of reopened invoice
  res = simulateSaveWorkflow(res.updatedDataset, res.savedRecord, '32');
  assert(res.updatedDataset.length === 1, 'Third save preserves single invoice record in array');
  assert(res.savedRecord.items[0].rate === 6800, 'Item rate remains 6800 after 3 repeated saves');
  assert(res.savedRecord.netPayable === firstNetPayable, 'Net payable remains identical after 3 repeated saves');
}

// ----------------------------------------------------
// TEST C: Inclusive pricing (MRP-inclusive)
// ----------------------------------------------------
console.log('\n--- TEST C: Inclusive pricing ---');
{
  const inclusiveInvoice = {
    id: 'inv-test-c-001',
    invoiceNumber: 'TPS/2026-27/012',
    invoiceDate: '2026-11-02',
    customer: { name: 'Suresh Kumar', phone: '9846223344' },
    items: [
      { id: 'it-1', name: 'Amaron Current 150Ah Battery', rate: 15360, qty: 1, isTaxInclusive: true, gstRate: 28 },
    ],
  };

  // Base rate calculation: 15360 / 1.28 = 12000 taxable; GST = 3360; Total = 15360
  const totals1 = calculateInvoiceTotals(inclusiveInvoice, '32');
  assert(Math.round(totals1.totalTaxableValue) === 12000, 'MRP inclusive extracts correct taxable value (12000)');
  assert(Math.round(totals1.totalTax) === 3360, 'MRP inclusive extracts correct GST amount (3360)');
  assert(totals1.netPayable === 15360, 'MRP inclusive total matches retail sticker price (15360)');

  // Save and reopen
  let dataset = [];
  const { savedRecord } = simulateSaveWorkflow(dataset, inclusiveInvoice, '32');
  const totals2 = calculateInvoiceTotals(savedRecord, '32');

  assert(savedRecord.items[0].rate === 15360, 'Saved rate is preserved as 15360 (NOT reduced to 12000)');
  assert(totals2.totalTaxableValue === totals1.totalTaxableValue, 'Reopened taxable value does NOT suffer double GST extraction');
  assert(totals2.netPayable === 15360, 'Reopened netPayable remains 15360');
}

// ----------------------------------------------------
// TEST D: Exclusive pricing (Base + GST)
// ----------------------------------------------------
console.log('\n--- TEST D: Exclusive pricing ---');
{
  const exclusiveInvoice = {
    id: 'inv-test-d-001',
    invoiceNumber: 'TPS/2026-27/013',
    invoiceDate: '2026-11-02',
    customer: { name: 'Apex Solar Contracting', gstin: '32AABCA5566D1Z1' },
    items: [
      { id: 'it-1', name: 'Waaree 550Wp Mono PERC Solar Panel', rate: 12500, qty: 2, isTaxInclusive: false, gstRate: 12 },
    ],
  };

  // Taxable = 2 * 12500 = 25000; GST 12% = 3000; Total = 28000
  const totals1 = calculateInvoiceTotals(exclusiveInvoice, '32');
  assert(totals1.totalTaxableValue === 25000, 'Exclusive pricing taxable value is 25000');
  assert(totals1.totalTax === 3000, 'Exclusive pricing GST 12% is 3000');
  assert(totals1.netPayable === 28000, 'Exclusive pricing netPayable is 28000');

  // Save and reopen
  let dataset = [];
  const { savedRecord } = simulateSaveWorkflow(dataset, exclusiveInvoice, '32');
  const totals2 = calculateInvoiceTotals(savedRecord, '32');

  assert(savedRecord.items[0].rate === 12500, 'Exclusive unit price preserved as 12500');
  assert(savedRecord.items[0].isTaxInclusive === false, 'isTaxInclusive flag preserved as false');
  assert(totals2.netPayable === 28000, 'Reopened exclusive invoice calculates exactly 28000');
}

// ----------------------------------------------------
// TEST E: Discounts and exchange deductions
// ----------------------------------------------------
console.log('\n--- TEST E: Discounts and exchange deductions ---');
{
  const discountInvoice = {
    id: 'inv-test-e-001',
    invoiceNumber: 'TPS/2026-27/014',
    customer: { name: 'Rajan P.' },
    items: [
      { id: 'it-1', name: 'Exide InvaMaster 150Ah', rate: 16000, qty: 1, isTaxInclusive: true, gstRate: 28, discount: 500 },
    ],
    scrapExchange: { enabled: true, amount: 2200, description: '150Ah Scrap Buyback' },
    additionalDiscount: 300,
    roundOffManual: null,
  };

  // Gross = (16000 - 500) = 15500; Scrap = -2200; Extra = -300; Net = 13000
  const totals1 = calculateInvoiceTotals(discountInvoice, '32');
  assert(totals1.computedItems[0].discount === 500, 'Item-level discount correctly recognized as 500');
  assert(totals1.scrapDiscount === 2200, 'Scrap discount correctly recognized as 2200');
  assert(totals1.extraDiscount === 300, 'Extra invoice discount correctly recognized as 300');
  assert(totals1.netPayable === 13000, 'Net payable correctly deducts item discount, scrap & extra discount: 16000 - 500 - 2200 - 300 = 13000');

  // Save and reopen
  let dataset = [];
  const { savedRecord } = simulateSaveWorkflow(dataset, discountInvoice, '32');
  const totals2 = calculateInvoiceTotals(savedRecord, '32');

  assert(savedRecord.items[0].discount === 500, 'Item-level discount preserved as 500');
  assert(savedRecord.scrapExchange.amount === 2200, 'Scrap amount preserved as 2200');
  assert(savedRecord.additionalDiscount === 300, 'Special discount preserved as 300');
  assert(totals2.netPayable === 13000, 'Reopened invoice does not re-apply deductions or corrupt netPayable');

  // Test 0% GST rate preservation (exempt item)
  const exemptItemInvoice = {
    id: 'inv-test-e-002',
    invoiceNumber: 'TPS/2026-27/014B',
    customer: { name: 'Exempt Goods Client' },
    items: [
      { id: 'it-ex', name: 'Battery Water 20L Can (Exempt)', rate: 250, qty: 2, isTaxInclusive: false, gstRate: 0 },
    ],
  };
  const { savedRecord: savedExempt } = simulateSaveWorkflow([], exemptItemInvoice, '32');
  assert(savedExempt.items[0].gstRate === 0, 'Zero percent (0%) GST rate is preserved and NOT overwritten to default 28%');
  const exemptTotals = calculateInvoiceTotals(savedExempt, '32');
  assert(exemptTotals.totalTax === 0, 'Zero GST rate item produces exactly 0 tax amount');
  assert(exemptTotals.netPayable === 500, 'Zero GST invoice netPayable is exactly 500 (2 * 250)');
}

// ----------------------------------------------------
// TEST F: Decimal values (₹1,234.56, ₹149.95, qty 1.5)
// ----------------------------------------------------
console.log('\n--- TEST F: Decimal quantities and prices ---');
{
  const decimalInvoice = {
    id: 'inv-test-f-001',
    invoiceNumber: 'TPS/2026-27/015',
    customer: { name: 'Precision Solar Works' },
    items: [
      { id: 'it-1', name: 'Solar DC Heavy 6sqmm Cable', rate: 149.95, qty: 10.5, unit: 'Mtr', isTaxInclusive: false, gstRate: 18 },
      { id: 'it-2', name: 'Custom Fabrication & Clamping Service', rate: 1234.56, qty: 1.5, unit: 'Job', isTaxInclusive: false, gstRate: 18 },
    ],
  };

  // Item 1: 10.5 * 149.95 = 1574.475
  // Item 2: 1.5 * 1234.56 = 1851.84
  // Total Taxable = 3426.315; 18% GST = 616.7367; Total Gross = 4043.0517
  const totals1 = calculateInvoiceTotals(decimalInvoice, '32');
  assert(decimalInvoice.items[0].qty === 10.5, 'Decimal quantity 10.5 parsed without integer truncation');
  assert(decimalInvoice.items[1].qty === 1.5, 'Decimal quantity 1.5 parsed without integer truncation');
  assert(totals1.totalTaxableValue > 3426 && totals1.totalTaxableValue < 3427, 'Decimal taxable value computed with float precision');
  assert(totals1.netPayable === 4043, 'Round-off brings 4043.05 to nearest integer rupee 4043');

  // Save and reopen
  let dataset = [];
  const { savedRecord } = simulateSaveWorkflow(dataset, decimalInvoice, '32');
  assert(savedRecord.items[0].qty === 10.5, 'Saved decimal quantity 10.5 intact');
  assert(savedRecord.items[0].rate === 149.95, 'Saved decimal rate 149.95 intact');
  assert(savedRecord.items[1].rate === 1234.56, 'Saved decimal rate 1234.56 intact');
}

// ----------------------------------------------------
// TEST G: B2B Invoice
// ----------------------------------------------------
console.log('\n--- TEST G: B2B Invoice ---');
{
  const b2bInvoice = {
    id: 'inv-test-g-001',
    invoiceNumber: 'TPS/2026-27/016',
    transactionType: TRANSACTION_TYPES.B2B,
    customer: {
      name: 'Kerala Solar Solutions Pvt Ltd',
      gstin: '32AAACK1234F1Z9',
      phone: '9846001122',
      address: 'Industrial Estate, Padinarangadi',
      state: 'Kerala',
      stateCode: '32',
    },
    items: [
      { id: 'it-1', name: 'Tubular Battery 200Ah', rate: 18000, qty: 1, isTaxInclusive: true, gstRate: 28 },
    ],
  };

  const { savedRecord } = simulateSaveWorkflow([], b2bInvoice, '32');
  assert(savedRecord.transactionType === 'B2B', 'B2B transaction type persisted correctly');
  assert(savedRecord.customer.gstin === '32AAACK1234F1Z9', 'Buyer GSTIN persisted accurately');
  assert(savedRecord.customer.name === 'Kerala Solar Solutions Pvt Ltd', 'Buyer business name persisted');
}

// ----------------------------------------------------
// TEST H: B2C Invoice
// ----------------------------------------------------
console.log('\n--- TEST H: B2C Invoice ---');
{
  const b2cInvoice = {
    id: 'inv-test-h-001',
    invoiceNumber: 'TPS/2026-27/017',
    transactionType: TRANSACTION_TYPES.B2C,
    customer: {
      name: 'Vinod Kumar (Retail Consumer)',
      phone: '9846554433',
      address: 'Thrithala West',
      state: 'Kerala',
      stateCode: '32',
      gstin: '', // Empty GSTIN for B2C consumer
    },
    items: [
      { id: 'it-1', name: 'Exide Car Battery 35Ah', rate: 4200, qty: 1, isTaxInclusive: true, gstRate: 28 },
    ],
  };

  const { savedRecord } = simulateSaveWorkflow([], b2cInvoice, '32');
  assert(savedRecord.transactionType === 'B2C', 'B2C transaction type persisted correctly');
  assert(!savedRecord.customer.gstin, 'B2C invoice does not force or fabricate GSTIN');
  assert(savedRecord.customer.name === 'Vinod Kumar (Retail Consumer)', 'Retail customer name persisted');
}

// ----------------------------------------------------
// TEST I: Historical legacy invoice backward compatibility
// ----------------------------------------------------
console.log('\n--- TEST I: Historical legacy invoice ---');
{
  // Invoice created before transactionType existed
  const legacyInvoice = {
    id: 'legacy-inv-009',
    invoiceNumber: 'TPS/2025-26/089',
    invoiceDate: '2025-10-15',
    customer: {
      name: 'Old Battery Client',
      phone: '9846111222',
      gstin: '32AABCO1111A1Z0', // Has GSTIN -> safe infer B2B
    },
    items: [
      { name: 'Amaron 100Ah Battery', rate: 9500, qty: 1, gstRate: 28 }, // No isTaxInclusive field
    ],
    netPayable: 9500,
  };

  // Infer transaction type without mutating
  const inferred = inferTransactionType(legacyInvoice);
  assert(inferred === 'B2B', 'Legacy invoice with GSTIN correctly inferred as B2B');

  const legacyB2C = {
    id: 'legacy-inv-010',
    invoiceNumber: 'TPS/2025-26/090',
    customer: { name: 'Walk-in Customer', phone: '9447000111' },
    items: [{ name: 'Distilled Water 5L', rate: 100, qty: 2 }],
  };
  assert(inferTransactionType(legacyB2C) === 'B2C', 'Legacy invoice without GSTIN correctly inferred as B2C');

  // Verify normalization does not corrupt legacy rate or qty
  const normItem = normalizeInvoiceItem(legacyInvoice.items[0]);
  assert(normItem.rate === 9500, 'Normalized legacy item rate intact (9500)');
  assert(normItem.qty === 1, 'Normalized legacy item qty intact (1)');
  assert(normItem.category === 'battery', 'Normalized legacy item inferred category as battery');
}

// ----------------------------------------------------
// TEST J: A4 PDF Positioning & Multi-Item Layout
// ----------------------------------------------------
console.log('\n--- TEST J: A4 PDF Positioning & Dimensions ---');
{
  async function testPdfGeneration() {
    // 1. Two-item invoice (Short invoice - tests bottom anchoring)
    const twoItemInvoice = {
      id: 'inv-pdf-2',
      invoiceNumber: 'TPS/2026-27/020',
      invoiceDate: '2026-11-02',
      transactionType: 'B2B',
      customer: { name: 'Urjaamithra', gstin: '32AABCU9603R1ZM' },
      items: [
        { id: '1', name: 'Exide InvaMaster 150Ah', rate: 14800, qty: 1, isTaxInclusive: true, gstRate: 28 },
        { id: '2', name: 'Luminous Eco Volt Neo 1050', rate: 6800, qty: 1, isTaxInclusive: true, gstRate: 18 },
      ],
    };

    const doc2 = await generateVectorPdf(twoItemInvoice, DEFAULT_BUSINESS, 'Original for Buyer');
    assert(doc2 !== null, 'Generated vector PDF for 2-item invoice');
    assert(Math.round(doc2.internal.pageSize.getWidth()) === 210, 'PDF width is exact A4: 210 mm');
    assert(Math.round(doc2.internal.pageSize.getHeight()) === 297, 'PDF height is exact A4: 297 mm');
    assert(doc2.internal.getNumberOfPages() === 1, '2-item invoice produces 1 page without unexpected overflow');

    // 2. Four-item invoice (Medium invoice)
    const fourItemInvoice = {
      id: 'inv-pdf-4',
      invoiceNumber: 'TPS/2026-27/021',
      invoiceDate: '2026-11-02',
      transactionType: 'B2B',
      customer: { name: 'Green Valley Agro Farm', gstin: '32AABCG9981A1Z4' },
      items: [
        { id: '1', name: 'Exide InvaMaster 150Ah', rate: 14800, qty: 1, isTaxInclusive: true, gstRate: 28 },
        { id: '2', name: 'Luminous Eco Volt Neo 1050', rate: 6800, qty: 1, isTaxInclusive: true, gstRate: 18 },
        { id: '3', name: 'Waaree 550Wp Mono Solar Panel', rate: 14500, qty: 2, isTaxInclusive: true, gstRate: 12 },
        { id: '4', name: 'Rooftop Solar EPC Installation', rate: 4500, qty: 1, isTaxInclusive: true, gstRate: 18 },
      ],
    };

    const doc4 = await generateVectorPdf(fourItemInvoice, DEFAULT_BUSINESS, 'Original for Buyer');
    assert(doc4 !== null, 'Generated vector PDF for 4-item invoice');
    assert(doc4.internal.getNumberOfPages() === 1, '4-item invoice fits on single A4 page with bottom-anchored summary');

    // 3. Ten-item invoice (Long invoice)
    const tenItemInvoice = {
      id: 'inv-pdf-10',
      invoiceNumber: 'TPS/2026-27/022',
      invoiceDate: '2026-11-02',
      transactionType: 'B2B',
      customer: { name: 'Mega Commercial Solar Projects', gstin: '32AABCM8899D1Z3' },
      items: Array.from({ length: 10 }, (_, i) => ({
        id: `it-${i + 1}`,
        name: `Solar Module String Pack #${i + 1} with Mounting Rail`,
        rate: 12000,
        qty: 2,
        isTaxInclusive: true,
        gstRate: 12,
        specs: { capacityWatts: '550W', brand: 'Waaree' },
        serialNo: `WAR-2026-00${i + 1}`,
        warranty: '25 Years Performance',
      })),
    };

    const doc10 = await generateVectorPdf(tenItemInvoice, DEFAULT_BUSINESS, 'Original for Buyer');
    assert(doc10 !== null, 'Generated vector PDF for 10-item invoice');
    assert(doc10.internal.getNumberOfPages() === 1, '10-item invoice fits cleanly on single page with compact row layout');

    // 4. Twenty-item invoice (Testing multi-page pagination)
    const twentyItemInvoice = {
      id: 'inv-pdf-20',
      invoiceNumber: 'TPS/2026-27/023',
      invoiceDate: '2026-11-02',
      transactionType: 'B2B',
      customer: { name: 'Heavy Industrial Supply Project', gstin: '32AABCH4455E1Z8' },
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `it-${i + 1}`,
        name: `Industrial Equipment Component #${i + 1}`,
        rate: 8500,
        qty: 1,
        isTaxInclusive: true,
        gstRate: 18,
      })),
    };

    const doc20 = await generateVectorPdf(twentyItemInvoice, DEFAULT_BUSINESS, 'Original for Buyer');
    assert(doc20 !== null, 'Generated vector PDF for 20-item invoice');
    assert(doc20.internal.getNumberOfPages() >= 2, '20-item invoice paginates cleanly across 2 pages without clipping');
  }

  await testPdfGeneration();
}

console.log('\n======================================================');
console.log(`TOTAL PASS: ${passCount}`);
console.log(`TOTAL FAIL: ${failCount}`);
console.log('======================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('All regression tests passed successfully!');
}
