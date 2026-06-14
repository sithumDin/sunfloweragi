import type { Sale } from './types';

declare global {
  interface Window { qz: any }
}

// ── Company info (keep in sync with pdf.ts) ────────────────────────────────
const COMPANY = {
  name:    'SUNFLOWER AGRI',
  tagline: 'Agri Business',
  address: 'Makandura Gonawila',
  phone1:  '077 298 4749',
  phone2:  '076 180 9833',
};

// ── ESC/POS constants ──────────────────────────────────────────────────────
const ESC = '\x1b';
const GS  = '\x1d';
const INIT     = ESC + '@';           // reset printer
const CUT      = GS  + 'V\x41\x03'; // full cut + 3-line feed
const CENTER   = ESC + 'a\x01';
const LEFT     = ESC + 'a\x00';
const BOLD_ON  = ESC + 'E\x01';
const BOLD_OFF = ESC + 'E\x00';
const DBL_ON   = GS  + '!\x11';     // 2× width + height
const DBL_OFF  = GS  + '!\x00';
const LF       = '\n';

// 58mm paper → ~32 printable chars at default font
const W = 32;

function hr(ch = '-'): string {
  return ch.repeat(W) + LF;
}

function pad(left: string, right: string): string {
  return left + ' '.repeat(Math.max(1, W - left.length - right.length)) + right;
}

// ── ESC/POS receipt builder ────────────────────────────────────────────────
function buildReceipt(sale: Sale): string {
  const ws     = sale.saleType === 'wholesale';
  const title  = ws ? 'WHOLESALE RECEIPT' : 'RETAIL RECEIPT';
  const footer = ws ? 'Thank you for your business!' : 'Thank you for your purchase!';
  const d      = new Date(sale.date);
  const other  = Math.max(0, sale.total - (sale.subtotal - (sale.discount || 0)));

  const lines: string[] = [
    INIT,

    // ── Header ──────────────────────────────────────────────────────────
    CENTER,
    BOLD_ON, COMPANY.name + LF, BOLD_OFF,
    COMPANY.tagline + LF,
    COMPANY.address + LF,
    `Tel: ${COMPANY.phone1} | ${COMPANY.phone2}` + LF,
    hr(),

    // ── Receipt type ────────────────────────────────────────────────────
    BOLD_ON, DBL_ON,
    title + LF,
    DBL_OFF, BOLD_OFF,
    hr(),

    // ── Sale info ───────────────────────────────────────────────────────
    LEFT,
    pad('Invoice:', sale.invoiceNo) + LF,
    pad('Date:', d.toLocaleDateString('en-LK')) + LF,
    pad('Time:', d.toLocaleTimeString('en-LK')) + LF,
    pad('Customer:', (sale.customerName || (ws ? 'Wholesale' : 'Walk-in')).substring(0, 18)) + LF,
    pad('Payment:', sale.paymentMethod.toUpperCase()) + LF,
    pad('Cashier:', (sale.cashierName || 'Staff').substring(0, 20)) + LF,
    hr(),

    // ── Items header: 12 + 1 + 3 + 1 + 7 + 1 + 7 = 32 chars ───────────
    BOLD_ON,
    'Item'.padEnd(12) + ' ' + 'Qty'.padStart(3) + ' ' + 'Price'.padStart(7) + ' ' + 'Total'.padStart(7) + LF,
    BOLD_OFF,
    hr(),
  ];

  // ── Items ──────────────────────────────────────────────────────────────
  for (const item of sale.items) {
    const name  = item.productName.substring(0, 12).padEnd(12);
    const qty   = String(item.qty).padStart(3);
    const price = item.unitPrice.toFixed(2).padStart(7);
    const total = item.total.toFixed(2).padStart(7);
    lines.push(`${name} ${qty} ${price} ${total}` + LF);
  }

  // ── Totals ─────────────────────────────────────────────────────────────
  lines.push(
    hr(),
    pad('Subtotal:', `LKR ${sale.subtotal.toFixed(2)}`) + LF,
  );

  if (sale.discount > 0) {
    lines.push(pad('Discount:', `-LKR ${sale.discount.toFixed(2)}`) + LF);
  }
  if (other > 0.005) {
    const label = (sale.otherChargesDescription?.trim() || 'Other Charges').substring(0, 12);
    lines.push(pad(`${label}:`, `+LKR ${other.toFixed(2)}`) + LF);
  }

  lines.push(
    hr('='),
    CENTER, BOLD_ON, DBL_ON,
    `TOTAL LKR ${sale.total.toFixed(2)}` + LF,
    DBL_OFF, BOLD_OFF,
    hr('='),

    // ── Footer ──────────────────────────────────────────────────────────
    CENTER,
    LF,
    footer + LF,
    'We appreciate your continued support.' + LF,
    LF,
    hr(),
    'Return Policy:' + LF,
    'Items returnable within 7 days' + LF,
    'with original receipt.' + LF,
    hr(),
    LF, LF, LF,

    // ── Cut ─────────────────────────────────────────────────────────────
    CUT,
  );

  return lines.join('');
}

