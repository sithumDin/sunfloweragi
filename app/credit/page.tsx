'use client';

import { useEffect, useState } from 'react';

interface CreditRecord {
  _id: string;
  customerName: string;
  invoiceNo: string;
  saleType: 'retail' | 'wholesale';
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'pending' | 'partial' | 'paid';
  payments: Array<{ amount: number; date: string; note: string }>;
  createdAt: string;
}

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusColor(status: string) {
  return status === 'paid' ? '#10b981' : status === 'partial' ? '#f59e0b' : '#ef4444';
}

export default function CreditPage() {
  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleType, setSaleType] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [expandedCredit, setExpandedCredit] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<Record<string, string>>({});
  const [paymentNote, setPaymentNote] = useState<Record<string, string>>({});
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        setLoading(true);
        const url = new URL('/api/credit', window.location.origin);
        if (saleType !== 'all') url.searchParams.append('saleType', saleType);
        url.searchParams.append('status', 'pending,partial');

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setCredits(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch credits:', error);
        setCredits([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();
  }, [saleType]);

  const handlePayment = async (creditId: string) => {
    const amount = parseFloat(paymentAmount[creditId] || '0');
    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const credit = credits.find(c => c._id === creditId);
    if (!credit) return;

    if (amount > credit.remainingAmount) {
      alert(`Payment cannot exceed remaining amount (${formatLKR(credit.remainingAmount)})`);
      return;
    }

    setProcessingPayment(creditId);
    try {
      const res = await fetch('/api/credit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditId,
          payment: {
            amount,
            date: new Date(),
            note: paymentNote[creditId] || '',
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to process payment');

      const updated = await res.json();
      setCredits(credits.map(c => c._id === creditId ? updated : c));
      setPaymentAmount({ ...paymentAmount, [creditId]: '' });
      setPaymentNote({ ...paymentNote, [creditId]: '' });
      alert('Payment recorded successfully!');
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to record payment');
    } finally {
      setProcessingPayment(null);
    }
  };

  const totalCredit = credits.reduce((sum, c) => sum + c.remainingAmount, 0);
  const totalPaid = credits.reduce((sum, c) => sum + c.paidAmount, 0);
  const totalAmount = credits.reduce((sum, c) => sum + c.totalAmount, 0);

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '28px', fontWeight: 700 }}>Credit Tracker</h1>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--card-background)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Total Outstanding</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444' }}>{formatLKR(totalCredit)}</div>
        </div>
        <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--card-background)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Total Amount</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--emerald-600)' }}>{formatLKR(totalAmount)}</div>
        </div>
        <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--card-background)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Total Paid</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>{formatLKR(totalPaid)}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
        {(['all', 'retail', 'wholesale'] as const).map(type => (
          <button
            key={type}
            onClick={() => setSaleType(type)}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: saleType === type ? 'var(--emerald-600)' : 'var(--card-background)',
              color: saleType === type ? 'white' : 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 500,
              textTransform: 'capitalize',
              fontSize: '14px',
            }}
          >
            {type === 'all' ? 'All Sales' : type === 'retail' ? 'Retail' : 'Wholesale'}
          </button>
        ))}
      </div>

      {/* Credits Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading credits...</div>
      ) : credits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No outstanding credits found</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--card-background)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Invoice</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 600 }}>Total</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 600 }}>Paid</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 600 }}>Outstanding</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {credits.map(credit => (
                <tbody key={credit._id}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px' }}>{credit.customerName}</td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '12px' }}>{credit.invoiceNo}</td>
                    <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: credit.saleType === 'retail' ? '#dcfce7' : '#fef3c7',
                        color: credit.saleType === 'retail' ? '#15803d' : '#92400e',
                      }}>
                        {credit.saleType}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 500 }}>{formatLKR(credit.totalAmount)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#10b981', fontWeight: 500 }}>{formatLKR(credit.paidAmount)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{formatLKR(credit.remainingAmount)}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: getStatusColor(credit.status) + '20',
                        color: getStatusColor(credit.status),
                        textTransform: 'capitalize',
                      }}>
                        {credit.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => setExpandedCredit(expandedCredit === credit._id ? null : credit._id)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--emerald-600)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                      >
                        {expandedCredit === credit._id ? 'Hide' : 'Add Payment'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Payment Form Row */}
                  {expandedCredit === credit._id && (
                    <tr style={{ background: 'var(--card-background)', borderBottom: '1px solid var(--border-color)' }}>
                      <td colSpan={8} style={{ padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px', display: 'block' }}>Payment Amount</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              max={credit.remainingAmount}
                              value={paymentAmount[credit._id] || ''}
                              onChange={(e) => setPaymentAmount({ ...paymentAmount, [credit._id]: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                fontSize: '14px',
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px', display: 'block' }}>Note</label>
                            <input
                              type="text"
                              placeholder="Payment note"
                              value={paymentNote[credit._id] || ''}
                              onChange={(e) => setPaymentNote({ ...paymentNote, [credit._id]: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                fontSize: '14px',
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                            <button
                              onClick={() => handlePayment(credit._id)}
                              disabled={processingPayment === credit._id}
                              style={{
                                flex: 1,
                                padding: '8px 16px',
                                background: 'var(--emerald-600)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: processingPayment === credit._id ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                                opacity: processingPayment === credit._id ? 0.6 : 1,
                              }}
                            >
                              {processingPayment === credit._id ? 'Processing...' : 'Record Payment'}
                            </button>
                          </div>
                        </div>

                        {/* Payment History */}
                        {credit.payments.length > 0 && (
                          <div style={{ marginTop: '16px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Payment History</h4>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                              {credit.payments.map((payment, idx) => (
                                <div key={idx} style={{
                                  padding: '8px',
                                  background: 'var(--card-background)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  marginBottom: '4px',
                                  fontSize: '12px',
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600 }}>{formatLKR(payment.amount)}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{new Date(payment.date).toLocaleDateString('en-LK')}</span>
                                  </div>
                                  {payment.note && <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Note: {payment.note}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
