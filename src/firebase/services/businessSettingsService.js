/**
 * TPS Battery House — Cloud Firestore Business Profile & Bank Settings Service
 *
 * Scoped document: businesses/{businessId}/settings/business_profile
 * Enforces strict schema compliance with firestore.rules (isValidBusinessSettings).
 *
 * Provides centralized business configuration, bank details, UPI settings,
 * invoice defaults, and historical invoice snapshot decoupling.
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_BUSINESS_ID } from '../../context/authConstants.js';
import { DEFAULT_BUSINESS } from '../../utils/defaults.js';

export const SETTINGS_DOC_ID = 'business_profile';
export const FINANCIAL_SETTINGS_DOC_ID = 'financial_details';
export const BUSINESS_PROFILE_STORAGE_KEY = 'tps_business_profile';
export const FINANCIAL_STORAGE_KEY = 'tps_financial_details';
export const BUSINESS_PROFILE_MIGRATION_KEY = 'tps_business_profile_migration_v1';

/**
 * Canonical default financial settings for restricted financial_details document.
 * Accessible only to administrators.
 */
export const DEFAULT_FINANCIAL_DETAILS = {
  bankName: 'Federal Bank',
  accountHolder: 'TPS BATTERYS HOUSE',
  accountNumber: '15240200008892',
  ifsc: 'FDRL0001524',
  branch: 'Thrithala / Koottanad',
  accountType: 'Current',
  enabled: true,
};

/**
 * Canonical default business settings object incorporating
 * both structured sub-objects and backward-compatible flat aliases.
 */
export const DEFAULT_BUSINESS_SETTINGS = {
  // Business Profile
  businessName: 'TPS BATTERYS HOUSE',
  legalName: 'TPS BATTERYS HOUSE',
  businessType: 'Proprietorship',
  address: 'Building No. 16/207, 208, Padinarangadi, Koottanad Road',
  addressLine1: 'Building No. 16/207, 208, Padinarangadi',
  roadStreet: 'Koottanad Road',
  city: 'Thrithala',
  district: 'Palakkad',
  cityDistrict: 'Thrithala, Palakkad',
  state: 'Kerala',
  stateCode: '32',
  pincode: '679552',
  pinCode: '679552',
  gstin: '32DIUPP1211B2ZN',
  pan: 'DIUPP1211B',
  phone: '+91 9846830532',
  alternatePhone: '+91 9447430532',
  altPhone: '+91 9447430532',
  email: 'tpsbatterys@gmail.com',
  website: '',
  logoUrl: '',
  tagline: 'Sales & Service of Inverter, Tubular, Automotive Batteries & Solar UPS',

  // Bank Details
  bank: {
    accountHolder: 'TPS BATTERYS HOUSE',
    accountNumber: '15240200008892',
    bankName: 'Federal Bank',
    branch: 'Thrithala / Koottanad',
    ifsc: 'FDRL0001524',
    accountType: 'Current',
    enabled: true,
  },
  // Backward-compatible flat bank aliases
  bankName: 'Federal Bank',
  accountNo: '15240200008892',
  accountName: 'TPS BATTERYS HOUSE',
  branch: 'Thrithala / Koottanad',
  ifsc: 'FDRL0001524',

  // UPI Details
  upi: {
    upiId: '9846830532@okaxis',
    merchantName: 'TPS BATTERYS HOUSE',
    enabled: true,
    showQrOnInvoice: true,
  },
  // Backward-compatible flat UPI alias
  upiId: '9846830532@okaxis',

  // Invoice Configuration
  invoiceSettings: {
    defaultTerms: [
      '1. Warranty claims are subject to the terms and conditions provided by the original manufacturer.',
      '2. Original warranty card and this Tax Invoice are mandatory for any warranty / replacement claims.',
      '3. Battery, inverter and solar equipment servicing is subject to manufacturer inspection and testing.',
      '4. Old battery scrap value accepted as per mutual agreement and condition of scrap.',
      '5. Goods once sold will not be accepted back or refunded without valid technical grounds.',
      '6. Subject to Thrithala, Palakkad jurisdiction only.',
    ],
    footerText: 'Thank you for choosing TPS BATTERYS HOUSE.',
    authorizedSignatory: 'Authorized Signatory',
    showBankDetails: true,
    showUpiQr: true,
    showAuthorizedSignatory: true,
    invoicePrefix: 'TPS/2026-27/',
    defaultPaymentMode: 'Cash',
  },
  // Backward-compatible flat invoice aliases
  terms: [
    '1. Warranty claims are subject to the terms and conditions provided by the original manufacturer.',
    '2. Original warranty card and this Tax Invoice are mandatory for any warranty / replacement claims.',
    '3. Battery, inverter and solar equipment servicing is subject to manufacturer inspection and testing.',
    '4. Old battery scrap value accepted as per mutual agreement and condition of scrap.',
    '5. Goods once sold will not be accepted back or refunded without valid technical grounds.',
    '6. Subject to Thrithala, Palakkad jurisdiction only.',
  ],
  invoicePrefix: 'TPS/2026-27/',

  // Business Configuration
  config: {
    currency: 'INR',
    defaultStateCode: '32',
    financialYearStartMonth: 4,
    defaultInvoiceType: 'B2C',
  },
};

