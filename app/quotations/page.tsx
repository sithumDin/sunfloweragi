'use client';

import { useEffect, useState } from 'react';
import { Product } from '@/lib/types';
import { generateQuotation } from '@/lib/pdf';

interface QuotationItem {
  product: string;
  productName: string;
  qty: number;
  unitPrice: number;
  unit: string;
  total: number;
}

interface Quotation {
  _id?: string;
  quotationNo: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  other: number;
  advance: number;
  total: number;
  notes: string;
  validUntil: string;
  quotationType: 'retail' | 'wholesale';
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt?: string;
}

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function QuotationsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'create' | 'view'>('view');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'accepted' | 'rejected'>('all');

  const [formData, setFormData] = useState<Quotation>({
    quotationNo: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    items: [],
    subtotal: 0,
    discount: 0,
    other: 0,
    advance: 0,
    total: 0,
    notes: '',
    validUntil: '',
    quotationType: 'retail',
    status: 'draft',
  });

  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedQty, setSelectedQty] = useState('1');
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');

  // Fetch products and quotations
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, quotationsRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/quotations'),
        ]);

        if (productsRes.ok) {
          const data = await productsRes.json();
          setProducts(Array.isArray(data) ? data : []);
        }

        if (quotationsRes.ok) {
          const data = await quotationsRes.json();
          setQuotations(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const addItemToQuotation = () => {
    if (!selectedProduct) return;

    const product = products.find((p) => p._id === selectedProduct);
    if (!product) return;

    const qty = parseInt(selectedQty) || 1;
    const price = formData.quotationType === 'retail' 
      ? (product.retailPrice ?? product.sellingPrice ?? 0)
      : (product.wholesalePrice ?? product.sellingPrice ?? 0);

    const newItem: QuotationItem = {
      product: product._id || '',
      productName: product.name,
      qty,
      unitPrice: price,
      unit: product.unit,
      total: price * qty,
    };

    const updatedItems = [...formData.items, newItem];
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal - (formData.discount || 0) + (formData.other || 0) - (formData.advance || 0);

    setFormData({
      ...formData,
      items: updatedItems,
      subtotal,
      total,
    });

    setSelectedProduct('');
    setSelectedQty('1');
  };

  const addManualItem = () => {
    if (!manualItemName.trim() || !manualItemPrice) return;

    const newItem: QuotationItem = {
      product: 'manual-' + Date.now(),
      productName: manualItemName.trim(),
      qty: 1,
      unitPrice: parseFloat(manualItemPrice),
      unit: '',
      total: parseFloat(manualItemPrice),
    };

    const updatedItems = [...formData.items, newItem];
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal - (formData.discount || 0) + (formData.other || 0) - (formData.advance || 0);

    setFormData({
      ...formData,
      items: updatedItems,
      subtotal,
      total,
    });

    setManualItemName('');
    setManualItemPrice('');
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal - (formData.discount || 0) + (formData.other || 0) - (formData.advance || 0);

    setFormData({
      ...formData,
      items: updatedItems,
      subtotal,
      total,
    });
  };

  const updateDiscount = (newDiscount: number) => {
    const total = formData.subtotal - newDiscount + (formData.other || 0) - (formData.advance || 0);
    setFormData({ ...formData, discount: newDiscount, total });
  };

  const updateOther = (newOther: number) => {
    const total = formData.subtotal - (formData.discount || 0) + newOther - (formData.advance || 0);
    setFormData({ ...formData, other: newOther, total });
  };

  const updateAdvance = (newAdvance: number) => {
    const total = formData.subtotal - (formData.discount || 0) + (formData.other || 0) - newAdvance;
    setFormData({ ...formData, advance: newAdvance, total });
  };

  const handleSaveQuotation = async () => {
    if (!formData.customerName || formData.items.length === 0) {
      alert('Please fill in customer name and add items');
      return;
    }

    try {
      const isUpdate = !!formData._id;
      console.log('Saving quotation', { isUpdate, _id: formData._id, customerName: formData.customerName });

      const endpoint = '/api/quotations';
      const method = isUpdate ? 'PUT' : 'POST';

      // For updates, exclude read-only fields
      const dataToSend = isUpdate 
        ? {
            _id: formData._id,
            customerName: formData.customerName,
            customerPhone: formData.customerPhone,
            customerEmail: formData.customerEmail,
            customerAddress: formData.customerAddress,
            items: formData.items,
            subtotal: formData.subtotal,
            discount: formData.discount,
            other: formData.other,
            advance: formData.advance,
            total: formData.total,
            notes: formData.notes,
            validUntil: formData.validUntil,
            quotationType: formData.quotationType,
            status: formData.status,
          }
        : formData;

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      const responseData = await res.json();
      console.log('API Response:', { ok: res.ok, status: res.status, data: responseData });

      if (!res.ok) {
        const errorMessage = responseData.error || responseData.details || 'Failed to save quotation';
        const errorDetails = responseData.details ? ` (${responseData.details})` : '';
        throw new Error(errorMessage + errorDetails);
      }

      alert('Quotation saved successfully');
      
      // Generate PDF with the saved data
      try {
        await generateQuotation(responseData);
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        // Don't alert for PDF errors, just log
      }
      
      // Reset form
      setFormData({
        quotationNo: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        customerAddress: '',
        items: [],
        subtotal: 0,
        discount: 0,
        other: 0,
        advance: 0,
        total: 0,
        notes: '',
        validUntil: '',
        quotationType: 'retail',
        status: 'draft',
      });
      setSelectedProduct('');
      setSelectedQty('1');
      setManualItemName('');
      setManualItemPrice('');
      
      // Refresh quotations
      const quotationsRes = await fetch('/api/quotations');
      if (quotationsRes.ok) {
        const quotationsData = await quotationsRes.json();
        setQuotations(Array.isArray(quotationsData) ? quotationsData : []);
      }
      
      setActiveTab('view');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Save error:', error);
      alert(`Failed to save quotation: ${errorMessage}`);
    }
  };

  const handleEditQuotation = (quotation: Quotation) => {
    setFormData(quotation);
    setActiveTab('create');
    window.scrollTo(0, 0);
  };

  const handleGeneratePDF = async (quotation: Quotation) => {
    await generateQuotation(quotation);
  };

  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch =
      q.customerName.toLowerCase().includes(search.toLowerCase()) ||
      q.quotationNo.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });


  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>📄 Quotations</h1>
        <p>Create and manage quotations for your customers</p>
      </div>

      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab('view')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'view' ? 'var(--emerald-500)' : 'var(--bg-card)',
              color: activeTab === 'view' ? '#fff' : 'var(--text-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '16px'
            }}
          >
            📋 View Quotations
          </button>
          <button
            onClick={() => setActiveTab('create')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'create' ? 'var(--emerald-500)' : 'var(--bg-card)',
              color: activeTab === 'create' ? '#fff' : 'var(--text-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '16px'
            }}
          >
            ✎ Create New
          </button>
        </div>

        {/* View Quotations */}
        {activeTab === 'view' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="🔍 Search customer name or quotation #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: '10px 15px',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '2px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px'
                }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{
                  padding: '10px 15px',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '2px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">📊 All Status</option>
                <option value="draft">📝 Draft</option>
                <option value="sent">📧 Sent</option>
                <option value="accepted">✅ Accepted</option>
                <option value="rejected">❌ Rejected</option>
              </select>
            </div>

            {/* Quotations List */}
            {filteredQuotations.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '2px dashed var(--border-color)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>📭</div>
                <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>No quotations found</p>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '10px' }}>Try adjusting your search criteria or create a new quotation</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                gap: '20px'
              }}>
                {filteredQuotations.map((quotation) => (
                  <div
                    key={quotation._id}
                    style={{
                      background: 'var(--bg-card)',
                      border: '2px solid var(--border-color)',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      transition: 'all var(--transition-base)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--emerald-500)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Card Header */}
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>QUOTATION</p>
                          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--emerald-400)', margin: '5px 0 0 0' }}>{quotation.quotationNo}</h3>
                        </div>
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: quotation.status === 'draft' ? 'var(--warning-soft)' : 
                                     quotation.status === 'sent' ? 'var(--info-soft)' :
                                     quotation.status === 'accepted' ? 'var(--success-soft)' :
                                     'var(--danger-soft)',
                          color: quotation.status === 'draft' ? 'var(--warning)' :
                                quotation.status === 'sent' ? 'var(--info)' :
                                quotation.status === 'accepted' ? 'var(--success)' :
                                'var(--danger)'
                        }}>
                          {quotation.status}
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: '16px', fontSize: '14px' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, margin: 0, marginBottom: '4px' }}>CUSTOMER</p>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{quotation.customerName}</p>
                        {quotation.customerPhone && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>📱 {quotation.customerPhone}</p>}
                      </div>

                      {/* Items */}
                      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 8px 0' }}>ITEMS ({quotation.items.length})</p>
                        {quotation.items.slice(0, 3).map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span>{item.productName}</span>
                            <span>{item.qty}x</span>
                          </div>
                        ))}
                        {quotation.items.length > 3 && <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0 0', textAlign: 'center' }}>+{quotation.items.length - 3} more</p>}
                      </div>

                      {/* Totals */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                        <div>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginBottom: '4px' }}>Subtotal</p>
                          <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{formatLKR(quotation.subtotal)}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginBottom: '4px' }}>Total</p>
                          <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--emerald-400)', margin: 0 }}>{formatLKR(quotation.total)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', gap: '10px', padding: '12px', borderTop: '1px solid var(--border-color)', background: 'rgba(16, 185, 129, 0.05)' }}>
                      {quotation.status === 'draft' && (
                        <button
                          onClick={() => handleEditQuotation(quotation)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: 'var(--info)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '12px'
                          }}
                        >
                          ✎ Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleGeneratePDF(quotation)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          background: 'var(--emerald-500)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '12px'
                        }}
                      >
                        📥 PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Quotation */}
        {activeTab === 'create' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
            {/* Form */}
            <div>
              {/* Customer Info */}
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: 0, color: 'var(--text-primary)' }}>👤 Customer</h2>
                  {formData._id && (
                    <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600, background: 'var(--warning-soft)', padding: '4px 8px', borderRadius: 'var(--radius-md)' }}>
                      Editing: {formData.quotationNo}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Name *</label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="Customer name"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-input)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Phone</label>
                    <input
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      placeholder="+94 xx xxx xxxx"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-input)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Email</label>
                    <input
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="customer@example.com"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-input)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Address</label>
                    <input
                      type="text"
                      value={formData.customerAddress}
                      onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                      placeholder="Address"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-input)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '15px', color: 'var(--text-primary)' }}>⚙️ Settings</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Type</label>
                    <select
                      value={formData.quotationType}
                      onChange={(e) => setFormData({ ...formData, quotationType: e.target.value as 'retail' | 'wholesale' })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-input)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="retail">🛒 Retail</option>
                      <option value="wholesale">🏭 Wholesale</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Valid Until</label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-input)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-input)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="draft">📝 Draft</option>
                      <option value="sent">📧 Sent</option>
                      <option value="accepted">✅ Accepted</option>
                      <option value="rejected">❌ Rejected</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Add Products */}
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '15px', color: 'var(--text-primary)' }}>📦 Add Products</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-input)',
                      border: '2px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={selectedQty}
                    onChange={(e) => setSelectedQty(e.target.value)}
                    min="1"
                    placeholder="Qty"
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-input)',
                      border: '2px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={addItemToQuotation}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--emerald-500)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}
                  >
                    ➕ Add
                  </button>
                </div>

                {/* Manual Items */}
                <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '15px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>Add Manual Items (Transport, Delivery, etc.)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                    <input
                      type="text"
                      value={manualItemName}
                      onChange={(e) => setManualItemName(e.target.value)}
                      placeholder="Item name (e.g., Transport, Delivery Fee)"
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-input)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                    />
                    <input
                      type="number"
                      value={manualItemPrice}
                      onChange={(e) => setManualItemPrice(e.target.value)}
                      placeholder="Price"
                      step="0.01"
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-input)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                    />
                    <button
                      onClick={addManualItem}
                      style={{
                        padding: '8px 12px',
                        background: 'var(--warning)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '14px'
                      }}
                    >
                      ✏️ Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              {formData.items.length > 0 && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', overflow: 'hidden', marginBottom: '20px' }}>
                  <div style={{ padding: '15px 20px', borderBottom: '2px solid var(--border-color)', fontWeight: 700, fontSize: '16px' }}>
                    📋 Items ({formData.items.length})
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-input)' }}>
                          <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Product</th>
                          <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Qty</th>
                          <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Unit</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Price</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Total</th>
                          <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px', fontSize: '13px' }}>{item.productName}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>{item.qty}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>{item.unit}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px' }}>{formatLKR(item.unitPrice)}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--emerald-400)' }}>{formatLKR(item.total)}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <button
                                onClick={() => removeItem(i)}
                                style={{
                                  background: 'var(--danger-soft)',
                                  color: 'var(--danger)',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 600
                                }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Summary Sidebar */}
            <div>
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-color)', position: 'sticky', top: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, marginTop: 0, marginBottom: '15px', color: 'var(--text-primary)' }}>💰 Summary</h2>
                
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginBottom: '4px' }}>Subtotal</p>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{formatLKR(formData.subtotal)}</p>
                </div>

                <div style={{ marginBottom: '15px', background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Discount</label>
                  <input
                    type="number"
                    value={formData.discount}
                    onChange={(e) => updateDiscount(parseFloat(e.target.value) || 0)}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'var(--bg-card)',
                      border: '2px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px', background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Other Charges</label>
                  <input
                    type="number"
                    value={formData.other}
                    onChange={(e) => updateOther(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'var(--bg-card)',
                      border: '2px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px', background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Advance Payment</label>
                  <input
                    type="number"
                    value={formData.advance}
                    onChange={(e) => updateAdvance(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'var(--bg-card)',
                      border: '2px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: 'var(--radius-md)', border: '2px solid var(--emerald-500)', marginBottom: '20px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--emerald-400)', fontWeight: 600, margin: 0, marginBottom: '8px' }}>TOTAL</p>
                  <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--emerald-400)', margin: 0 }}>{formatLKR(formData.total)}</p>
                </div>

                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Terms & notes..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'var(--bg-input)',
                    border: '2px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    minHeight: '100px',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />

                <div style={{ display: 'grid', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={handleSaveQuotation}
                    style={{
                      padding: '12px',
                      background: 'var(--emerald-500)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px',
                      opacity: 1,
                      pointerEvents: 'auto'
                    }}
                  >
                    ✓ Save & PDF
                  </button>
                  <button
                    onClick={() => {
                      setFormData({
                        quotationNo: '',
                        customerName: '',
                        customerPhone: '',
                        customerEmail: '',
                        customerAddress: '',
                        items: [],
                        subtotal: 0,
                        discount: 0,
                        other: 0,
                        total: 0,
                        notes: '',
                        validUntil: '',
                        quotationType: 'retail',
                        status: 'draft',
                      });
                      setManualItemName('');
                      setManualItemPrice('');
                      setSelectedProduct('');
                      setSelectedQty('1');
                      setActiveTab('view');
                    }}
                    style={{
                      padding: '12px',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
