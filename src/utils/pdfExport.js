import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports the invoice DOM element into an A4 PDF document.
 * Configured with high scale multiplier for crisp text and barcodes/QR codes.
 */
export async function downloadInvoicePdf(elementId, invoiceNumber = 'Invoice', customerName = '') {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Invoice preview element not found.');
  }

  // Temporarily ensure high visibility and standard width for capture
  const originalShadow = element.style.boxShadow;
  element.style.boxShadow = 'none';

  try {
    const canvas = await html2canvas(element, {
      scale: 2.2, // High resolution for crisp print lines & fonts
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      onclone: (clonedDoc) => {
        // Ensure no animations or print-hidden classes affect the cloned doc
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          clonedElement.style.margin = '0';
          clonedElement.style.padding = '12px';
        }
      },
    });

    element.style.boxShadow = originalShadow;

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = 210; // mm
    const pageHeight = 297; // mm
    const margin = 5; // mm margin
    const contentWidth = pageWidth - margin * 2;
    
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    if (imgHeight <= pageHeight - margin * 2) {
      // Single page fit
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight);
    } else {
      // Multi-page slicing if invoice has many line items
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    const sanitizedInvNo = (invoiceNumber || 'Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedCustomer = (customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `TPS_${sanitizedInvNo}_${sanitizedCustomer}.pdf`;

    pdf.save(fileName);
    return fileName;
  } catch (error) {
    element.style.boxShadow = originalShadow;
    console.error('Error generating PDF:', error);
    throw error;
  }
}