const ALLOWED_SETTINGS_KEYS = new Set([
  'businessName',
  'legalName',
  'businessType',
  'address',
  'addressLine1',
  'roadStreet',
  'city',
  'district',
  'cityDistrict',
  'state',
  'stateCode',
  'pincode',
  'pinCode',
  'gstin',
  'pan',
  'phone',
  'alternatePhone',
  'altPhone',
  'email',
  'website',
  'logoUrl',
  'tagline',
  'bank',
  'bankName',
  'accountNo',
  'accountName',
  'branch',
  'ifsc',
  'upi',
  'upiId',
  'invoiceSettings',
  'terms',
  'invoicePrefix',
  'config',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
]);

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_REGEX = /^[\w.-]+@[\w.-]+$/;

export const ALLOWED_FINANCIAL_KEYS = new Set([
  'bankName',
  'accountHolder',
  'accountName',
  'accountNumber',
  'accountNo',
  'ifsc',
  'branch',
  'accountType',
  'enabled',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
]);

/**
 * Validates and sanitizes restricted financial settings payload strictly
 * conforming to firestore.rules (isValidFinancialDetails).
 */
export function sanitizeFinancialDetailsForFirestore(rawFinancial, user = null, isUpdate = false) {
  if (!rawFinancial || typeof rawFinancial !== 'object') {
    throw new Error('Invalid financial details payload: expected an object.');
  }

  const bankName = String(rawFinancial.bankName || rawFinancial.bank?.bankName || '').trim();
  if (!bankName) {
    throw new Error('Bank name is required in financial details.');
  }

  const ifsc = String(rawFinancial.ifsc || rawFinancial.bank?.ifsc || '').trim().toUpperCase();
  if (!ifsc) {
    throw new Error('IFSC code is required in financial details.');
  }

  const holder = String(
    rawFinancial.accountHolder ||
    rawFinancial.accountName ||
    rawFinancial.bank?.accountHolder ||
    rawFinancial.bank?.accountName ||
    ''
  ).trim();

  const accNo = String(
    rawFinancial.accountNumber ||
    rawFinancial.accountNo ||
    rawFinancial.bank?.accountNumber ||
    rawFinancial.bank?.accountNo ||
    ''
  ).trim();

  const branch = String(rawFinancial.branch || rawFinancial.bank?.branch || '').trim();
  const accType = String(rawFinancial.accountType || rawFinancial.bank?.accountType || 'Current').trim();
  const enabled = rawFinancial.enabled !== undefined
    ? Boolean(rawFinancial.enabled)
    : (rawFinancial.bank?.enabled !== undefined ? Boolean(rawFinancial.bank.enabled) : true);

  const sanitized = {
    bankName: bankName.slice(0, 100),
    ifsc: ifsc.slice(0, 20),
    accountHolder: holder.slice(0, 150),
    accountName: holder.slice(0, 150),
    accountNumber: accNo.slice(0, 50),
    accountNo: accNo.slice(0, 50),
    branch: branch.slice(0, 100),
    accountType: accType.slice(0, 50),
    enabled,
  };

  const userUid = user?.uid || (typeof user === 'string' ? user : null);
  if (isUpdate) {
    sanitized.updatedAt = new Date().toISOString();
    if (userUid) sanitized.updatedBy = userUid.slice(0, 128);
    if (rawFinancial.createdAt) sanitized.createdAt = rawFinancial.createdAt;
    if (rawFinancial.createdBy) sanitized.createdBy = String(rawFinancial.createdBy).slice(0, 128);
  } else {
    sanitized.createdAt = rawFinancial.createdAt || new Date().toISOString();
    sanitized.updatedAt = new Date().toISOString();
    if (userUid) {
      sanitized.createdBy = userUid.slice(0, 128);
      sanitized.updatedBy = userUid.slice(0, 128);
    }
  }

  const cleanDoc = {};
  for (const [k, v] of Object.entries(sanitized)) {
    if (ALLOWED_FINANCIAL_KEYS.has(k) && v !== undefined) {
      cleanDoc[k] = v;
    }
  }
  return cleanDoc;
}

