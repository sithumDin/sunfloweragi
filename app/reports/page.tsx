'use client';

import { useEffect, useState } from 'react';
import { generateReport, generateReceipt } from '@/lib/pdf';

interface Sale {
  _id: string;
  invoiceNo: string;
  customerName: string;
  cashierName?: string;
  cashierId?: string;
  items: Array<{
    product: string;
    productName: string;
    qty: number;
    unitPrice: number;
    costPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  profit: number;
  paymentMethod: string;
  saleType: string;
  date: string;
}

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchSales = () => {
    setLoading(true);
    let from = '';
    let to = '';
    const now = new Date();

    switch (period) {
      case 'today':
        from = now.toISOString().split('T')[0];
        to = from;
        break;
      case 'week': {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        from = weekStart.toISOString().split('T')[0];
        to = now.toISOString().split('T')[0];
        break;
      }
      case 'month':
        from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        to = now.toISOString().split('T')[0];
        break;
      case 'year':
        from = `${now.getFullYear()}-01-01`;
        to = now.toISOString().split('T')[0];
        break;
      case 'custom':
        from = fromDate;
        to = toDate;
        break;
    }

    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('limit', '500');

    fetch(`/api/sales?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setSales(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error(e);
        setSales([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSales();
  }, [period, fromDate, toDate]);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = sales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => itemSum + item.costPrice * item.qty, 0);
  }, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);

  // Admin-wise sales and profit
  const adminMap: Record<string, { name: string; salesCount: number; revenue: number; profit: number }> = {};
  for (const sale of sales) {
    const adminName = sale.cashierName?.trim() || 'Unknown Admin';
    if (!adminMap[adminName]) {
      adminMap[adminName] = {
        name: adminName,
        salesCount: 0,
        revenue: 0,
        profit: 0,
      };
    }
    adminMap[adminName].salesCount += 1;
    adminMap[adminName].revenue += sale.total;
    adminMap[adminName].profit += sale.profit;
  }
  const adminPerformance = Object.values(adminMap).sort((a, b) => b.revenue - a.revenue);
  const adminSales = adminPerformance.reduce((sum, admin) => sum + admin.salesCount, 0);
  const adminProfit = adminPerformance.reduce((sum, admin) => sum + admin.profit, 0);

  // Top products
  const productMap: Record<string, { name: string; total: number; qty: number }> = {};
  for (const sale of sales) {
    for (const item of sale.items) {
      if (!productMap[item.productName]) {
        productMap[item.productName] = { name: item.productName, total: 0, qty: 0 };
      }
      productMap[item.productName].total += item.total;
      productMap[item.productName].qty += item.qty;
    }
  }
  const topProducts = Object.values(productMap).sort((a, b) => b.total - a.total);

  // Payment method breakdown
  const paymentBreakdown: Record<string, number> = {};
  for (const sale of sales) {
    paymentBreakdown[sale.paymentMethod] = (paymentBreakdown[sale.paymentMethod] || 0) + sale.total;
  }

  // Sale type breakdown
  const retailSales = sales.filter((s) => s.saleType === 'retail');
  const wholesaleSales = sales.filter((s) => s.saleType === 'wholesale');

  const getPeriodLabel = () => {
    const now = new Date();
    switch (period) {
      case 'today': return now.toLocaleDateString('en-LK', { dateStyle: 'long' });
      case 'week': return 'This Week';
      case 'month': return now.toLocaleDateString('en-LK', { month: 'long', year: 'numeric' });
      case 'year': return String(now.getFullYear());
      case 'custom': return `${fromDate} to ${toDate}`;
      default: return '';
    }
  };

  const handleDownloadReport = async () => {
    await generateReport({
      title: `${period.charAt(0).toUpperCase() + period.slice(1)} Report`,
      period: getPeriodLabel(),
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      salesCount: sales.length,
      adminSales,
      adminProfit,
      adminPerformance: adminPerformance.map((admin) => ({
        name: admin.name,
        salesCount: admin.salesCount,
        profit: admin.profit,
      })),
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>📈 Reports</h1>
        <p>Analyze your business performance</p>
      </div>

      {/* Filter Bar */}
      <div className="report-filter-bar">
        <div className="tabs" style={{ marginBottom: 0 }}>
          {['today', 'week', 'month', 'year', 'custom'].map((p) => (
            <button
              key={p}
              className={`tab ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              className="form-input"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ width: '160px' }}
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input
              className="form-input"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ width: '160px' }}
            />
          </div>
        )}

        <button className="btn btn-primary" onClick={handleDownloadReport}>
          👁️ Preview PDF Report
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="report-summary">
            <div className="report-card">
              <h4>Total Revenue</h4>
              <div className="amount revenue">{formatLKR(totalRevenue)}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {sales.length} sale{sales.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="report-card">
              <h4>Total Cost</h4>
              <div className="amount cost">{formatLKR(totalCost)}</div>
            </div>
            <div className="report-card">
              <h4>Net Profit</h4>
              <div className="amount profit">{formatLKR(totalProfit)}</div>
              {totalRevenue > 0 && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {((totalProfit / totalRevenue) * 100).toFixed(1)}% margin
                </div>
              )}
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="charts-grid" style={{ marginBottom: '24px' }}>
            {/* Sale Type Breakdown */}
            <div className="chart-card">
              <h3>📊 Sales Breakdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                <div style={{
                  padding: '16px',
                  background: 'var(--info-soft)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Retail</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--info)' }}>
                    {retailSales.length}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {formatLKR(retailSales.reduce((s, sale) => s + sale.total, 0))}
                  </div>
                </div>
                <div style={{
                  padding: '16px',
                  background: 'var(--warning-soft)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Wholesale</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--warning)' }}>
                    {wholesaleSales.length}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {formatLKR(wholesaleSales.reduce((s, sale) => s + sale.total, 0))}
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <h3 style={{ marginTop: '20px' }}>💳 Payment Methods</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {Object.entries(paymentBreakdown).map(([method, amount]) => (
                  <div key={method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ textTransform: 'capitalize', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      {method === 'cash' ? '💵' : method === 'card' ? '💳' : '🏦'} {method}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{formatLKR(amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Products */}
            <div className="chart-card">
              <h3>🏆 Top Products</h3>
              {topProducts.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>No sales data</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  {topProducts.slice(0, 8).map((p, i) => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: i < 3 ? 'var(--success-soft)' : 'var(--bg-input)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: i < 3 ? 'var(--emerald-400)' : 'var(--text-muted)',
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }} className="truncate">{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.qty} sold</div>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--emerald-400)', flexShrink: 0 }}>
                        {formatLKR(p.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Admin Performance */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
              👨‍💼 Sales & Profit by Admin ({getPeriodLabel()})
            </h3>
            {adminPerformance.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <span className="icon">📭</span>
                <h3>No Admin Sales Data</h3>
                <p>No sales available for this period.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Admin</th>
                      <th style={{ textAlign: 'right' }}>Sales Count</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminPerformance.map((admin) => (
                      <tr key={admin.name}>
                        <td style={{ fontWeight: 600 }}>{admin.name}</td>
                        <td style={{ textAlign: 'right' }}>{admin.salesCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatLKR(admin.revenue)}</td>
                        <td style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: admin.profit >= 0 ? 'var(--emerald-400)' : 'var(--danger)'
                        }}>
                          {formatLKR(admin.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sales Table */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
              🧾 Sales History — {getPeriodLabel()}
            </h3>
            {sales.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px' }}>
                <span className="icon">📭</span>
                <h3>No Sales in This Period</h3>
                <p>Try selecting a different date range.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Type</th>
                      <th>Admin</th>
                      <th>Payment</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'right' }}>Profit</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale._id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{sale.invoiceNo}</td>
                        <td>{sale.customerName}</td>
                        <td>{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</td>
                        <td>
                          <span className={`badge ${sale.saleType === 'retail' ? 'badge-info' : 'badge-warning'}`}>
                            {sale.saleType}
                          </span>
                        </td>
                        <td>{sale.cashierName || 'Unknown Admin'}</td>
                        <td style={{ textTransform: 'capitalize' }}>{sale.paymentMethod}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatLKR(sale.total)}</td>
                        <td style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: sale.profit >= 0 ? 'var(--emerald-400)' : 'var(--danger)'
                        }}>
                          {formatLKR(sale.profit)}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {new Date(sale.date).toLocaleDateString('en-LK')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => generateReceipt(sale as any).catch(console.error)}
                            title="Download Receipt"
                          >
                            📥 Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
