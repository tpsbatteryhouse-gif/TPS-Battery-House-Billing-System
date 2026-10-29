export const DEFAULT_BUSINESS = {
  businessName: 'TPS BATTERYS HOUSE',
  gstin: '32DIUPP1211B2ZN',
  addressLine1: 'Building No. 16/207, 208, Padinarangadi',
  roadStreet: 'Koottanad Road',
  cityDistrict: 'Thrithala, Palakkad',
  state: 'Kerala',
  stateCode: '32',
  pinCode: '679552',
  phone: '+91 9846830532',
  altPhone: '+91 9447430532',
  email: 'tpsbatterys@gmail.com',
  tagline: 'Sales & Service of Inverter, Tubular, Automotive Batteries & Solar UPS',
  bankName: 'Federal Bank',
  accountNo: '15240200008892',
  accountName: 'TPS BATTERYS HOUSE',
  branch: 'Thrithala / Koottanad',
  ifsc: 'FDRL0001524',
  upiId: '9846830532@okaxis',
  terms: [
    '1. Warranty claims are subject to the terms and conditions provided by the original manufacturer.',
    '2. Original warranty card and this Tax Invoice are mandatory for any warranty / replacement claims.',
    '3. Battery replacement / service is subject to manufacturer inspection and testing.',
    '4. Old battery scrap value accepted as per mutual agreement and condition of scrap.',
    '5. Goods once sold will not be accepted back or refunded without valid technical grounds.',
    '6. Subject to Thrithala, Palakkad jurisdiction only.',
  ],
  invoicePrefix: 'TPS/2026-27/',
};

export const COMMON_HSN_SUGGESTIONS = [
  { code: '8507', desc: 'Electric Accumulators / Lead-Acid & Tubular Batteries', defaultGst: 28 },
  { code: '8504', desc: 'Electrical Transformers, Static Converters (Inverters / UPS)', defaultGst: 18 },
  { code: '8506', desc: 'Primary Cells and Primary Batteries', defaultGst: 18 },
  { code: '9987', desc: 'Maintenance and Repair Services of Electrical Equipment', defaultGst: 18 },
  { code: '850790', desc: 'Battery Parts, Acid, Accessories & Terminal Clamps', defaultGst: 28 },
];

export const ITEM_PRESETS = [
  {
    name: 'Fuze 1100 Inverter + 150 Ah Tubular Battery (Combo Set)',
    hsn: '8507',
    warranty: '36 Months Replacement',
    unit: 'Set',
    gstRate: 28,
    isTaxInclusive: true,
    price: 22000,
  },
  {
    name: 'Amaron Current 150Ah Tall Tubular Inverter Battery (CR-AR150TT)',
    hsn: '8507',
    warranty: '36 Months Free + 18 Months Pro-rata',
    unit: 'Nos',
    gstRate: 28,
    isTaxInclusive: true,
    price: 15500,
  },
  {
    name: 'Exide InvaMaster 150Ah Tall Tubular Battery (IMTT1500)',
    hsn: '8507',
    warranty: '36 Months Full Replacement',
    unit: 'Nos',
    gstRate: 28,
    isTaxInclusive: true,
    price: 14800,
  },
  {
    name: 'Luminous Eco Volt Neo 1050 Pure Sine Wave Inverter',
    hsn: '8504',
    warranty: '24 Months On-site Warranty',
    unit: 'Nos',
    gstRate: 18,
    isTaxInclusive: true,
    price: 6800,
  },
  {
    name: 'Microtek Super Power 1100 Advanced Digital UPS',
    hsn: '8504',
    warranty: '24 Months Warranty',
    unit: 'Nos',
    gstRate: 18,
    isTaxInclusive: true,
    price: 6400,
  },
  {
    name: 'Amaron Hi-Life 35Ah Car Battery (AAM-FL-00042B20L)',
    hsn: '8507',
    warranty: '60 Months (30F + 30P)',
    unit: 'Nos',
    gstRate: 28,
    isTaxInclusive: true,
    price: 4300,
  },
  {
    name: 'Exide Matrix 45Ah Maintenance Free Car Battery',
    hsn: '8507',
    warranty: '66 Months (36F + 30P)',
    unit: 'Nos',
    gstRate: 28,
    isTaxInclusive: true,
    price: 5600,
  },
  {
    name: 'Exide Xpress Heavy Commercial Vehicle Battery 130Ah',
    hsn: '8507',
    warranty: '36 Months Warranty',
    unit: 'Nos',
    gstRate: 28,
    isTaxInclusive: true,
    price: 13200,
  },
];

export const PAYMENT_MODES = [
  'Cash',
  'UPI / QR Code',
  'Bank Transfer (NEFT/RTGS/IMPS)',
  'Credit / Post-dated',
  'Cheque',
  'Debit/Credit Card',
];

export const UNITS_LIST = ['Nos', 'Set', 'Pcs', 'Units', 'Boxes', 'Pairs'];

export const GST_RATES = [28, 18, 12, 5, 0];

// Default sample test invoice pre-filled as specified in requirements
export const getSampleInvoiceData = () => {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    id: 'sample-' + Date.now(),
    invoiceNumber: 'TPS/2026-27/001',
    invoiceDate: today,
    dueDate: today,
    paymentMode: 'Cash',
    paymentStatus: 'Paid',
    placeOfSupply: 'Kerala (32)',
    reverseCharge: 'No',

    // Customer / Billed To
    customer: {
      name: 'Rajesh K.',
      phone: '9876543210',
      address: 'Near Old Bus Stand, Thrithala Road',
      city: 'Thrithala',
      district: 'Palakkad',
      state: 'Kerala',
      stateCode: '32',
      pincode: '679534',
      gstin: '', // B2C unregistered
    },

    // Line items
    items: [
      {
        id: 'item-1',
        name: 'Fuze 1100 Inverter + 150 Ah Tubular Battery (Combo Set)',
        hsn: '8507',
        serialNo: 'FZ-2026-98124 / BAT-150-7762',
        warranty: '36 Months Replacement',
        qty: 1,
        unit: 'Set',
        rate: 22000, // Total Gross Amount ₹22,000 (tax inclusive)
        isTaxInclusive: true,
        gstRate: 28,
      },
    ],

    // Old Battery Exchange / Scrap Buyback
    scrapExchange: {
      enabled: true,
      description: 'Old 150Ah Scrap Battery Buyback (Exchange Discount)',
      amount: 2000,
    },

    // Adjustments
    additionalDiscount: 0,
    roundOffManual: null, // null for auto round-off
    notes: 'Thank you for choosing TPS BATTERYS HOUSE. For inverter/battery service or emergency jump-start call +91 9846830532.',
  };
};