/**
 * Validates and sanitizes business settings payload to conform strictly to firestore.rules
 */
export function sanitizeBusinessSettingsForFirestore(rawSettings, user = null, isUpdate = false) {
  if (!rawSettings || typeof rawSettings !== 'object') {
    throw new Error('Invalid business settings payload: expected an object.');
  }

  // 1. Business Name (Required)
  const businessName = String(rawSettings.businessName || '').trim();
  if (!businessName) {
    throw new Error('Business name is required.');
  }
  if (businessName.length > 150) {
    throw new Error('Business name cannot exceed 150 characters.');
  }

  const sanitized = {
    businessName,
  };

  // Optional string fields with length limits
  if (rawSettings.legalName !== undefined && rawSettings.legalName !== null) {
    sanitized.legalName = String(rawSettings.legalName).trim().slice(0, 150);
  }
  if (rawSettings.businessType !== undefined && rawSettings.businessType !== null) {
    sanitized.businessType = String(rawSettings.businessType).trim().slice(0, 50);
  }

  // Address
  if (rawSettings.address !== undefined && rawSettings.address !== null) {
    sanitized.address = String(rawSettings.address).trim().slice(0, 300);
  }
  if (rawSettings.addressLine1 !== undefined && rawSettings.addressLine1 !== null) {
    sanitized.addressLine1 = String(rawSettings.addressLine1).trim().slice(0, 150);
  }
  if (rawSettings.roadStreet !== undefined && rawSettings.roadStreet !== null) {
    sanitized.roadStreet = String(rawSettings.roadStreet).trim().slice(0, 150);
  }
  if (rawSettings.city !== undefined && rawSettings.city !== null) {
    sanitized.city = String(rawSettings.city).trim().slice(0, 100);
  }
  if (rawSettings.district !== undefined && rawSettings.district !== null) {
    sanitized.district = String(rawSettings.district).trim().slice(0, 100);
  }
  if (rawSettings.cityDistrict !== undefined && rawSettings.cityDistrict !== null) {
    sanitized.cityDistrict = String(rawSettings.cityDistrict).trim().slice(0, 150);
  }
  if (rawSettings.state !== undefined && rawSettings.state !== null) {
    sanitized.state = String(rawSettings.state).trim().slice(0, 100);
  }

  // State Code (default '32')
  const stateCode = String(rawSettings.stateCode || '32').trim();
  if (stateCode.length > 10) {
    throw new Error('State code cannot exceed 10 characters.');
  }
  sanitized.stateCode = stateCode;

  // Pincode
  const pin = rawSettings.pincode || rawSettings.pinCode;
  if (pin !== undefined && pin !== null && String(pin).trim() !== '') {
    const cleanPin = String(pin).trim();
    if (cleanPin.length > 20) {
      throw new Error('Pincode cannot exceed 20 characters.');
    }
    sanitized.pincode = cleanPin;
    sanitized.pinCode = cleanPin;
  }

  // GSTIN & PAN
  if (rawSettings.gstin !== undefined && rawSettings.gstin !== null && String(rawSettings.gstin).trim() !== '') {
    const cleanGstin = String(rawSettings.gstin).trim().toUpperCase();
    if (cleanGstin.length > 25) {
      throw new Error('GSTIN cannot exceed 25 characters.');
    }
    sanitized.gstin = cleanGstin;

    // Auto-derive PAN if not explicitly set
    if (!rawSettings.pan && cleanGstin.length >= 12) {
      sanitized.pan = cleanGstin.slice(2, 12);
    }
  }

  if (rawSettings.pan !== undefined && rawSettings.pan !== null && String(rawSettings.pan).trim() !== '') {
    sanitized.pan = String(rawSettings.pan).trim().toUpperCase().slice(0, 20);
  }

  // Phones & Email
  if (rawSettings.phone !== undefined && rawSettings.phone !== null) {
    sanitized.phone = String(rawSettings.phone).trim().slice(0, 25);
  }
  const altPhone = rawSettings.alternatePhone || rawSettings.altPhone;
  if (altPhone !== undefined && altPhone !== null) {
    const cleanAlt = String(altPhone).trim().slice(0, 25);
    sanitized.alternatePhone = cleanAlt;
    sanitized.altPhone = cleanAlt;
  }
  if (rawSettings.email !== undefined && rawSettings.email !== null) {
    sanitized.email = String(rawSettings.email).trim().slice(0, 100);
  }
  if (rawSettings.website !== undefined && rawSettings.website !== null) {
    sanitized.website = String(rawSettings.website).trim().slice(0, 150);
  }
  if (rawSettings.logoUrl !== undefined && rawSettings.logoUrl !== null) {
    sanitized.logoUrl = String(rawSettings.logoUrl).trim().slice(0, 500);
  }
  if (rawSettings.tagline !== undefined && rawSettings.tagline !== null) {
    sanitized.tagline = String(rawSettings.tagline).trim().slice(0, 200);
  }

  // Bank Map & Aliases
  const rawBank = rawSettings.bank || {};
  const bankHolder = rawBank.accountHolder || rawBank.accountName || rawSettings.accountName || rawSettings.accountHolder || '';
  const bankAccNo = rawBank.accountNumber || rawBank.accountNo || rawSettings.accountNo || rawSettings.accountNumber || '';
  const bankName = rawBank.bankName || rawSettings.bankName || '';
  const bankBranch = rawBank.branch || rawSettings.branch || '';
  const bankIfsc = (rawBank.ifsc || rawSettings.ifsc || '').toUpperCase().trim();
  const bankType = rawBank.accountType || rawSettings.accountType || 'Current';
  const bankEnabled = rawBank.enabled !== undefined ? Boolean(rawBank.enabled) : true;

  if (bankIfsc && bankIfsc.length > 20) {
    throw new Error('IFSC code cannot exceed 20 characters.');
  }

  sanitized.bank = {
    accountHolder: String(bankHolder).trim().slice(0, 150),
    accountNumber: String(bankAccNo).trim().slice(0, 50),
    bankName: String(bankName).trim().slice(0, 100),
    branch: String(bankBranch).trim().slice(0, 100),
    ifsc: bankIfsc.slice(0, 20),
    accountType: String(bankType).trim().slice(0, 30),
    enabled: bankEnabled,
  };

  // Flat aliases for direct access
  sanitized.bankName = sanitized.bank.bankName;
  sanitized.accountNo = sanitized.bank.accountNumber;
  sanitized.accountName = sanitized.bank.accountHolder;
  sanitized.branch = sanitized.bank.branch;
  sanitized.ifsc = sanitized.bank.ifsc;

  // UPI Map & Aliases
  const rawUpi = rawSettings.upi || {};
  const upiId = String(rawUpi.upiId || rawSettings.upiId || '').trim();
  const upiMerchant = String(rawUpi.merchantName || rawSettings.merchantName || sanitized.businessName).trim();
  const upiEnabled = rawUpi.enabled !== undefined ? Boolean(rawUpi.enabled) : true;
  const upiShowQr = rawUpi.showQrOnInvoice !== undefined ? Boolean(rawUpi.showQrOnInvoice) : true;

  if (upiId && upiId.length > 100) {
    throw new Error('UPI ID cannot exceed 100 characters.');
  }

  sanitized.upi = {
    upiId: upiId.slice(0, 100),
    merchantName: upiMerchant.slice(0, 150),
    enabled: upiEnabled,
    showQrOnInvoice: upiShowQr,
  };
  sanitized.upiId = sanitized.upi.upiId;

  // Invoice Configuration Map & Aliases
  const rawInv = rawSettings.invoiceSettings || {};
  const termsList = Array.isArray(rawInv.defaultTerms)
    ? rawInv.defaultTerms
    : Array.isArray(rawSettings.terms)
      ? rawSettings.terms
      : DEFAULT_BUSINESS_SETTINGS.invoiceSettings.defaultTerms;

  const sanitizedTerms = termsList
    .slice(0, 20)
    .map((t) => String(t || '').trim().slice(0, 300))
    .filter(Boolean);

  const footerText = String(rawInv.footerText || rawSettings.footerText || 'Thank you for choosing TPS BATTERYS HOUSE.').trim().slice(0, 300);
  const authSig = String(rawInv.authorizedSignatory || rawSettings.authorizedSignatory || 'Authorized Signatory').trim().slice(0, 100);
  const showBank = rawInv.showBankDetails !== undefined ? Boolean(rawInv.showBankDetails) : true;
  const showQr = rawInv.showUpiQr !== undefined ? Boolean(rawInv.showUpiQr) : true;
  const showSig = rawInv.showAuthorizedSignatory !== undefined ? Boolean(rawInv.showAuthorizedSignatory) : true;
  const prefix = String(rawInv.invoicePrefix || rawSettings.invoicePrefix || 'TPS/2026-27/').trim().slice(0, 50);
  const defPayMode = String(rawInv.defaultPaymentMode || rawSettings.defaultPaymentMode || 'Cash').trim().slice(0, 50);

  sanitized.invoiceSettings = {
    defaultTerms: sanitizedTerms,
    footerText,
    authorizedSignatory: authSig,
    showBankDetails: showBank,
    showUpiQr: showQr,
    showAuthorizedSignatory: showSig,
    invoicePrefix: prefix,
    defaultPaymentMode: defPayMode,
  };
  sanitized.terms = sanitizedTerms;
  sanitized.invoicePrefix = prefix;

  // Business Configuration Map
  const rawCfg = rawSettings.config || {};
  sanitized.config = {
    currency: String(rawCfg.currency || 'INR').trim().slice(0, 10),
    defaultStateCode: String(rawCfg.defaultStateCode || sanitized.stateCode || '32').trim().slice(0, 10),
    financialYearStartMonth: Math.min(12, Math.max(1, Number(rawCfg.financialYearStartMonth) || 4)),
    defaultInvoiceType: String(rawCfg.defaultInvoiceType || 'B2C').trim().slice(0, 20),
  };

  // Audit metadata
  const userUid = user?.uid || (typeof user === 'string' ? user : null);

  if (isUpdate) {
    sanitized.updatedAt = new Date().toISOString();
    if (userUid) {
      sanitized.updatedBy = userUid.slice(0, 128);
    } else if (rawSettings.updatedBy) {
      sanitized.updatedBy = String(rawSettings.updatedBy).slice(0, 128);
    }

    if (rawSettings.createdAt) sanitized.createdAt = rawSettings.createdAt;
    if (rawSettings.createdBy) sanitized.createdBy = String(rawSettings.createdBy).slice(0, 128);
  } else {
    sanitized.createdAt = rawSettings.createdAt || new Date().toISOString();
    sanitized.updatedAt = new Date().toISOString();
    if (userUid) {
      sanitized.createdBy = userUid.slice(0, 128);
      sanitized.updatedBy = userUid.slice(0, 128);
    } else {
      if (rawSettings.createdBy) sanitized.createdBy = String(rawSettings.createdBy).slice(0, 128);
      if (rawSettings.updatedBy) sanitized.updatedBy = String(rawSettings.updatedBy).slice(0, 128);
    }
  }

  // Strip unwhitelisted fields
  const cleanDoc = {};
  for (const [k, v] of Object.entries(sanitized)) {
    if (ALLOWED_SETTINGS_KEYS.has(k) && v !== undefined) {
      cleanDoc[k] = v;
    }
  }

  return cleanDoc;
}

