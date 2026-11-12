import { numberToIndianWords } from './numberToWords.js';
import { normalizeInvoiceItem, PRODUCT_CATEGORIES } from './categories.js';

/**
 * Exact Round-Half-Up (Commercial / Arithmetic Rounding) to two decimal places.
 * Overcomes IEEE 754 floating-point midpoint precision anomalies (e.g. 1.005, 2.675, etc.)
 * by scaling in decimal exponential notation prior to rounding.
 * Safely handles scientific notation, negative numbers (symmetric), non-finite values, and negative zero.
 */
export function roundToTwoDecimals(num) {
  if (num === null || num === undefined) return 0;
  if (typeof num === 'boolean' || Array.isArray(num) || (typeof num === 'object' && num !== null)) return 0;
  if (typeof num === 'string' && num.trim() === '') return 0;
  const n = Number(num);
  if (!Number.isFinite(n)) return 0;
  if (n === 0) return 0;

  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);

  // Split mantissa and exponent to cleanly handle scientific notation (e.g., 1e-7, 1e21)
  const [mantissa, exponent = 0] = String(abs).toLowerCase().split('e');
  const shiftedExp = Number(exponent) + 2;
  const shifted = Number(mantissa + 'e' + shiftedExp);
  const rounded = Math.round(shifted);
  const [roundedMantissa, roundedExp = 0] = String(rounded).toLowerCase().split('e');
  const finalExp = Number(roundedExp) - 2;
  return sign * Number(roundedMantissa + 'e' + finalExp);
}

export const FINANCIAL_BOUNDS = {
  MAX_INVOICE_AMOUNT: 100000000,    // ₹10 Crores (100 Million INR)
  MAX_UNIT_PRICE: 10000000,         // ₹10 Lakhs (1 Million INR per unit)
  MAX_QUANTITY: 100000,             // 100,000 units
  MIN_QUANTITY: 0.001,              // 0.001 units (e.g. 1 ml / 1 gram / 1 mm)
  MAX_LINE_DISCOUNT: 10000000,      // ₹10 Lakhs
  MAX_ADJUSTMENT_DISCOUNT: 1000000, // ₹10 Lakhs
  MAX_ROUND_OFF_ADJUSTMENT: 500,    // ±₹500 manual round-off tolerance
  ALLOWED_GST_RATES: [0, 5, 12, 18, 28],
};

/**
 * Strict Financial Number Validator.
 * Validates that an input is a finite, non-NaN monetary or quantity figure within allowed bounds.
 * Prevents silent conversion of corrupted or malformed data into zero.
 */
export function validateFinancialInput(val, fieldName = 'Amount', {
  min = 0,
  max = FINANCIAL_BOUNDS.MAX_INVOICE_AMOUNT,
  allowZero = true,
  required = false,
} = {}) {
  if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
    if (required) {
      throw new Error(`${fieldName} is required.`);
    }
    return allowZero ? 0 : null;
  }

  if (typeof val === 'boolean' || Array.isArray(val) || (typeof val === 'object')) {
    throw new Error(`${fieldName} must be a valid number, received ${typeof val}.`);
  }

  const n = Number(val);
  if (Number.isNaN(n)) {
    throw new Error(`${fieldName} contains invalid characters and cannot be converted to a number.`);
  }

  if (!Number.isFinite(n)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }

  if (n < min) {
    throw new Error(`${fieldName} cannot be less than ${min}.`);
  }

  if (n > max) {
    throw new Error(`${fieldName} exceeds maximum permitted value of ${max}.`);
  }

  if (!allowZero && n === 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }

  return n;
}

/**
 * Validates the entire financial payload of an invoice.
 * Ensures no invalid prices, quantities, taxes, or discounts can silently pass into financial records.
 */
