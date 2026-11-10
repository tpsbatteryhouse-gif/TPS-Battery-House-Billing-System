import React, { useState } from 'react';
import {
  X,
  Building2,
  Save,
  RotateCcw,
  CreditCard,
  QrCode,
  FileText,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/useAuth.js';
import { DEFAULT_BUSINESS_SETTINGS } from '../firebase/services/businessSettingsService.js';
import { buildUpiUri } from '../utils/gstCalculations.js';
import UpiQrCode from './UpiQrCode.jsx';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_REGEX = /^[\w.-]+@[\w.-]+$/;

function BusinessSettingsContent({
  onClose,
  business,
  setBusiness,
  onSave,
  _syncStatus = 'synced',
}) {
  const { permissions, member } = useAuth();
  const canEdit = Boolean(permissions?.canManageSettings || member?.role === 'admin');

  const [activeTab, setActiveTab] = useState('business');
  const [formData, setFormData] = useState(() => ({
    ...DEFAULT_BUSINESS_SETTINGS,
    ...(business || {}),
    bank: {
      ...DEFAULT_BUSINESS_SETTINGS.bank,
      ...(business?.bank || {}),
    },
    upi: {
      ...DEFAULT_BUSINESS_SETTINGS.upi,
      ...(business?.upi || {}),
    },
    invoiceSettings: {
      ...DEFAULT_BUSINESS_SETTINGS.invoiceSettings,
      ...(business?.invoiceSettings || {}),
    },
    config: {
      ...DEFAULT_BUSINESS_SETTINGS.config,
      ...(business?.config || {}),
    },
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Change handlers
  const handleRootChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleBankChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      bank: {
        ...(prev.bank || {}),
        [field]: value,
      },
    }));
  };

  const handleUpiChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      upi: {
        ...(prev.upi || {}),
        [field]: value,
      },
    }));
  };

  const handleInvoiceSettingsChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      invoiceSettings: {
        ...(prev.invoiceSettings || {}),
        [field]: value,
      },
    }));
  };

  // Terms and conditions list management
  const termsList = Array.isArray(formData.invoiceSettings?.defaultTerms)
    ? formData.invoiceSettings.defaultTerms
    : Array.isArray(formData.terms)
      ? formData.terms
      : DEFAULT_BUSINESS_SETTINGS.invoiceSettings.defaultTerms;

  const handleTermUpdate = (index, value) => {
    const updated = [...termsList];
    updated[index] = value;
    handleInvoiceSettingsChange('defaultTerms', updated);
  };

  const handleAddTerm = () => {
    if (termsList.length >= 20) return;
    const updated = [...termsList, ''];
    handleInvoiceSettingsChange('defaultTerms', updated);
  };

  const handleRemoveTerm = (index) => {
    const updated = termsList.filter((_, i) => i !== index);
    handleInvoiceSettingsChange('defaultTerms', updated);
  };

  // Validations
  const gstinValue = (formData.gstin || '').trim().toUpperCase();
  const isGstinValid = !gstinValue || GSTIN_REGEX.test(gstinValue);

  const ifscValue = (formData.bank?.ifsc || formData.ifsc || '').trim().toUpperCase();
  const isIfscValid = !ifscValue || IFSC_REGEX.test(ifscValue);

  const upiIdValue = (formData.upi?.upiId || formData.upiId || '').trim();
  const isUpiValid = !upiIdValue || UPI_REGEX.test(upiIdValue);

  // Live UPI URI for QR Preview
  const previewMerchant = formData.upi?.merchantName || formData.businessName || 'TPS BATTERYS HOUSE';
  const liveUpiUri = upiIdValue && isUpiValid
    ? buildUpiUri(upiIdValue, previewMerchant, 1000, 'PREVIEW-SAMPLE')
    : null;

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!canEdit) return;

    if (!formData.businessName?.trim()) {
      setErrorMessage('Business name is required.');
      setActiveTab('business');
      return;
    }

    if (gstinValue && !GSTIN_REGEX.test(gstinValue)) {
      setErrorMessage('Invalid GSTIN format. Expected standard 15-character Indian GSTIN.');
      setActiveTab('business');
      return;
    }

    if (ifscValue && !IFSC_REGEX.test(ifscValue)) {
      setErrorMessage('Invalid IFSC code format. Expected 11 characters (e.g. FDRL0001524).');
      setActiveTab('bank');
      return;
    }

    if (upiIdValue && !UPI_REGEX.test(upiIdValue)) {
      setErrorMessage('Invalid UPI ID format. Expected standard VPA (e.g. username@bank).');
      setActiveTab('upi');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      if (onSave) {
        await onSave(formData);
      } else if (setBusiness) {
        setBusiness(formData);
        localStorage.setItem('tps_business_profile', JSON.stringify(formData));
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('[BusinessSettingsModal] Save error:', err);
      setErrorMessage(err.message || 'Failed to save business settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (!canEdit) return;
    if (window.confirm('Reset business information to official TPS BATTERYS HOUSE defaults?')) {
      setFormData({ ...DEFAULT_BUSINESS_SETTINGS });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="settings-modal-title" className="text-base font-bold text-white">
                  Store Profile & Settings
                </h2>
                {!canEdit && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    <Lock className="w-3 h-3 text-amber-400" />
                    View-Only Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Centralized store profile, bank accounts, UPI payment QR, & invoice configuration
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings modal"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View-Only Warning for Managers/Cashiers */}
        {!canEdit && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              You have read-only access. Modifying business information, bank accounts, and invoice templates requires Administrator privileges.
            </span>
          </div>
        )}

        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}
        {saveSuccess && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2.5 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Store settings saved successfully to Cloud Firestore!</span>
          </div>
        )}

        {/* Accessible Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Business Settings Sections"
          className="flex border-b border-slate-800 bg-slate-950/40 px-4 gap-2 overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            id="tab-business"
            aria-selected={activeTab === 'business'}
            aria-controls="panel-business"
            onClick={() => setActiveTab('business')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-t ${
              activeTab === 'business'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>1. Business Info</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-bank"
            aria-selected={activeTab === 'bank'}
            aria-controls="panel-bank"
            onClick={() => setActiveTab('bank')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-t ${
              activeTab === 'bank'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>2. Bank Details</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-upi"
            aria-selected={activeTab === 'upi'}
            aria-controls="panel-upi"
            onClick={() => setActiveTab('upi')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-t ${
              activeTab === 'upi'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>3. UPI Configuration</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-invoice"
            aria-selected={activeTab === 'invoice'}
            aria-controls="panel-invoice"
            onClick={() => setActiveTab('invoice')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-t ${
              activeTab === 'invoice'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>4. Invoice Settings</span>
          </button>
        </div>

        {/* Tab Panels */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* TAB 1: Business Information */}
          {activeTab === 'business' && (
            <div
              id="panel-business"
              role="tabpanel"
              aria-labelledby="tab-business"
              className="space-y-4 animate-fade-in"
            >
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Primary Business Profile
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="businessName" className="text-slate-300 font-medium">
                      Trade Name / Store Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="businessName"
                      type="text"
                      disabled={!canEdit}
                      value={formData.businessName || ''}
                      onChange={(e) => handleRootChange('businessName', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="legalName" className="text-slate-300 font-medium">
                      Legal Name
                    </label>
                    <input
                      id="legalName"
                      type="text"
                      disabled={!canEdit}
                      value={formData.legalName || ''}
                      onChange={(e) => handleRootChange('legalName', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="gstin" className="text-slate-300 font-medium">
                        GSTIN
                      </label>
                      {gstinValue && (
                        <span
                          className={`text-[10px] font-semibold ${
                            isGstinValid ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isGstinValid ? 'Valid Format' : 'Invalid Format'}
                        </span>
                      )}
                    </div>
                    <input
                      id="gstin"
                      type="text"
                      disabled={!canEdit}
                      value={formData.gstin || ''}
                      onChange={(e) => handleRootChange('gstin', e.target.value.toUpperCase())}
                      placeholder="32DIUPP1211B2ZN"
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-1.5 font-mono text-white uppercase disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        !isGstinValid ? 'border-red-500' : 'border-slate-700'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="pan" className="text-slate-300 font-medium">
                      PAN
                    </label>
                    <input
                      id="pan"
                      type="text"
                      disabled={!canEdit}
                      value={formData.pan || ''}
                      onChange={(e) => handleRootChange('pan', e.target.value.toUpperCase())}
                      placeholder="DIUPP1211B"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-white uppercase disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="tagline" className="text-slate-300 font-medium">
                    Store Tagline / Description
                  </label>
                  <input
                    id="tagline"
                    type="text"
                    disabled={!canEdit}
                    value={formData.tagline || ''}
                    onChange={(e) => handleRootChange('tagline', e.target.value)}
                    placeholder="Sales & Service of Inverter, Tubular, Automotive Batteries & Solar UPS"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Contact & Address */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                  Store Address & Contact Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="addressLine1" className="text-slate-300 font-medium">
                      Building / Shop No. & Area
                    </label>
                    <input
                      id="addressLine1"
                      type="text"
                      disabled={!canEdit}
                      value={formData.addressLine1 || ''}
                      onChange={(e) => handleRootChange('addressLine1', e.target.value)}
                      placeholder="Building No. 16/207, 208, Padinarangadi"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="roadStreet" className="text-slate-300 font-medium">
                      Road / Landmark
                    </label>
                    <input
                      id="roadStreet"
                      type="text"
                      disabled={!canEdit}
                      value={formData.roadStreet || ''}
                      onChange={(e) => handleRootChange('roadStreet', e.target.value)}
                      placeholder="Koottanad Road"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label htmlFor="cityDistrict" className="text-slate-300 font-medium">
                      City / District
                    </label>
                    <input
                      id="cityDistrict"
                      type="text"
                      disabled={!canEdit}
                      value={formData.cityDistrict || ''}
                      onChange={(e) => handleRootChange('cityDistrict', e.target.value)}
                      placeholder="Thrithala, Palakkad"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="state" className="text-slate-300 font-medium">
                      State & Code
                    </label>
                    <input
                      id="state"
                      type="text"
                      disabled
                      value={`${formData.state || 'Kerala'} (${formData.stateCode || '32'})`}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="pinCode" className="text-slate-300 font-medium">
                      PIN Code
                    </label>
                    <input
                      id="pinCode"
                      type="text"
                      disabled={!canEdit}
                      value={formData.pinCode || formData.pincode || ''}
                      onChange={(e) => {
                        handleRootChange('pinCode', e.target.value);
                        handleRootChange('pincode', e.target.value);
                      }}
                      placeholder="679552"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="phone" className="text-slate-300 font-medium">
                      Primary Phone
                    </label>
                    <input
                      id="phone"
                      type="text"
                      disabled={!canEdit}
                      value={formData.phone || ''}
                      onChange={(e) => handleRootChange('phone', e.target.value)}
                      placeholder="+91 9846830532"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="altPhone" className="text-slate-300 font-medium">
                      Alternate Phone
                    </label>
                    <input
                      id="altPhone"
                      type="text"
                      disabled={!canEdit}
                      value={formData.altPhone || formData.alternatePhone || ''}
                      onChange={(e) => {
                        handleRootChange('altPhone', e.target.value);
                        handleRootChange('alternatePhone', e.target.value);
                      }}
                      placeholder="+91 9447430532"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="email" className="text-slate-300 font-medium">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      disabled={!canEdit}
                      value={formData.email || ''}
                      onChange={(e) => handleRootChange('email', e.target.value)}
                      placeholder="tpsbatterys@gmail.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Bank Details */}
          {activeTab === 'bank' && (
            <div
              id="panel-bank"
              role="tabpanel"
              aria-labelledby="tab-bank"
              className="space-y-4 animate-fade-in"
            >
              {!canEdit && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-amber-200">Restricted Financial Details</span>
                    Direct management of bank settlement credentials and full account numbers is strictly restricted to Administrators. Cashiers and Managers can view store profile and manage UPI payment QR codes.
                  </div>
                </div>
              )}

              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    Official Settlement Bank Account
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={formData.bank?.enabled ?? true}
                      onChange={(e) => handleBankChange('enabled', e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-slate-300 font-medium">Print on Invoices</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="bankName" className="text-slate-300 font-medium">
                      Bank Name
                    </label>
                    <input
                      id="bankName"
                      type="text"
                      disabled={!canEdit}
                      value={formData.bank?.bankName || formData.bankName || ''}
                      onChange={(e) => {
                        handleBankChange('bankName', e.target.value);
                        handleRootChange('bankName', e.target.value);
                      }}
                      placeholder="Federal Bank"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="accountHolder" className="text-slate-300 font-medium">
                      Account Holder Name
                    </label>
                    <input
                      id="accountHolder"
                      type="text"
                      disabled={!canEdit}
                      value={formData.bank?.accountHolder || formData.accountName || ''}
                      onChange={(e) => {
                        handleBankChange('accountHolder', e.target.value);
                        handleRootChange('accountName', e.target.value);
                      }}
                      placeholder="TPS BATTERYS HOUSE"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="accountNumber" className="text-slate-300 font-medium">
                      Account Number
                    </label>
                    <input
                      id="accountNumber"
                      type="text"
                      disabled={!canEdit}
                      value={
                        !canEdit
                          ? (formData.bank?.accountNumber || formData.accountNo
                              ? '•••• •••• •••• ' + String(formData.bank?.accountNumber || formData.accountNo).slice(-4)
                              : '••••••••••••')
                          : (formData.bank?.accountNumber || formData.accountNo || '')
                      }
                      onChange={(e) => {
                        handleBankChange('accountNumber', e.target.value);
                        handleRootChange('accountNo', e.target.value);
                      }}
                      placeholder="15240200008892"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="ifsc" className="text-slate-300 font-medium">
                        IFSC Code
                      </label>
                      {ifscValue && (
                        <span
                          className={`text-[10px] font-semibold ${
                            isIfscValid ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isIfscValid ? 'Valid IFSC' : 'Invalid Format'}
                        </span>
                      )}
                    </div>
                    <input
                      id="ifsc"
                      type="text"
                      disabled={!canEdit}
                      value={formData.bank?.ifsc || formData.ifsc || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        handleBankChange('ifsc', val);
                        handleRootChange('ifsc', val);
                      }}
                      placeholder="FDRL0001524"
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-1.5 font-mono text-white uppercase disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        !isIfscValid ? 'border-red-500' : 'border-slate-700'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="branch" className="text-slate-300 font-medium">
                      Branch Name / Location
                    </label>
                    <input
                      id="branch"
                      type="text"
                      disabled={!canEdit}
                      value={formData.bank?.branch || formData.branch || ''}
                      onChange={(e) => {
                        handleBankChange('branch', e.target.value);
                        handleRootChange('branch', e.target.value);
                      }}
                      placeholder="Thrithala / Koottanad"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="accountType" className="text-slate-300 font-medium">
                      Account Type
                    </label>
                    <select
                      id="accountType"
                      disabled={!canEdit}
                      value={formData.bank?.accountType || 'Current'}
                      onChange={(e) => handleBankChange('accountType', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Current">Current Account</option>
                      <option value="Savings">Savings Account</option>
                      <option value="Cash Credit">Cash Credit (CC)</option>
                      <option value="Overdraft">Overdraft (OD)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: UPI Configuration & Live QR Preview */}
          {activeTab === 'upi' && (
            <div
              id="panel-upi"
              role="tabpanel"
              aria-labelledby="tab-upi"
              className="space-y-4 animate-fade-in"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: UPI Settings */}
                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5" />
                      UPI Payment Parameters
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={formData.upi?.enabled ?? true}
                        onChange={(e) => handleUpiChange('enabled', e.target.checked)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                      />
                      <span className="text-slate-300 font-medium">UPI Enabled</span>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="upiId" className="text-slate-300 font-medium">
                        UPI ID (Virtual Payment Address)
                      </label>
                      {upiIdValue && (
                        <span
                          className={`text-[10px] font-semibold ${
                            isUpiValid ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isUpiValid ? 'Valid VPA' : 'Invalid Format'}
                        </span>
                      )}
                    </div>
                    <input
                      id="upiId"
                      type="text"
                      disabled={!canEdit}
                      value={formData.upi?.upiId || formData.upiId || ''}
                      onChange={(e) => {
                        handleUpiChange('upiId', e.target.value.trim());
                        handleRootChange('upiId', e.target.value.trim());
                      }}
                      placeholder="9846830532@okaxis"
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-1.5 font-mono text-amber-300 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        !isUpiValid ? 'border-red-500' : 'border-slate-700'
                      }`}
                    />
                    <p className="text-[10px] text-slate-400">
                      Standard format: mobile@bank or merchant@upi
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="merchantName" className="text-slate-300 font-medium">
                      Payee / Merchant Display Name
                    </label>
                    <input
                      id="merchantName"
                      type="text"
                      disabled={!canEdit}
                      value={formData.upi?.merchantName || formData.businessName || ''}
                      onChange={(e) => handleUpiChange('merchantName', e.target.value)}
                      placeholder="TPS BATTERYS HOUSE"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-700/60">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={formData.upi?.showQrOnInvoice ?? true}
                        onChange={(e) => handleUpiChange('showQrOnInvoice', e.target.checked)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                      />
                      <span className="text-slate-200 font-medium">Print dynamic UPI QR code on invoices</span>
                    </label>
                  </div>
                </div>

                {/* Right: Live Interactive UPI QR Preview */}
                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 flex flex-col items-center justify-center text-center space-y-2">
                  <h4 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">
                    Live Dynamic QR Code Preview
                  </h4>

                  {liveUpiUri ? (
                    <div className="p-3 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col items-center">
                      <UpiQrCode upiUri={liveUpiUri} size={130} />
                      <span className="mt-1.5 text-[10px] font-bold text-slate-800">
                        {previewMerchant}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">
                        {upiIdValue}
                      </span>
                    </div>
                  ) : (
                    <div className="w-36 h-36 bg-slate-950/60 rounded-xl border border-dashed border-slate-700 flex flex-col items-center justify-center p-3 text-slate-500">
                      <QrCode className="w-8 h-8 mb-1 opacity-50" />
                      <span className="text-[10px]">Enter valid UPI ID to preview QR</span>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                    Customers can scan this QR code with any UPI app (GPay, PhonePe, Paytm) to pay invoices directly to your account.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Invoice Configuration */}
          {activeTab === 'invoice' && (
            <div
              id="panel-invoice"
              role="tabpanel"
              aria-labelledby="tab-invoice"
              className="space-y-4 animate-fade-in"
            >
              {/* Display Options & Defaults */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Print & Display Defaults
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="authorizedSignatory" className="text-slate-300 font-medium">
                      Authorized Signatory Label
                    </label>
                    <input
                      id="authorizedSignatory"
                      type="text"
                      disabled={!canEdit}
                      value={formData.invoiceSettings?.authorizedSignatory || 'Authorised Signatory'}
                      onChange={(e) => handleInvoiceSettingsChange('authorizedSignatory', e.target.value)}
                      placeholder="Authorised Signatory"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="defaultPaymentMode" className="text-slate-300 font-medium">
                      Default Payment Mode
                    </label>
                    <select
                      id="defaultPaymentMode"
                      disabled={!canEdit}
                      value={formData.invoiceSettings?.defaultPaymentMode || 'Cash'}
                      onChange={(e) => handleInvoiceSettingsChange('defaultPaymentMode', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI / QR Code">UPI / QR Code</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="Credit">Credit / Post-dated</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Debit/Credit Card">Debit/Credit Card</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="footerText" className="text-slate-300 font-medium">
                    Footer Acknowledgement Note
                  </label>
                  <input
                    id="footerText"
                    type="text"
                    disabled={!canEdit}
                    value={formData.invoiceSettings?.footerText || ''}
                    onChange={(e) => handleInvoiceSettingsChange('footerText', e.target.value)}
                    placeholder="Thank you for choosing TPS BATTERYS HOUSE."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Terms and Conditions List */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                    Terms & Conditions of Sale
                  </h3>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleAddTerm}
                      disabled={termsList.length >= 20}
                      className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add Term
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {termsList.map((term, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono text-[11px] w-5 text-right">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={term}
                        onChange={(e) => handleTermUpdate(index, e.target.value)}
                        placeholder={`Term ${index + 1}`}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTerm(index)}
                          aria-label={`Remove term ${index + 1}`}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div>
            {canEdit && (
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={isSaving}
                className="px-3 py-1.5 text-slate-400 hover:text-white text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Defaults</span>
              </button>
            )}
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {canEdit ? 'Cancel' : 'Close'}
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusinessSettingsModal({ isOpen, ...props }) {
  if (!isOpen) return null;
  return <BusinessSettingsContent {...props} />;
}