/**
 * Normalizes settings document from Firestore or Cache into a complete
 * structure with both sub-objects and flat properties available.
 */
export function normalizeBusinessSettings(docData) {
  if (!docData || typeof docData !== 'object') {
    return { ...DEFAULT_BUSINESS_SETTINGS };
  }

  const merged = {
    ...DEFAULT_BUSINESS_SETTINGS,
    ...docData,
    bank: {
      ...DEFAULT_BUSINESS_SETTINGS.bank,
      ...(docData.bank || {}),
    },
    upi: {
      ...DEFAULT_BUSINESS_SETTINGS.upi,
      ...(docData.upi || {}),
    },
    invoiceSettings: {
      ...DEFAULT_BUSINESS_SETTINGS.invoiceSettings,
      ...(docData.invoiceSettings || {}),
    },
    config: {
      ...DEFAULT_BUSINESS_SETTINGS.config,
      ...(docData.config || {}),
    },
  };

  // Ensure flat compatibility properties match
  merged.bankName = merged.bank.bankName || docData.bankName || DEFAULT_BUSINESS_SETTINGS.bankName;
  merged.accountNo = merged.bank.accountNumber || docData.accountNo || DEFAULT_BUSINESS_SETTINGS.accountNo;
  merged.accountName = merged.bank.accountHolder || docData.accountName || DEFAULT_BUSINESS_SETTINGS.accountName;
  merged.branch = merged.bank.branch || docData.branch || DEFAULT_BUSINESS_SETTINGS.branch;
  merged.ifsc = merged.bank.ifsc || docData.ifsc || DEFAULT_BUSINESS_SETTINGS.ifsc;
  merged.upiId = merged.upi.upiId || docData.upiId || DEFAULT_BUSINESS_SETTINGS.upiId;
  const explicitTerms = docData.terms || docData.invoiceSettings?.defaultTerms;
  merged.terms = Array.isArray(explicitTerms)
    ? [...explicitTerms]
    : (Array.isArray(merged.invoiceSettings.defaultTerms) ? [...merged.invoiceSettings.defaultTerms] : [...DEFAULT_BUSINESS_SETTINGS.terms]);
  merged.invoiceSettings.defaultTerms = merged.terms;
  merged.invoicePrefix = merged.invoiceSettings.invoicePrefix || docData.invoicePrefix || DEFAULT_BUSINESS_SETTINGS.invoicePrefix;
  merged.pinCode = merged.pincode || docData.pinCode || DEFAULT_BUSINESS_SETTINGS.pinCode;
  merged.altPhone = merged.alternatePhone || docData.altPhone || DEFAULT_BUSINESS_SETTINGS.altPhone;

  return merged;
}

