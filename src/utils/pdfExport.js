import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { calculateInvoiceTotals, buildUpiUri } from './gstCalculations.js';
import { formatNumber } from './numberToWords.js';
import { formatItemSpecifications } from './categories.js';

/**
 * Builds a vector-based, lightweight, selectable-text A4 PDF using jsPDF.
 * Output size is typically 40 KB - 85 KB (a ~99% reduction compared to raster captures).
 */
export async function generateVectorPdf(invoice, business, invoiceCopy = 'Original for Recipient') {
  const totals = calculateInvoiceTotals(invoice, business?.stateCode || '32');
  const upiUri = buildUpiUri(
    business?.upiId,
    business?.businessName,
    totals.netPayable,
    invoice.invoiceNumber
  );

  // Generate UPI QR Code as an optimized small data URL
  let qrDataUrl = null;
  if (business?.upiId) {
    try {
      qrDataUrl = await QRCode.toDataURL(upiUri, {
        width: 140,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
    } catch (e) {
      console.warn('QR code generation error:', e);
    }
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186 mm
  const rightEdge = margin + contentWidth; // 198 mm

  // Palette: Minimalist Professional (Dark charcoal, muted slate, subtle borders, amber accent)
  const darkCharcoal = [15, 23, 42]; // #0f172a
  const mutedText = [71, 85, 105]; // #475569
  const lightGreyBorder = [203, 213, 225]; // #cbd5e1
  const subtleFill = [248, 250, 252]; // #f8fafc
  const amberAccent = [180, 83, 9]; // #b45309

  // Helper to draw clean table header
  const drawTableHeader = (startY) => {
    const tableCols = [
      { name: '#', w: 8, align: 'center' },
      { name: 'DESCRIPTION OF GOODS', w: totals.isInterstate ? 66 : 64, align: 'left' },
      { name: 'HSN', w: 14, align: 'center' },
      { name: 'QTY', w: 12, align: 'center' },
      { name: 'RATE', w: 20, align: 'right' },
      { name: 'TAXABLE', w: 20, align: 'right' },
      ...(totals.isInterstate
        ? [{ name: 'IGST', w: 22, align: 'right' }]
        : [
            { name: 'CGST', w: 15, align: 'right' },
            { name: 'SGST', w: 15, align: 'right' },
          ]),
      { name: 'AMOUNT (Rs.)', w: totals.isInterstate ? 24 : 18, align: 'right' },
    ];

    doc.setFillColor(...subtleFill);
    doc.rect(margin, startY, contentWidth, 5.5, 'F');
    doc.setDrawColor(...lightGreyBorder);
    doc.setLineWidth(0.2);
    doc.rect(margin, startY, contentWidth, 5.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...darkCharcoal);

    let curX = margin;
    tableCols.forEach((col) => {
      let textX = curX + 1.5;
      if (col.align === 'center') textX = curX + col.w / 2;
      if (col.align === 'right') textX = curX + col.w - 1.5;
      doc.text(col.name, textX, startY + 3.8, { align: col.align });
      curX += col.w;
    });

    return 5.5;
  };

  let y = margin;

  // 1. Top Bar: Header Tag & Copy Designation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkCharcoal);

  // Minimal amber accent marker
  doc.setFillColor(...amberAccent);
  doc.rect(margin, y, 2, 2, 'F');
  doc.text('GST TAX INVOICE', margin + 3.5, y + 2);

  // Copy designation (right-aligned with subtle border)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);
  const copyWidth = doc.getTextWidth(invoiceCopy.toUpperCase());
  doc.setDrawColor(...lightGreyBorder);
  doc.setLineWidth(0.2);
  doc.rect(rightEdge - copyWidth - 6, y - 1, copyWidth + 6, 4.5, 'S');
  doc.text(invoiceCopy.toUpperCase(), rightEdge - copyWidth - 3, y + 2.2);

  y += 5;

  // Header separator line
  doc.setDrawColor(...darkCharcoal);
  doc.setLineWidth(0.4);
  doc.line(margin, y, rightEdge, y);

  y += 5;

  // 2. Company Header (Left) & GSTIN / Registration (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...darkCharcoal);
  doc.text(business?.businessName || 'TPS BATTERYS HOUSE', margin, y + 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...amberAccent);
  doc.text((business?.tagline || '').toUpperCase(), margin, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);
  doc.text(`${business?.addressLine1 || ''}, ${business?.roadStreet || ''}`, margin, y + 8.5);
  doc.text(
    `${business?.cityDistrict || ''}, ${business?.state || 'Kerala'} - ${business?.pinCode || ''}`,
    margin,
    y + 12
  );
  doc.text(
    `Phone: ${business?.phone || ''}${business?.altPhone ? ' | ' + business.altPhone : ''}${business?.email ? ' | ' + business.email : ''}`,
    margin,
    y + 15.5
  );

  // Right: GSTIN & PAN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...mutedText);
  doc.text('GSTIN / UIN', rightEdge, y, { align: 'right' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...darkCharcoal);
  doc.text(business?.gstin || '', rightEdge, y + 4.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);
  doc.text(
    `State: ${business?.state || 'Kerala'} (Code: ${business?.stateCode || '32'})`,
    rightEdge,
    y + 8.5,
    { align: 'right' }
  );
  const pan = (business?.gstin || '').length >= 12 ? business.gstin.slice(2, 12) : '—';
  doc.text(`PAN: ${pan}`, rightEdge, y + 12, { align: 'right' });

  y += 18;

  // Divider line
  doc.setDrawColor(...lightGreyBorder);
  doc.setLineWidth(0.2);
  doc.line(margin, y, rightEdge, y);

  y += 3;

  // 3. Invoice Particulars (Left) & Buyer Details (Right)
  const colWidth = (contentWidth - 6) / 2;
  const rightColX = margin + colWidth + 6;

  // Left Box: Particulars
  doc.setFillColor(...subtleFill);
  doc.rect(margin, y, colWidth, 26, 'F');
  doc.setDrawColor(...lightGreyBorder);
  doc.rect(margin, y, colWidth, 26, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkCharcoal);
  doc.text('INVOICE PARTICULARS', margin + 3, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const particulars = [
    ['Invoice No:', invoice.invoiceNumber || '—'],
    ['Invoice Date:', invoice.invoiceDate || '—'],
    ['Payment Mode:', invoice.paymentMode || 'Cash'],
    ['Place of Supply:', invoice.placeOfSupply || 'Kerala (32)'],
    ['Reverse Charge:', invoice.reverseCharge || 'No'],
  ];

  particulars.forEach(([lbl, val], idx) => {
    const rowY = y + 8 + idx * 3.5;
    doc.setTextColor(...mutedText);
    doc.text(lbl, margin + 3, rowY);
    doc.setTextColor(...darkCharcoal);
    doc.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
    doc.text(val, margin + 32, rowY);
    doc.setFont('helvetica', 'normal');
  });

  // Right Box: Buyer / Billed To
  doc.setFillColor(255, 255, 255);
  doc.rect(rightColX, y, colWidth, 26, 'F');
  doc.setDrawColor(...lightGreyBorder);
  doc.rect(rightColX, y, colWidth, 26, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkCharcoal);
  doc.text('BILLED TO / BUYER', rightColX + 3, y + 4);

  const isB2b = Boolean(invoice.customer?.gstin);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedText);
  doc.text(isB2b ? 'B2B (Registered)' : 'B2C (Consumer)', rightEdge - 3, y + 4, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkCharcoal);
  doc.text(invoice.customer?.name || 'Cash Customer', rightColX + 3, y + 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...mutedText);
  let custY = y + 12;
  if (invoice.customer?.phone) {
    doc.text(`Mobile: +91 ${invoice.customer.phone}`, rightColX + 3, custY);
    custY += 3.5;
  }
  const custAddr = [
    invoice.customer?.address,
    invoice.customer?.city,
    invoice.customer?.district,
    invoice.customer?.state || 'Kerala',
  ]
    .filter(Boolean)
    .join(', ');
  const fullAddr = custAddr + (invoice.customer?.pincode ? ` - ${invoice.customer.pincode}` : '');

  const splitAddr = doc.splitTextToSize(fullAddr, colWidth - 6);
  doc.text(splitAddr.slice(0, 2), rightColX + 3, custY);
  custY += splitAddr.slice(0, 2).length * 3.5;

  let stateLine = `State Code: ${invoice.customer?.stateCode || '32'}`;
  if (invoice.customer?.gstin) {
    stateLine += ` | GSTIN: ${invoice.customer.gstin}`;
  }
  doc.text(stateLine, rightColX + 3, custY);

  y += 29;

  // 4. Products & Services Table
  y += drawTableHeader(y);

  const descColW = totals.isInterstate ? 66 : 64;

  totals.computedItems.forEach((item, idx) => {
    const specsText = formatItemSpecifications(item);
    const hasSpecs = Boolean(specsText);
    const hasNotes = Boolean(item.serialNo || item.warranty);
    const descLines = doc.splitTextToSize(item.name || '', descColW - 3);
    const specsLines = hasSpecs ? doc.splitTextToSize(specsText, descColW - 3) : [];
    const rowHeight = Math.max(
      7,
      descLines.length * 3.4 + (hasSpecs ? specsLines.length * 2.8 : 0) + (hasNotes ? 3.0 : 0) + 2.5
    );

    // Check pagination: if next item would collide with bottom
    if (y + rowHeight + 15 > pageHeight - margin) {
      doc.addPage();
      y = margin;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...mutedText);
      doc.text(
        `${business?.businessName || 'TPS BATTERYS HOUSE'} | INVOICE ${invoice.invoiceNumber || ''} (Continuation)`,
        margin,
        y + 3
      );
      y += 6;
      y += drawTableHeader(y);
    }

    const rowStartY = y;
    doc.setDrawColor(...lightGreyBorder);
    doc.setLineWidth(0.2);
    doc.rect(margin, rowStartY, contentWidth, rowHeight, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...darkCharcoal);

    let cellX = margin;

    // #
    doc.text(String(idx + 1), cellX + 4, rowStartY + 3.8, { align: 'center' });
    cellX += 8;

    // Description & Technical Specifications
    doc.setFont('helvetica', 'bold');
    doc.text(descLines, cellX + 1.5, rowStartY + 3.8);

    let currentLineY = rowStartY + 3.8 + descLines.length * 3.2;

    if (hasSpecs) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(...darkCharcoal);
      doc.text(specsLines, cellX + 1.5, currentLineY);
      currentLineY += specsLines.length * 2.8;
    }

    if (hasNotes) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.0);
      doc.setTextColor(...mutedText);
      const noteParts = [];
      if (item.serialNo) noteParts.push(`SN: ${item.serialNo}`);
      if (item.warranty) noteParts.push(`Warranty: ${item.warranty}`);
      doc.text(noteParts.join(' | '), cellX + 1.5, currentLineY);
    }
    cellX += descColW;

    // HSN
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...darkCharcoal);
    doc.text(item.hsn || '8507', cellX + 7, rowStartY + 3.8, { align: 'center' });
    cellX += 14;

    // Qty
    doc.text(`${item.qty} ${item.unit || 'Nos'}`, cellX + 6, rowStartY + 3.8, { align: 'center' });
    cellX += 12;

    // Rate
    doc.text(formatNumber(item.rate), cellX + 20 - 1.5, rowStartY + 3.8, { align: 'right' });
    cellX += 20;

    // Taxable
    doc.text(formatNumber(item.taxableValue), cellX + 20 - 1.5, rowStartY + 3.8, { align: 'right' });
    cellX += 20;

    // CGST & SGST or IGST
    if (!totals.isInterstate) {
      doc.text(formatNumber(item.cgstAmount), cellX + 15 - 1.5, rowStartY + 3.8, { align: 'right' });
      cellX += 15;
      doc.text(formatNumber(item.sgstAmount), cellX + 15 - 1.5, rowStartY + 3.8, { align: 'right' });
      cellX += 15;
    } else {
      doc.text(formatNumber(item.igstAmount), cellX + 22 - 1.5, rowStartY + 3.8, { align: 'right' });
      cellX += 22;
    }

    // Line Total
    doc.setFont('helvetica', 'bold');
    const amtW = totals.isInterstate ? 24 : 18;
    doc.text(formatNumber(item.lineTotal), cellX + amtW - 1.5, rowStartY + 3.8, { align: 'right' });

    y += rowHeight;
  });

  // Table Subtotal Footer Row
  doc.setFillColor(...subtleFill);
  doc.rect(margin, y, contentWidth, 5.5, 'F');
  doc.setDrawColor(...lightGreyBorder);
  doc.rect(margin, y, contentWidth, 5.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...darkCharcoal);
  doc.text('ITEM TOTALS', margin + 86, y + 3.8, { align: 'right' });

  const totalQty = totals.computedItems.reduce((acc, it) => acc + it.qty, 0);
  doc.text(String(totalQty), margin + 8 + descColW + 14 + 6, y + 3.8, { align: 'center' });
  doc.text(
    formatNumber(totals.totalTaxableValue),
    margin + 8 + descColW + 14 + 12 + 20 + 20 - 1.5,
    y + 3.8,
    { align: 'right' }
  );

  let footX = margin + 8 + descColW + 14 + 12 + 20 + 20;
  if (!totals.isInterstate) {
    doc.text(formatNumber(totals.totalCgst), footX + 15 - 1.5, y + 3.8, { align: 'right' });
    footX += 15;
    doc.text(formatNumber(totals.totalSgst), footX + 15 - 1.5, y + 3.8, { align: 'right' });
    footX += 15;
    doc.text(formatNumber(totals.totalGross), footX + 18 - 1.5, y + 3.8, { align: 'right' });
  } else {
    doc.text(formatNumber(totals.totalIgst), footX + 22 - 1.5, y + 3.8, { align: 'right' });
    footX += 22;
    doc.text(formatNumber(totals.totalGross), footX + 24 - 1.5, y + 3.8, { align: 'right' });
  }

  y += 7.5;

  // Check if remaining blocks fit on current page; if not, add page
  const remainingBlocksNeeded = 80;
  if (y + remainingBlocksNeeded > pageHeight - margin) {
    doc.addPage();
    y = margin + 4;
  }

  // 5. Middle Split: HSN Summary & Bank/QR (Left) & Totals (Right)
  const midLeftW = 104;
  const midRightW = contentWidth - midLeftW - 4; // 78mm
  const midRightX = margin + midLeftW + 4;
  const midStartY = y;

  // --- Left: HSN Summary Table ---
  doc.setFillColor(...subtleFill);
  doc.rect(margin, y, midLeftW, 4, 'F');
  doc.setDrawColor(...lightGreyBorder);
  doc.rect(margin, y, midLeftW, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...darkCharcoal);
  doc.text('GST TAX COMPUTATION SUMMARY (HSN/SAC WISE)', margin + 2, y + 2.8);

  y += 4;

  const hsnCols = [
    { name: 'HSN/SAC', w: 26, align: 'left' },
    { name: 'TAXABLE VAL', w: 22, align: 'right' },
    ...(totals.isInterstate
      ? [{ name: 'IGST', w: 26, align: 'right' }]
      : [
          { name: 'CGST', w: 18, align: 'right' },
          { name: 'SGST', w: 18, align: 'right' },
        ]),
    { name: 'TOTAL TAX', w: totals.isInterstate ? 30 : 20, align: 'right' },
  ];

  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, midLeftW, 4, 'F');
  doc.rect(margin, y, midLeftW, 4, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(...mutedText);

  let hX = margin;
  hsnCols.forEach((c) => {
    const textX = c.align === 'right' ? hX + c.w - 1 : hX + 1;
    doc.text(c.name, textX, y + 2.8, { align: c.align });
    hX += c.w;
  });

  y += 4;

  totals.hsnSummary.forEach((h) => {
    doc.rect(margin, y, midLeftW, 4, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...darkCharcoal);

    let rowX = margin;
    doc.text(`${h.hsn} (${h.gstRate}%)`, rowX + 1, y + 2.8);
    rowX += 26;
    doc.text(formatNumber(h.taxableValue), rowX + 22 - 1, y + 2.8, { align: 'right' });
    rowX += 22;

    if (!totals.isInterstate) {
      doc.text(formatNumber(h.cgstAmount), rowX + 18 - 1, y + 2.8, { align: 'right' });
      rowX += 18;
      doc.text(formatNumber(h.sgstAmount), rowX + 18 - 1, y + 2.8, { align: 'right' });
      rowX += 18;
    } else {
      doc.text(formatNumber(h.igstAmount), rowX + 26 - 1, y + 2.8, { align: 'right' });
      rowX += 26;
    }

    doc.setFont('helvetica', 'bold');
    const totW = totals.isInterstate ? 30 : 20;
    doc.text(formatNumber(h.totalTax), rowX + totW - 1, y + 2.8, { align: 'right' });

    y += 4;
  });

  y += 2.5;

  // --- Left: Bank & UPI Payment Block ---
  const bankBlockY = y;
  doc.setDrawColor(...lightGreyBorder);
  doc.rect(margin, bankBlockY, midLeftW, 28, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...darkCharcoal);
  doc.text('BANK PAYMENT DETAILS', margin + 3, bankBlockY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const bankRows = [
    ['Bank Name:', business?.bankName || ''],
    ['Account No:', business?.accountNo || ''],
    ['Account Name:', business?.accountName || ''],
    ['IFSC Code:', business?.ifsc || ''],
    ['Branch:', business?.branch || ''],
  ];

  bankRows.forEach(([lbl, val], idx) => {
    const rowY = bankBlockY + 8 + idx * 3.4;
    doc.setTextColor(...mutedText);
    doc.text(lbl, margin + 3, rowY);
    doc.setTextColor(...darkCharcoal);
    doc.setFont('helvetica', idx === 1 || idx === 3 ? 'bold' : 'normal');
    doc.text(val, margin + 24, rowY);
    doc.setFont('helvetica', 'normal');
  });

  // Embed QR code on right of bank box
  if (qrDataUrl) {
    const qrX = margin + midLeftW - 25;
    const qrY = bankBlockY + 2.5;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, 21, 21);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...darkCharcoal);
    doc.text('SCAN TO PAY (UPI)', qrX + 10.5, bankBlockY + 26.2, { align: 'center' });
  }

  // --- Right Column: Totals Breakdown ---
  const rightY = midStartY;
  doc.setDrawColor(...lightGreyBorder);
  doc.rect(midRightX, rightY, midRightW, 46.5, 'S');

  const summaryRows = [
    ['Total Taxable Value:', formatNumber(totals.totalTaxableValue)],
    [`Total GST (${totals.isInterstate ? 'IGST' : 'CGST+SGST'}):`, formatNumber(totals.totalTax)],
    ['Gross Invoice Amount:', formatNumber(totals.totalGross)],
  ];

  if (totals.scrapDiscount > 0) {
    summaryRows.push(['Old Battery Scrap Buyback:', `- Rs. ${formatNumber(totals.scrapDiscount)}`]);
  }
  if (totals.extraDiscount > 0) {
    summaryRows.push(['Special Discount:', `- Rs. ${formatNumber(totals.extraDiscount)}`]);
  }
  const roundSign = totals.roundOff >= 0 ? '+' : '-';
  summaryRows.push(['Round Off:', `${roundSign} Rs. ${formatNumber(Math.abs(totals.roundOff))}`]);

  summaryRows.forEach(([lbl, val], idx) => {
    const rY = rightY + 4 + idx * 4.2;
    doc.setFont('helvetica', idx === 2 ? 'bold' : 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...(idx >= 3 && val.includes('-') ? amberAccent : mutedText));
    doc.text(lbl, midRightX + 3, rY);
    doc.setTextColor(...darkCharcoal);
    doc.text(`Rs. ${val.replace(/^[+-]\s*Rs\.\s*/, '')}`, rightEdge - 3, rY, { align: 'right' });
  });

  // Net Payable Amount Box
  const netBoxY = rightY + 28;
  doc.setFillColor(...darkCharcoal);
  doc.rect(midRightX, netBoxY, midRightW, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('NET PAYABLE AMOUNT', midRightX + 3, netBoxY + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(203, 213, 225);
  doc.text('(Inclusive of all taxes)', midRightX + 3, netBoxY + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(`Rs. ${formatNumber(totals.netPayable)}`, rightEdge - 3, netBoxY + 6.8, { align: 'right' });

  // Amount In Words
  const wordsBoxY = rightY + 39;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...darkCharcoal);
  doc.text('Amount in Words:', midRightX + 3, wordsBoxY + 2.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...mutedText);
  const wordsLines = doc.splitTextToSize(totals.amountInWords || '', midRightW - 6);
  doc.text(wordsLines.slice(0, 2), midRightX + 3, wordsBoxY + 5.5);

  y = Math.max(bankBlockY + 30, rightY + 48.5);

  // 6. Bottom Section: Declarations, Terms & Signatures
  doc.setDrawColor(...lightGreyBorder);
  doc.line(margin, y, rightEdge, y);
  y += 3;

  const footLeftW = 120;
  const footRightW = contentWidth - footLeftW - 6; // 60mm
  const footRightX = margin + footLeftW + 6;
  const footStartY = y;

  // Statutory Declaration
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...darkCharcoal);
  doc.text('STATUTORY DECLARATION:', margin, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...mutedText);
  const declText =
    '"Certified that all particulars shown in this tax invoice are true and correct, and that our registration under the GST Act 2017 is valid as on the date of this bill."';
  const declLines = doc.splitTextToSize(declText, footLeftW);
  doc.text(declLines, margin, y + 5);

  y += 5 + declLines.length * 3;

  // Terms & Conditions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...darkCharcoal);
  doc.text('TERMS & CONDITIONS:', margin, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...mutedText);
  const termsList = business?.terms || [];
  let termY = y + 5;
  termsList.slice(0, 4).forEach((term, idx) => {
    const cleanTerm = term.replace(/^\d+\.\s*/, '');
    const termLines = doc.splitTextToSize(`${idx + 1}. ${cleanTerm}`, footLeftW);
    doc.text(termLines, margin, termY);
    termY += termLines.length * 2.8;
  });

  // Right: Signature Blocks
  let sigY = footStartY;
  doc.setDrawColor(...lightGreyBorder);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(footRightX, sigY + 12, rightEdge, sigY + 12);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedText);
  doc.text('Customer Signature', footRightX + footRightW / 2, sigY + 15, { align: 'center' });

  sigY += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkCharcoal);
  doc.text(`For ${business?.businessName || 'TPS BATTERYS HOUSE'}`, footRightX + footRightW / 2, sigY, {
    align: 'center',
  });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.2);
  doc.setTextColor(...mutedText);
  doc.text('[Authorized Signatory / Stamp]', footRightX + footRightW / 2, sigY + 6, {
    align: 'center',
  });

  doc.setDrawColor(...darkCharcoal);
  doc.setLineWidth(0.3);
  doc.line(footRightX + 5, sigY + 11, rightEdge - 5, sigY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...darkCharcoal);
  doc.text('Authorized Signatory', footRightX + footRightW / 2, sigY + 14, { align: 'center' });

  // 7. Bottom Watermark & Page Numbering across all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const bottomY = pageHeight - margin + 2;

    doc.setDrawColor(...lightGreyBorder);
    doc.setLineWidth(0.2);
    doc.line(margin, bottomY, rightEdge, bottomY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...mutedText);
    doc.text('Generated via TPS BATTERYS HOUSE GST Billing System', margin, bottomY + 3.2);

    if (totalPages > 1) {
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, bottomY + 3.2, { align: 'center' });
    }

    doc.text('Subject to Thrithala / Palakkad Jurisdiction', rightEdge, bottomY + 3.2, {
      align: 'right',
    });
  }

  return doc;
}

/**
 * Optimized fallback canvas capture with JPEG compression to guarantee small file sizes (<400 KB).
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
      scale: 1.8, // Balanced high-DPI scaling
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
    });

    element.style.boxShadow = originalShadow;

    // Use JPEG 0.88 compression instead of raw PNG
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
 * Prioritizes fast vector/text generation if invoice & business objects are supplied,
 * falling back gracefully to optimized canvas capture.
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
      options.invoiceCopy || 'Original for Recipient'
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