export function validateInvoiceFinancials(invoice) {
  if (!invoice || typeof invoice !== 'object') {
    throw new Error('Invoice payload must be an object.');
  }

  if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
    throw new Error('Invoice must contain at least one line item.');
  }

  if (invoice.items.length > 100) {
    throw new Error('Invoice cannot contain more than 100 line items.');
  }

  invoice.items.forEach((item, index) => {
    const itemPrefix = `Item ${index + 1} ("${item.name || item.description || 'unnamed'}")`;

    // Rate validation (allow 0 for legitimate complimentary free services or items)
    const rawRate = item.rate !== undefined ? item.rate : (item.unitPrice !== undefined ? item.unitPrice : item.price);
    const rate = validateFinancialInput(rawRate, `${itemPrefix} price/rate`, {
      min: 0,
      max: FINANCIAL_BOUNDS.MAX_UNIT_PRICE,
      allowZero: true,
      required: false,
    });

    // Quantity validation (must be positive > 0)
    const rawQty = item.qty !== undefined ? item.qty : item.quantity;
    const qty = validateFinancialInput(rawQty ?? 1, `${itemPrefix} quantity`, {
      min: FINANCIAL_BOUNDS.MIN_QUANTITY,
      max: FINANCIAL_BOUNDS.MAX_QUANTITY,
      allowZero: false,
      required: false,
    });

    // GST Rate validation
    if (item.gstRate !== undefined && item.gstRate !== null && item.gstRate !== '') {
      const gstRateNum = validateFinancialInput(item.gstRate, `${itemPrefix} GST rate`, {
        min: 0,
        max: 28,
        allowZero: true,
      });
      if (!FINANCIAL_BOUNDS.ALLOWED_GST_RATES.includes(gstRateNum)) {
        throw new Error(`${itemPrefix} has invalid GST slab ${gstRateNum}%. Allowed slabs are: ${FINANCIAL_BOUNDS.ALLOWED_GST_RATES.join('%, ')}%.`);
      }
    }

    // Discount validation
    const rawDiscount = item.discount ?? item.discountAmount ?? item.disAmt;
    if (rawDiscount !== undefined && rawDiscount !== null && rawDiscount !== '') {
      const disc = validateFinancialInput(rawDiscount, `${itemPrefix} discount`, {
        min: 0,
        max: FINANCIAL_BOUNDS.MAX_LINE_DISCOUNT,
        allowZero: true,
      });
      const grossMax = rate * qty;
      if (disc > grossMax && grossMax > 0) {
        throw new Error(`${itemPrefix} discount (${disc}) cannot exceed line subtotal (${grossMax}).`);
      }
    }
  });

  // Scrap exchange validation
  if (invoice.scrapExchange && invoice.scrapExchange.enabled) {
    validateFinancialInput(invoice.scrapExchange.amount, 'Scrap exchange deduction', {
      min: 0,
      max: FINANCIAL_BOUNDS.MAX_ADJUSTMENT_DISCOUNT,
      allowZero: true,
    });
  }

  // Additional discount validation
  if (invoice.additionalDiscount !== undefined && invoice.additionalDiscount !== null && invoice.additionalDiscount !== '') {
    validateFinancialInput(invoice.additionalDiscount, 'Additional invoice discount', {
      min: 0,
      max: FINANCIAL_BOUNDS.MAX_ADJUSTMENT_DISCOUNT,
      allowZero: true,
    });
  }

  // Manual round-off validation
  if (invoice.roundOffManual !== undefined && invoice.roundOffManual !== null && invoice.roundOffManual !== '') {
    validateFinancialInput(invoice.roundOffManual, 'Manual round-off adjustment', {
      min: -FINANCIAL_BOUNDS.MAX_ROUND_OFF_ADJUSTMENT,
      max: FINANCIAL_BOUNDS.MAX_ROUND_OFF_ADJUSTMENT,
      allowZero: true,
    });
  }

  return true;
}

/**
 * Authoritative Pre-Print and Pre-Save Invoice Form Validator.
 * Validates that an invoice contains real, fully-configured line items
 * and meets statutory GST, quantity, pricing, and naming rules before printing or saving.
 *
 * @param {Object} invoice
 * @returns {{
 *   isValid: boolean,
 *   errors: string[],
 *   errorSummary: string | null,
 *   itemErrors: Object<number, string[]>,
 *   hasEmptyItems: boolean
 * }}
 */