/**
 * Creates an immutable business settings snapshot for permanent invoice records.
 * Decouples historical invoices from subsequent store profile updates.
 * Guarantees deep-cloned properties with robust fallbacks for missing optional fields.
 */
export function createBusinessSnapshot(settings) {
  const normalized = normalizeBusinessSettings(settings);

  return {
    businessName: String(normalized.businessName || DEFAULT_BUSINESS_SETTINGS.businessName),
    legalName: String(normalized.legalName || normalized.businessName || DEFAULT_BUSINESS_SETTINGS.legalName),
    businessType: String(normalized.businessType || DEFAULT_BUSINESS_SETTINGS.businessType),
    address: String(normalized.address || DEFAULT_BUSINESS_SETTINGS.address),
    addressLine1: String(normalized.addressLine1 || DEFAULT_BUSINESS_SETTINGS.addressLine1),
    roadStreet: String(normalized.roadStreet || DEFAULT_BUSINESS_SETTINGS.roadStreet),
    city: String(normalized.city || DEFAULT_BUSINESS_SETTINGS.city),
    district: String(normalized.district || DEFAULT_BUSINESS_SETTINGS.district),
    cityDistrict: String(normalized.cityDistrict || DEFAULT_BUSINESS_SETTINGS.cityDistrict),
    state: String(normalized.state || DEFAULT_BUSINESS_SETTINGS.state),
    stateCode: String(normalized.stateCode || DEFAULT_BUSINESS_SETTINGS.stateCode),
    pincode: String(normalized.pincode || DEFAULT_BUSINESS_SETTINGS.pincode),
    pinCode: String(normalized.pinCode || DEFAULT_BUSINESS_SETTINGS.pinCode),
    gstin: String(normalized.gstin || DEFAULT_BUSINESS_SETTINGS.gstin),
    pan: String(normalized.pan || DEFAULT_BUSINESS_SETTINGS.pan),
    phone: String(normalized.phone || DEFAULT_BUSINESS_SETTINGS.phone),
    alternatePhone: String(normalized.alternatePhone || DEFAULT_BUSINESS_SETTINGS.alternatePhone),
    altPhone: String(normalized.altPhone || DEFAULT_BUSINESS_SETTINGS.altPhone),
    email: String(normalized.email || DEFAULT_BUSINESS_SETTINGS.email),
    tagline: String(normalized.tagline || DEFAULT_BUSINESS_SETTINGS.tagline),
    bankName: String(normalized.bankName || ''),
    accountNo: String(normalized.accountNo || ''),
    accountName: String(normalized.accountName || ''),
    branch: String(normalized.branch || ''),
    ifsc: String(normalized.ifsc || ''),
    upiId: String(normalized.upiId || DEFAULT_BUSINESS_SETTINGS.upiId),
    terms: Array.isArray(normalized.terms) ? [...normalized.terms] : [...DEFAULT_BUSINESS_SETTINGS.terms],
    showBankDetails: normalized.invoiceSettings?.showBankDetails ?? true,
    showUpiQr: normalized.invoiceSettings?.showUpiQr ?? true,
    showAuthorizedSignatory: normalized.invoiceSettings?.showAuthorizedSignatory ?? true,
    footerText: String(normalized.invoiceSettings?.footerText || DEFAULT_BUSINESS_SETTINGS.invoiceSettings.footerText),
    authorizedSignatory: String(normalized.invoiceSettings?.authorizedSignatory || DEFAULT_BUSINESS_SETTINGS.invoiceSettings.authorizedSignatory),
    snapshotTimestamp: new Date().toISOString(),
  };
}

