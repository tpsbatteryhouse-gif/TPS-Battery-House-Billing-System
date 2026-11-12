# Root Cause Analysis: Critical White Screen / React Application Not Rendering

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management  
**Severity:** P0 (Application Unavailable)  
**Date:** 2026-11-11  
**Status:** RESOLVED & VERIFIED

---

## 1. Executive Summary

When opening `http://localhost:5173/` in a browser (reproduced in mobile emulation 427 × 952 px and across viewports), the application presented a completely blank white/off-white screen. The DOM inspector revealed:
- The React root container `<div id="root"></div>` was completely empty (`innerHTML == ""`).
- A hidden sibling `<div>` with `style="display: none; position: fixed; top: 30px; ... z-index: 99999999;"` was present after `<script type="module" src="/src/main.jsx"></script>`.
- The browser console logged 1 uncaught runtime exception.

---

## 2. Forensic Discovery & Root Cause Identification

### A. The Primary Runtime Crash
Investigation of git commit history identified commit `c6542c9` ("Invoice Draft save state fix") which introduced the following change to `src/App.jsx`:

```javascript
// AppContent component
const lastSavedSnapshotRef = useRef(null);
```

However, line 1 of `src/App.jsx` was:
```javascript
import React, { useState, useEffect } from 'react';
```
`useRef` was **never imported** from `'react'`.

When the page loaded, the following execution flow occurred:
1. `src/main.jsx` mounted `<App />` using React 19's `createRoot(document.getElementById('root')).render(...)`.
2. Inside `App.jsx`, `AuthProvider` initialized Firebase Auth and restored the existing active user session from `browserLocalPersistence`.
3. `ProtectedRoute` completed authentication verification and rendered `AppContent`.
4. At line 44 of `src/App.jsx`, JavaScript executed `useRef(null)`.
5. Because `useRef` was undeclared in the module scope, the JavaScript runtime threw:
   ```
   Uncaught ReferenceError: useRef is not defined at AppContent (App.jsx:44:32)
   ```

### B. Why `#root` Became Completely Empty
In React 16+, an uncaught exception during component rendering or lifecycle execution causes React to unmount the entire component tree from the DOM:
> *"As of React 16, errors that were not caught by any error boundary will result in unmounting of the whole React component tree."* — React Official Documentation

Because the application lacked an application-level `<ErrorBoundary>`, the uncaught `ReferenceError` caused React to completely unmount and remove all DOM nodes from inside `<div id="root"></div>`.

### C. Why the Screen Appeared "White"
In `index.html`, line 14 was defined as:
```html
<body class="bg-slate-100 text-slate-900 antialiased selection:bg-amber-500 selection:text-white">
```
While the application interface is styled in a modern dark theme (`bg-slate-950`), the base HTML body had the Tailwind class `bg-slate-100` (`#f1f5f9`). When React unmounted `#root`, the light background of `body` became fully visible, producing the "blank white screen".

### D. The Hidden Sibling Element
The hidden sibling DOM element (`display: none; position: fixed; z-index: 99999999`) observed in DevTools was inspected. It did not originate from the application codebase; it was injected into the DOM by a third-party browser extension running in the browser profile (e.g. translation or notification overlay helper). It was not responsible for the rendering failure.

---

## 3. Secondary Vulnerabilities Identified & Remediated

1. **Missing React ErrorBoundary:**
   Without an error boundary, any minor rendering error in any component unmounted the entire billing system, leaving no way for store operators to reload or recover their session.
2. **Indefinite Auth Loading Vulnerability:**
   In `src/components/auth/ProtectedRoute.jsx`, if Firebase Auth or Firestore membership lookup took unusually long or experienced network timeouts, the loading spinner could remain indefinitely.
3. **No Pre-Mount Skeleton or Script Error Handler:**
   If a syntax error or missing environment variable crashed Vite module loading before React executed, the user saw an unstyled empty page without feedback.

---

## 4. Resolution Summary

| Vulnerability | Remediation |
|---|---|
| Missing `useRef` import in `src/App.jsx` | Added `useRef` to React imports in `src/App.jsx:1`. |
| Uncaught exceptions unmounting `#root` | Created `src/components/common/ErrorBoundary.jsx` and wrapped `<App />` in `src/main.jsx`. |
| Body background flash mismatch | Updated `index.html` `body` class to `bg-slate-950 text-slate-100`. |
| Pre-mount white screen | Added dark branded loading skeleton inside `<div id="root">` in `index.html`. |
| Pre-React module failures | Added top-level window error event listener in `index.html` displaying recovery UI. |
| Potential stuck auth verification | Added 7-second loading watchdog with retry actions in `ProtectedRoute.jsx`. |