export function validateInvoiceBeforePrint(invoice) {
  const errors = [];
  const itemErrors = {};

  if (!invoice || typeof invoice !== 'object') {
    const msg = 'Please add at least one product or service before printing this invoice.';
    return {
      isValid: false,
      errors: [msg],
      errorSummary: 'Your bill is empty. Please add a product or service before printing.',
      itemErrors: {},
      hasEmptyItems: true,
    };
  }

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  // Rule 1 — At least one item
  if (items.length === 0) {
    const msg = 'Please add at least one product or service before printing this invoice.';
    return {
      isValid: false,
      errors: [msg],
      errorSummary: 'Your bill is empty. Please add a product or service before printing.',
      itemErrors: {},
      hasEmptyItems: true,
    };
  }

  // Iterate over each item
  items.forEach((item, index) => {
    const currentItemErrors = [];
    const itemNum = index + 1;
    const rawName = item?.name ?? item?.description ?? '';
    const cleanName = typeof rawName === 'string' ? rawName.trim() : '';

    // Rule 2 & 3 — Product description / No blank placeholder items
    if (!cleanName || cleanName.toLowerCase() === 'unnamed item' || cleanName.toLowerCase() === 'unnamed') {
      currentItemErrors.push(`Item ${itemNum}: Please enter the product or service name.`);
    }

    // Rule 4 — Quantity must be a valid positive number (> 0)
    const rawQty = item?.qty !== undefined ? item.qty : item?.quantity;
    if (rawQty === undefined || rawQty === null || (typeof rawQty === 'string' && rawQty.trim() === '')) {
      currentItemErrors.push(`Item ${itemNum} ("${cleanName || 'Unnamed'}"): Quantity is required.`);
    } else {
      const qtyNum = Number(rawQty);
      if (Number.isNaN(qtyNum) || !Number.isFinite(qtyNum) || qtyNum <= 0) {
        currentItemErrors.push(`Item ${itemNum} ("${cleanName || 'Unnamed'}"): Please enter a quantity greater than zero.`);
      }
    }

    // Rule 5 — Price and financial values
    const rawRate = item?.rate !== undefined ? item.rate : (item?.unitPrice !== undefined ? item.unitPrice : item?.price);
    if (rawRate === undefined || rawRate === null || (typeof rawRate === 'string' && rawRate.trim() === '')) {
      currentItemErrors.push(`Item ${itemNum} ("${cleanName || 'Unnamed'}"): Please enter a valid price.`);
    } else {
      const rateNum = Number(rawRate);
      if (Number.isNaN(rateNum) || !Number.isFinite(rateNum) || rateNum < 0) {
        currentItemErrors.push(`Item ${itemNum} ("${cleanName || 'Unnamed'}"): Please enter a valid price.`);
      }
      // Note on Rule 5: Legitimate zero-value service or complimentary inspection (rateNum === 0) is allowed!
    }

    // Rule 7 — GST Validation
    if (item?.gstRate !== undefined && item?.gstRate !== null && item?.gstRate !== '') {
      const gstNum = Number(item.gstRate);
      if (Number.isNaN(gstNum) || !FINANCIAL_BOUNDS.ALLOWED_GST_RATES.includes(gstNum)) {
        currentItemErrors.push(
          `Item ${itemNum} ("${cleanName || 'Unnamed'}"): Invalid GST rate (${item.gstRate}%). Allowed rates are 0%, 5%, 12%, 18%, 28%.`
        );
      }
    }

    if (currentItemErrors.length > 0) {
      itemErrors[index] = currentItemErrors;
      errors.push(...currentItemErrors);
    }
  });

  // Deductions validation
  if (invoice.additionalDiscount !== undefined && invoice.additionalDiscount !== null && invoice.additionalDiscount !== '') {
    const addDisc = Number(invoice.additionalDiscount);
    if (Number.isNaN(addDisc) || !Number.isFinite(addDisc) || addDisc < 0) {
      errors.push('Special invoice discount must be a valid non-negative number.');
    }
  }

  if (invoice.scrapExchange && invoice.scrapExchange.enabled) {
    const scrapAmt = Number(invoice.scrapExchange.amount);
    if (Number.isNaN(scrapAmt) || !Number.isFinite(scrapAmt) || scrapAmt < 0) {
      errors.push('Old battery scrap buyback amount must be a valid non-negative number.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorSummary: errors.length > 0 ? (items.length === 0 ? 'Your bill is empty. Please add a product or service before printing.' : errors[0]) : null,
    itemErrors,
    hasEmptyItems: items.length === 0,
  };
}

/**
 * Calculates line-level and invoice-level GST values.
 * Handles both Tax Inclusive (MRP reverse calculation) and Tax Exclusive pricing.
 */
export function calculateLineItem(item, isInterstate = false) {
  const normalized = normalizeInvoiceItem(item);
  const qty = Math.max(0, Number(normalized.qty) || 0);
  const rate = Math.max(0, Number(normalized.rate) || 0);
  const gstRate = Math.max(0, Number(normalized.gstRate) || 0);
  const isInclusive = Boolean(normalized.isTaxInclusive);
  const discount = Math.max(0, Number(normalized.discount) || 0);

  let taxableValue = 0;
  let grossAmount = 0;

  if (isInclusive) {
    // If rate includes GST, the total gross after item discount is (rate * qty) - discount
    grossAmount = Math.max(0, rate * qty - discount);
    taxableValue = gstRate > 0 ? grossAmount / (1 + gstRate / 100) : grossAmount;
  } else {
    // If rate is exclusive of GST, taxable value is (rate * qty) - discount
    taxableValue = Math.max(0, rate * qty - discount);
    grossAmount = taxableValue * (1 + gstRate / 100);
  }

  const totalGstAmount = grossAmount - taxableValue;

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (isInterstate) {
    igstRate = gstRate;
    igstAmount = totalGstAmount;
  } else {
    cgstRate = gstRate / 2;
    cgstAmount = totalGstAmount / 2;
    sgstRate = gstRate / 2;
    sgstAmount = totalGstAmount / 2;
  }

  return {
    ...normalized,
    qty,
    rate,
    gstRate,
    discount: roundToTwoDecimals(discount),
    taxableValue: roundToTwoDecimals(taxableValue),
    cgstRate,
    cgstAmount: roundToTwoDecimals(cgstAmount),
    sgstRate,
    sgstAmount: roundToTwoDecimals(sgstAmount),
    igstRate,
    igstAmount: roundToTwoDecimals(igstAmount),
    totalGstAmount: roundToTwoDecimals(totalGstAmount),
    lineTotal: roundToTwoDecimals(grossAmount),
    total: roundToTwoDecimals(grossAmount),
  };
}

export function calculateInvoiceTotals(invoice, businessStateCode = '32') {
  const customerStateCode = String(invoice?.customer?.stateCode || '32').trim();
  const isInterstate = customerStateCode !== '' && customerStateCode !== String(businessStateCode).trim();

  const computedItems = (invoice.items || []).map((item) =>
    calculateLineItem(item, isInterstate)
  );

  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalGross = 0;

  // Category sales breakdown (line totals per category, no double counting)
  const categorySales = {
    [PRODUCT_CATEGORIES.BATTERY]: 0,
    [PRODUCT_CATEGORIES.INVERTER]: 0,
    [PRODUCT_CATEGORIES.SOLAR]: 0,
    [PRODUCT_CATEGORIES.SERVICES]: 0,
  };

  // HSN Tax Breakdown Map
  const hsnMap = {};

  computedItems.forEach((item) => {
    totalTaxableValue += item.taxableValue;
    totalCgst += item.cgstAmount;
    totalSgst += item.sgstAmount;
    totalIgst += item.igstAmount;
    totalGross += item.lineTotal;

    const cat = item.category || PRODUCT_CATEGORIES.BATTERY;
    categorySales[cat] = roundToTwoDecimals((categorySales[cat] || 0) + item.lineTotal);

    const hsnKey = `${item.hsn || '8507'}_${item.gstRate}`;
    if (!hsnMap[hsnKey]) {
      hsnMap[hsnKey] = {
        hsn: item.hsn || '8507',
        gstRate: item.gstRate,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
      };
    }
    hsnMap[hsnKey].taxableValue += item.taxableValue;
    hsnMap[hsnKey].cgstAmount += item.cgstAmount;
    hsnMap[hsnKey].sgstAmount += item.sgstAmount;
    hsnMap[hsnKey].igstAmount += item.igstAmount;
    hsnMap[hsnKey].totalTax += item.totalGstAmount;
  });

  const hsnSummary = Object.values(hsnMap).map((h) => ({
    ...h,
    taxableValue: roundToTwoDecimals(h.taxableValue),
    cgstAmount: roundToTwoDecimals(h.cgstAmount),
    sgstAmount: roundToTwoDecimals(h.sgstAmount),
    igstAmount: roundToTwoDecimals(h.igstAmount),
    totalTax: roundToTwoDecimals(h.totalTax),
  }));

  // Scrap / Old Battery Buyback deduction
  const scrapDiscount =
    invoice.scrapExchange && invoice.scrapExchange.enabled
      ? Number(invoice.scrapExchange.amount) || 0
      : 0;

  // Additional Special Discount
  const extraDiscount = Number(invoice.additionalDiscount) || 0;

  // Amount after deductions
  const subtotalAfterDeductions = Math.max(0, totalGross - scrapDiscount - extraDiscount);

  // Round-off handling
  let roundOff = 0;
  let netPayable = 0;

  if (invoice.roundOffManual !== null && invoice.roundOffManual !== undefined && invoice.roundOffManual !== '') {
    roundOff = Number(invoice.roundOffManual) || 0;
    netPayable = Math.max(0, subtotalAfterDeductions + roundOff);
  } else {
    // Auto round-off to nearest integer
    const rounded = Math.round(subtotalAfterDeductions);
    roundOff = roundToTwoDecimals(rounded - subtotalAfterDeductions);
    netPayable = rounded;
  }

  const amountInWords = numberToIndianWords(netPayable);

  return {
    computedItems,
    isInterstate,
    totalTaxableValue: roundToTwoDecimals(totalTaxableValue),
    totalCgst: roundToTwoDecimals(totalCgst),
    totalSgst: roundToTwoDecimals(totalSgst),
    totalIgst: roundToTwoDecimals(totalIgst),
    totalTax: roundToTwoDecimals(totalCgst + totalSgst + totalIgst),
    totalGross: roundToTwoDecimals(totalGross),
    scrapDiscount,
    extraDiscount,
    subtotalAfterDeductions: roundToTwoDecimals(subtotalAfterDeductions),
    roundOff,
    netPayable: roundToTwoDecimals(netPayable),
    amountInWords,
    hsnSummary,
    categorySales,
  };
}

/**
 * Builds standard UPI Payment URI compatible with GPay, PhonePe, Paytm, BHIM, etc.
 * Example: upi://pay?pa=9846830532@okaxis&pn=TPS%20BATTERYS%20HOUSE&am=20000.00&cu=INR&tn=Invoice%20TPS/2026-27/001
 */
export function buildUpiUri(upiId, businessName, amount, invoiceNumber) {
  if (!upiId) return '';
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent(businessName.trim());
  const cleanAmount = roundToTwoDecimals(amount).toFixed(2);
  const note = encodeURIComponent(`Bill ${invoiceNumber || 'TPS'}`);
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${note}`;
}

export const FINANCIAL_VALIDATION_STATUS = {
  VALID_NONZERO: 'VALID_NONZERO',
  VALID_ZERO: 'VALID_ZERO',
  MISSING_FINAL_AMOUNT: 'MISSING_FINAL_AMOUNT',
  INVALID_FINANCIAL_INPUT: 'INVALID_FINANCIAL_INPUT',
  CALCULATION_MISMATCH: 'CALCULATION_MISMATCH',
};

/**
 * Authoritative financial consistency guard for invoice issuance, preview, and persistence.
 * Validates that mathematical totals, deductions, tax slabs, round-off, and net payable
 * are coherent and consistent with the single source of truth engine.
 *
 * Returns {
 *   isValid: boolean,
 *   status: FINANCIAL_VALIDATION_STATUS,
 *   authoritativeNetPayable: number | null,
 *   totals: object | null,
 *   error: string | null
 * }
 */
export function verifyInvoiceFinancialConsistency(invoice, businessStateCode = '32') {
  if (!invoice || typeof invoice !== 'object') {
    return {
      isValid: false,
      status: FINANCIAL_VALIDATION_STATUS.INVALID_FINANCIAL_INPUT,
      authoritativeNetPayable: null,
      totals: null,
      error: 'Invoice payload must be a non-null object.',
    };
  }

  // 1. Run low-level financial input validation (bounds, types, GST slabs)
  try {
    validateInvoiceFinancials(invoice);
  } catch (err) {
    return {
      isValid: false,
      status: FINANCIAL_VALIDATION_STATUS.INVALID_FINANCIAL_INPUT,
      authoritativeNetPayable: null,
      totals: null,
      error: err.message,
    };
  }

  // 2. Authoritative calculation using centralized engine
  let totals;
  try {
    totals = calculateInvoiceTotals(invoice, businessStateCode);
  } catch (err) {
    return {
      isValid: false,
      status: FINANCIAL_VALIDATION_STATUS.INVALID_FINANCIAL_INPUT,
      authoritativeNetPayable: null,
      totals: null,
      error: `Failed to calculate invoice totals: ${err.message}`,
    };
  }

  const authoritativeNetPayable = totals.netPayable;

  if (typeof authoritativeNetPayable !== 'number' || isNaN(authoritativeNetPayable) || !isFinite(authoritativeNetPayable)) {
    return {
      isValid: false,
      status: FINANCIAL_VALIDATION_STATUS.MISSING_FINAL_AMOUNT,
      authoritativeNetPayable: null,
      totals,
      error: 'Authoritative net payable calculation resulted in an invalid number.',
    };
  }

  // 3. Mathematical validation of totals
  const expectedTax = roundToTwoDecimals(totals.totalCgst + totals.totalSgst + totals.totalIgst);
  if (Math.abs(expectedTax - totals.totalTax) > 0.01) {
    return {
      isValid: false,
      status: FINANCIAL_VALIDATION_STATUS.CALCULATION_MISMATCH,
      authoritativeNetPayable,
      totals,
      error: `Tax totals mismatch: component taxes (${expectedTax}) do not match total tax (${totals.totalTax}).`,
    };
  }

  const grossLessDeductions = Math.max(0, totals.totalGross - totals.scrapDiscount - totals.extraDiscount);
  if (Math.abs(grossLessDeductions - totals.subtotalAfterDeductions) > 0.01) {
    return {
      isValid: false,
      status: FINANCIAL_VALIDATION_STATUS.CALCULATION_MISMATCH,
      authoritativeNetPayable,
      totals,
      error: 'Deduction subtraction mismatch in subtotal calculation.',
    };
  }

  const expectedNet = roundToTwoDecimals(Math.max(0, totals.subtotalAfterDeductions + totals.roundOff));
  if (Math.abs(expectedNet - authoritativeNetPayable) > 0.01) {
    return {
      isValid: false,
      status: FINANCIAL_VALIDATION_STATUS.CALCULATION_MISMATCH,
      authoritativeNetPayable,
      totals,
      error: `Final payable (${authoritativeNetPayable}) does not match subtotal after deductions and round-off (${expectedNet}).`,
    };
  }

  // 4. Distinguish Valid Zero vs Valid Nonzero
  const isZeroValue = authoritativeNetPayable === 0;

  if (totals.totalGross > (totals.scrapDiscount + totals.extraDiscount) && isZeroValue) {
    return {
      isValid: false,
      status: FINANCIAL_VALIDATION_STATUS.CALCULATION_MISMATCH,
      authoritativeNetPayable,
      totals,
      error: 'Corrupted calculation: billable items exceed deductions but net payable calculated as zero.',
    };
  }

  return {
    isValid: true,
    status: isZeroValue ? FINANCIAL_VALIDATION_STATUS.VALID_ZERO : FINANCIAL_VALIDATION_STATUS.VALID_NONZERO,
    authoritativeNetPayable,
    totals,
    error: null,
  };
}