/**
 * Fetch restricted financial details from Firestore (Administrator only)
 */
export async function getFinancialDetails(businessId = DEFAULT_BUSINESS_ID, dbInstance = db) {
  try {
    const docRef = doc(dbInstance, 'businesses', businessId, 'settings', FINANCIAL_SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return null;
    }

    return snap.data();
  } catch (error) {
    console.error(`[BusinessSettingsService] Failed to get financial details for ${businessId}:`, error);
    throw error;
  }
}

/**
 * Update restricted financial details (Administrator only)
 */
export async function updateFinancialDetails(
  businessId = DEFAULT_BUSINESS_ID,
  financialData,
  user = null,
  dbInstance = db
) {
  try {
    const docRef = doc(dbInstance, 'businesses', businessId, 'settings', FINANCIAL_SETTINGS_DOC_ID);
    const sanitized = sanitizeFinancialDetailsForFirestore(financialData, user, true);

    await setDoc(docRef, sanitized, { merge: true });
    return sanitized;
  } catch (error) {
    console.error(`[BusinessSettingsService] Failed to update financial details for ${businessId}:`, error);
    throw error;
  }
}

/**
 * Subscribe to restricted financial details in real-time (Administrator only)
 */
export function subscribeToFinancialDetails(
  businessId = DEFAULT_BUSINESS_ID,
  onNext,
  onError,
  dbInstance = db
) {
  const docRef = doc(dbInstance, 'businesses', businessId, 'settings', FINANCIAL_SETTINGS_DOC_ID);

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        if (typeof onNext === 'function') onNext(snap.data());
      } else {
        if (typeof onNext === 'function') onNext(null);
      }
    },
    (err) => {
      console.warn(`[BusinessSettingsService] Snapshot error on ${businessId}/settings/financial_details:`, err);
      if (typeof onError === 'function') onError(err);
    }
  );
}

