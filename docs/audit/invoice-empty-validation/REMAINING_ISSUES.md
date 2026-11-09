# TPS BATTERY HOUSE — Remaining Issues & Technical Observations

## 1. Overview
This document records any residual observations, caveats, or potential improvements identified during the empty invoice initialization and pre-print validation fixes.

---

## 2. Issues & Observations Log

| Item | Classification | Description | Impact | Mitigation / Status |
|---|---|---|---|---|
| 1 | Runtime Environment | Firestore emulator jar requires Java 21 LTS classfile version 65.0. | Minimal. Emulator runner detects and utilizes `/tmp/jdk-21/bin/java`. | Fully resolved by referencing extracted JDK 21 in test scripts. |
| 2 | Legacy Draft Sanitization | Drafts stored in `localStorage` from earlier sessions that contained a lone dummy item. | Low. Could cause phantom item to reappear if user has old local cache. | Mitigated: `src/App.jsx` automatically strips legacy single empty items upon parsing. |
| 3 | Legitimate Zero-Value Service Bills | Compliant zero-value warranty replacements or inspection charges could have been blocked if validation used `rate > 0`. | Critical Financial Invariant. | Resolved: Validation strictly permits `rate === 0` (as long as `rate >= 0` and quantity > 0). |
| 4 | Offline / Iframe Print Fallbacks | In restricted webviews or environments where iframe printing is blocked, browser fallback is needed. | Edge case for POS terminals. | Handled: `printInvoicePdf` gracefully falls back to `window.print()` if blob iframe is blocked. |

---

## 3. Residual Defect Count
- **Critical Severity:** 0
- **High Severity:** 0
- **Medium Severity:** 0
- **Low Severity:** 0

All functional requirements, validation invariants, user-facing error reporting, and historical invoice preservation checks have met all acceptance criteria with zero remaining blockers.

