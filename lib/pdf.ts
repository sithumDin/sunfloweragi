import jsPDF from 'jspdf';
import { Sale } from './types';

// ─── IMAGE COMPRESSION HELPER ─────────────────────────────────────────────
async function compressImage(base64String: string, maxWidth: number = 500, quality: number = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Resize if larger than maxWidth
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64String); // fallback
    img.src = base64String;
  });
}

// Company Details
const COMPANY = {
  name: 'SUNFLOWER AGRI',
  tagline: 'Agri Business',
  address: 'Makandura Gonawila',
  phone1: '077 298 4749',
  phone2: '076 180 9833',
  country: 'Sri Lanka',
  bankName: 'ABC Bank',
  bankBranch: 'Colombo',
  accountName: 'Sample Account',
  accountNo: '1234567890',
  website: '',
  facebook: '',
  instagram: '',
};

function openPdfPreview(doc: jsPDF, fileName: string) {
  if (typeof window === 'undefined') {
    doc.save(fileName);
    return;
  }

  const blobUrl = doc.output('bloburl');
  const previewWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');

  // Fallback if popup is blocked by the browser.
  if (!previewWindow) {
    doc.save(fileName);
  }
}

async function getLogoAsBase64(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;
    const sources = ['/uploads/logo.png', '/api/logo'];

    for (const source of sources) {
      const response = await fetch(source);

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('image/')) {
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        // Compress the image before returning
        return await compressImage(base64, 400, 0.6);
      }

      const data = await response.json();
      if (data.url) {
        const img = await fetch(data.url);
        if (!img.ok) continue;
        const blob = await img.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        // Compress the image before returning
        return await compressImage(base64, 400, 0.6);
      }
    }
  } catch (error) {
    console.error('Failed to load logo:', error);
  }
  return null;
}