/**
 * Initialize financial details if not already present (Administrator only)
 */
export async function initializeFinancialDetails(
  businessId = DEFAULT_BUSINESS_ID,
  initialData = null,
  user = null,
  dbInstance = db
) {
  try {
    const docRef = doc(dbInstance, 'businesses', businessId, 'settings', FINANCIAL_SETTINGS_DOC_ID);
    const existingSnap = await getDoc(docRef);

    if (existingSnap.exists()) {
      return existingSnap.data();
    }

    const payload = initialData || DEFAULT_FINANCIAL_DETAILS;
    const sanitized = sanitizeFinancialDetailsForFirestore(payload, user, false);
    await setDoc(docRef, sanitized);

    return sanitized;
  } catch (error) {
    console.error(`[BusinessSettingsService] Failed to initialize financial details for ${businessId}:`, error);
    throw error;
  }
}

/**
 * Fetch business settings from Firestore
 */
export async function getBusinessSettings(businessId = DEFAULT_BUSINESS_ID, dbInstance = db) {
  try {
    const docRef = doc(dbInstance, 'businesses', businessId, 'settings', SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return null;
    }

    return normalizeBusinessSettings(snap.data());
  } catch (error) {
    console.error(`[BusinessSettingsService] Failed to get settings for ${businessId}:`, error);
    throw error;
  }
}

/**
 * Subscribe to business settings in real-time
 */
export function subscribeToBusinessSettings(
  businessId = DEFAULT_BUSINESS_ID,
  onNext,
  onError,
  dbInstance = db
) {
  const docRef = doc(dbInstance, 'businesses', businessId, 'settings', SETTINGS_DOC_ID);

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = normalizeBusinessSettings(snap.data());
        if (typeof onNext === 'function') {
          onNext(data);
        }
      } else {
        if (typeof onNext === 'function') {
          onNext(null);
        }
      }
    },
    (err) => {
      console.error(`[BusinessSettingsService] Snapshot error on ${businessId}/settings:`, err);
      if (typeof onError === 'function') {
        onError(err);
      }
    }
  );
}

/**
 * Update business settings (Administrator only)
 * Persists general settings to settings/business_profile and restricted
 * financial bank details to settings/financial_details.
 */
export async function updateBusinessSettings(
  businessId = DEFAULT_BUSINESS_ID,
  settingsData,
  user = null,
  dbInstance = db
) {
  try {
    const docRef = doc(dbInstance, 'businesses', businessId, 'settings', SETTINGS_DOC_ID);
    const sanitized = sanitizeBusinessSettingsForFirestore(settingsData, user, true);

    await setDoc(docRef, sanitized, { merge: true });

    // Also persist restricted financial details into settings/financial_details
    if (settingsData.bank || settingsData.accountNo || settingsData.accountNumber || settingsData.bankName) {
      try {
        await updateFinancialDetails(
          businessId,
          settingsData.bank || settingsData,
          user,
          dbInstance
        );
      } catch (finErr) {
        console.warn('[BusinessSettingsService] Non-critical warning updating financial details:', finErr.message);
      }
    }

    return normalizeBusinessSettings(sanitized);
  } catch (error) {
    console.error(`[BusinessSettingsService] Failed to update settings for ${businessId}:`, error);
    throw error;
  }
}

