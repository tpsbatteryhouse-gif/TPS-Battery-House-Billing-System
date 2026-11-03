/**
 * Centralized Category Configuration System for TPS BATTERYS HOUSE
 * Supports the four primary business lines: Battery, Inverter, Solar, and Services.
 */

export const PRODUCT_CATEGORIES = {
  BATTERY: 'battery',
  INVERTER: 'inverter',
  SOLAR: 'solar',
  SERVICES: 'services',
};

export const CATEGORY_CONFIG = {
  [PRODUCT_CATEGORIES.BATTERY]: {
    id: PRODUCT_CATEGORIES.BATTERY,
    label: 'Battery',
    shortLabel: 'Battery',
    description: 'Automotive, Inverter, Tubular, SMF, Lithium & Solar storage batteries',
    defaultHsn: '8507',
    defaultGstRate: 28,
    defaultUnit: 'Nos',
    color: 'amber',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    allowScrapExchange: true,
    subcategories: [
      'Automotive Battery',
      'Inverter Battery',
      'Tubular Battery',
      'SMF Battery',
      'VRLA Battery',
      'Lithium Battery',
      'Solar Battery',
      'Two-Wheeler Battery',
      'Other Batteries',
    ],
    fields: [
      { name: 'brand', label: 'Brand', type: 'text', placeholder: 'e.g. Exide, Amaron, SF Sonic' },
      { name: 'model', label: 'Model', type: 'text', placeholder: 'e.g. IT500, IMTT1500, AAM-FL' },
      {
        name: 'batteryType',
        label: 'Technology / Type',
        type: 'select',
        options: ['Tall Tubular', 'Short Tubular', 'Flat Plate', 'SMF / VRLA', 'Lithium (LiFePO4)', 'AGM', 'Gel'],
      },
      { name: 'capacity', label: 'Capacity (Ah)', type: 'text', placeholder: 'e.g. 150Ah, 100Ah, 35Ah' },
      { name: 'voltage', label: 'Voltage', type: 'select', options: ['12V', '24V', '48V', '6V', 'Other'] },
      { name: 'warranty', label: 'Warranty Duration', type: 'text', placeholder: 'e.g. 36 Months, 60M (36F+24P)' },
      { name: 'serialNo', label: 'Battery Serial Number(s)', type: 'text', placeholder: 'e.g. BAT-2026-98124' },
    ],
  },

  [PRODUCT_CATEGORIES.INVERTER]: {
    id: PRODUCT_CATEGORIES.INVERTER,
    label: 'Inverter',
    shortLabel: 'Inverter',
    description: 'Home, Commercial, Solar, Hybrid & Digital UPS Power Backup Systems',
    defaultHsn: '8504',
    defaultGstRate: 18,
    defaultUnit: 'Nos',
    color: 'sky',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    allowScrapExchange: false,
    subcategories: [
      'Home Inverter',
      'Commercial Inverter',
      'Solar Inverter',
      'Hybrid Inverter',
      'Off-Grid Inverter',
      'On-Grid Inverter',
      'UPS',
      'Other Inverters',
    ],
    fields: [
      { name: 'brand', label: 'Brand', type: 'text', placeholder: 'e.g. Luminous, Microtek, V-Guard, Livguard' },
      { name: 'model', label: 'Model', type: 'text', placeholder: 'e.g. Eco Volt Neo 1050, Super Power 1100' },
      { name: 'capacityVa', label: 'Rated Capacity (VA/kVA)', type: 'text', placeholder: 'e.g. 1100 VA, 1500 VA, 2.5 kVA' },
      { name: 'powerWatts', label: 'Rated Power (W/kW)', type: 'text', placeholder: 'e.g. 900 Watts, 1200 W, 3 kW' },
      { name: 'voltage', label: 'Input / System Voltage', type: 'select', options: ['12V DC', '24V DC', '48V DC', '96V DC', '230V AC'] },
      { name: 'phase', label: 'Phase', type: 'select', options: ['Single Phase', 'Three Phase'] },
      { name: 'waveform', label: 'Waveform', type: 'select', options: ['Pure Sine Wave', 'Square Wave', 'Modified Sine Wave'] },
      { name: 'warranty', label: 'Warranty Duration', type: 'text', placeholder: 'e.g. 24 Months On-site' },
      { name: 'serialNo', label: 'Inverter Serial Number', type: 'text', placeholder: 'e.g. INV-MC-1100-8812' },
    ],
  },

  [PRODUCT_CATEGORIES.SOLAR]: {
    id: PRODUCT_CATEGORIES.SOLAR,
    label: 'Solar',
    shortLabel: 'Solar',
    description: 'Photovoltaic Panels, Charge Controllers, Solar Hybrid Inverters & Balance of System',
    defaultHsn: '8541',
    defaultGstRate: 12, // Standard statutory concession for Solar PV Modules / Systems
    defaultUnit: 'Nos',
    color: 'emerald',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    allowScrapExchange: false,
    subcategories: [
      'Solar Panels',
      'Monocrystalline Solar Panels',
      'Polycrystalline Solar Panels',
      'Solar Inverters',
      'Hybrid Solar Systems',
      'Solar Charge Controllers',
      'Solar Batteries',
      'Solar Mounting Structures',
      'Solar Cables',
      'Solar Connectors',
      'Solar Accessories',
      'Complete Solar Systems',
      'Other Solar Products',
    ],
    fields: [
      { name: 'brand', label: 'Brand', type: 'text', placeholder: 'e.g. Tata Power Solar, Waaree, Adani, Vikram Solar' },
      { name: 'model', label: 'Model', type: 'text', placeholder: 'e.g. Bi-550, Mono PERC Half-Cut 540' },
      { name: 'ratedCapacityWp', label: 'Rated Capacity (Wp/Watts)', type: 'text', placeholder: 'e.g. 550 Wp, 450 Wp, 330 Wp' },
      { name: 'systemCapacityKw', label: 'System Capacity (kW)', type: 'text', placeholder: 'e.g. 3 kW, 5 kW, 10 kW' },
      {
        name: 'panelTechnology',
        label: 'Cell Technology',
        type: 'select',
        options: ['Mono PERC Half-Cut', 'Bifacial Mono PERC', 'TOPCon N-Type', 'Polycrystalline', 'Thin Film'],
      },
      { name: 'voltage', label: 'Operating Voltage (Vmp)', type: 'text', placeholder: 'e.g. 24V, 41.8V, 49.5V' },
      { name: 'dimensions', label: 'Dimensions / Specs', type: 'text', placeholder: 'e.g. 2278 x 1134 x 35 mm' },
      { name: 'warranty', label: 'Warranty Duration', type: 'text', placeholder: 'e.g. 10Y Product + 25Y Performance' },
      { name: 'serialNo', label: 'Panel / Module Serial No', type: 'text', placeholder: 'e.g. SL-WRE-550-9921' },
    ],
  },

  [PRODUCT_CATEGORIES.SERVICES]: {
    id: PRODUCT_CATEGORIES.SERVICES,
    label: 'Services',
    shortLabel: 'Service',
    description: 'Installation, Testing, Repair, Annual Maintenance & Field Transport Services',
    defaultHsn: '9987',
    defaultGstRate: 18,
    defaultUnit: 'Service',
    color: 'purple',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    allowScrapExchange: false,
    subcategories: [
      'Solar Installation',
      'Inverter Installation',
      'Battery Installation',
      'Maintenance',
      'Repair and Service',
      'Transportation',
      'Other Services',
    ],
    fields: [
      {
        name: 'serviceCategory',
        label: 'Service Type',
        type: 'select',
        options: [
          'Rooftop Solar EPC & Commissioning',
          'Inverter & Battery Wiring Installation',
          'Annual Maintenance Contract (AMC)',
          'Battery Health & Specific Gravity Testing',
          'Emergency Breakdown Repair',
          'Site Survey & Feasibility Audit',
          'Field Delivery & Handling',
        ],
      },
      { name: 'serviceScope', label: 'Scope of Work', type: 'text', placeholder: 'e.g. Full rooftop mounting, wiring, earthing & inverter integration' },
      { name: 'warranty', label: 'Service Guarantee', type: 'text', placeholder: 'e.g. 12 Months Workmanship Guarantee' },
    ],
  },
};

