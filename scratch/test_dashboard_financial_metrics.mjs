/**
 * Automated Verification Suite for Dashboard Financial Metrics & Reconciliation
 *
 * Covers:
 * 1. Life cycle segregation (Draft and Cancelled excluded from Total Billed)
 * 2. Mixed-category proportional deduction allocation
 * 3. Exact reconciliation invariant: Category Revenue Total === Total Billed
 * 4. Residual paise distribution determinism
 * 5. Payment rate and revenue collection rate accuracy
 * 6. Outstanding vs Overdue balance segregation
 * 7. Date range boundaries (Midnight, Fiscal Year Apr 1 - Mar 31)
 * 8. Empty dataset and missing-field resilience
 */

import assert from 'node:assert/strict';
import {
  calculateDashboardMetrics,
  getIndianFinancialYear,
  getPeriodDateBoundaries,
  isInvoiceInDateRange,
  DASHBOARD_PERIODS,
} from '../src/utils/dashboardFinancialMetrics.js';

let passedAssertions = 0;
function testAssert(condition, message) {
  assert.ok(condition, message);
  passedAssertions++;
}

console.log('🧪 Starting Dashboard Financial Reconciliation Test Suite...');

// --- Test 1: Indian Financial Year Rollover ---
{
  testAssert(getIndianFinancialYear('2026-04-01') === '2026-27', 'April 1 is start of FY 2026-27');
  testAssert(getIndianFinancialYear('2026-11-08') === '2026-27', 'November 8 is inside FY 2026-27');
  testAssert(getIndianFinancialYear('2027-03-31') === '2026-27', 'March 31 is end of FY 2026-27');
  testAssert(getIndianFinancialYear('2027-04-01') === '2027-28', 'April 1 rolls over to FY 2027-28');
  testAssert(getIndianFinancialYear('2026-01-15') === '2025-26', 'January 15, 2026 belongs to FY 2025-26');
}

// --- Test 2: Date Boundaries and Midnight Inclusions ---
{
  const ref = new Date(2026, 10, 8, 14, 30, 0); // Nov 8, 2026 14:30:00
  const boundariesToday = getPeriodDateBoundaries(DASHBOARD_PERIODS.TODAY, ref);
  testAssert(boundariesToday.startDate.getHours() === 0, 'Today starts at 00:00:00');
  testAssert(boundariesToday.endDate.getHours() === 23, 'Today ends at 23:59:59');

  const invTodayMidnight = { invoiceDate: '2026-11-08' };
  testAssert(isInvoiceInDateRange(invTodayMidnight, boundariesToday.startDate, boundariesToday.endDate), 'Today invoice matches today');

  const invYesterday = { invoiceDate: '2026-11-07' };
  testAssert(!isInvoiceInDateRange(invYesterday, boundariesToday.startDate, boundariesToday.endDate), 'Yesterday excluded from today');

  const boundariesFY = getPeriodDateBoundaries(DASHBOARD_PERIODS.THIS_FY, ref);
  testAssert(boundariesFY.startDate.getMonth() === 3, 'FY starts in April');
  testAssert(boundariesFY.startDate.getDate() === 1, 'FY starts on April 1');
  testAssert(boundariesFY.endDate.getMonth() === 2, 'FY ends in March');
  testAssert(boundariesFY.endDate.getDate() === 31, 'FY ends on March 31');
  testAssert(boundariesFY.endDate.getFullYear() === 2027, 'FY 2026-27 ends March 31 2027');
}

// --- Test 3: Empty Dataset Handling ---
{
  const metrics = calculateDashboardMetrics([]);
  testAssert(metrics.counts.totalCount === 0, 'Empty total count is 0');
  testAssert(metrics.counts.issuedCount === 0, 'Empty issued count is 0');
  testAssert(metrics.financials.totalBilled === 0, 'Empty total billed is 0');
  testAssert(metrics.financials.collectedRevenue === 0, 'Empty collected revenue is 0');
  testAssert(metrics.financials.totalOutstanding === 0, 'Empty outstanding is 0');
  testAssert(metrics.rates.invoicePaymentRate === 0, 'Empty payment rate is 0 without NaN');
  testAssert(metrics.rates.revenueCollectionRate === 0, 'Empty collection rate is 0 without NaN');
  testAssert(metrics.reconciliation.isBalanced === true, 'Empty dataset is balanced');
  testAssert(metrics.reconciliation.discrepancy === 0, 'Empty discrepancy is 0');
}

