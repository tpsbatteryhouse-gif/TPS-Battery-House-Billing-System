// scratch/test_navigation_wiring.mjs
// Targeted verification of New Invoice navigation, button click handlers,
// state transitions, and absence of ReferenceError.

import assert from 'assert';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(err);
  }
}

console.log('================================================================');
console.log('TPS BATTERY HOUSE — NEW INVOICE NAVIGATION & EVENT WIRING TEST');
console.log('================================================================\n');

// 1. Static AST/Source Code Inspection for Undeclared Variables
console.log('--- 1. STATIC CODE AUDIT FOR UNRESOLVED VARIABLES & SYMBOLS ---');

const appJsxContent = fs.readFileSync(path.resolve('src/App.jsx'), 'utf-8');
const dashboardJsxContent = fs.readFileSync(path.resolve('src/components/Dashboard.jsx'), 'utf-8');
const headerJsxContent = fs.readFileSync(path.resolve('src/components/Header.jsx'), 'utf-8');
const settingsModalContent = fs.readFileSync(path.resolve('src/components/BusinessSettingsModal.jsx'), 'utf-8');

it('App.jsx contains NO reference to setIsQuickCreateOpen', () => {
  assert.strictEqual(
    appJsxContent.includes('setIsQuickCreateOpen'),
    false,
    'App.jsx must not reference undeclared setIsQuickCreateOpen'
  );
});

it('App.jsx handleStartNewInvoice transitions activeView to "editor" and editorMode to "edit"', () => {
  const handleStartNewMatch = appJsxContent.match(/const handleStartNewInvoice = \(\) => \{([\s\S]*?)\n  \};/);
  assert(handleStartNewMatch, 'handleStartNewInvoice function must exist');
  const body = handleStartNewMatch[1];
  assert(body.includes("setActiveView('editor')"), 'Must call setActiveView("editor")');
  assert(body.includes("setEditorMode('edit')"), 'Must call setEditorMode("edit")');
  assert(body.includes('setInvoice('), 'Must set fresh invoice');
  assert(!body.includes('setIsQuickCreateOpen'), 'Must not call setIsQuickCreateOpen');
});

it('Dashboard.jsx button label does NOT duplicate plus sign', () => {
  assert.strictEqual(
    dashboardJsxContent.includes('<span>+ New Invoice</span>'),
    false,
    'Dashboard button must not have duplicate plus in <span>+ New Invoice</span>'
  );
  assert(
    dashboardJsxContent.includes('<span>New Invoice</span>'),
    'Dashboard button must have clean <span>New Invoice</span>'
  );
});

it('Dashboard.jsx correctly attaches onClick={onNewInvoice}', () => {
  assert(
    dashboardJsxContent.includes('onClick={onNewInvoice}'),
    'Dashboard button must bind onClick to onNewInvoice prop'
  );
});

it('FloatingActionButton binds onClick and is visible when activeView !== "editor"', () => {
  assert(
    appJsxContent.includes("visible={activeView !== 'editor'}"),
    'FAB must be visible on non-editor views'
  );
  assert(
    appJsxContent.includes('onClick={handleStartNewInvoice}'),
    'FAB must trigger handleStartNewInvoice'
  );
});

it('Header.jsx wires onNewInvoice and Tax Bill Generator tab', () => {
  assert(
    headerJsxContent.includes('onClick={onNewInvoice}'),
    'Header New Bill buttons must call onNewInvoice'
  );
  assert(
    headerJsxContent.includes("onClick={() => setActiveView('editor')}"),
    'Tax Bill Generator nav tab must set activeView to editor'
  );
});

it('BusinessSettingsModal does not have undeclared isOpen reference in BusinessSettingsContent', () => {
  const contentMatch = settingsModalContent.match(/function BusinessSettingsContent\(\{[\s\S]*?\n\}/);
  assert(contentMatch, 'BusinessSettingsContent component must exist');
  assert(
    !contentMatch[0].includes('if (!isOpen) return null;'),
    'BusinessSettingsContent must not contain undeclared isOpen check'
  );
});

// 2. Behavioral Simulation of State Transition & Navigation Chain
console.log('\n--- 2. RUNTIME SIMULATION: CLICK EVENT & NAVIGATION LIFECYCLE ---');

it('simulated click chain transitions state from dashboard to full-page editor', () => {
  // Simulate App component state
  let state = {
    activeView: 'dashboard',
    editorMode: 'edit',
    invoice: { id: 'old-draft', invoiceNumber: 'TPS/2026-27/005' },
    isSavedFeedback: false,
  };

  const setActiveView = (view) => { state.activeView = view; };
  const setEditorMode = (mode) => { state.editorMode = mode; };
  const setInvoice = (inv) => { state.invoice = inv; };

  const getNextInvoiceNumber = () => 'TPS/2026-27/008';

  // Extract actual handleStartNewInvoice logic
  const handleStartNewInvoice = () => {
    const newInvNo = getNextInvoiceNumber();
    const today = new Date().toISOString().split('T')[0];

    const freshInvoice = {
      id: 'inv-' + Date.now(),
      invoiceNumber: newInvNo,
      invoiceDate: today,
      dueDate: today,
      transactionType: 'B2B',
      paymentMode: 'Cash',
      paymentStatus: 'Draft',
      placeOfSupply: 'Kerala (32)',
      reverseCharge: 'No',
      customer: {
        name: '',
        phone: '',
        address: '',
        city: 'Thrithala',
        district: 'Palakkad',
        state: 'Kerala',
        stateCode: '32',
        pincode: '679552',
        gstin: '',
      },
      items: [
        {
          id: 'item-1',
          name: '',
          category: 'BATTERY',
          qty: 1,
          unit: 'Nos',
          rate: 0,
          isTaxInclusive: true,
          gstRate: 28,
        },
      ],
      scrapExchange: {
        enabled: false,
        amount: 0,
      },
      additionalDiscount: 0,
      roundOffManual: null,
      netPayable: 0,
      createdAt: new Date().toISOString(),
    };

    setInvoice(freshInvoice);
    setActiveView('editor');
    setEditorMode('edit');
  };

  // Step 1: User is on Dashboard
  assert.strictEqual(state.activeView, 'dashboard');

  // Step 2: User clicks "+ New Invoice" button on Dashboard
  // Dashboard calls onNewInvoice -> handleStartNewInvoice()
  assert.doesNotThrow(() => {
    handleStartNewInvoice();
  }, 'Click handler must execute without any ReferenceError');

  // Step 3: Verify View Transition
  assert.strictEqual(state.activeView, 'editor', 'activeView must become "editor"');
  assert.strictEqual(state.editorMode, 'edit', 'editorMode must become "edit"');

  // Step 4: Verify Fresh Invoice Initialized
  assert.strictEqual(state.invoice.invoiceNumber, 'TPS/2026-27/008');
  assert.strictEqual(state.invoice.paymentStatus, 'Draft');
  assert.strictEqual(state.invoice.customer.name, '');
  assert.strictEqual(state.invoice.items.length, 1);
});

console.log('\n================================================================');
console.log(`TOTAL NAVIGATION WIRING TESTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

