'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Product, CartItem, Customer, Credit } from '@/lib/types';
import { generateReceipt } from '@/lib/pdf';

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getWholesalePrice(product: Product) {
  return product.wholesalePrice ?? product.sellingPrice ?? 0;
}

export default function WholesalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [blinkProductId, setBlinkProductId] = useState<string | null>(null);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [selectedCartIndex, setSelectedCartIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [discount, setDiscount] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  const [otherChargesDescription, setOtherChargesDescription] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [isCredit, setIsCredit] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<'pos' | 'credits'>('pos');
  const [paymentModal, setPaymentModal] = useState<Credit | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then((r) => r.ok ? r.json() : []),
      fetch('/api/customers?type=wholesale').then((r) => r.ok ? r.json() : []),
      fetch('/api/credit').then((r) => r.ok ? r.json() : []),
    ])
      .then(([prods, custs, creds]) => {
        setProducts(Array.isArray(prods) ? prods : []);
        setCustomers(Array.isArray(custs) ? custs : []);
        setCredits(Array.isArray(creds) ? creds : []);
      })
      .catch((e) => {
        console.error(e);
        setProducts([]);
        setCustomers([]);
        setCredits([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshCredits = () => {
    fetch('/api/credit').then((r) => r.json()).then(setCredits);
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;

    if (product._id) {
      setBlinkProductId(product._id);
      setTimeout(() => setBlinkProductId((prev) => (prev === product._id ? null : prev)), 250);
    }

    const existing = cart.find((c) => c.product._id === product._id);
    if (existing) {
      if (existing.qty >= product.stock) return;
      setCart(cart.map((c) =>
        c.product._id === product._id ? { ...c, qty: c.qty + 1 } : c
      ));
    } else {
      setCart([...cart, { product, qty: 1, discount: 0 }]);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(cart.map((c) => {
      if (c.product._id === productId) {
        const newQty = c.qty + delta;
        if (newQty <= 0 || newQty > 10000) return c;
        return { ...c, qty: newQty };
      }
      return c;
    }));
  };

  const setQty = (productId: string, qtyValue: string) => {
    const normalized = qtyValue.replace(/[,\s]/g, '');
    const parsed = parseInt(normalized, 10);
    if (Number.isNaN(parsed)) return;

    setCart(cart.map((c) => {
      if (c.product._id !== productId) return c;
      const nextQty = Math.min(Math.max(parsed, 1), 10000);
      return { ...c, qty: nextQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.product._id !== productId));
  };

  const subtotal = cart.reduce((sum, c) => sum + getWholesalePrice(c.product) * c.qty, 0);
  const discountAmount = parseFloat(discount) || 0;
  const otherChargesAmount = parseFloat(otherCharges) || 0;
  const total = subtotal - discountAmount + otherChargesAmount;
  const totalCost = cart.reduce((sum, c) => sum + c.product.costPrice * c.qty, 0);
  const profit = total - totalCost - otherChargesAmount;
  const whatsappPhonePattern = /^\+94\s\d{2}\s\d{3}\s\d{4}$/;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (isCredit && !selectedCustomer) {
      alert('Please select a customer for credit sale');
      return;
    }

    if (sendWhatsApp) {
      if (!customerPhone.trim()) {
        alert('Please enter customer WhatsApp number. Format: +94 76 180 9833');
        return;
      }

      if (!whatsappPhonePattern.test(customerPhone.trim())) {
        alert('Invalid number format. Please use: +94 76 180 9833');
        return;
      }
    }

    setProcessing(true);

    const customer = customers.find((c) => c._id === selectedCustomer);

    const saleData = {
      customer: selectedCustomer || undefined,
      customerName: customer?.name || 'Wholesale Customer',
      items: cart.map((c) => ({
        product: c.product._id,
        productName: c.product.name,
        qty: c.qty,
        unitPrice: getWholesalePrice(c.product),
        costPrice: c.product.costPrice,
        total: getWholesalePrice(c.product) * c.qty,
      })),
      subtotal,
      discount: discountAmount,
      otherCharges: otherChargesAmount,
      otherChargesDescription: otherChargesDescription.trim() || 'Other Charges',
      total,
      profit,
      paymentMethod: isCredit ? 'transfer' : paymentMethod,
      saleType: 'wholesale' as const,
      date: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });

      if (res.ok) {
        const sale = await res.json();

        // Create credit record if credit sale
        if (isCredit) {
          await fetch('/api/credit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer: selectedCustomer,
              customerName: customer?.name,
              sale: sale._id,
              invoiceNo: sale.invoiceNo,
              totalAmount: total,
              paidAmount: 0,
              remainingAmount: total,
              payments: [],
              status: 'pending',
            }),
          });
          refreshCredits();
        }

        generateReceipt(sale).catch(console.error);
        
        if (sendWhatsApp) {
          const waText = [
            `Sunflower Agri Business Wholesale Receipt`,
            `Invoice: ${sale.invoiceNo}`,
            `Customer: ${sale.customerName || 'Wholesale Customer'}`,
            `Total: ${formatLKR(sale.total)}`,
            isCredit ? `Status: CREDIT (Amount due ${formatLKR(sale.total)})` : `Status: PAID (${sale.paymentMethod})`,
            `Date: ${new Date(sale.date).toLocaleString('en-LK')}`,
            `Thank you!`,
          ].join('\n');

          try {
            const waRes = await fetch('/api/whatsapp/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: customerPhone.trim(), text: waText }),
            });

            if (waRes.ok) {
              alert('Sale completed. WhatsApp message sent successfully.');
            } else {
              const waData = await waRes.json().catch(() => ({ error: 'Failed to send WhatsApp' }));
              const errorText = String(waData.error || 'Unknown error');
              const lowerError = errorText.toLowerCase();

              if (lowerError.includes('not configured')) {
                alert(`Sale completed. WhatsApp failed: ${errorText}. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID, then restart the server.`);
              } else if (
                lowerError.includes('session has expired') ||
                lowerError.includes('error validating access token') ||
                lowerError.includes('invalid oauth access token')
              ) {
                alert(`Sale completed. WhatsApp failed: ${errorText}. Please regenerate WHATSAPP_ACCESS_TOKEN in Meta and restart the server.`);
              } else if (
                lowerError.includes('invalid phone') ||
                lowerError.includes('invalid wa id') ||
                lowerError.includes('phone number')
              ) {
                alert(`Sale completed. WhatsApp failed: ${errorText}. Please ensure the phone number is correct with country code (+94).`);
              } else {
                alert(`Sale completed. WhatsApp failed: ${errorText}. Please check WhatsApp API credentials and try again.`);
              }
            }
          } catch (error) {
            console.error('WhatsApp send error:', error);
            alert('Sale completed. WhatsApp could not be sent due to a network error.');
          }
        } else {
          alert('Sale completed.');
        }
        setCart([]);
        setDiscount('');
        setOtherCharges('');
        setOtherChargesDescription('');
        setSelectedCustomer('');
        setIsCredit(false);
        setCustomerPhone('');
        setSendWhatsApp(false);

        const updatedProducts = await fetch('/api/products').then((r) => r.json());
        setProducts(updatedProducts);
      }
    } catch (error) {
      console.error('Checkout failed:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreditPayment = async () => {
    if (!paymentModal || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (amount <= 0 || amount > paymentModal.remainingAmount) return;

    try {
      const res = await fetch('/api/credit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditId: paymentModal._id,
          payment: {
            amount,
            date: new Date().toISOString(),
            note: paymentNote,
          },
        }),
      });

      if (res.ok) {
        refreshCredits();
        setPaymentModal(null);
        setPaymentAmount('');
        setPaymentNote('');
      }
    } catch (error) {
      console.error('Payment failed:', error);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectableProducts = filteredProducts.filter((p) => p.stock > 0);
  const selectedProductId =
    selectedProductIndex >= 0 && selectedProductIndex < selectableProducts.length
      ? selectableProducts[selectedProductIndex]?._id
      : undefined;
  const selectedCartItem = cart[selectedCartIndex];

  useEffect(() => {
    setSelectedCartIndex((prev) => {
      if (cart.length === 0) return 0;
      return Math.min(prev, cart.length - 1);
    });
  }, [cart.length]);

  useEffect(() => {
    const onGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (tab !== 'pos') return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const isFormField = !!target && (target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select');

      if (!isFormField && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isFormField) return;

      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!processing && cart.length > 0) {
          handleCheckout();
        }
        return;
      }

      if (cart.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCartIndex((prev) => (prev + 1) % cart.length);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCartIndex((prev) => (prev - 1 + cart.length) % cart.length);
        return;
      }

      if (!selectedCartItem) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        updateQty(selectedCartItem.product._id!, 1);
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedCartItem.qty > 1) {
          updateQty(selectedCartItem.product._id!, -1);
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeFromCart(selectedCartItem.product._id!);
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [cart, processing, selectedCartItem, tab]);

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (selectableProducts.length === 0) return;
      e.preventDefault();
      setSelectedProductIndex((prev) => {
        if (prev < 0) return 0;
        if (e.key === 'ArrowDown') return (prev + 1) % selectableProducts.length;
        return (prev - 1 + selectableProducts.length) % selectableProducts.length;
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selectedProduct =
        selectedProductIndex >= 0
          ? selectableProducts[selectedProductIndex]
          : selectableProducts[0];
      if (selectedProduct) {
        addToCart(selectedProduct);
        setSearch('');
        setSelectedProductIndex(0);
      }
    }
  };

  const pendingCredits = credits.filter((c) => c.status !== 'paid');
  const totalOutstanding = pendingCredits.reduce((sum, c) => sum + c.remainingAmount, 0);

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>🏭 Wholesale</h1>
        <p>Wholesale sales and credit management</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'pos' ? 'active' : ''}`} onClick={() => setTab('pos')}>
          Sales POS
        </button>
        <button className={`tab ${tab === 'credits' ? 'active' : ''}`} onClick={() => setTab('credits')}>
          Credit Tracker ({pendingCredits.length})
        </button>
      </div>

      {tab === 'pos' ? (
        <div className="pos-layout">
          {/* Products */}
          <div>
            <div className="search-bar" style={{ marginBottom: '16px', maxWidth: '100%' }}>
              <span className="search-icon">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedProductIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <div className="pos-products">
              {filteredProducts.map((p) => (
                <div
                  key={p._id}
                  className={`product-card ${blinkProductId === p._id ? 'blink-add' : ''} ${selectedProductId === p._id ? 'keyboard-selected' : ''}`}
                  onClick={() => addToCart(p)}
                  style={{ opacity: p.stock <= 0 ? 0.5 : 1 }}
                >
                  <div className="product-name">{p.name}</div>
                  <div className="product-price">{formatLKR(getWholesalePrice(p))}</div>
                  <div className={`product-stock ${p.stock <= 0 ? 'out-of-stock' : ''}`}>
                    {p.stock <= 0 ? 'Out of Stock' : `${p.stock} ${p.unit} available`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div className="cart-panel">
            <div className="cart-header">
              <h3>🧾 Wholesale Cart</h3>
              {cart.length > 0 && <span className="badge badge-warning">{cart.length}</span>}
            </div>

            {cart.length === 0 ? (
              <div className="cart-empty">
                <span>🏭</span>
                Click products to add to cart
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item, index) => (
                    <div key={item.product._id} className={`cart-item ${selectedCartIndex === index ? 'keyboard-selected' : ''}`}>
                      <div className="cart-item-info">
                        <div className="cart-item-name">{item.product.name}</div>
                        <div className="cart-item-price">
                            {formatLKR(getWholesalePrice(item.product))} × {item.qty}
                        </div>
                      </div>
                      <div className="cart-item-controls">
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          value={item.qty}
                          onChange={(e) => setQty(item.product._id!, e.target.value)}
                          inputMode="numeric"
                          className="form-input"
                          style={{ width: '100px', padding: '4px 8px', textAlign: 'center' }}
                        />
                      </div>
                      <div className="cart-item-total">
                        {formatLKR(getWholesalePrice(item.product) * item.qty)}
                      </div>
                      <button className="cart-remove" onClick={() => removeFromCart(item.product._id!)}>✕</button>
                    </div>
                  ))}
                </div>

                {/* Customer Selection */}
                <div className="checkout-section">
                  <label>Select Customer</label>
                  <select
                    className="form-select"
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    style={{ marginTop: '6px' }}
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>{c.name} — {c.phone}</option>
                    ))}
                  </select>
                </div>

                <div className="checkout-section">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={sendWhatsApp}
                      onChange={(e) => setSendWhatsApp(e.target.checked)}
                    />
                    Do you want to send WhatsApp receipt to customer?
                  </label>
                  {sendWhatsApp && (
                    <input
                      className="form-input"
                      type="text"
                      placeholder="+94 76 180 9833"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      style={{ marginTop: '10px' }}
                    />
                  )}
                </div>

                {/* Credit Toggle */}
                <div className="checkout-section">
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                    onClick={() => setIsCredit(!isCredit)}
                  >
                    <div style={{
                      width: '40px',
                      height: '22px',
                      borderRadius: '11px',
                      background: isCredit ? 'var(--emerald-500)' : 'var(--border-color)',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: isCredit ? '20px' : '2px',
                        transition: 'left 0.2s',
                      }} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Credit Sale</span>
                  </div>
                </div>

                <div className="checkout-section">
                  <label>Discount (LKR)</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="0.00"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    style={{ marginTop: '6px' }}
                  />
                </div>
                <div className="checkout-section">
                  <label>Other Charges (Delivery / Labour)</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="0.00"
                    value={otherCharges}
                    onChange={(e) => setOtherCharges(e.target.value)}
                    style={{ marginTop: '6px' }}
                  />
                </div>
                {otherChargesAmount > 0 && (
                  <div className="checkout-section">
                    <label>What is this charge for? (e.g., Delivery, Labour)</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g., Delivery Cost, Labour"
                      value={otherChargesDescription}
                      onChange={(e) => setOtherChargesDescription(e.target.value)}
                      style={{ marginTop: '6px' }}
                    />
                  </div>
                )}
                {!isCredit && (
                  <>
                    <div className="checkout-section">
                      <label>Payment Method</label>
                      <div className="payment-methods">
                        {(['cash', 'card', 'transfer'] as const).map((m) => (
                          <button
                            key={m}
                            className={`payment-method ${paymentMethod === m ? 'active' : ''}`}
                            onClick={() => setPaymentMethod(m)}
                          >
                            {m === 'cash' ? '💵' : m === 'card' ? '💳' : '🏦'} {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="cart-summary">
                  <div className="cart-summary-row">
                    <span>Subtotal</span>
                    <span>{formatLKR(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="cart-summary-row">
                      <span>Discount</span>
                      <span style={{ color: 'var(--danger)' }}>-{formatLKR(discountAmount)}</span>
                    </div>
                  )}
                  {otherChargesAmount > 0 && (
                    <div className="cart-summary-row">
                      <span>{otherChargesDescription.trim() || 'Other Charges'}</span>
                      <span style={{ color: 'var(--text-primary)' }}>+{formatLKR(otherChargesAmount)}</span>
                    </div>
                  )}
                  <div className="cart-summary-row total">
                    <span>Total</span>
                    <span>{formatLKR(total)}</span>
                  </div>
                  {isCredit && (
                    <div className="cart-summary-row" style={{ marginTop: '4px' }}>
                      <span>⚠️ Credit Sale</span>
                      <span style={{ color: 'var(--warning)' }}>Due: {formatLKR(total)}</span>
                    </div>
                  )}
                </div>

                <div className="cart-actions">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handleCheckout}
                    disabled={processing}
                    style={{ width: '100%' }}
                  >
                    {processing ? 'Processing...' : isCredit ? `📋 Create Credit Sale — ${formatLKR(total)}` : `💳 Complete Sale — ${formatLKR(total)}`}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setCart([])} style={{ width: '100%' }}>
                    Clear Cart
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Credit Tracker Tab */
        <div>
          {/* Outstanding Summary */}
          <div className="stat-cards-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Total Outstanding</span>
                <div className="stat-card-icon yellow">💰</div>
              </div>
              <div className="stat-card-value" style={{ color: 'var(--warning)' }}>
                {formatLKR(totalOutstanding)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Pending Credits</span>
                <div className="stat-card-icon red">📋</div>
              </div>
              <div className="stat-card-value">{pendingCredits.length}</div>
            </div>
          </div>

          {pendingCredits.length === 0 ? (
            <div className="empty-state">
              <span className="icon">✅</span>
              <h3>No Outstanding Credits</h3>
              <p>All wholesale credits have been paid.</p>
            </div>
          ) : (
            <div className="credit-cards">
              {pendingCredits.map((credit) => (
                <div key={credit._id} className="credit-card">
                  <div className="credit-card-header">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>
                        {credit.customerName}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {credit.invoiceNo}
                      </div>
                    </div>
                    <span className={`badge ${credit.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                      {credit.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total</div>
                      <div style={{ fontWeight: 700, fontSize: '16px' }}>{formatLKR(credit.totalAmount)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Paid</div>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--emerald-400)' }}>{formatLKR(credit.paidAmount)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Remaining</div>
                      <div className="credit-amount">{formatLKR(credit.remainingAmount)}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', marginBottom: '12px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(credit.paidAmount / credit.totalAmount) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--emerald-600), var(--emerald-400))',
                      borderRadius: '3px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>

                  {/* Payment History */}
                  {credit.payments && credit.payments.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Payments:</div>
                      {credit.payments.map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{new Date(p.date).toLocaleDateString('en-LK')}</span>
                          <span style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>{formatLKR(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { setPaymentModal(credit); setPaymentAmount(''); setPaymentNote(''); }}
                    style={{ width: '100%' }}
                  >
                    💵 Record Payment
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Credit Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Record Payment</h2>
              <button className="modal-close" onClick={() => setPaymentModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                <strong>{paymentModal.customerName}</strong> — Invoice {paymentModal.invoiceNo}
              </p>
              <p style={{ marginBottom: '16px' }}>
                Outstanding: <strong style={{ color: 'var(--warning)' }}>{formatLKR(paymentModal.remainingAmount)}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Payment Amount (LKR)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  max={paymentModal.remainingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Payment note..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setPaymentAmount(String(paymentModal.remainingAmount));
                }}
                style={{ marginBottom: '8px' }}
              >
                Pay Full Amount
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPaymentModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreditPayment} disabled={!paymentAmount}>
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
