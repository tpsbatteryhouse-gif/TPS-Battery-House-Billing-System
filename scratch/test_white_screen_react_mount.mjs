import fs from 'fs';

console.log('================================================================');
console.log('TPS BATTERY HOUSE — WHITE SCREEN & REACT MOUNT VERIFICATION');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passCount++;
  } else {
    console.error(`✗ FAILED: ${message}`);
    failCount++;
  }
}

// 1. Verify index.html
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(
  indexHtml.includes('bg-slate-950') && !indexHtml.includes('bg-slate-100'),
  'index.html uses dark background class (bg-slate-950) instead of light bg-slate-100'
);
assert(
  indexHtml.includes('id="root"') && indexHtml.includes('pre-mount-fallback'),
  'index.html has pre-mount fallback loading skeleton inside #root'
);
assert(
  indexHtml.includes("window.addEventListener('error'"),
  'index.html has pre-React script error catcher to prevent silent white screen failures'
);

// 2. Verify src/main.jsx
const mainJsx = fs.readFileSync('src/main.jsx', 'utf8');
assert(
  mainJsx.includes("import ErrorBoundary from './components/common/ErrorBoundary.jsx'"),
  'src/main.jsx imports ErrorBoundary'
);
assert(
  mainJsx.includes('<ErrorBoundary>') && mainJsx.includes('<App />'),
  'src/main.jsx wraps <App /> in <ErrorBoundary>'
);
assert(
  mainJsx.includes("createRoot(document.getElementById('root'))"),
  'src/main.jsx correctly mounts to element with id "root"'
);

// 3. Verify src/App.jsx
const appJsx = fs.readFileSync('src/App.jsx', 'utf8');
assert(
  appJsx.match(/import\s+React,\s*\{[^}]*\buseRef\b[^}]*\}\s*from\s*['"]react['"]/),
  'src/App.jsx explicitly imports useRef from react'
);
assert(
  !appJsx.includes('business.stateCode') || appJsx.includes('business?.stateCode'),
  'src/App.jsx safely accesses business?.stateCode with optional chaining'
);

// 4. Verify ErrorBoundary component exists and exports properly
assert(
  fs.existsSync('src/components/common/ErrorBoundary.jsx'),
  'src/components/common/ErrorBoundary.jsx exists'
);
const errorBoundaryJsx = fs.readFileSync('src/components/common/ErrorBoundary.jsx', 'utf8');
assert(
  errorBoundaryJsx.includes('componentDidCatch') && errorBoundaryJsx.includes('getDerivedStateFromError'),
  'ErrorBoundary implements standard React Error Boundary lifecycle methods'
);
assert(
  errorBoundaryJsx.includes('handleReload') && errorBoundaryJsx.includes('handleClearCacheAndReload'),
  'ErrorBoundary provides user-friendly recovery actions (Reload & Clear Cache)'
);

// 5. Verify ProtectedRoute timeout fallback
const protectedRouteJsx = fs.readFileSync('src/components/auth/ProtectedRoute.jsx', 'utf8');
assert(
  protectedRouteJsx.includes('isTimedOut') && protectedRouteJsx.includes('setTimeout'),
  'ProtectedRoute implements timeout watchdog for stuck auth loading'
);
assert(
  protectedRouteJsx.includes('Retry Verification') && protectedRouteJsx.includes('Sign In with Different Account'),
  'ProtectedRoute provides user recovery options when connection is slow or blocked'
);

// 6. Viewport & CSS Responsive Verification
// Check Invoice layout & container classes
const invoiceSummaryJsx = fs.readFileSync('src/components/invoice/InvoiceSummary.jsx', 'utf8');
assert(
  !invoiceSummaryJsx.includes('min-w-[768px]') && !invoiceSummaryJsx.includes('min-w-[1024px]'),
  'InvoiceSummary does not enforce rigid desktop-only min-widths that break mobile viewports'
);

const invoiceItemsJsx = fs.readFileSync('src/components/invoice/InvoiceItemsSection.jsx', 'utf8');
const invoiceItemRowJsx = fs.readFileSync('src/components/invoice/InvoiceItemRow.jsx', 'utf8');
assert(
  invoiceItemRowJsx.includes('flex flex-wrap') && invoiceItemsJsx.includes('space-y-3.5'),
  'Invoice items use mobile-first responsive flex-wrap card architecture'
);

console.log(`\n================================================================`);
console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log(`================================================================`);

if (failCount > 0) {
  process.exit(1);
}