/**
 * Standard Units of Measurement accepted across all categories
 */
export const MULTI_CATEGORY_UNITS = [
  'Nos',
  'Set',
  'Piece',
  'Watt',
  'kW',
  'Meter',
  'Meter Run',
  'Service',
  'Job',
  'Boxes',
  'Pairs',
];

/**
 * Formats concise, professional technical specifications for print & display
 */
export function formatItemSpecifications(item) {
  if (!item) return '';
  const specs = [];

  const cat = (item.category || '').toLowerCase();

  if (cat === PRODUCT_CATEGORIES.BATTERY) {
    if (item.specs?.capacity || item.capacity) specs.push(item.specs?.capacity || item.capacity);
    if (item.specs?.voltage || item.voltage) specs.push(item.specs?.voltage || item.voltage);
    if (item.specs?.batteryType || item.batteryType) specs.push(item.specs?.batteryType || item.batteryType);
  } else if (cat === PRODUCT_CATEGORIES.INVERTER) {
    if (item.specs?.capacityVa || item.capacityVa) specs.push(item.specs?.capacityVa || item.capacityVa);
    if (item.specs?.powerWatts || item.powerWatts) specs.push(item.specs?.powerWatts || item.powerWatts);
    if (item.specs?.voltage || item.voltage) specs.push(item.specs?.voltage || item.voltage);
    if (item.specs?.waveform || item.waveform) specs.push(item.specs?.waveform || item.waveform);
  } else if (cat === PRODUCT_CATEGORIES.SOLAR) {
    if (item.specs?.ratedCapacityWp || item.ratedCapacityWp) specs.push(item.specs?.ratedCapacityWp || item.ratedCapacityWp);
    if (item.specs?.panelTechnology || item.panelTechnology) specs.push(item.specs?.panelTechnology || item.panelTechnology);
    if (item.specs?.systemCapacityKw || item.systemCapacityKw) specs.push(item.specs?.systemCapacityKw || item.systemCapacityKw);
  } else if (cat === PRODUCT_CATEGORIES.SERVICES) {
    if (item.specs?.serviceCategory || item.serviceCategory) specs.push(item.specs?.serviceCategory || item.serviceCategory);
    if (item.specs?.serviceScope || item.serviceScope) specs.push(item.specs?.serviceScope || item.serviceScope);
  }

  // Fallback to description if specs array is empty
  if (specs.length === 0 && item.description && item.description !== item.name) {
    return item.description;
  }

  return specs.join(' • ');
}