// --- Test 4: Segregation of Draft & Cancelled Invoices from Total Billed ---
{
  const mockDataset = [
    {
      id: 'inv-1',
      invoiceNumber: 'TPS/2026-27/001',
      invoiceDate: '2026-10-10',
      paymentStatus: 'Paid',
      netPayable: 20000,
      items: [{ name: 'Battery A', category: 'battery', qty: 1, rate: 20000, isTaxInclusive: true }],
    },
    {
      id: 'inv-2',
      invoiceNumber: 'TPS/2026-27/002',
      invoiceDate: '2026-10-12',
      paymentStatus: 'Pending',
      netPayable: 15000,
      items: [{ name: 'Inverter B', category: 'inverter', qty: 1, rate: 15000, isTaxInclusive: true }],
    },
    {
      id: 'inv-3',
      invoiceNumber: 'TPS/2026-27/003',
      invoiceDate: '2026-10-15',
      paymentStatus: 'Overdue',
      netPayable: 10000,
      items: [{ name: 'Solar Panel C', category: 'solar', qty: 1, rate: 10000, isTaxInclusive: true }],
    },
    {
      id: 'inv-4',
      invoiceNumber: 'TPS/2026-27/004',
      invoiceDate: '2026-10-20',
      paymentStatus: 'Draft',
      netPayable: 50000, // Should NOT be in totalBilled!
      items: [{ name: 'Draft Item', category: 'battery', qty: 1, rate: 50000, isTaxInclusive: true }],
    },
    {
      id: 'inv-5',
      invoiceNumber: 'TPS/2026-27/005',
      invoiceDate: '2026-10-22',
      paymentStatus: 'Cancelled',
      netPayable: 30000, // Should NOT be in totalBilled!
      items: [{ name: 'Cancelled Item', category: 'battery', qty: 1, rate: 30000, isTaxInclusive: true }],
    },
  ];

  const metrics = calculateDashboardMetrics(mockDataset, { period: DASHBOARD_PERIODS.ALL });

  testAssert(metrics.counts.totalCount === 5, 'Total invoice count includes all records (5)');
  testAssert(metrics.counts.issuedCount === 3, 'Issued count is strictly 3 (Paid, Pending, Overdue)');
  testAssert(metrics.counts.draftCount === 1, 'Draft count is 1');
  testAssert(metrics.counts.cancelledCount === 1, 'Cancelled count is 1');

  // Total Billed = 20000 + 15000 + 10000 = 45000 (excludes draft 50000 and cancelled 30000)
  testAssert(metrics.financials.totalBilled === 45000, 'Total Billed strictly equals issued sum (45,000)');
  testAssert(metrics.financials.collectedRevenue === 20000, 'Collected revenue equals Paid sum (20,000)');
  testAssert(metrics.financials.pendingAmount === 15000, 'Pending amount equals 15,000');
  testAssert(metrics.financials.overdueAmount === 10000, 'Overdue amount equals 10,000');
  testAssert(metrics.financials.totalOutstanding === 25000, 'Total outstanding is 25,000 (15000 + 10000)');
  testAssert(metrics.financials.draftBilled === 50000, 'Draft billed tracks 50,000 separately');

  // Rate metrics
  // 1 Paid out of 3 Issued = 33.33%
  testAssert(metrics.rates.invoicePaymentRate === 33.33, 'Invoice payment rate is 33.33% (1/3)');
  // 20,000 collected out of 45,000 billed = 44.44%
  testAssert(metrics.rates.revenueCollectionRate === 44.44, 'Revenue collection rate is 44.44% (20k/45k)');

  // Category reconciliation
  testAssert(metrics.categories.net.battery === 20000, 'Battery category has 20,000');
  testAssert(metrics.categories.net.inverter === 15000, 'Inverter category has 15,000');
  testAssert(metrics.categories.net.solar === 10000, 'Solar category has 10,000');
  testAssert(metrics.categories.net.services === 0, 'Services category has 0');
  testAssert(metrics.reconciliation.categoryRevenueTotal === 45000, 'Category Revenue Total equals 45,000');
  testAssert(metrics.reconciliation.isBalanced === true, 'Reconciliation is balanced (discrepancy 0)');
}

// --- Test 5: Mixed-Category Proportional Deduction Allocation with Residual Distribution ---
{
  // Mixed invoice with:
  // - Battery item: Gross ₹10,000
  // - Inverter item: Gross ₹20,000
  // - Service item: Gross ₹5,000
  // Total Gross: ₹35,000
  // Invoice-level discount / scrap exchange: ₹3,500
  // Net Payable: ₹31,500
  //
  // Expected proportional allocation:
  // Ratio: 31,500 / 35,000 = 0.90
  // Battery: 10,000 * 0.90 = ₹9,000.00
  // Inverter: 20,000 * 0.90 = ₹18,000.00
  // Service: 5,000 * 0.90 = ₹4,500.00
  // Sum = 9000 + 18000 + 4500 = ₹31,500.00 exactly!
  const mixedInvoice = {
    id: 'inv-mixed-1',
    invoiceNumber: 'TPS/2026-27/MIX-1',
    invoiceDate: '2026-10-25',
    paymentStatus: 'Paid',
    netPayable: 31500,
    items: [
      { name: 'Amaron Battery', category: 'battery', qty: 1, rate: 10000, isTaxInclusive: true },
      { name: 'Luminous Inverter', category: 'inverter', qty: 1, rate: 20000, isTaxInclusive: true },
      { name: 'Installation Service', category: 'services', qty: 1, rate: 5000, isTaxInclusive: true },
    ],
  };

  const metrics = calculateDashboardMetrics([mixedInvoice]);
  testAssert(metrics.financials.totalBilled === 31500, 'Total Billed is 31,500');
  testAssert(metrics.categories.net.battery === 9000, 'Battery net is exactly 9,000');
  testAssert(metrics.categories.net.inverter === 18000, 'Inverter net is exactly 18,000');
  testAssert(metrics.categories.net.services === 4500, 'Services net is exactly 4,500');
  testAssert(metrics.reconciliation.categoryRevenueTotal === 31500, 'Sum of category net is exactly 31,500');
  testAssert(metrics.reconciliation.isBalanced === true, 'Mixed invoice is 100% balanced');
  testAssert(metrics.financials.totalDeductions === 3500, 'Total deductions tracked as 3,500');
}