/**
 * Initialize business settings if not already present
 */
export async function initializeBusinessSettings(
  businessId = DEFAULT_BUSINESS_ID,
  initialData = null,
  user = null,
  dbInstance = db
) {
  try {
    const docRef = doc(dbInstance, 'businesses', businessId, 'settings', SETTINGS_DOC_ID);
    const existingSnap = await getDoc(docRef);

    if (existingSnap.exists()) {
      return normalizeBusinessSettings(existingSnap.data());
    }

    const payload = initialData || DEFAULT_BUSINESS_SETTINGS;
    const sanitized = sanitizeBusinessSettingsForFirestore(payload, user, false);
    await setDoc(docRef, sanitized);

    try {
      await initializeFinancialDetails(
        businessId,
        payload.bank || payload,
        user,
        dbInstance
      );
    } catch (finErr) {
      console.warn('[BusinessSettingsService] Non-critical warning initializing financial details:', finErr.message);
    }

    return normalizeBusinessSettings(sanitized);
  } catch (error) {
    console.error(`[BusinessSettingsService] Failed to initialize settings for ${businessId}:`, error);
    throw error;
  }
}

/**
 * Checks if migration from localStorage is needed
 */
export function isBusinessSettingsMigrationNeeded() {
  try {
    const isCompleted = localStorage.getItem(BUSINESS_PROFILE_MIGRATION_KEY);
    if (isCompleted) return false;

    const raw = localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return true;
    }
    return true; // Candidate default profile can be seeded
  } catch {
    return false;
  }
}

/**
 * Extracts local profile from localStorage or fallback defaults
 */
export function extractLocalBusinessProfile() {
  try {
    const raw = localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[BusinessSettingsService] Error reading local business profile:', e);
  }
  return DEFAULT_BUSINESS;
}

/**
 * Safe, idempotent migration from localStorage to Cloud Firestore.
 * Concurrency-safe: reads Firestore first, never overwrites verified remote settings.
 * Preserves localStorage until migration is fully verified.
 */
export async function migrateBusinessSettings(
  businessId = DEFAULT_BUSINESS_ID,
  user = null,
  dbInstance = db
) {
  const result = {
    migrated: false,
    alreadyPresent: false,
    conflicted: false,
    settings: null,
    error: null,
  };

  try {
    const docRef = doc(dbInstance, 'businesses', businessId, 'settings', SETTINGS_DOC_ID);

    // 1. Check if remote Firestore document already exists
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      // Remote already exists! Do NOT overwrite with local data.
      result.alreadyPresent = true;
      result.settings = normalizeBusinessSettings(snap.data());

      // Mark migration complete in localStorage
      try {
        localStorage.setItem(
          BUSINESS_PROFILE_MIGRATION_KEY,
          JSON.stringify({
            status: 'completed',
            mode: 'remote_preserved',
            migratedAt: new Date().toISOString(),
          })
        );
      } catch (e) {
        console.warn('[BusinessSettingsService] Failed to write migration flag:', e);
      }
      return result;
    }

    // 2. Remote document is absent: extract local profile
    const localProfile = extractLocalBusinessProfile();
    const sanitized = sanitizeBusinessSettingsForFirestore(localProfile, user, false);

    // 3. Atomically set document in Firestore using transaction to prevent race conditions
    await runTransaction(dbInstance, async (transaction) => {
      const freshSnap = await transaction.get(docRef);
      if (freshSnap.exists()) {
        result.conflicted = true;
        result.settings = normalizeBusinessSettings(freshSnap.data());
        return;
      }
      transaction.set(docRef, sanitized);
      result.migrated = true;
      result.settings = normalizeBusinessSettings(sanitized);
    });

    // 4. Record migration completion in localStorage without deleting original data
    try {
      localStorage.setItem(
        BUSINESS_PROFILE_MIGRATION_KEY,
        JSON.stringify({
          status: 'completed',
          mode: 'migrated',
          migratedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.warn('[BusinessSettingsService] Failed to write migration flag:', e);
    }

    return result;
  } catch (err) {
    console.error('[BusinessSettingsService] Migration failed:', err);
    result.error = err.message;
    throw err;
  }
}