/**
 * Standard GST Transaction / Customer Classification Types
 */
export const TRANSACTION_TYPES = {
  B2B: 'B2B',
  B2C: 'B2C',
  SEZ: 'SEZ',
  EXPORT: 'EXPORT',
  DEEMED_EXPORT: 'DEEMED_EXPORT',
};

export const TRANSACTION_TYPE_CONFIG = {
  [TRANSACTION_TYPES.B2B]: {
    id: TRANSACTION_TYPES.B2B,
    label: 'B2B — Business to Business (Tax Invoice)',
    shortLabel: 'B2B (Tax Invoice)',
    description: 'Registered business buyer with GSTIN. Eligible for statutory Input Tax Credit (ITC).',
    requiresGstin: true,
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  [TRANSACTION_TYPES.B2C]: {
    id: TRANSACTION_TYPES.B2C,
    label: 'B2C — Business to Consumer (Retail Invoice)',
    shortLabel: 'B2C (Retail)',
    description: 'Unregistered end-consumer. Standard retail tax invoice without ITC.',
    requiresGstin: false,
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  [TRANSACTION_TYPES.SEZ]: {
    id: TRANSACTION_TYPES.SEZ,
    label: 'SEZ — Special Economic Zone Supply',
    shortLabel: 'SEZ Supply',
    description: 'Supply to Special Economic Zone developer or unit (Inter-State IGST rules apply).',
    requiresGstin: true,
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  [TRANSACTION_TYPES.EXPORT]: {
    id: TRANSACTION_TYPES.EXPORT,
    label: 'Export — Out of Territory Supply',
    shortLabel: 'Export',
    description: 'Export of goods or services under statutory rules.',
    requiresGstin: false,
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  [TRANSACTION_TYPES.DEEMED_EXPORT]: {
    id: TRANSACTION_TYPES.DEEMED_EXPORT,
    label: 'Deemed Export',
    shortLabel: 'Deemed Export',
    description: 'Supplies notified under section 147 of the CGST Act.',
    requiresGstin: true,
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
};

/**
 * Safely infers transaction type for legacy or unclassified invoices without mutating data
 */
export function inferTransactionType(invoice) {
  if (!invoice) return TRANSACTION_TYPES.B2C;
  if (invoice.transactionType && TRANSACTION_TYPE_CONFIG[invoice.transactionType]) {
    return invoice.transactionType;
  }
  // Safe infer for legacy invoices: if GSTIN is present and valid, it's B2B; else B2C
  const gstin = invoice.customer?.gstin ? String(invoice.customer.gstin).trim() : '';
  return gstin.length >= 10 ? TRANSACTION_TYPES.B2B : TRANSACTION_TYPES.B2C;
}

/**
 * Normalizes an invoice item to ensure it contains safe category metadata and numeric values
 */
export function normalizeInvoiceItem(item) {
  if (!item) return item;

  let category = item.category;

  // Infer category for legacy invoices without category field
  if (!category) {
    const hsn = String(item.hsn || '');
    const name = String(item.name || item.description || '').toLowerCase();

    if (hsn.startsWith('99') || name.includes('service') || name.includes('installation') || name.includes('maintenance')) {
      category = PRODUCT_CATEGORIES.SERVICES;
    } else if (hsn.startsWith('8541') || name.includes('solar') || name.includes('panel') || name.includes('charge controller')) {
      category = PRODUCT_CATEGORIES.SOLAR;
    } else if (hsn.startsWith('8504') || name.includes('inverter') || name.includes('ups') || name.includes('converter')) {
      category = PRODUCT_CATEGORIES.INVERTER;
    } else {
      category = PRODUCT_CATEGORIES.BATTERY;
    }
  }

  // Ensure item has clean name, rate, qty, unit, gstRate, isTaxInclusive, and discount
  const name = item.name !== undefined ? item.name : (item.description || '');
  const rawRate = item.rate !== undefined ? item.rate : (item.unitPrice !== undefined ? item.unitPrice : item.price);
  const rate = (rawRate !== undefined && rawRate !== null && rawRate !== '') ? Math.max(0, Number(rawRate) || 0) : 0;
  const rawQty = item.qty !== undefined ? item.qty : item.quantity;
  const qty = (rawQty !== undefined && rawQty !== null && rawQty !== '') ? Math.max(0.01, Number(rawQty) || 1) : 1;
  const isTaxInclusive = item.isTaxInclusive !== undefined ? Boolean(item.isTaxInclusive) : true;

  let gstRate = CATEGORY_CONFIG[category]?.defaultGstRate ?? 28;
  if (item.gstRate !== undefined && item.gstRate !== null && item.gstRate !== '') {
    gstRate = Number(item.gstRate);
  } else if (item.gst !== undefined && item.gst !== null && item.gst !== '') {
    gstRate = Number(item.gst);
  }

  const hsn = (item.hsn !== undefined && item.hsn !== null && String(item.hsn).trim() !== '')
    ? String(item.hsn)
    : (item.hsnCode ? String(item.hsnCode) : (CATEGORY_CONFIG[category]?.defaultHsn || '8507'));

  const unit = (item.unit !== undefined && item.unit !== null && String(item.unit).trim() !== '')
    ? String(item.unit)
    : (CATEGORY_CONFIG[category]?.defaultUnit || 'Nos');

  const discount = Math.max(0, Number(item.discount ?? item.discountAmount ?? item.disAmt) || 0);

  return {
    ...item,
    name,
    category,
    rate,
    qty,
    unit,
    hsn,
    gstRate,
    isTaxInclusive,
    discount,
    specs: item.specs || {},
  };
}

/**
 * Pre-seeded Initial Product Catalog for TPS BATTERYS HOUSE
 * Persisted in browser localStorage under 'tps_product_catalog'
 */
export const INITIAL_PRODUCT_CATALOG = [
  // --- Batteries ---
  {
    id: 'prod-bat-001',
    sku: 'EXD-IMTT1500',
    name: 'Exide InvaMaster 150Ah Tall Tubular Inverter Battery',
    category: PRODUCT_CATEGORIES.BATTERY,
    subcategory: 'Tubular Battery',
    brand: 'Exide',
    model: 'IMTT1500',
    description: '150Ah 12V Tall Tubular lead-acid deep-cycle inverter battery for long power cuts.',
    hsn: '8507',
    gstRate: 28,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 14800,
    warranty: '36 Months Full Replacement',
    specs: {
      capacity: '150Ah',
      voltage: '12V',
      batteryType: 'Tall Tubular',
    },
    active: true,
  },
  {
    id: 'prod-bat-002',
    sku: 'AMR-AR150TT',
    name: 'Amaron Current 150Ah Tall Tubular Inverter Battery',
    category: PRODUCT_CATEGORIES.BATTERY,
    subcategory: 'Tubular Battery',
    brand: 'Amaron',
    model: 'CR-AR150TT',
    description: 'Ultra low maintenance heavy-duty tubular battery with high heat tolerance.',
    hsn: '8507',
    gstRate: 28,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 15500,
    warranty: '36M Free + 18M Pro-rata',
    specs: {
      capacity: '150Ah',
      voltage: '12V',
      batteryType: 'Tall Tubular',
    },
    active: true,
  },
  {
    id: 'prod-bat-003',
    sku: 'AMR-FL-35',
    name: 'Amaron Hi-Life 35Ah Maintenance Free Car Battery',
    category: PRODUCT_CATEGORIES.BATTERY,
    subcategory: 'Automotive Battery',
    brand: 'Amaron',
    model: 'AAM-FL-00042B20L',
    description: 'High cranking power automotive battery for passenger hatchbacks and sedans.',
    hsn: '8507',
    gstRate: 28,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 4300,
    warranty: '60 Months (30F + 30P)',
    specs: {
      capacity: '35Ah',
      voltage: '12V',
      batteryType: 'SMF / VRLA',
    },
    active: true,
  },
  {
    id: 'prod-bat-004',
    sku: 'EXD-XP1300',
    name: 'Exide Xpress 130Ah Heavy Commercial Vehicle Battery',
    category: PRODUCT_CATEGORIES.BATTERY,
    subcategory: 'Automotive Battery',
    brand: 'Exide',
    model: 'XP1300',
    description: 'Heavy duty commercial vehicle starter battery with hybrid alloy grids.',
    hsn: '8507',
    gstRate: 28,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 13200,
    warranty: '36 Months Warranty',
    specs: {
      capacity: '130Ah',
      voltage: '12V',
      batteryType: 'Flat Plate',
    },
    active: true,
  },

  // --- Inverters ---
  {
    id: 'prod-inv-001',
    sku: 'LUM-ECO-1050',
    name: 'Luminous Eco Volt Neo 1050 Pure Sine Wave Inverter',
    category: PRODUCT_CATEGORIES.INVERTER,
    subcategory: 'Home Inverter',
    brand: 'Luminous',
    model: 'Eco Volt Neo 1050',
    description: '900VA / 12V Pure Sine Wave intelligent home inverter with adaptive battery charging.',
    hsn: '8504',
    gstRate: 18,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 6800,
    warranty: '24 Months On-site Warranty',
    specs: {
      capacityVa: '900 VA',
      powerWatts: '756 Watts',
      voltage: '12V DC',
      phase: 'Single Phase',
      waveform: 'Pure Sine Wave',
    },
    active: true,
  },
  {
    id: 'prod-inv-002',
    sku: 'MIC-SP-1100',
    name: 'Microtek Super Power 1100 Advanced Digital Pure Sine Wave UPS',
    category: PRODUCT_CATEGORIES.INVERTER,
    subcategory: 'Home Inverter',
    brand: 'Microtek',
    model: 'Super Power 1100',
    description: '1000VA / 12V Microcontroller-based smart home UPS with overload protection.',
    hsn: '8504',
    gstRate: 18,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 6400,
    warranty: '24 Months Warranty',
    specs: {
      capacityVa: '1000 VA',
      powerWatts: '800 Watts',
      voltage: '12V DC',
      phase: 'Single Phase',
      waveform: 'Pure Sine Wave',
    },
    active: true,
  },
  {
    id: 'prod-inv-003',
    sku: 'LUM-CRZ-3.5',
    name: 'Luminous Cruze 3.5kVA / 48V Heavy Duty Commercial Inverter',
    category: PRODUCT_CATEGORIES.INVERTER,
    subcategory: 'Commercial Inverter',
    brand: 'Luminous',
    model: 'Cruze 3.5kVA',
    description: 'High capacity 48V commercial inverter capable of running air conditioners, petrol pumps & lifts.',
    hsn: '8504',
    gstRate: 18,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 28500,
    warranty: '24 Months On-site Warranty',
    specs: {
      capacityVa: '3.5 kVA',
      powerWatts: '2800 Watts',
      voltage: '48V DC',
      phase: 'Single Phase',
      waveform: 'Pure Sine Wave',
    },
    active: true,
  },

  // --- Solar ---
  {
    id: 'prod-sol-001',
    sku: 'WAR-550-BIF',
    name: 'Waaree 550Wp Bifacial Mono PERC Solar Panel Module',
    category: PRODUCT_CATEGORIES.SOLAR,
    subcategory: 'Monocrystalline Solar Panels',
    brand: 'Waaree',
    model: 'WXS-550-BIF',
    description: 'High efficiency 144-cell half-cut dual glass bifacial solar photovoltaic module.',
    hsn: '8541',
    gstRate: 12,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 13750, // ~₹25/watt
    warranty: '12Y Product + 30Y Performance',
    specs: {
      ratedCapacityWp: '550 Wp',
      panelTechnology: 'Bifacial Mono PERC',
      voltage: '41.8V Vmp',
      dimensions: '2278 x 1134 x 35 mm',
    },
    active: true,
  },
  {
    id: 'prod-sol-002',
    sku: 'TAT-450-MONO',
    name: 'Tata Power Solar 450Wp Mono PERC Half-Cut Solar Panel',
    category: PRODUCT_CATEGORIES.SOLAR,
    subcategory: 'Solar Panels',
    brand: 'Tata Power Solar',
    model: 'TP450-M144',
    description: 'Class-A high transmission tempered glass module optimized for Kerala climatic conditions.',
    hsn: '8541',
    gstRate: 12,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 11250,
    warranty: '10Y Product + 25Y Performance',
    specs: {
      ratedCapacityWp: '450 Wp',
      panelTechnology: 'Mono PERC Half-Cut',
      voltage: '41.2V Vmp',
    },
    active: true,
  },
  {
    id: 'prod-sol-003',
    sku: 'LUM-SOL-PCU',
    name: 'Luminous Solarverter PRO 3kVA / 36V MPPT Solar Hybrid Inverter',
    category: PRODUCT_CATEGORIES.SOLAR,
    subcategory: 'Solar Inverters',
    brand: 'Luminous',
    model: 'Solarverter PRO 3kVA',
    description: 'Intelligent solar PCU with built-in high tracking efficiency MPPT charge controller.',
    hsn: '8504',
    gstRate: 12,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 31000,
    warranty: '60 Months Warranty',
    specs: {
      capacityVa: '3 kVA',
      systemCapacityKw: '3 kW Solar Support',
      voltage: '36V DC Battery',
    },
    active: true,
  },
  {
    id: 'prod-sol-004',
    sku: 'SOL-CC-MPPT24',
    name: 'Microtek 24V / 40A MPPT Solar Charge Controller',
    category: PRODUCT_CATEGORIES.SOLAR,
    subcategory: 'Solar Charge Controllers',
    brand: 'Microtek',
    model: 'SM-40A-24V',
    description: 'Ultra fast MPPT controller to upgrade conventional home inverters into solar backup systems.',
    hsn: '8504',
    gstRate: 18,
    isTaxInclusive: true,
    unit: 'Nos',
    sellingPrice: 4500,
    warranty: '12 Months Warranty',
    specs: {
      ratedCapacityWp: '1000W PV Input',
      voltage: '12V / 24V Auto Detect',
    },
    active: true,
  },

  // --- Services ---
  {
    id: 'prod-ser-001',
    sku: 'SER-SOL-INST',
    name: 'Rooftop Solar EPC Installation, Structural Mounting & Wiring Service',
    category: PRODUCT_CATEGORIES.SERVICES,
    subcategory: 'Solar Installation',
    brand: 'TPS Services',
    model: 'On-site Service',
    description: 'End-to-end rooftop solar structural fabrication, panel clamping, DC/AC cabling, earthing and inverter interconnection.',
    hsn: '9954',
    gstRate: 18,
    isTaxInclusive: true,
    unit: 'Job',
    sellingPrice: 6500,
    warranty: '12 Months Workmanship Guarantee',
    specs: {
      serviceCategory: 'Rooftop Solar EPC & Commissioning',
      serviceScope: 'Complete rooftop panel fabrication, earthing kit & net-metering readiness',
    },
    active: true,
  },
  {
    id: 'prod-ser-002',
    sku: 'SER-INV-INST',
    name: 'Inverter & Battery Home Wiring, Changeover Switch & Commissioning',
    category: PRODUCT_CATEGORIES.SERVICES,
    subcategory: 'Inverter Installation',
    brand: 'TPS Services',
    model: 'Standard Installation',
    description: 'Wall mounting of inverter, heavy copper battery interconnects, manual changeover switch connection and load testing.',
    hsn: '9987',
    gstRate: 18,
    isTaxInclusive: true,
    unit: 'Service',
    sellingPrice: 1200,
    warranty: '6 Months Service Guarantee',
    specs: {
      serviceCategory: 'Inverter & Battery Wiring Installation',
      serviceScope: 'AC distribution board bypass wiring & terminal crimping',
    },
    active: true,
  },
  {
    id: 'prod-ser-003',
    sku: 'SER-BAT-TEST',
    name: 'Annual Battery Preventative Maintenance & Specific Gravity Desulfation Inspection',
    category: PRODUCT_CATEGORIES.SERVICES,
    subcategory: 'Maintenance',
    brand: 'TPS Services',
    model: 'AMC Visit',
    description: 'Full hydrometer specific gravity test, cell equalization, demineralized water top-up and terminal anti-corrosion petroleum gel coating.',
    hsn: '9987',
    gstRate: 18,
    isTaxInclusive: true,
    unit: 'Service',
    sellingPrice: 750,
    warranty: 'N/A',
    specs: {
      serviceCategory: 'Battery Health & Specific Gravity Testing',
    },
    active: true,
  },
];
