/**
 * Safe ID generator and timestamp utility for invoices and line items.
 */
let counter = 0;

export function generateId(prefix = 'id') {
  counter = (counter + 1) % 1000000;
  return `${prefix}-${Date.now()}-${counter}`;
}

export function getIsoTimestamp() {
  return new Date().toISOString();
}

export function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