// ── QZ Tray loader ─────────────────────────────────────────────────────────
let _loaded = false;

async function loadQZScript(): Promise<void> {
  if (_loaded || (typeof window !== 'undefined' && window.qz)) {
    _loaded = true;
    return;
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    s.onload  = () => { _loaded = true; resolve(); };
    s.onerror = () => reject(new Error('QZ Tray script failed to load. Check internet connection.'));
    document.head.appendChild(s);
  });
}

// ── QZ Tray connection ─────────────────────────────────────────────────────
async function connect(): Promise<void> {
  await loadQZScript();

  if (!window.qz) throw new Error('QZ Tray library not available.');

  // Unsigned connection — QZ Tray will show a one-time trust dialog on the PC.
  // Click "Allow" → "Remember this site" to suppress future prompts.
  window.qz.security.setCertificatePromise((_resolve: Function) => _resolve(''));
  window.qz.security.setSignatureAlgorithm('SHA512');
  window.qz.security.setSignaturePromise(
    (_toSign: string) => (_resolve: Function) => _resolve('')
  );

  if (!window.qz.websocket.isActive()) {
    // usingSecure:true required when served over HTTPS (Vercel)
    await window.qz.websocket.connect({
      host: ['localhost'],
      usingSecure: true,
      retries: 3,
      delay: 1,
    });
  }
}

// ── Printer detection ──────────────────────────────────────────────────────
const PRINTER_KEYWORDS = ['xp', 'xprinter', 'thermal', 'pos', 'receipt', '58', '80'];

async function findPrinter(): Promise<string> {
  const printers: string[] = await window.qz.printers.find();
  if (!printers.length) throw new Error('No printers found. Check printer is on and connected.');

  for (const kw of PRINTER_KEYWORDS) {
    const match = printers.find(p => p.toLowerCase().includes(kw));
    if (match) return match;
  }

  return printers[0]; // fallback: first available printer
}

// ── Public: print via QZ Tray ──────────────────────────────────────────────
export async function printWithQZ(sale: Sale): Promise<void> {
  await connect();

  const printer = await findPrinter();
  console.log(`[QZ] Printing to: ${printer}`);

  const config = window.qz.configs.create(printer, {
    encoding: 'Cp1252',
    copies: 1,
    colorType: 'blackWhite',
  });

  await window.qz.print(config, [
    { type: 'raw', format: 'command', data: buildReceipt(sale) },
  ]);
}

// ── Public: list available printers (for settings UI) ─────────────────────
export async function listPrinters(): Promise<string[]> {
  await connect();
  return window.qz.printers.find();
}

// ── Public: disconnect (call on page unload if needed) ────────────────────
export async function disconnectQZ(): Promise<void> {
  if (typeof window !== 'undefined' && window.qz?.websocket?.isActive()) {
    await window.qz.websocket.disconnect();
  }
}
