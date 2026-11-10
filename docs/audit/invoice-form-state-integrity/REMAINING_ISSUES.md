# TPS BATTERY HOUSE — Remaining Issues & Residual Risk Assessment

## 1. Resolved Items
All items identified in the user prompt and discovered during the comprehensive audit have been resolved:
- [x] Old Battery Scrap Value (`scrapExchange.amount`) input instability, decimal truncation, and race conditions.
- [x] Unsynchronized child visibility states (`showDiscount`, `showExchange`).
- [x] B2B / B2C toggle stuck on B2B when GSTIN text was present.
- [x] "New Customer" forcing B2B invoices back to B2C.
- [x] Customer directory selection overwriting pre-entered delivery address with empty string.
- [x] Reverse charge toggle evaluating `'No'` as truthy `true`.
- [x] Line item rate losing decimal points during typing.
- [x] Potential React component state collisions due to missing fallback `item.id`.
- [x] Overwriting custom scrap description on invoice save.

---

## 2. Residual Operational Considerations
1. **Large Number of Line Items (>15 items on single A4):**
   - The browser printable invoice uses standard A4 CSS pagination. Extremely long item lists (15+ items with multi-line notes) wrap onto subsequent pages.
   - Recommended: In future billing cycles, consider multi-page vector continuation headers if store orders exceed 15 items frequently.
2. **Offline LocalStorage Quotas:**
   - Saved invoices and drafts are cached locally in `localStorage`. While individual invoice records are very compact (<10 KB), storing thousands of invoices purely in localStorage without periodic archive may approach the browser's 5MB origin quota.
   - Cloud Firestore remains the authoritative persistent store.

---

## 3. Strict Boundary Compliance Confirmation
- **No Production Deployments:** No code was deployed to Vercel, Firebase Hosting, or Cloud Functions.
- **No Security Rule Degradation:** Cloud Firestore rules remain in strict lockdown under Phase 6B.1 hardening.
- **No Production Record Modifications:** All mutations and tests ran strictly in local development and the local Firestore emulator.

