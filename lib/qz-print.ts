import type { Sale } from './types';

declare global {
  interface Window { qz: any }
}

const COMPANY = {
  name:    'SUNFLOWER AGRI',
  tagline: 'Agri Business',
  address: 'Makandura Gonawila',
  phone1:  '077 298 4749',
  phone2:  '076 180 9833',
  country: 'Sri Lanka',
};

// ── ESC/POS constants ──────────────────────────────────────────────────────
const ESC = '\x1b';
const GS  = '\x1d';
const INIT     = ESC + '@';
const CUT      = GS  + 'V\x41\x03';
const CENTER   = ESC + 'a\x01';
const LEFT     = ESC + 'a\x00';
const BOLD_ON  = ESC + 'E\x01';
const BOLD_OFF = ESC + 'E\x00';
const DBL_ON   = GS  + '!\x11';
const DBL_OFF  = GS  + '!\x00';
const LF       = '\n';

// 80mm paper → ~42 printable chars at default font
const W = 42;

function hr(ch = '-'): string { return ch.repeat(W) + LF; }
function pad(l: string, r: string): string {
  return l + ' '.repeat(Math.max(1, W - l.length - r.length)) + r;
}

function buildReceipt(sale: Sale): string {
  const ws     = sale.saleType === 'wholesale';
  const title  = ws ? 'WHOLESALE RECEIPT' : 'RETAIL RECEIPT';
  const footer = ws ? 'Thank you for your business!' : 'Thank you for your purchase!';
  const d      = new Date(sale.date);
  const other  = Math.max(0, sale.total - (sale.subtotal - (sale.discount || 0)));

  const lines: string[] = [
    INIT,
    CENTER,
    BOLD_ON, COMPANY.name + LF, BOLD_OFF,
    COMPANY.tagline + LF,
    COMPANY.address + LF,
    `Tel: ${COMPANY.phone1} | ${COMPANY.phone2}` + LF,
    COMPANY.country + LF,
    hr(),
    BOLD_ON, DBL_ON,
    title + LF,
    DBL_OFF, BOLD_OFF,
    hr(),
    LEFT,
    pad('Invoice:', sale.invoiceNo) + LF,
    pad('Date:', d.toLocaleDateString('en-LK')) + LF,
    pad('Time:', d.toLocaleTimeString('en-LK')) + LF,
    pad('Customer:', (sale.customerName || (ws ? 'Wholesale Customer' : 'Walk-in Customer')).substring(0, 26)) + LF,
    pad('Payment:', sale.paymentMethod.toUpperCase()) + LF,
    pad('Cashier:', (sale.cashierName || 'Staff').substring(0, 28)) + LF,
    hr(),
    // Column headers: 20 + 1 + 4 + 1 + 8 + 1 + 7 = 42
    BOLD_ON,
    'Item'.padEnd(20) + ' ' + 'Qty'.padStart(4) + ' ' + 'Price'.padStart(8) + ' ' + 'Total'.padStart(7) + LF,
    BOLD_OFF,
    hr(),
  ];

  for (const item of sale.items) {
    const name  = item.productName.substring(0, 20).padEnd(20);
    const qty   = String(item.qty).padStart(4);
    const price = item.unitPrice.toFixed(2).padStart(8);
    const total = item.total.toFixed(2).padStart(7);
    lines.push(`${name} ${qty} ${price} ${total}` + LF);
  }

  lines.push(hr());
  lines.push(pad('Subtotal:', `LKR ${sale.subtotal.toFixed(2)}`) + LF);

  if (sale.discount > 0) {
    lines.push(pad('Discount:', `-LKR ${sale.discount.toFixed(2)}`) + LF);
  }
  if (other > 0.005) {
    const label = (sale.otherChargesDescription?.trim() || 'Other Charges').substring(0, 20);
    lines.push(pad(`${label}:`, `+LKR ${other.toFixed(2)}`) + LF);
  }

  lines.push(
    hr('='),
    CENTER, BOLD_ON, DBL_ON,
    `TOTAL  LKR ${sale.total.toFixed(2)}` + LF,
    DBL_OFF, BOLD_OFF,
    hr('='),
    LF,
    footer + LF,
    'We appreciate your continued support.' + LF,
    LF,
    hr(),
    'Return Policy:' + LF,
    'Items returnable within 7 days with original receipt.' + LF,
    hr(),
    LF, LF, LF,
    CUT,
  );

  return lines.join('');
}

// ── QZ Tray loader ─────────────────────────────────────────────────────────
let _loaded = false;

async function loadQZScript(): Promise<void> {
  if (_loaded || (typeof window !== 'undefined' && window.qz)) { _loaded = true; return; }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    s.onload  = () => { _loaded = true; resolve(); };
    s.onerror = () => reject(new Error('Failed to load QZ Tray script'));
    document.head.appendChild(s);
  });
}

async function connect(): Promise<void> {
  await loadQZScript();
  if (!window.qz) throw new Error('QZ Tray library not available');

  window.qz.security.setCertificatePromise((_resolve: Function) => _resolve(''));
  window.qz.security.setSignatureAlgorithm('SHA512');
  window.qz.security.setSignaturePromise(
    (_toSign: string) => (_resolve: Function) => _resolve('')
  );

  if (!window.qz.websocket.isActive()) {
    await window.qz.websocket.connect({
      host: ['localhost'],
      usingSecure: true,
      retries: 3,
      delay: 1,
    });
  }
}

const PRINTER_KEYWORDS = ['xp', 'xprinter', 'thermal', 'pos', 'receipt', '80'];

async function findPrinter(): Promise<string> {
  const printers: string[] = await window.qz.printers.find();
  if (!printers.length) throw new Error('No printers found');
  for (const kw of PRINTER_KEYWORDS) {
    const match = printers.find((p: string) => p.toLowerCase().includes(kw));
    if (match) return match;
  }
  return printers[0];
}

export async function printWithQZ(sale: Sale): Promise<void> {
  await connect();
  const printer = await findPrinter();
  console.log(`[QZ] Printing to: ${printer}`);
  const config = window.qz.configs.create(printer, { encoding: 'Cp1252', copies: 1 });
  await window.qz.print(config, [{ type: 'raw', format: 'command', data: buildReceipt(sale) }]);
}

export async function listPrinters(): Promise<string[]> {
  await connect();
  return window.qz.printers.find();
}

export async function disconnectQZ(): Promise<void> {
  if (typeof window !== 'undefined' && window.qz?.websocket?.isActive()) {
    await window.qz.websocket.disconnect();
  }
}
