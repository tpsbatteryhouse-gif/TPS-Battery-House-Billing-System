import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { calculateInvoiceTotals, buildUpiUri, verifyInvoiceFinancialConsistency } from './gstCalculations.js';
import { formatNumber } from './numberToWords.js';
import {
  formatItemSpecifications,
  inferTransactionType,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_CONFIG,
} from './categories.js';

/**
 * Builds a vector-based, lightweight, selectable-text A4 PDF using jsPDF.
 * Modeled strictly after traditional Indian GST retail accounting invoices.
 * Produces crisp vector borders, tabular layout, embedded scannable UPI QR,
 * multi-HSN tax summary, bank details, and terms.
 * Output size is typically 50 KB - 90 KB.
 */
export async function generateVectorPdf(invoice, businessInput, invoiceCopy = 'Original for Buyer') {
  const business = invoice?.businessSnapshot || businessInput;
  const totals = calculateInvoiceTotals(invoice, business?.stateCode || '32');
  const consistency = verifyInvoiceFinancialConsistency(invoice, business?.stateCode || '32');
  if (!consistency.isValid) {
    throw new Error(`Cannot generate PDF for invalid invoice: ${consistency.error}`);
  }
  const payableAmount = totals.netPayable;
  const upiUri = buildUpiUri(
    business?.upiId,
    business?.businessName,
    payableAmount,
    invoice.invoiceNumber
  );

  // Derive business PAN from GSTIN (chars 3 to 12)
  const businessPan = (business?.gstin || '').length >= 12
    ? business.gstin.slice(2, 12)
    : (business?.pan || '—');
  const customerPan = invoice?.customer?.pan ||
    ((invoice?.customer?.gstin || '').length >= 12 ? invoice.customer.gstin.slice(2, 12) : '—');

  // Transaction classification
  const currentTxType = invoice?.transactionType || inferTransactionType(invoice);
  const _txConfig = TRANSACTION_TYPE_CONFIG[currentTxType] || TRANSACTION_TYPE_CONFIG[TRANSACTION_TYPES.B2B];

  const isCredit = invoice.paymentStatus === 'Pending' || invoice.paymentMode === 'Credit' || invoice.paymentMode === 'On Credit';
  const taxInvoiceTitle = isCredit
    ? `TAX INVOICE - CREDIT (${currentTxType})`
    : currentTxType === TRANSACTION_TYPES.B2C
      ? 'RETAIL TAX INVOICE (B2C)'
      : `TAX INVOICE (${currentTxType})`;

  // Generate UPI QR Code as an optimized small data URL
  let qrDataUrl = null;
  if (business?.upiId) {
    try {
      qrDataUrl = await QRCode.toDataURL(upiUri, {
        width: 140,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
    } catch (e) {
      console.warn('QR code generation error:', e);
    }
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const contentWidth = 190; // 210 - 20
  const rightEdge = margin + contentWidth; // 200

  // Palette: Traditional Accounting (Black lines, dark typography, subtle gray fills)
  const blackColor = [0, 0, 0];
  const darkText = [17, 24, 39];
  const mutedText = [75, 85, 99];
  const headerFill = [243, 244, 246]; // #f3f4f6

  // Helper date formatter YYYY-MM-DD -> DD-MM-YYYY
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}-${m}-${y}`;
    }
    return dateStr;
  };

  // Table Column Specifications (Total = 190 mm)
  const tableCols = [
    { name: 'Sl', w: 8, align: 'center' },
    { name: 'HSN Code', w: 16, align: 'center' },
    { name: 'Item Name', w: 62, align: 'left' },
    { name: 'Quantity', w: 16, align: 'center' },
    { name: 'Price', w: 16, align: 'right' },
    { name: 'Dis Amt', w: 12, align: 'right' },
    { name: 'GrossAmt', w: 18, align: 'right' },
    { name: 'GST %', w: 10, align: 'center' },
    { name: 'GST Amt', w: 14, align: 'right' },
    { name: 'Total', w: 18, align: 'right' },
  ];

  // Helper to draw clean traditional table header
  const drawTableHeader = (startY) => {
    const h = 7;
    doc.setFillColor(...headerFill);
    doc.rect(margin, startY, contentWidth, h, 'F');
    doc.setDrawColor(...blackColor);
    doc.setLineWidth(0.2);
    doc.rect(margin, startY, contentWidth, h, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...blackColor);

    let curX = margin;
    tableCols.forEach((col) => {
      // Draw vertical separator
      doc.line(curX, startY, curX, startY + h);

      if (col.name === 'GST %') {
        // Draw split GST box
        doc.line(curX, startY + 3.2, curX + 24, startY + 3.2);
        doc.text('GST', curX + 12, startY + 2.5, { align: 'center' });
        doc.text('%', curX + 5, startY + 5.8, { align: 'center' });
      } else if (col.name === 'GST Amt') {
        doc.text('Amt', curX + col.w - 1.5, startY + 5.8, { align: 'right' });
      } else {
        let textX = curX + 1.5;
        if (col.align === 'center') textX = curX + col.w / 2;
        if (col.align === 'right') textX = curX + col.w - 1.5;
        doc.text(col.name, textX, startY + 4.5, { align: col.align });
      }
      curX += col.w;
    });

    return h;
  };

  let y = margin;
  const pageStartY = y;

  // Outer Border begins
  doc.setDrawColor(...blackColor);
  doc.setLineWidth(0.35);

  // 1. Top Bar: PAN NO | TAX INVOICE | Copy Designation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...blackColor);
  doc.text(`PAN NO : ${businessPan}`, margin + 2.5, y + 3.5);

  doc.setFontSize(9);
  doc.text(taxInvoiceTitle, pageWidth / 2, y + 3.5, { align: 'center' });

  doc.setFontSize(7.5);
  doc.text(invoiceCopy.toUpperCase(), rightEdge - 2.5, y + 3.5, { align: 'right' });

  y += 5;
  doc.line(margin, y, rightEdge, y);

  // 2. Seller Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...blackColor);
  doc.text(business?.businessName || 'TPS BATTERYS HOUSE', margin + 2.5, y + 4.5);

  doc.setFontSize(6.5);
  doc.setTextColor(...darkText);
  if (business?.tagline) {
    doc.text((business.tagline).toUpperCase(), margin + 2.5, y + 8);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(`${business?.addressLine1 || ''}${business?.roadStreet ? ', ' + business.roadStreet : ''}`, margin + 2.5, y + 11.5);
  doc.text(`${business?.cityDistrict || ''}${business?.state ? ', ' + business.state : 'Kerala'} - ${business?.pinCode || ''}`, margin + 2.5, y + 15);
  doc.text(`Ph: ${business?.phone || ''}${business?.altPhone ? ' | ' + business.altPhone : ''}`, margin + 2.5, y + 18.5);

  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN/UIN : ${business?.gstin || ''}`, margin + 2.5, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.text(
    `State : ${business?.state || 'KERALA'}   Code : ${business?.stateCode || '32'}${business?.email ? '   Email : ' + business.email : ''}`,
    margin + 2.5,
    y + 25.5
  );

  y += 28;
  doc.line(margin, y, rightEdge, y);

  // 3. Buyer & Invoice Details Grid (Col 1: 78mm, Col 2: 50mm, Col 3: 62mm)
  const metaGridStartY = y;
  const metaGridH = 26;
  const col1W = 78;
  const col2W = 50;

  const col1X = margin;
  const col2X = margin + col1W;
  const col3X = margin + col1W + col2W;

  // Vertical separators
  doc.line(col2X, metaGridStartY, col2X, metaGridStartY + metaGridH);
  doc.line(col3X, metaGridStartY, col3X, metaGridStartY + metaGridH);

  // --- Col 1: Bill To ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...blackColor);
  doc.text('Bill To', col1X + 2, metaGridStartY + 3.5);
  doc.setFontSize(8);
  doc.text((invoice?.customer?.name || 'CASH CUSTOMER').toUpperCase(), col1X + 2, metaGridStartY + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...darkText);
  const custAddr = [
    invoice.customer?.address,
    [invoice.customer?.city, invoice.customer?.district].filter(Boolean).join(', '),
  ].filter(Boolean);
  if (custAddr[0]) doc.text(custAddr[0], col1X + 2, metaGridStartY + 11);
  if (custAddr[1]) doc.text(`${custAddr[1]} Pin:${invoice.customer?.pincode || '679552'}`, col1X + 2, metaGridStartY + 14.5);

  doc.text(`Ph : ${invoice.customer?.phone ? '+91 ' + invoice.customer.phone : '—'}`, col1X + 2, metaGridStartY + 18);
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTNO : ${invoice.customer?.gstin || '—'}`, col1X + 2, metaGridStartY + 21.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`PAN NO : ${customerPan}   STATE : ${(invoice.customer?.state || 'KERALA').toUpperCase()} , CODE : ${invoice.customer?.stateCode || '32'}`, col1X + 2, metaGridStartY + 24.8);

  // --- Col 2: Shipped To ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...blackColor);
  doc.text('Shipped To', col2X + 2, metaGridStartY + 3.5);
  doc.setFontSize(7.5);
  doc.text((invoice?.customer?.name || 'CASH CUSTOMER').toUpperCase(), col2X + 2, metaGridStartY + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...darkText);
  const shipAddr = invoice.customer?.shippingAddress || invoice.customer?.address || 'Padinarangadi, Koottanad Road';
  doc.text(shipAddr.slice(0, 32), col2X + 2, metaGridStartY + 11);
  doc.text(`${invoice.customer?.city || 'Thrithala'}, ${invoice.customer?.district || 'Palakkad'} Pin:${invoice.customer?.pincode || '679552'}`, col2X + 2, metaGridStartY + 14.5);
  doc.text(`Ph : ${invoice.customer?.phone || '—'}`, col2X + 2, metaGridStartY + 18);
  doc.text(`GSTNO : ${invoice.customer?.gstin || '—'}`, col2X + 2, metaGridStartY + 21.5);

  // --- Col 3: Invoice Details Table ---
  const metaRows = [
    ['Invoice Date', formatDate(invoice.invoiceDate)],
    ['Invoice No', invoice.invoiceNumber || '—'],
    ['Payment Mode', invoice.paymentMode || 'Cash'],
    ['Place of Supply', invoice.placeOfSupply || 'Kerala (32)'],
    ['EWay Bill No', invoice.ewayBillNo || '—'],
    ['IRN No', invoice.irn ? (invoice.irn.length > 20 ? invoice.irn.slice(0, 20) + '...' : invoice.irn) : '—'],
  ];

  metaRows.forEach(([lbl, val], idx) => {
    const rowY = metaGridStartY + idx * (metaGridH / 6);
    if (idx > 0) doc.line(col3X, rowY, rightEdge, rowY);

    doc.setFillColor(...headerFill);
    doc.rect(col3X, rowY, 26, metaGridH / 6, 'F');
    doc.line(col3X + 26, rowY, col3X + 26, rowY + metaGridH / 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...darkText);
    doc.text(lbl, col3X + 1.5, rowY + 3.0);

    doc.setFont('helvetica', idx === 1 ? 'bold' : 'normal');
    doc.text(val, col3X + 28, rowY + 3.0);
  });

  y += metaGridH;
  doc.line(margin, y, rightEdge, y);

  // 4. Products & Services Table
  y += drawTableHeader(y);

  totals.computedItems.forEach((item, idx) => {
    const specsText = formatItemSpecifications(item);
    const hasSpecs = Boolean(specsText);
    const hasNotes = Boolean(item.serialNo || item.warranty);
    const descLines = doc.splitTextToSize((item.name || '').toUpperCase(), 59);
    const specsLines = hasSpecs ? doc.splitTextToSize(specsText, 59) : [];

    const rowHeight = Math.max(
      6.8,
      descLines.length * 3.2 + (hasSpecs ? specsLines.length * 2.6 : 0) + (hasNotes ? 2.8 : 0) + 1.8
    );

    // Check pagination
    if (y + rowHeight + 20 > pageHeight - margin) {
      doc.addPage();
      y = margin;
      y += drawTableHeader(y);
    }

    const rowStartY = y;
    doc.setLineWidth(0.2);
    doc.setDrawColor(...blackColor);

    // Draw row bottom line
    doc.line(margin, rowStartY + rowHeight, rightEdge, rowStartY + rowHeight);

    // Draw vertical column separators
    let cX = margin;
    tableCols.forEach((col) => {
      doc.line(cX, rowStartY, cX, rowStartY + rowHeight);
      cX += col.w;
    });
    doc.line(rightEdge, rowStartY, rightEdge, rowStartY + rowHeight);

    // Cell Texts
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...blackColor);

    let cellX = margin;

    // Sl
    doc.text(String(idx + 1), cellX + 4, rowStartY + 3.5, { align: 'center' });
    cellX += 8;

    // HSN Code
    doc.text(item.hsn || '8507', cellX + 8, rowStartY + 3.5, { align: 'center' });
    cellX += 16;

    // Item Name & Specs
    doc.setFont('helvetica', 'bold');
    doc.text(descLines, cellX + 1.5, rowStartY + 3.5);
    let curDescY = rowStartY + 3.5 + descLines.length * 3.0;

    if (hasSpecs) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(...darkText);
      doc.text(specsLines, cellX + 1.5, curDescY);
      curDescY += specsLines.length * 2.5;
    }

    if (hasNotes) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.6);
      doc.setTextColor(...mutedText);
      const noteParts = [];
      if (item.serialNo) noteParts.push(`S/N: ${item.serialNo}`);
      if (item.warranty) noteParts.push(`Warranty: ${item.warranty}`);
      doc.text(noteParts.join(' | '), cellX + 1.5, curDescY);
    }
    cellX += 62;

    // Quantity
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...blackColor);
    doc.text(`${Number(item.qty).toFixed(2)} ${item.unit || 'NOS'}`, cellX + 8, rowStartY + 3.5, { align: 'center' });
    cellX += 16;

    // Price
    const unitPrice = item.isTaxInclusive ? (item.qty > 0 ? item.taxableValue / item.qty : 0) : item.rate;
    doc.text(formatNumber(unitPrice), cellX + 16 - 1.5, rowStartY + 3.5, { align: 'right' });
    cellX += 16;

    // Dis Amt
    const itDis = Number(item.discount || 0);
    doc.text(itDis > 0 ? formatNumber(itDis) : '0.00', cellX + 12 - 1.5, rowStartY + 3.5, { align: 'right' });
    cellX += 12;

    // GrossAmt
    doc.text(formatNumber(item.taxableValue), cellX + 18 - 1.5, rowStartY + 3.5, { align: 'right' });
    cellX += 18;

    // GST %
    doc.text(String(item.gstRate), cellX + 5, rowStartY + 3.5, { align: 'center' });
    cellX += 10;

    // GST Amt
    doc.text(formatNumber(item.totalGstAmount), cellX + 14 - 1.5, rowStartY + 3.5, { align: 'right' });
    cellX += 14;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.text(formatNumber(item.lineTotal), cellX + 18 - 1.5, rowStartY + 3.5, { align: 'right' });

    y += rowHeight;
  });

  // 5. Dynamic bottom-anchoring for A4 page
  // Lower sections required height:
  // Section D (Subtotal): 5.5 mm
  // Section E (Words, HSN Summary, Totals, Bank): 44 mm
  // Sections G & H (Terms, QR, Signatory): 32 mm
  // Total lower block height = 81.5 mm
  // Target bottom boundary of invoice is 284 mm (leaving 3 mm breathing room before watermark)
  const targetBottom = 284;
  const targetSubtotalY = targetBottom - (32 + 44 + 5.5); // 202.5 mm

  if (y < targetSubtotalY) {
    // Extend table vertical grid lines to reach targetSubtotalY
    doc.setDrawColor(...blackColor);
    doc.setLineWidth(0.2);
    let padX = margin;
    tableCols.forEach((col) => {
      doc.line(padX, y, padX, targetSubtotalY);
      padX += col.w;
    });
    doc.line(rightEdge, y, rightEdge, targetSubtotalY);
    doc.line(margin, targetSubtotalY, rightEdge, targetSubtotalY);
    y = targetSubtotalY;
  }

  // 5. Item Subtotal Row
  const subH = 5.5;
  doc.setFillColor(...headerFill);
  doc.rect(margin, y, contentWidth, subH, 'F');
  doc.setDrawColor(...blackColor);
  doc.rect(margin, y, contentWidth, subH, 'S');

  let subX = margin;
  tableCols.forEach((col) => {
    doc.line(subX, y, subX, y + subH);
    subX += col.w;
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...blackColor);
  doc.text('SUB TOTAL', margin + 8 + 16 + 62 - 2, y + 3.8, { align: 'right' });

  const totalQty = totals.computedItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  const totalItemDis = totals.computedItems.reduce((acc, it) => acc + (Number(it.discount) || 0), 0);
  doc.text(totalQty.toFixed(2), margin + 8 + 16 + 62 + 8, y + 3.8, { align: 'center' });
  doc.text(totalItemDis > 0 ? formatNumber(totalItemDis) : '0.00', margin + 8 + 16 + 62 + 16 + 16 + 12 - 1.5, y + 3.8, { align: 'right' });
  doc.text(formatNumber(totals.totalTaxableValue), margin + 8 + 16 + 62 + 16 + 16 + 12 + 18 - 1.5, y + 3.8, { align: 'right' });
  doc.text(formatNumber(totals.totalTax), margin + 8 + 16 + 62 + 16 + 16 + 12 + 18 + 10 + 14 - 1.5, y + 3.8, { align: 'right' });
  doc.text(formatNumber(totals.totalGross), rightEdge - 1.5, y + 3.8, { align: 'right' });

  y += subH;

  // Check if remaining blocks fit on current page; if not, add page
  const remainingNeeded = 76;
  if (y + remainingNeeded > targetBottom) {
    doc.addPage();
    y = margin + 5;
    if (y < targetSubtotalY) {
      y = targetSubtotalY;
    }
  }

  // 6. Section E: Words + Statutory HSN Summary (Left: 112mm) & Totals / Bank (Right: 78mm)
  const secEStartY = y;
  const secEHeight = 44;
  const secELeftW = 112;
  const secERightW = 78;
  const secERightX = margin + secELeftW;

  doc.setDrawColor(...blackColor);
  doc.setLineWidth(0.3);
  doc.rect(margin, secEStartY, contentWidth, secEHeight, 'S');
  doc.line(secERightX, secEStartY, secERightX, secEStartY + secEHeight);

  // --- Left: Amount in Words ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...blackColor);
  doc.text('Rupees ', margin + 2.5, secEStartY + 4.5);
  doc.setFontSize(7.5);
  const cleanWords = (totals.amountInWords || '')
    .replace(/^rupees\s*/i, '')
    .replace(/\s*rupees\s*(only)?$/i, '')
    .replace(/\s*only$/i, '')
    .trim();
  const wordsText = `${cleanWords.toUpperCase()} ONLY`;
  const wordsLines = doc.splitTextToSize(wordsText, secELeftW - 20);
  doc.text(wordsLines, margin + 14, secEStartY + 4.5);

  const hsnTableStartY = secEStartY + 9;
  doc.line(margin, hsnTableStartY - 2, secERightX, hsnTableStartY - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setFillColor(...headerFill);
  doc.rect(margin + 2, hsnTableStartY, secELeftW - 4, 3.5, 'F');
  doc.rect(margin + 2, hsnTableStartY, secELeftW - 4, 3.5, 'S');
  doc.text('Taxable Value', margin + 3.5, hsnTableStartY + 2.5);

  if (!totals.isInterstate) {
    doc.text('CGST Rate', margin + 28 + 4, hsnTableStartY + 2.5);
    doc.text('CGST Amt', margin + 44 + 8, hsnTableStartY + 2.5, { align: 'right' });
    doc.text('SGST Rate', margin + 64 + 4, hsnTableStartY + 2.5);
    doc.text('SGST Amt', margin + 80 + 8, hsnTableStartY + 2.5, { align: 'right' });
    doc.text('Total Tax', margin + secELeftW - 3.5, hsnTableStartY + 2.5, { align: 'right' });
  } else {
    doc.text('IGST Rate', margin + 30 + 10, hsnTableStartY + 2.5);
    doc.text('IGST Amount', margin + 56 + 24, hsnTableStartY + 2.5, { align: 'right' });
    doc.text('Total Tax Amount', margin + secELeftW - 3.5, hsnTableStartY + 2.5, { align: 'right' });
  }

  let hsnY = hsnTableStartY + 3.5;
  totals.hsnSummary.forEach((h) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.rect(margin + 2, hsnY, secELeftW - 4, 3.5, 'S');

    doc.text(`${formatNumber(h.taxableValue)} (${h.hsn})`, margin + 3.5, hsnY + 2.5);

    if (!totals.isInterstate) {
      doc.text(`${(h.gstRate / 2)}%`, margin + 28 + 8, hsnY + 2.5, { align: 'center' });
      doc.text(formatNumber(h.cgstAmount), margin + 44 + 18, hsnY + 2.5, { align: 'right' });
      doc.text(`${(h.gstRate / 2)}%`, margin + 64 + 8, hsnY + 2.5, { align: 'center' });
      doc.text(formatNumber(h.sgstAmount), margin + 80 + 18, hsnY + 2.5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatNumber(h.totalTax), margin + secELeftW - 3.5, hsnY + 2.5, { align: 'right' });
    } else {
      doc.text(`${h.gstRate}%`, margin + 30 + 13, hsnY + 2.5, { align: 'center' });
      doc.text(formatNumber(h.igstAmount), margin + 56 + 24, hsnY + 2.5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatNumber(h.totalTax), margin + secELeftW - 3.5, hsnY + 2.5, { align: 'right' });
    }
    hsnY += 3.5;
  });

  // HSN Totals line
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(...headerFill);
  doc.rect(margin + 2, hsnY, secELeftW - 4, 3.5, 'F');
  doc.rect(margin + 2, hsnY, secELeftW - 4, 3.5, 'S');
  doc.text(formatNumber(totals.totalTaxableValue), margin + 3.5, hsnY + 2.5);

  if (!totals.isInterstate) {
    doc.text(formatNumber(totals.totalCgst), margin + 44 + 18, hsnY + 2.5, { align: 'right' });
    doc.text(formatNumber(totals.totalSgst), margin + 80 + 18, hsnY + 2.5, { align: 'right' });
    doc.text(formatNumber(totals.totalTax), margin + secELeftW - 3.5, hsnY + 2.5, { align: 'right' });
  } else {
    doc.text(formatNumber(totals.totalIgst), margin + 56 + 24, hsnY + 2.5, { align: 'right' });
    doc.text(formatNumber(totals.totalTax), margin + secELeftW - 3.5, hsnY + 2.5, { align: 'right' });
  }

  // --- Right: Deductions, Round Off, Bill Amount & Bank Details ---
  let rightCurY = secEStartY + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...darkText);

  if (totals.scrapDiscount > 0) {
    doc.text('Old Battery Scrap Buyback :', secERightX + 3, rightCurY);
    doc.text(`- ${formatNumber(totals.scrapDiscount)}`, rightEdge - 3, rightCurY, { align: 'right' });
    rightCurY += 3.8;
  }

  if (totals.extraDiscount > 0) {
    doc.text('Special Discount :', secERightX + 3, rightCurY);
    doc.text(`- ${formatNumber(totals.extraDiscount)}`, rightEdge - 3, rightCurY, { align: 'right' });
    rightCurY += 3.8;
  }

  doc.text('Round Off :', secERightX + 3, rightCurY);
  const roundStr = totals.roundOff >= 0 ? `+${formatNumber(totals.roundOff)}` : formatNumber(totals.roundOff);
  doc.text(roundStr, rightEdge - 3, rightCurY, { align: 'right' });
  rightCurY += 5;

  // Boxed Bill Amount Row
  const billBoxY = rightCurY;
  const billBoxH = 7.5;
  doc.setFillColor(...headerFill);
  doc.rect(secERightX + 2, billBoxY, secERightW - 4, billBoxH, 'F');
  doc.setLineWidth(0.35);
  doc.rect(secERightX + 2, billBoxY, secERightW - 4, billBoxH, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...blackColor);
  doc.text('Bill Amount :', secERightX + 4.5, billBoxY + 5.2);
  doc.setFontSize(11);
  doc.text(formatNumber(payableAmount), rightEdge - 4.5, billBoxY + 5.2, { align: 'right' });

  // Bank Details below Bill Amount
  const bankStartY = billBoxY + billBoxH + 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...darkText);

  const bankRows = [
    ['Bank Name :', business?.bankName || 'Federal Bank'],
    ['Account No :', business?.accountNo || '15240200008892'],
    ['IFSC Code :', business?.ifsc || 'FDRL0001524'],
  ];

  bankRows.forEach(([lbl, val], bIdx) => {
    const rowY = bankStartY + bIdx * 3.2;
    doc.setFont('helvetica', 'bold');
    doc.text(lbl, secERightX + 3, rowY);
    doc.setFont('helvetica', 'normal');
    doc.text(val, secERightX + 26, rowY);
  });

  y = secEStartY + secEHeight;

  // 7. Sections G & H: Terms & Conditions (Left: 96mm), Payment QR (Middle: 44mm), Signatory (Right: 50mm)
  const footStartY = y;
  const footH = 32;
  const fCol1W = 96;
  const fCol2W = 44;
  const fCol3W = 50;

  const fCol1X = margin;
  const fCol2X = margin + fCol1W;
  const fCol3X = margin + fCol1W + fCol2W;

  doc.setDrawColor(...blackColor);
  doc.setLineWidth(0.3);
  doc.rect(margin, footStartY, contentWidth, footH, 'S');
  doc.line(fCol2X, footStartY, fCol2X, footStartY + footH);
  doc.line(fCol3X, footStartY, fCol3X, footStartY + footH);

  // Left: Terms & Conditions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...blackColor);
  doc.text('TERMS & CONDITIONS OF SALE', fCol1X + 2.5, footStartY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(...darkText);
  const termsLines = [
    '1) Goods once sold will not be taken back or exchanged except as per warranty terms.',
    '2) Seller is not responsible for any loss or damaged of goods in transit after dispatch.',
    '3) Disputes if any will be subject to Thrithala / Palakkad court jurisdiction.',
  ];

  termsLines.forEach((t, tIdx) => {
    const tLines = doc.splitTextToSize(t, fCol1W - 5);
    doc.text(tLines, fCol1X + 2.5, footStartY + 7.5 + tIdx * 4.2);
  });

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' });
  const dateStr = formatDate(now.toISOString().split('T')[0]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.text(`TPS OPERATOR on ${dateStr} ${timeStr}`, fCol1X + 2.5, footStartY + footH - 2.5);

  // Middle: Payment QR Code (Centered like reference photo)
  if (qrDataUrl) {
    const qrSize = 21;
    const qrX = fCol2X + (fCol2W - qrSize) / 2;
    const qrY = footStartY + 3.5;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...blackColor);
    doc.text('Scan to Pay (UPI)', fCol2X + fCol2W / 2, footStartY + 2.8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    doc.text(business?.upiId || '', fCol2X + fCol2W / 2, footStartY + footH - 2.5, { align: 'center' });
  }

  // Right: Authorized Signatory
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...blackColor);
  doc.text(`For ${business?.businessName || 'TPS BATTERYS HOUSE'}`, fCol3X + fCol3W / 2, footStartY + 4, { align: 'center' });

  // Signature line
  doc.line(fCol3X + 5, footStartY + footH - 7, rightEdge - 5, footStartY + footH - 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('Authorised Signatory', fCol3X + fCol3W / 2, footStartY + footH - 3, { align: 'center' });

  y += footH;

  // Draw full outer boundary and watermark on all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setLineWidth(0.4);
    doc.setDrawColor(...blackColor);
    doc.rect(margin, pageStartY, contentWidth, targetBottom - pageStartY, 'S');

    // Bottom Watermark
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...mutedText);
    doc.text('Generated via TPS BATTERYS HOUSE GST Billing System • Computer Generated Tax Invoice', margin + 2, pageHeight - 5);
    doc.text(`Page ${p} of ${totalPages}`, rightEdge - 2, pageHeight - 5, { align: 'right' });
  }

  return doc;
}

/**
 * Optimized fallback canvas capture with JPEG compression.
 */
async function generateCanvasFallbackPdf(elementId) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Invoice preview element not found.');
  }

  const originalShadow = element.style.boxShadow;
  element.style.boxShadow = 'none';

  try {
    const canvas = await html2canvas(element, {
      scale: 1.8,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
    });

    element.style.boxShadow = originalShadow;

    const imgData = canvas.toDataURL('image/jpeg', 0.88);
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 5;
    const contentWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    if (imgHeight <= pageHeight - margin * 2) {
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, imgHeight, undefined, 'FAST');
    } else {
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
    }

    return pdf;
  } catch (error) {
    element.style.boxShadow = originalShadow;
    throw error;
  }
}

/**
 * Main export function called by UI components.
 */
export async function downloadInvoicePdf(
  elementId = 'invoice-printable',
  invoiceNumber = 'Invoice',
  customerName = '',
  options = {}
) {
  let pdfDoc;

  if (options?.invoice && options?.business) {
    pdfDoc = await generateVectorPdf(
      options.invoice,
      options.business,
      options.invoiceCopy || 'Original for Buyer'
    );
  } else {
    pdfDoc = await generateCanvasFallbackPdf(elementId);
  }

  const sanitizedInvNo = (invoiceNumber || 'Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedCustomer = (customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `TPS_${sanitizedInvNo}_${sanitizedCustomer}.pdf`;

  pdfDoc.save(fileName);
  return fileName;
}

/**
 * Dedicated vector PDF print function.
 * Generates the authentic A4 vector GST invoice using jsPDF, converts it into a Blob URL,
 * and invokes the browser print dialog targeting the pure vector document.
 * Includes graceful fallback to direct window.print() if browser sandbox blocks iframe printing.
 */
export async function printInvoicePdf(
  invoice,
  business,
  invoiceCopy = 'Original for Buyer'
) {
  // 1. Verify consistency using single source of truth
  const consistency = verifyInvoiceFinancialConsistency(
    invoice,
    business?.stateCode || '32'
  );
  if (!consistency.isValid) {
    throw new Error(`Cannot print invoice with invalid financial data: ${consistency.error}`);
  }

  // 2. Generate authoritative vector PDF
  const pdfDoc = await generateVectorPdf(invoice, business, invoiceCopy);
  const blob = pdfDoc.output('blob');
  if (!blob || blob.size === 0) {
    throw new Error('Generated invoice PDF is empty.');
  }

  // 3. In non-browser / test environments, return the blob directly
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { success: true, blob, size: blob.size, method: 'mock-environment' };
  }

  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    let completed = false;
    const cleanup = () => {
      if (completed) return;
      completed = true;
      setTimeout(() => {
        try {
          const oldFrame = document.getElementById('tps-invoice-print-frame');
          if (oldFrame && oldFrame.parentNode) {
            oldFrame.parentNode.removeChild(oldFrame);
          }
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore cleanup errors
        }
      }, 60000); // 60s retention for print spooler
    };

    try {
      // Remove any prior existing print iframe
      const existingFrame = document.getElementById('tps-invoice-print-frame');
      if (existingFrame && existingFrame.parentNode) {
        existingFrame.parentNode.removeChild(existingFrame);
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'tps-invoice-print-frame';
      iframe.setAttribute('title', 'GST Invoice Print Document');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      iframe.src = blobUrl;

      iframe.onload = () => {
        setTimeout(() => {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
              cleanup();
              resolve({ success: true, method: 'iframe-pdf' });
              return;
            }
          } catch (err) {
            console.warn('Iframe PDF printing blocked, falling back to window.print():', err);
          }
          // Fallback to DOM print if iframe contentWindow is blocked
          cleanup();
          window.print();
          resolve({ success: true, method: 'window-print-fallback' });
        }, 350);
      };

      iframe.onerror = () => {
        cleanup();
        window.print();
        resolve({ success: true, method: 'window-print-fallback' });
      };

      document.body.appendChild(iframe);
    } catch (err) {
      cleanup();
      console.warn('Print initiation error, falling back to direct window.print:', err);
      window.print();
      resolve({ success: true, method: 'window-print-fallback' });
    }
  });
}