// --- Test 6: Residual Paise Handling (Indivisible fractions) ---
{
  // Mixed invoice where rounding creates fractional paise:
  // Item 1: Battery Gross ₹100.00 (33.333%)
  // Item 2: Inverter Gross ₹200.00 (66.667%)
  // Total Gross: ₹300.00
  // Net Payable: ₹295.00 (Discount ₹5.00)
  // Scaling: 295 / 300 = 0.983333333...
  // Item 1 share: 100 * 0.983333 = 98.33
  // Item 2 share: 200 * 0.983333 = 196.67
  // Sum = 98.33 + 196.67 = 295.00 exactly!
  const residualInvoice = {
    id: 'inv-res-1',
    invoiceNumber: 'TPS/2026-27/RES-1',
    invoiceDate: '2026-10-25',
    paymentStatus: 'Pending',
    netPayable: 295,
    items: [
      { name: 'Small Battery', category: 'battery', qty: 1, rate: 100, isTaxInclusive: true },
      { name: 'Inverter Accessory', category: 'inverter', qty: 1, rate: 200, isTaxInclusive: true },
    ],
  };

  const metrics = calculateDashboardMetrics([residualInvoice]);
  testAssert(metrics.financials.totalBilled === 295, 'Total billed is 295');
  testAssert(metrics.categories.net.battery === 98.33, 'Battery allocated 98.33');
  testAssert(metrics.categories.net.inverter === 196.67, 'Inverter allocated 196.67');
  testAssert(metrics.reconciliation.categoryRevenueTotal === 295, 'Category sum matches 295 with zero discrepancy');
  testAssert(metrics.reconciliation.isBalanced === true, 'Balanced invariant held across fractional rounding');
}

// --- Test 7: Mock Dataset Verification (Matches Screenshot Resolution) ---
{
  const { INITIAL_MOCK_INVOICES } = await import('../src/data/mockData.js');
  const metrics = calculateDashboardMetrics(INITIAL_MOCK_INVOICES, { period: DASHBOARD_PERIODS.ALL });

  // 7 total invoices in mock data (6 issued + 1 draft)
  testAssert(metrics.counts.totalCount === 7, 'Mock data has 7 total invoices');
  testAssert(metrics.counts.issuedCount === 6, 'Mock data has 6 issued invoices');
  testAssert(metrics.counts.draftCount === 1, 'Mock data has 1 draft invoice');
  testAssert(metrics.counts.paidCount === 3, 'Mock data has 3 paid invoices');
  testAssert(metrics.counts.pendingCount === 2, 'Mock data has 2 pending invoices');
  testAssert(metrics.counts.overdueCount === 1, 'Mock data has 1 overdue invoice');

  // Authoritative issued total: ₹1,37,900.00 (Excludes ₹26,000 draft!)
  testAssert(metrics.financials.totalBilled === 137900, 'Authoritative Total Billed is ₹1,37,900.00');
  testAssert(metrics.financials.collectedRevenue === 79500, 'Collected Revenue is ₹79,500.00');
  testAssert(metrics.financials.pendingAmount === 32000, 'Pending Amount is ₹32,000.00');
  testAssert(metrics.financials.overdueAmount === 26400, 'Overdue Amount is ₹26,400.00');
  testAssert(metrics.financials.totalOutstanding === 58400, 'Total Outstanding is ₹58,400.00 (32k + 26.4k)');

  // Mathematical equation: Total Billed === Collected + Outstanding
  testAssert(
    metrics.financials.totalBilled === metrics.financials.collectedRevenue + metrics.financials.totalOutstanding,
    'Total Billed = Collected Revenue + Total Outstanding'
  );

  // Reconciled Category Sales
  testAssert(metrics.reconciliation.isBalanced === true, 'Mock data category sales are 100% balanced');
  testAssert(metrics.reconciliation.discrepancy === 0, 'Discrepancy is 0.00');
  testAssert(metrics.reconciliation.categoryRevenueTotal === 137900, 'Category Revenue Total equals Total Billed (137,900)');
  testAssert(metrics.financials.totalDeductions === 2400, 'Total deductions in issued invoices is ₹2,400 (Scrap ₹2000 + Discount ₹400)');
}

console.log(`RESULTS: ${passedAssertions} PASSED, 0 FAILED`);
console.log(`✅ All ${passedAssertions} Dashboard Financial Metrics assertions passed successfully!`);
