/**
 * TPS BATTERY HOUSE — Centralized Dashboard Financial Aggregation & Reconciliation Engine
 *
 * Implements the Phase 5.3 Financial Precision Policy and Priority 1 Financial Metric Contract:
 * 1. Strict segregation of Issued vs Draft vs Cancelled invoices.
 * 2. Total Billed = Authoritative Net Payable of Issued Invoices (excludes Drafts & Cancelled).
 * 3. Collected Revenue = Net Payable of Settled (Paid) Invoices.
 * 4. Outstanding = Net Payable of Unsettled Issued Invoices (Pending + Overdue).
 * 5. Distinct Overdue Tracking = Dedicated debt tracking past due terms.
 * 6. Mixed-Category Proportional Allocation: Pro-rates invoice-level deductions (Scrap buyback,
 *    additional discounts, round-off) across line item categories so that:
 *    Sum of Category Net Sales === Total Billed (Guaranteed 100% Reconciliation Invariant).
 * 7. Explicit Reporting Periods: Today, This Week, This Month, This FY (Apr 1 - Mar 31), All Time.
 * 8. Zero NaN risk, safe empty state defaults, and deterministic residual paise assignment.
 */

import { roundToTwoDecimals, calculateLineItem } from './gstCalculations.js';
import { normalizeInvoiceItem, PRODUCT_CATEGORIES } from './categories.js';

export const INVOICE_LIFECYCLE_STATUS = {
  PAID: 'Paid',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
  DRAFT: 'Draft',
  CANCELLED: 'Cancelled',
};

export const DASHBOARD_PERIODS = {
  ALL: 'ALL',
  THIS_FY: 'THIS_FY',
  THIS_MONTH: 'THIS_MONTH',
  THIS_WEEK: 'THIS_WEEK',
  TODAY: 'TODAY',
};

export const PERIOD_LABELS = {
  [DASHBOARD_PERIODS.ALL]: 'All Time',
  [DASHBOARD_PERIODS.THIS_FY]: 'This Financial Year',
  [DASHBOARD_PERIODS.THIS_MONTH]: 'This Month',
  [DASHBOARD_PERIODS.THIS_WEEK]: 'This Week',
  [DASHBOARD_PERIODS.TODAY]: 'Today',
};

/**
 * Returns Indian Financial Year identifier (e.g. '2026-27') for a given date.
 * Fiscal year starts April 1 and ends March 31.
 */
export function getIndianFinancialYear(dateInput = new Date()) {
  const d = dateInput instanceof Date
    ? dateInput
    : new Date(typeof dateInput === 'string' && dateInput.length === 10 ? `${dateInput}T12:00:00Z` : dateInput);

  const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  const month = isNaN(d.getMonth()) ? new Date().getMonth() : d.getMonth(); // 0 = Jan, 3 = Apr

  if (month >= 3) {
    const nextYear = String((year + 1) % 100).padStart(2, '0');
    return `${year}-${nextYear}`;
  } else {
    const curYear = String(year % 100).padStart(2, '0');
    return `${year - 1}-${curYear}`;
  }
}

/**
 * Calculates start and end Date boundaries for the selected reporting period.
 * Dates are aligned to local day boundaries (00:00:00.000 to 23:59:59.999).
 */