async function addHeaderWithBrandingAndLogo(doc: jsPDF, w: number, y: number, logoBase64?: string | null) {
  let currentY = y;
  
  // Add logo if available
  if (logoBase64) {
    try {
      const logoHeight = 12;
      const logoWidth = 15;
      const logoX = w / 2 - logoWidth / 2;
      doc.addImage(logoBase64, 'PNG', logoX, currentY, logoWidth, logoHeight);
      currentY += logoHeight + 2;
    } catch (error) {
      console.error('Failed to add logo to PDF:', error);
    }
  }
  
  // Company name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 120, 60);
  doc.text(COMPANY.name, w / 2, currentY, { align: 'center' });
  currentY += 5;
  
  // Tagline
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(COMPANY.tagline, w / 2, currentY, { align: 'center' });
  currentY += 3;
  
  // Address
  doc.setFontSize(8);
  doc.text(COMPANY.address, w / 2, currentY, { align: 'center' });
  currentY += 3;
  
  // Phone numbers
  doc.setFontSize(7);
  doc.text(`Tel: ${COMPANY.phone1}`, w / 2, currentY, { align: 'center' });
  currentY += 2;
  doc.text(`${COMPANY.phone2}`, w / 2, currentY, { align: 'center' });
  currentY += 3;
  doc.text(COMPANY.country, w / 2, currentY, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  return currentY + 3;
}

function addHeaderWithBranding(doc: jsPDF, w: number, y: number) {
  // Company name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 120, 60);
  doc.text(COMPANY.name, w / 2, y, { align: 'center' });
  y += 5;
  
  // Tagline
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(COMPANY.tagline, w / 2, y, { align: 'center' });
  y += 3;
  
  // Address
  doc.setFontSize(8);
  doc.text(COMPANY.address, w / 2, y, { align: 'center' });
  y += 3;
  
  // Phone numbers
  doc.setFontSize(7);
  doc.text(`Tel: ${COMPANY.phone1} | ${COMPANY.phone2}`, w / 2, y, { align: 'center' });
  y += 3;
  doc.text(COMPANY.country, w / 2, y, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  return y + 3;
}

export function generateReceiptText(sale: Sale): string {
  const isWholesale = sale.saleType === 'wholesale';
  const receiptTitle = isWholesale ? 'Wholesale Receipt' : 'Retail Receipt';
  const receiptSubtitle = isWholesale ? 'Business Supply / Credit Sale' : 'Customer Purchase Receipt';
  const footerLine = isWholesale ? 'Thank you for your wholesale business!' : 'Thank you for your purchase!';
  const div = '─'.repeat(32);

  const lines: string[] = [
    COMPANY.name,
    COMPANY.tagline,
    COMPANY.address,
    `Tel: ${COMPANY.phone1} | ${COMPANY.phone2}`,
    COMPANY.country,
    div,
    receiptTitle,
    receiptSubtitle,
    div,
    `Invoice:    ${sale.invoiceNo}`,
    `Date:       ${new Date(sale.date).toLocaleDateString('en-LK')}`,
    `Time:       ${new Date(sale.date).toLocaleTimeString('en-LK')}`,
    `Customer:   ${sale.customerName || (isWholesale ? 'Wholesale Customer' : 'Walk-in Customer')}`,
    `Type:       ${sale.saleType.toUpperCase()}`,
    `Payment:    ${sale.paymentMethod.toUpperCase()}`,
    `Served By:  ${sale.cashierName || 'Cashier'}`,
    div,
    'Item                    Qty   Price      Total',
    '─'.repeat(46),
  ];

  for (const item of sale.items) {
    const name = item.productName.length > 22 ? `${item.productName.substring(0, 22)}..` : item.productName.padEnd(24);
    lines.push(`${name}  ${String(item.qty).padStart(3)}   ${item.unitPrice.toFixed(2).padStart(8)}   ${item.total.toFixed(2).padStart(8)}`);
  }

  lines.push(div);
  lines.push(`Subtotal:                          LKR ${sale.subtotal.toFixed(2)}`);

  if (sale.discount && sale.discount > 0) {
    lines.push(`Discount:                         -LKR ${sale.discount.toFixed(2)}`);
  }

  const effectiveOther = Math.max(0, sale.total - (sale.subtotal - (sale.discount || 0)));
  if (effectiveOther > 0.005) {
    const chargeLabel = (sale.otherChargesDescription?.trim() || 'Other Charges').padEnd(26);
    lines.push(`${chargeLabel}         +LKR ${effectiveOther.toFixed(2)}`);
  }

  lines.push('═'.repeat(46));
  lines.push(`*TOTAL:                            LKR ${sale.total.toFixed(2)}*`);
  lines.push('═'.repeat(46));
  lines.push('');
  lines.push(footerLine);
  lines.push('We appreciate your continued support.');
  lines.push(div);
  lines.push('Return Policy:');
  lines.push('Items may be returned within 7 days with original');
  lines.push('receipt. Perishable goods are non-refundable.');
  lines.push(div);
  lines.push('Find us online:');
  if (COMPANY.website) lines.push(COMPANY.website);
  if (COMPANY.facebook) lines.push(COMPANY.facebook);
  if (COMPANY.instagram) lines.push(COMPANY.instagram);
  if (isWholesale) {
    lines.push(div);
    lines.push('Wholesale rates applied.');
  }

  return lines.join('\n');
}

export async function generateReceipt(sale: Sale) {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200], compress: true });
  const w = 80;
  let y = 6;
  const isWholesale = sale.saleType === 'wholesale';
  const receiptTitle = isWholesale ? 'Wholesale Receipt' : 'Retail Receipt';
  const receiptSubtitle = isWholesale ? 'Business Supply / Credit Sale' : 'Customer Purchase Receipt';
  const footerLine = isWholesale ? 'Thank you for your wholesale business!' : 'Thank you for your purchase!';

  // Try to load and compress logo
  let logoBase64: string | null = null;
  try {
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/logo');
      if (response.ok) {
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        logoBase64 = await compressImage(base64, 300, 0.5);
      }
    }
  } catch (error) {
    console.error('Failed to load logo for receipt:', error);
  }

  // ─── LOGO + CONTACT INFO ──────────────────────────────────────────────────
  if (logoBase64) {
    try {
      // Logo centered - it already contains the company name & tagline visually
      const logoW = 40;
      const logoH = 26;
      const logoX = (w - logoW) / 2;
      doc.addImage(logoBase64, 'PNG', logoX, y, logoW, logoH);
      y += logoH + 4;

      // Only show contact details below the logo (NO repeated name/tagline)
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Tel: ${COMPANY.phone1} | ${COMPANY.phone2}`, w / 2, y, { align: 'center' });
      y += 3;
      doc.text(COMPANY.country, w / 2, y, { align: 'center' });
      y += 3;

      doc.setTextColor(0, 0, 0);
    } catch (error) {
      console.error('Failed to add logo to receipt:', error);
      y = await addHeaderWithBranding(doc, w, y); // fallback
    }
  } else {
    // No logo - show full text header
    y = await addHeaderWithBranding(doc, w, y);
  }

  doc.setLineWidth(0.3);
  doc.setDrawColor(40, 120, 60);
  doc.line(5, y, w - 5, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 120, 60);
  doc.text(receiptTitle, w / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text(receiptSubtitle, w / 2, y, { align: 'center' });
  y += 5;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7.5);

  const labelX = 5;
  const valueX = w - 5;
  const printRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, valueX, y, { align: 'right' });
    y += 4;
  };

  printRow('Invoice:', sale.invoiceNo);
  printRow('Date:', new Date(sale.date).toLocaleDateString('en-LK'));
  printRow('Time:', new Date(sale.date).toLocaleTimeString('en-LK'));
  printRow(
    'Customer:',
    sale.customerName || (isWholesale ? 'Wholesale Customer' : 'Walk-in Customer')
  );
  printRow('Type:', sale.saleType.toUpperCase());
  printRow('Payment:', sale.paymentMethod.toUpperCase());
  printRow('Served By:', sale.cashierName || 'Cashier');

  doc.setDrawColor(40, 120, 60);
  doc.line(5, y, w - 5, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(40, 120, 60);
  doc.text('Item', 5, y);
  doc.text('Qty', 40, y, { align: 'center' });
  doc.text('Price', 55, y, { align: 'right' });
  doc.text('Total', w - 5, y, { align: 'right' });
  y += 3;

  doc.setDrawColor(150, 150, 150);
  doc.line(5, y, w - 5, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  for (const item of sale.items) {
    const name = item.productName.length > 18 ? `${item.productName.substring(0, 18)}..` : item.productName;
    doc.text(name, 5, y);
    doc.text(String(item.qty), 40, y, { align: 'center' });
    doc.text(item.unitPrice.toFixed(2), 55, y, { align: 'right' });
    doc.text(item.total.toFixed(2), w - 5, y, { align: 'right' });
    y += 4;
  }

  y += 2;
  doc.setDrawColor(40, 120, 60);
  doc.line(5, y, w - 5, y);
  y += 4;

  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 5, y);
  doc.text(`LKR ${sale.subtotal.toFixed(2)}`, w - 5, y, { align: 'right' });
  y += 4;

  if (sale.discount && sale.discount > 0) {
    doc.text('Discount:', 5, y);
    doc.text(`-LKR ${sale.discount.toFixed(2)}`, w - 5, y, { align: 'right' });
    y += 4;
  }

  const expectedSubtotal = sale.subtotal - (sale.discount || 0);
  const effectiveOther = Math.max(0, sale.total - expectedSubtotal);

  if (effectiveOther > 0.005) {
    const chargeLabel = sale.otherChargesDescription?.trim() || 'Other Charges';
    doc.text(`${chargeLabel}:`, 5, y);
    doc.text(`+LKR ${effectiveOther.toFixed(2)}`, w - 5, y, { align: 'right' });
    y += 4;
  }

  y += 2;
  doc.setDrawColor(40, 120, 60);
  doc.setLineWidth(0.5);
  doc.line(5, y, w - 5, y);
  y += 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 120, 60);
  doc.text('TOTAL:', 5, y);
  doc.text(`LKR ${sale.total.toFixed(2)}`, w - 5, y, { align: 'right' });


  doc.setDrawColor(40, 120, 60);
  doc.setLineWidth(0.4);
  doc.line(5, y, w - 5, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 120, 60);
  doc.text(footerLine, w / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(80, 80, 80);
  doc.text('We appreciate your continued support.', w / 2, y, { align: 'center' });
  y += 5;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(5, y, w - 5, y);
  y += 4;

  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'bold');
  doc.text('Return Policy:', w / 2, y, { align: 'center' });
  y += 3;
  doc.setFont('helvetica', 'normal');
  const policy = 'Items may be returned within 7 days with original receipt. Perishable goods are non-refundable.';
  const policyLines = doc.splitTextToSize(policy, w - 12);
  doc.text(policyLines, w / 2, y, { align: 'center' });
  y += policyLines.length * 3.5 + 4;

  doc.setDrawColor(180, 180, 180);
  doc.line(5, y, w - 5, y);
  y += 4;

  doc.setFontSize(6.5);
  doc.setTextColor(40, 120, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('Find us online:', w / 2, y, { align: 'center' });
  y += 3;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(COMPANY.website ?? 'www.yourwebsite.lk', w / 2, y, { align: 'center' });
  y += 3;
  doc.text(COMPANY.facebook ?? 'fb.com/YourPage', w / 2, y, { align: 'center' });
  y += 3;
  doc.text(COMPANY.instagram ?? '@YourHandle', w / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(6);
  doc.setTextColor(180, 180, 180);
  doc.text(COMPANY.name, w / 2, y, { align: 'center' });

  if (isWholesale) {
    y += 4;
    doc.setTextColor(150, 150, 150);
    doc.text('Wholesale rates applied.', w / 2, y, { align: 'center' });
  }

  openPdfPreview(doc, `receipt-${sale.invoiceNo}.pdf`);
}

export async function printReceiptDirect(sale: Sale): Promise<void> {
  // ── Primary: QZ Tray → zero-dialog direct thermal print ─────────────────
  try {
    const { printWithQZ } = await import('./qz-print');
    await printWithQZ(sale);
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Only fall back silently if QZ simply isn't running
    if (!msg.includes('Unable to establish connection') && !msg.includes('QZ Tray')) {
      throw err; // real error (e.g. printer offline) — surface it
    }
    console.warn('[QZ] Not available, falling back to browser print:', msg);
  }

  // ── Fallback: HTML iframe + window.print() ───────────────────────────────
  const isWholesale = sale.saleType === 'wholesale';
  const receiptTitle = isWholesale ? 'Wholesale Receipt' : 'Retail Receipt';
  const receiptSubtitle = isWholesale ? 'Business Supply / Credit Sale' : 'Customer Purchase Receipt';
  const footerLine = isWholesale ? 'Thank you for your wholesale business!' : 'Thank you for your purchase!';

  let logoHtml = '';
  try {
    const res = await fetch('/api/logo');
    if (res.ok && res.headers.get('content-type')?.includes('image/')) {
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      logoHtml = `<img src="${dataUrl}" class="logo" />`;
    }
  } catch { /* no logo */ }

  const effectiveOther = Math.max(0, sale.total - (sale.subtotal - (sale.discount || 0)));

  const itemRows = sale.items.map(item => `
    <tr>
      <td class="item-name">${item.productName}</td>
      <td class="center">${item.qty}</td>
      <td class="right">${item.unitPrice.toFixed(2)}</td>
      <td class="right">${item.total.toFixed(2)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:9px;width:54mm;padding:2mm 1mm;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.center{text-align:center}
.right{text-align:right}
.logo{max-width:44mm;display:block;margin:0 auto 4px}
.contact{font-size:9px;color:#555;margin-bottom:1px}
.divider-green{border:none;border-top:1.5px solid #28783c;margin:5px 0}
.divider-gray{border:none;border-top:1px solid #ccc;margin:4px 0}
.receipt-title{color:#28783c;font-size:13px;font-weight:bold;margin:3px 0 1px}
.receipt-subtitle{color:#888;font-size:9px;margin-bottom:4px}
.info-table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:2px}
.info-table td{padding:1.5px 0}
.info-table .lbl{font-weight:bold}
.info-table .val{text-align:right}
.items-table{width:100%;border-collapse:collapse;font-size:10px;margin:2px 0}
.items-table th{color:#28783c;font-weight:bold;padding:2px 0;border-bottom:1px solid #28783c}
.items-table th.center{text-align:center}
.items-table th.right{text-align:right}
.items-table td{padding:2.5px 0;vertical-align:top;border-bottom:1px solid #eee}
.items-table .item-name{text-align:left}
.sub-table{width:100%;border-collapse:collapse;font-size:10px;margin-top:3px}
.sub-table td{padding:1.5px 0}
.sub-table .val{text-align:right}
.total-row{font-size:13px;font-weight:bold;color:#28783c;border-top:2px solid #28783c;padding-top:3px}
.thankyou{color:#28783c;font-size:12px;font-weight:bold;margin:4px 0 1px}
.support{color:#666;font-size:9px}
.policy-title{font-weight:bold;font-size:9px}
.policy-text{color:#666;font-size:9px}
.online-title{color:#28783c;font-weight:bold;font-size:9px}
.watermark{color:#ccc;font-size:8px;margin-top:6px}
@media print{
  body{width:58mm;padding:1mm}
  @page{size:58mm auto;margin:0}
}
</style></head><body>
<div class="center">
  ${logoHtml}
  <div class="contact">Tel: ${COMPANY.phone1} | ${COMPANY.phone2}</div>
  <div class="contact">${COMPANY.country}</div>
</div>
<hr class="divider-green"/>
<div class="center">
  <div class="receipt-title">${receiptTitle}</div>
  <div class="receipt-subtitle">${receiptSubtitle}</div>
</div>
<table class="info-table">
  <tr><td class="lbl">Invoice:</td><td class="val">${sale.invoiceNo}</td></tr>
  <tr><td class="lbl">Date:</td><td class="val">${new Date(sale.date).toLocaleDateString('en-LK')}</td></tr>
  <tr><td class="lbl">Time:</td><td class="val">${new Date(sale.date).toLocaleTimeString('en-LK')}</td></tr>
  <tr><td class="lbl">Customer:</td><td class="val">${sale.customerName || (isWholesale ? 'Wholesale Customer' : 'Walk-in Customer')}</td></tr>
  <tr><td class="lbl">Payment:</td><td class="val">${sale.paymentMethod.toUpperCase()}</td></tr>
  <tr><td class="lbl">Served By:</td><td class="val">${sale.cashierName || 'Cashier'}</td></tr>
</table>
<hr class="divider-green"/>
<table class="items-table">
  <thead><tr>
    <th style="text-align:left">Item</th>
    <th class="center">Qty</th>
    <th class="right">Price</th>
    <th class="right">Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<hr class="divider-gray"/>
<table class="sub-table">
  <tr><td>Subtotal:</td><td class="val">LKR ${sale.subtotal.toFixed(2)}</td></tr>
  ${sale.discount && sale.discount > 0 ? `<tr><td>Discount:</td><td class="val">-LKR ${sale.discount.toFixed(2)}</td></tr>` : ''}
  ${effectiveOther > 0.005 ? `<tr><td>${sale.otherChargesDescription?.trim() || 'Other Charges'}:</td><td class="val">+LKR ${effectiveOther.toFixed(2)}</td></tr>` : ''}
  <tr class="total-row"><td>TOTAL:</td><td class="val">LKR ${sale.total.toFixed(2)}</td></tr>
</table>
<hr class="divider-green"/>
<div class="center">
  <div class="thankyou">${footerLine}</div>
  <div class="support">We appreciate your continued support.</div>
</div>
<hr class="divider-gray"/>
<div class="center">
  <div class="policy-title">Return Policy:</div>
  <div class="policy-text">Items may be returned within 7 days with original receipt.<br/>Perishable goods are non-refundable.</div>
</div>
<hr class="divider-gray"/>
<div class="center">
  <div class="online-title">Find us online:</div>
  ${COMPANY.website ? `<div class="policy-text">${COMPANY.website}</div>` : ''}
  ${COMPANY.facebook ? `<div class="policy-text">${COMPANY.facebook}</div>` : ''}
  ${COMPANY.instagram ? `<div class="policy-text">${COMPANY.instagram}</div>` : ''}
</div>
<div class="center watermark">${COMPANY.name}</div>
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:58mm;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc2 = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc2) { iframe.remove(); return; }

  doc2.open();
  doc2.write(html);
  doc2.close();

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 3000);
    }
  };
}

export async function generateReport(data: {
  title: string;
  period: string;
  revenue: number;
  cost: number;
  profit: number;
  salesCount: number;
  adminSales: number;
  adminProfit: number;
  adminPerformance: Array<{ name: string; salesCount: number; profit: number }>;
}) {
  const doc = new jsPDF({ compress: true });
  let y = 20;

  // Try to load and compress logo
  let logoBase64: string | null = null;
  try {
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/logo');
      if (response.ok) {
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        logoBase64 = await compressImage(base64, 300, 0.5);
      }
    }
  } catch (error) {
    console.error('Failed to load logo for report:', error);
  }

  // Add logo if available
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, y, 20, 15);
      y += 18;
    } catch (error) {
      console.error('Failed to add logo to report:', error);
    }
  }

  const ensureSpace = (needed = 20) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // Header with branding
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 120, 60);
  doc.text(COMPANY.name, 105, y, { align: 'center' });
  y += 7;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Agro Solution - Business Report', 105, y, { align: 'center' });
  y += 5;

  doc.setFontSize(9);
  doc.text(`Address: ${COMPANY.address}`, 105, y, { align: 'center' });
  y += 4;
  doc.text(`Tel: ${COMPANY.phone1} | ${COMPANY.phone2}`, 105, y, { align: 'center' });
  y += 6;

  // Period
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.title, 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${data.period}`, 105, y, { align: 'center' });
  y += 12;

  // Divider
  doc.setLineWidth(0.5);
  doc.setDrawColor(40, 120, 60);
  doc.line(20, y, 190, y);
  y += 10;

  // Summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Financial Summary', 20, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Revenue:', 20, y);
  doc.text(`LKR ${data.revenue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 190, y, { align: 'right' });
  y += 7;
  doc.text('Total Cost:', 20, y);
  doc.text(`LKR ${data.cost.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 190, y, { align: 'right' });
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Net Profit:', 20, y);
  doc.text(`LKR ${data.profit.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 190, y, { align: 'right' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('Total Sales:', 20, y);
  doc.text(String(data.salesCount), 190, y, { align: 'right' });
  y += 7;
  doc.text('Admin Sales:', 20, y);
  doc.text(String(data.adminSales), 190, y, { align: 'right' });
  y += 7;
  doc.text('Admin Profit:', 20, y);
  doc.text(`LKR ${data.adminProfit.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 190, y, { align: 'right' });

  if (data.adminPerformance.length > 0) {
    y += 10;
    doc.setLineWidth(0.3);
    doc.line(20, y, 190, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Admin Sales and Profit', 20, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Admin', 20, y);
    doc.text('Sales', 130, y, { align: 'right' });
    doc.text('Profit (LKR)', 190, y, { align: 'right' });
    y += 2;
    doc.line(20, y, 190, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    for (const admin of data.adminPerformance) {
      ensureSpace(8);
      doc.text(admin.name, 20, y);
      doc.text(String(admin.salesCount), 130, y, { align: 'right' });
      doc.text(admin.profit.toLocaleString('en-LK', { minimumFractionDigits: 2 }), 190, y, { align: 'right' });
      y += 6;
    }
  }

  y += 10;
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 8;

  // Footer
  doc.setFontSize(8);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-LK')} at ${new Date().toLocaleTimeString('en-LK')}`, 105, y, { align: 'center' });
  y += 5;
  doc.text('Govi Sewana Agro Solution - Confidential', 105, y, { align: 'center' });

  openPdfPreview(doc, `report-${data.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

export async function generateQuotation(quotation: any) {
  const doc = new jsPDF({ compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15;

  const logoBase64 = await getLogoAsBase64();

  // ─── HEADER: Logo LEFT, Company Info RIGHT ───────────────────────────────
  const headerStartY = y;

  // Logo (left side)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, headerStartY, 28, 22);
    } catch (error) {
      console.error('Failed to add logo to quotation:', error);
    }
  }

  // Company info (right side)
  const companyX = pageWidth - 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 120, 60);
  doc.text(COMPANY.name, companyX, y, { align: 'right' });
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(COMPANY.tagline, companyX, y, { align: 'right' });
  y += 5;
  doc.text(COMPANY.address, companyX, y, { align: 'right' });
  y += 4;
  doc.text(`Tel: ${COMPANY.phone1}`, companyX, y, { align: 'right' });
  y += 4;
  doc.text(COMPANY.phone2, companyX, y, { align: 'right' });
  y += 4;
  doc.text(COMPANY.country, companyX, y, { align: 'right' });

  // Ensure y clears the logo height
  y = Math.max(y, headerStartY + 26);
  y += 6;

  // Divider
  doc.setDrawColor(40, 120, 60);
  doc.setLineWidth(1);
  doc.line(15, y, pageWidth - 15, y);
  y += 8;

  // ─── TWO-COLUMN SECTION: Company/Quotation Details LEFT, Customer RIGHT ──
  const leftX = 15;
  const rightX = pageWidth / 2 + 10;
  const colStartY = y;

  // LEFT: Quotation details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 120, 60);
  doc.text('QUOTATION', leftX, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Quotation #: ${quotation.quotationNo}`, leftX, y);
  y += 5;
  doc.text(`Date: ${new Date(quotation.createdAt).toLocaleDateString('en-LK')}`, leftX, y);
  y += 5;
  doc.text(`Valid Until: ${quotation.validUntil}`, leftX, y);
  y += 5;

  // RIGHT: Customer / Bill To
  let rightY = colStartY;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 120, 60);
  doc.text('BILL TO:', rightX, rightY);
  rightY += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(quotation.customerName || 'Customer Name', rightX, rightY);
  rightY += 5;
  if (quotation.customerPhone) {
    doc.text(`Phone: ${quotation.customerPhone}`, rightX, rightY);
    rightY += 5;
  }
  if (quotation.customerEmail) {
    doc.text(`Email: ${quotation.customerEmail}`, rightX, rightY);
    rightY += 5;
  }
  if (quotation.customerAddress) {
    const addrLines = doc.splitTextToSize(
      `Address: ${quotation.customerAddress}`,
      pageWidth / 2 - 20
    );
    doc.text(addrLines, rightX, rightY);
    rightY += addrLines.length * 5;
  }

  // Move y past whichever column is taller
  y = Math.max(y, rightY) + 8;

  // Second divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(15, y, pageWidth - 15, y);
  y += 8;

  // ─── ITEMS TABLE ──────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 120, 60);

  doc.text('Item Description', 15, y);
  doc.text('Qty', 95, y);
  doc.text('Unit', 115, y);
  doc.text('Unit Price', 140, y, { align: 'right' });
  doc.text('Total', pageWidth - 15, y, { align: 'right' });

  y += 5;
  doc.setDrawColor(40, 120, 60);
  doc.setLineWidth(0.5);
  doc.line(15, y, pageWidth - 15, y);
  y += 6;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  let totalAmount = 0;
  for (const item of quotation.items) {
    if (y > pageHeight - 70) {
      // Add footer before new page
      addFooter(doc, pageWidth, pageHeight);
      doc.addPage();
      y = 20;
    }

    doc.text(item.productName, 15, y);
    doc.text(String(item.qty), 95, y);
    doc.text(item.unit || 'kg', 115, y);
    doc.text(`LKR ${item.unitPrice.toFixed(2)}`, 140, y, { align: 'right' });
    doc.text(`LKR ${item.total.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });

    totalAmount += item.total;
    y += 6;
  }

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(15, y, pageWidth - 15, y);
  y += 6;

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  const summaryX = pageWidth - 60;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Subtotal:', summaryX, y, { align: 'right' });
  doc.text(`LKR ${quotation.subtotal.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });
  y += 6;

  if (quotation.discount > 0) {
    doc.text('Discount:', summaryX, y, { align: 'right' });
    doc.text(`-LKR ${quotation.discount.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });
    y += 6;
  }

  if (quotation.other > 0) {
    const otherLabel = quotation.otherChargesDescription?.trim() || 'Other Charges';
    doc.text(`${otherLabel}:`, summaryX, y, { align: 'right' });
    doc.text(`+LKR ${quotation.other.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });
    y += 6;
  }

  if (quotation.advance > 0) {
    doc.text('Advance:', summaryX, y, { align: 'right' });
    doc.text(`-LKR ${quotation.advance.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });
    y += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 120, 60);
  doc.text('TOTAL:', summaryX, y, { align: 'right' });
  doc.text(`LKR ${quotation.total.toFixed(2)}`, pageWidth - 15, y, { align: 'right' });
  y += 12;

  // ─── NOTES ───────────────────────────────────────────────────────────────
  if (quotation.notes) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(quotation.notes, pageWidth - 30);
    doc.text(noteLines, 15, y);
    y += noteLines.length * 4 + 6;
  }

  // ─── BANK / PAYMENT DETAILS ───────────────────────────────────────────────
  if (y > pageHeight - 90) {
    addFooter(doc, pageWidth, pageHeight);
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(15, y, pageWidth - 15, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 120, 60);
  doc.text('PAYMENT DETAILS', 15, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  // ⚠️ Replace these values with your actual bank details
  const bankDetails = [
    `Bank:          ${COMPANY.bankName ?? 'Bank Name Here'}`,
    `Branch:        ${COMPANY.bankBranch ?? 'Branch Name Here'}`,
    `Account Name:  ${COMPANY.accountName ?? COMPANY.name}`,
    `Account No:    ${COMPANY.accountNo ?? 'XXXX-XXXX-XXXX'}`,
  ];
  for (const line of bankDetails) {
    doc.text(line, 15, y);
    y += 5;
  }
  y += 4;

  // ─── TERMS & CONDITIONS ───────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, pageWidth - 15, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 120, 60);
  doc.text('TERMS & CONDITIONS', 15, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  // ⚠️ Customise these terms as needed
  const terms = [
    '1. This quotation is valid for the period stated above.',
    '2. Prices are inclusive of applicable taxes unless stated otherwise.',
    '3. Payment is due within 30 days of invoice date.',
    '4. Goods remain the property of ' + COMPANY.name + ' until full payment is received.',
    '5. Any disputes are subject to the jurisdiction of Sri Lankan courts.',
  ];
  for (const term of terms) {
    const termLines = doc.splitTextToSize(term, pageWidth - 30);
    doc.text(termLines, 15, y);
    y += termLines.length * 4 + 2;
  }

  // ─── FOOTER (last page) ───────────────────────────────────────────────────
  addFooter(doc, pageWidth, pageHeight);

  // ─── PAGE NUMBERS (all pages) ────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - 15,
      pageHeight - 5,
      { align: 'right' }
    );
  }

  openPdfPreview(doc, `quotation-${quotation.quotationNo}.pdf`);
}

// ─── REUSABLE FOOTER HELPER ───────────────────────────────────────────────────
function addFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const footerY = pageHeight - 14;
  doc.setDrawColor(40, 120, 60);
  doc.setLineWidth(0.5);
  doc.line(15, footerY, pageWidth - 15, footerY);

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for considering us!', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-LK')}`,
    15,
    footerY + 5
  );
}