export function getPeriodDateBoundaries(period, referenceDate = new Date()) {
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();

  if (period === DASHBOARD_PERIODS.ALL) {
    return {
      period,
      label: PERIOD_LABELS[DASHBOARD_PERIODS.ALL],
      startDate: null,
      endDate: null,
    };
  }

  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();

  if (period === DASHBOARD_PERIODS.TODAY) {
    const start = new Date(y, m, d, 0, 0, 0, 0);
    const end = new Date(y, m, d, 23, 59, 59, 999);
    return {
      period,
      label: PERIOD_LABELS[DASHBOARD_PERIODS.TODAY],
      startDate: start,
      endDate: end,
    };
  }

  if (period === DASHBOARD_PERIODS.THIS_WEEK) {
    // Week starting Monday
    const currentDay = ref.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const distanceToMonday = (currentDay + 6) % 7;
    const start = new Date(y, m, d - distanceToMonday, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    return {
      period,
      label: PERIOD_LABELS[DASHBOARD_PERIODS.THIS_WEEK],
      startDate: start,
      endDate: end,
    };
  }

  if (period === DASHBOARD_PERIODS.THIS_MONTH) {
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return {
      period,
      label: PERIOD_LABELS[DASHBOARD_PERIODS.THIS_MONTH],
      startDate: start,
      endDate: end,
    };
  }

  if (period === DASHBOARD_PERIODS.THIS_FY) {
    const fyStartYear = m >= 3 ? y : y - 1;
    const start = new Date(fyStartYear, 3, 1, 0, 0, 0, 0); // April 1
    const end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999); // March 31
    const fyCode = `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
    return {
      period,
      label: `FY ${fyCode}`,
      startDate: start,
      endDate: end,
    };
  }

  // Fallback to All Time
  return {
    period: DASHBOARD_PERIODS.ALL,
    label: PERIOD_LABELS[DASHBOARD_PERIODS.ALL],
    startDate: null,
    endDate: null,
  };
}

/**
 * Checks whether an invoice falls within a given start and end date boundary.
 * Handles both YYYY-MM-DD date strings and ISO timestamp strings safely.
 */
export function isInvoiceInDateRange(invoice, startDate, endDate) {
  if (!startDate || !endDate) return true;

  const rawDate = invoice.invoiceDate || invoice.createdAt;
  if (!rawDate) return false;

  let invoiceTime;
  if (typeof rawDate === 'string' && rawDate.length === 10) {
    // YYYY-MM-DD format - parse as local noon to avoid midnight UTC timezone shifts
    const [year, month, day] = rawDate.split('-').map(Number);
    if (!year || !month || !day) return false;
    invoiceTime = new Date(year, month - 1, day, 12, 0, 0).getTime();
  } else {
    invoiceTime = new Date(rawDate).getTime();
  }

  if (isNaN(invoiceTime)) return false;

  return invoiceTime >= startDate.getTime() && invoiceTime <= endDate.getTime();
}

/**
 * Normalizes payment status into authoritative lifecycle categories.
 */
export function normalizeInvoiceStatus(rawStatus) {
  const s = String(rawStatus || '').trim().toLowerCase();
  if (s === 'paid') return INVOICE_LIFECYCLE_STATUS.PAID;
  if (s === 'overdue') return INVOICE_LIFECYCLE_STATUS.OVERDUE;
  if (s === 'draft') return INVOICE_LIFECYCLE_STATUS.DRAFT;
  if (s === 'cancelled' || s === 'canceled') return INVOICE_LIFECYCLE_STATUS.CANCELLED;
  return INVOICE_LIFECYCLE_STATUS.PENDING;
}

/**
 * Main Centralized Financial Metrics Aggregation Engine.
 *
 * @param {Array<Object>} rawInvoices - Collection of invoices
 * @param {Object} options - Configuration options
 * @param {string} [options.period=DASHBOARD_PERIODS.ALL] - Reporting period
 * @param {Date} [options.referenceDate=new Date()] - Reference date for relative period calculations
 * @returns {Object} Comprehensive, reconciled dashboard metrics
 */
export function calculateDashboardMetrics(rawInvoices = [], options = {}) {
  const invoices = Array.isArray(rawInvoices) ? rawInvoices : [];
  const period = options.period || DASHBOARD_PERIODS.ALL;
  const referenceDate = options.referenceDate || new Date();

  const boundaries = getPeriodDateBoundaries(period, referenceDate);
  const { startDate, endDate, label: periodLabel } = boundaries;

  // 1. Filter by Reporting Period
  const periodInvoices = invoices.filter((inv) =>
    isInvoiceInDateRange(inv, startDate, endDate)
  );

  // 2. Segregate by Lifecycle Status
  const issuedInvoices = [];
  const draftInvoices = [];
  const cancelledInvoices = [];
  const paidInvoices = [];
  const pendingInvoices = [];
  const overdueInvoices = [];

  periodInvoices.forEach((inv) => {
    const status = normalizeInvoiceStatus(inv.paymentStatus);
    if (status === INVOICE_LIFECYCLE_STATUS.DRAFT) {
      draftInvoices.push(inv);
    } else if (status === INVOICE_LIFECYCLE_STATUS.CANCELLED) {
      cancelledInvoices.push(inv);
    } else {
      issuedInvoices.push(inv);
      if (status === INVOICE_LIFECYCLE_STATUS.PAID) {
        paidInvoices.push(inv);
      } else if (status === INVOICE_LIFECYCLE_STATUS.OVERDUE) {
        overdueInvoices.push(inv);
      } else {
        pendingInvoices.push(inv);
      }
    }
  });

  // 3. Authoritative Financial Totals (Net Payable based)
  let totalBilled = 0;
  let collectedRevenue = 0;
  let pendingAmount = 0;
  let overdueAmount = 0;
  let draftBilled = 0;

  issuedInvoices.forEach((inv) => {
    const amount = roundToTwoDecimals(Math.max(0, Number(inv.netPayable) || 0));
    totalBilled = roundToTwoDecimals(totalBilled + amount);

    const status = normalizeInvoiceStatus(inv.paymentStatus);
    if (status === INVOICE_LIFECYCLE_STATUS.PAID) {
      collectedRevenue = roundToTwoDecimals(collectedRevenue + amount);
    } else if (status === INVOICE_LIFECYCLE_STATUS.OVERDUE) {
      overdueAmount = roundToTwoDecimals(overdueAmount + amount);
    } else {
      pendingAmount = roundToTwoDecimals(pendingAmount + amount);
    }
  });

  draftInvoices.forEach((inv) => {
    const amount = roundToTwoDecimals(Math.max(0, Number(inv.netPayable) || 0));
    draftBilled = roundToTwoDecimals(draftBilled + amount);
  });

  const totalOutstanding = roundToTwoDecimals(pendingAmount + overdueAmount);

  // 4. Performance & Payment Rates
  const issuedCount = issuedInvoices.length;
  const paidCount = paidInvoices.length;
  const invoicePaymentRate = issuedCount > 0
    ? roundToTwoDecimals((paidCount / issuedCount) * 100)
    : 0;

  const revenueCollectionRate = totalBilled > 0
    ? roundToTwoDecimals((collectedRevenue / totalBilled) * 100)
    : 0;

  // 5. Reconciled Category Sales with Proportional Allocation
  const categoryNetSales = {
    [PRODUCT_CATEGORIES.BATTERY]: 0,
    [PRODUCT_CATEGORIES.INVERTER]: 0,
    [PRODUCT_CATEGORIES.SOLAR]: 0,
    [PRODUCT_CATEGORIES.SERVICES]: 0,
  };

  const categoryGrossSales = {
    [PRODUCT_CATEGORIES.BATTERY]: 0,
    [PRODUCT_CATEGORIES.INVERTER]: 0,
    [PRODUCT_CATEGORIES.SOLAR]: 0,
    [PRODUCT_CATEGORIES.SERVICES]: 0,
  };

  issuedInvoices.forEach((inv) => {
    const netPayable = roundToTwoDecimals(Math.max(0, Number(inv.netPayable) || 0));

    // Calculate gross amounts per category for this specific invoice
    const invCatGross = {
      [PRODUCT_CATEGORIES.BATTERY]: 0,
      [PRODUCT_CATEGORIES.INVERTER]: 0,
      [PRODUCT_CATEGORIES.SOLAR]: 0,
      [PRODUCT_CATEGORIES.SERVICES]: 0,
    };

    (inv.items || []).forEach((rawItem) => {
      const item = normalizeInvoiceItem(rawItem);
      const computed = calculateLineItem(item);
      const cat = computed.category && categoryGrossSales[computed.category] !== undefined
        ? computed.category
        : PRODUCT_CATEGORIES.BATTERY;

      invCatGross[cat] = roundToTwoDecimals(invCatGross[cat] + computed.lineTotal);
      categoryGrossSales[cat] = roundToTwoDecimals(categoryGrossSales[cat] + computed.lineTotal);
    });

    const invGrossTotal = roundToTwoDecimals(
      Object.values(invCatGross).reduce((sum, v) => sum + v, 0)
    );

    // If invoice has zero gross or zero net, nothing to allocate
    if (invGrossTotal <= 0 || netPayable <= 0) {
      return;
    }

    // Allocate netPayable proportionally across categories
    let allocatedSum = 0;
    let maxGrossCat = null;
    let maxGrossVal = -1;

    const allocated = {};
    for (const cat of Object.keys(invCatGross)) {
      const grossVal = invCatGross[cat];
      if (grossVal > maxGrossVal) {
        maxGrossVal = grossVal;
        maxGrossCat = cat;
      }
      if (grossVal > 0) {
        const share = roundToTwoDecimals(grossVal * (netPayable / invGrossTotal));
        allocated[cat] = share;
        allocatedSum = roundToTwoDecimals(allocatedSum + share);
      } else {
        allocated[cat] = 0;
      }
    }

    // Assign residual paise caused by rounding to the largest category on the invoice
    const residual = roundToTwoDecimals(netPayable - allocatedSum);
    if (residual !== 0 && maxGrossCat) {
      allocated[maxGrossCat] = roundToTwoDecimals(allocated[maxGrossCat] + residual);
    }

    // Accumulate into overall period category net sales
    for (const cat of Object.keys(allocated)) {
      categoryNetSales[cat] = roundToTwoDecimals(categoryNetSales[cat] + allocated[cat]);
    }
  });

  const categoryRevenueTotal = roundToTwoDecimals(
    Object.values(categoryNetSales).reduce((sum, v) => sum + v, 0)
  );

  const grossCategoryTotal = roundToTwoDecimals(
    Object.values(categoryGrossSales).reduce((sum, v) => sum + v, 0)
  );

  const totalDeductions = roundToTwoDecimals(grossCategoryTotal - totalBilled);

  // Invariant verification: Category Revenue Total === Total Billed
  const discrepancy = roundToTwoDecimals(Math.abs(categoryRevenueTotal - totalBilled));
  const isBalanced = discrepancy === 0;

  // Percentage contribution per category (based on Total Billed)
  const categoryPercentages = {
    [PRODUCT_CATEGORIES.BATTERY]: 0,
    [PRODUCT_CATEGORIES.INVERTER]: 0,
    [PRODUCT_CATEGORIES.SOLAR]: 0,
    [PRODUCT_CATEGORIES.SERVICES]: 0,
  };

  if (totalBilled > 0) {
    let pctSum = 0;
    let maxNetCat = null;
    let maxNetVal = -1;

    for (const cat of Object.keys(categoryNetSales)) {
      const val = categoryNetSales[cat];
      if (val > maxNetVal) {
        maxNetVal = val;
        maxNetCat = cat;
      }
      const pct = Math.round((val / totalBilled) * 100);
      categoryPercentages[cat] = pct;
      pctSum += pct;
    }

    // Keep percentages clean: if rounded sum is 99% or 101%, normalize against largest category
    if (pctSum !== 100 && maxNetCat && categoryRevenueTotal > 0) {
      categoryPercentages[maxNetCat] = categoryPercentages[maxNetCat] + (100 - pctSum);
    }
  }

  return {
    period,
    periodLabel,
    dateRange: { startDate, endDate },
    counts: {
      totalCount: periodInvoices.length,
      issuedCount: issuedInvoices.length,
      draftCount: draftInvoices.length,
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length,
      cancelledCount: cancelledInvoices.length,
    },
    financials: {
      totalBilled,
      collectedRevenue,
      pendingAmount,
      overdueAmount,
      totalOutstanding,
      draftBilled,
      grossCategoryTotal,
      totalDeductions,
      categoryRevenueTotal,
    },
    rates: {
      invoicePaymentRate,
      revenueCollectionRate,
    },
    categories: {
      net: categoryNetSales,
      gross: categoryGrossSales,
      percentages: categoryPercentages,
    },
    reconciliation: {
      isBalanced,
      discrepancy,
      status: isBalanced ? 'BALANCED' : 'MISMATCH',
      categoryRevenueTotal,
      totalBilled,
      grossCategoryTotal,
      totalDeductions,
    },
    invoices: {
      all: periodInvoices,
      issued: issuedInvoices,
      draft: draftInvoices,
      paid: paidInvoices,
      pending: pendingInvoices,
      overdue: overdueInvoices,
      cancelled: cancelledInvoices,
    },
  };
}

