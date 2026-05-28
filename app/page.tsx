'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  today: { revenue: number; profit: number; count: number };
  week: { revenue: number; profit: number };
  month: { revenue: number; profit: number };
  year: { revenue: number; profit: number };
  totalCustomers: number;
  totalProducts: number;
  lowStockProducts: number;
  lowStockList: Array<{ _id: string; name: string; stock: number; unit: string }>;
  totalOutstanding: number;
  recentSales: Array<{
    _id: string;
    invoiceNo: string;
    customerName: string;
    total: number;
    profit: number;
    saleType: string;
    paymentMethod: string;
    date: string;
  }>;
  dailyProfits: Array<{ date: string; profit: number; revenue: number }>;
  categoryBreakdown: Record<string, number>;
  cashierBreakdown: Record<string, { revenue: number; count: number }>;
}

interface Reminder {
  _id: string;
  text: string;
  done: boolean;
  createdByName?: string;
  completedByName?: string;
  createdAt?: string;
}

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newReminder, setNewReminder] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);
  const [clearingSales, setClearingSales] = useState(false);
  const [userRole, setUserRole] = useState<string>('cashier');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('today');

  const fetchDashboard = async () => {
    const res = await fetch('/api/dashboard');
    if (!res.ok) {
      throw new Error('Failed to load data');
    }
    const dashboardData = await res.json();
    setData(dashboardData);
  };

  const fetchReminders = () => {
    fetch('/api/reminders')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load reminders');
        return r.json();
      })
      .then((items) => setReminders(Array.isArray(items) ? items : []))
      .catch((e) => {
        console.error(e);
        setReminders([]);
      });
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then((r) => {
        if (!r.ok) throw new Error('Failed to load data');
        return r.json();
      }),
      fetch('/api/reminders').then((r) => {
        if (!r.ok) throw new Error('Failed to load reminders');
        return r.json();
      }),
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : { user: null }))
        .catch(() => ({ user: null })),
    ])
      .then(([dashboardData, reminderData, me]) => {
        setData(dashboardData);
        setReminders(Array.isArray(reminderData) ? reminderData : []);
        setUserRole(me?.user?.role || 'cashier');
      })
      .catch((e) => {
        console.error(e);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAddReminder = async () => {
    const text = newReminder.trim();
    if (!text || savingReminder) return;

    setSavingReminder(true);
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to add reminder' }));
        alert(data.error || 'Failed to add reminder');
        return;
      }

      setNewReminder('');
      fetchReminders();
    } catch (error) {
      console.error(error);
      alert('Failed to add reminder');
    } finally {
      setSavingReminder(false);
    }
  };

  const handleToggleReminder = async (id: string, done: boolean) => {
    try {
      const res = await fetch('/api/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, done }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to update reminder' }));
        alert(data.error || 'Failed to update reminder');
        return;
      }

      setReminders((prev) =>
        prev.map((item) => (item._id === id ? { ...item, done } : item))
      );
      fetchReminders();
    } catch (error) {
      console.error(error);
      alert('Failed to update reminder');
    }
  };

  const handleClearRecentSales = async () => {
    if (userRole !== 'admin' || clearingSales || !data || data.recentSales.length === 0) return;

    const confirmed = window.confirm('Are you sure you want to clear all sales globally? This will also remove Reports history and cannot be undone.');
    if (!confirmed) return;

    setClearingSales(true);
    try {
      const res = await fetch('/api/sales', { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Failed to clear sales' }));
        alert(payload.error || 'Failed to clear sales');
        return;
      }

      await fetchDashboard();
      alert('Recent sales cleared');
    } catch (error) {
      console.error(error);
      alert('Failed to clear sales');
    } finally {
      setClearingSales(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <span className="icon">⚠️</span>
        <h3>Unable to Load Dashboard</h3>
        <p>Please check your database connection and try again.</p>
      </div>
    );
  }

  const periodData = data[period];
  const revenue = 'revenue' in periodData ? periodData.revenue : 0;
  const profit = 'profit' in periodData ? periodData.profit : 0;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back to SUNFLOWER AGRI Agribusiness POS</p>
      </div>

      {/* Period Tabs */}
      <div className="tabs">
        {(['today', 'week', 'month', 'year'] as const).map((p) => (
          <button
            key={p}
            className={`tab ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="stat-cards-grid">
        <div className="stat-card animate-slide-up">
          <div className="stat-card-header">
            <span className="stat-card-label">Revenue</span>
            <div className="stat-card-icon green">💰</div>
          </div>
          <div className="stat-card-value">{formatLKR(revenue)}</div>
          {period === 'today' && (
            <div className="stat-card-change positive">
              {data.today.count} sale{data.today.count !== 1 ? 's' : ''} today
            </div>
          )}
        </div>

        <div className="stat-card animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="stat-card-header">
            <span className="stat-card-label">Profit</span>
            <div className="stat-card-icon blue">📈</div>
          </div>
          <div className="stat-card-value" style={{ color: profit >= 0 ? 'var(--emerald-400)' : 'var(--danger)' }}>
            {formatLKR(profit)}
          </div>
          {revenue > 0 && (
            <div className="stat-card-change positive">
              {((profit / revenue) * 100).toFixed(1)}% margin
            </div>
          )}
        </div>

        <div className="stat-card animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="stat-card-header">
            <span className="stat-card-label">Total Customers</span>
            <div className="stat-card-icon yellow">👥</div>
          </div>
          <div className="stat-card-value">{data.totalCustomers}</div>
        </div>

        <div className="stat-card animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="stat-card-header">
            <span className="stat-card-label">Low Stock Items</span>
            <div className={`stat-card-icon ${data.lowStockProducts > 0 ? 'red' : 'green'}`}>
              {data.lowStockProducts > 0 ? '⚠️' : '✅'}
            </div>
          </div>
          <div className="stat-card-value">{data.lowStockProducts}</div>
        </div>

        <div className="stat-card animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="stat-card-header">
            <span className="stat-card-label">Outstanding Credit</span>
            <div className="stat-card-icon yellow">💳</div>
          </div>
          <div className="stat-card-value" style={{ color: data.totalOutstanding > 0 ? 'var(--warning)' : 'var(--emerald-400)' }}>
            {formatLKR(data.totalOutstanding)}
          </div>
        </div>

        <div className="stat-card animate-slide-up" style={{ animationDelay: '250ms' }}>
          <div className="stat-card-header">
            <span className="stat-card-label">Products</span>
            <div className="stat-card-icon green">📦</div>
          </div>
          <div className="stat-card-value">{data.totalProducts}</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* 7-Day Profit Trend */}
        <div className="chart-card">
          <h3>📊 7-Day Profit Trend</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.dailyProfits.map((day) => {
              const maxProfit = Math.max(...data.dailyProfits.map((d) => d.profit), 1);
              const width = (day.profit / maxProfit) * 100;
              const dayName = new Date(day.date).toLocaleDateString('en-LK', { weekday: 'short' });
              return (
                <div key={day.date} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '36px', flexShrink: 0 }}>{dayName}</span>
                  <div style={{ flex: 1, height: '24px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(width, 2)}%`,
                        height: '100%',
                        background: day.profit >= 0
                          ? 'linear-gradient(90deg, var(--emerald-700), var(--emerald-500))'
                          : 'linear-gradient(90deg, #7f1d1d, var(--danger))',
                        borderRadius: '4px',
                        transition: 'width 0.8s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', width: '90px', textAlign: 'right', flexShrink: 0 }}>
                    {formatLKR(day.profit)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="chart-card">
          <h3>🥧 Sales by Category</h3>
          {Object.keys(data.categoryBreakdown).length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
              No sales data yet
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(data.categoryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => {
                  const total = Object.values(data.categoryBreakdown).reduce((s, v) => s + v, 0);
                  const percent = ((amount / total) * 100).toFixed(1);
                  return (
                    <div key={category}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{category}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{percent}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--emerald-600), var(--emerald-400))',
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alerts */}
      {data.lowStockList && data.lowStockList.length > 0 && (
        <div className="card mb-24">
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--warning)' }}>
            ⚠️ Low Stock Alerts
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {data.lowStockList.map((p) => (
              <div
                key={p._id}
                style={{
                  padding: '8px 16px',
                  background: 'var(--warning-soft)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                }}
              >
                <strong>{p.name}</strong>
                <span style={{ color: 'var(--warning)', marginLeft: '8px' }}>
                  {p.stock} {p.unit} left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin / Cashier Breakdown (Today) */}
      <div className="card mb-24">
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
          👨‍💼 Today's Sales by Admin
        </h3>
        {Object.keys(data.cashierBreakdown || {}).length === 0 ? (
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '10px' }}>No sales recorded today.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            {Object.entries(data.cashierBreakdown).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, stats]) => (
              <div key={name} style={{
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'var(--emerald-600)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '14px'
                  }}>
                    {name.charAt(0)}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{name}</div>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--emerald-400)' }}>
                  {formatLKR(stats.revenue)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {stats.count} sale{stats.count !== 1 ? 's' : ''} today
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reminders */}
      <div className="card mb-24">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>🔔 Admin Reminders</h3>
          <span className="badge badge-neutral">{reminders.filter((r) => !r.done).length} pending</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            type="text"
            placeholder={userRole === 'admin' ? 'Add reminder...' : 'Only admins can add reminders'}
            value={newReminder}
            onChange={(e) => setNewReminder(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddReminder();
            }}
            disabled={userRole !== 'admin' || savingReminder}
            style={{ flex: '1 1 280px' }}
          />
          <button
            className="btn btn-primary"
            onClick={handleAddReminder}
            disabled={userRole !== 'admin' || !newReminder.trim() || savingReminder}
          >
            {savingReminder ? 'Adding...' : 'Add Reminder'}
          </button>
        </div>

        {reminders.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>No reminders yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reminders.map((reminder) => (
              <label
                key={reminder._id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  background: reminder.done ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-input)',
                }}
              >
                <input
                  type="checkbox"
                  checked={reminder.done}
                  onChange={(e) => handleToggleReminder(reminder._id, e.target.checked)}
                  disabled={userRole !== 'admin'}
                  style={{ marginTop: '3px' }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      color: reminder.done ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: reminder.done ? 'line-through' : 'none',
                    }}
                  >
                    {reminder.text}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Added by {reminder.createdByName || 'Admin'}
                    {reminder.done && reminder.completedByName ? ` · Done by ${reminder.completedByName}` : ''}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sales */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 0 }}>🧾 Recent Sales</h3>
          {userRole === 'admin' && (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleClearRecentSales}
              disabled={clearingSales || data.recentSales.length === 0}
            >
              {clearingSales ? 'Clearing...' : 'Clear Recent Sales'}
            </button>
          )}
        </div>
        {data.recentSales.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>No sales yet</p>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Payment</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Profit</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSales.map((sale) => (
                  <tr key={sale._id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{sale.invoiceNo}</td>
                    <td>{sale.customerName}</td>
                    <td>
                      <span className={`badge ${sale.saleType === 'retail' ? 'badge-info' : 'badge-warning'}`}>
                        {sale.saleType}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{sale.paymentMethod}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatLKR(sale.total)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: sale.profit >= 0 ? 'var(--emerald-400)' : 'var(--danger)' }}>
                      {formatLKR(sale.profit)}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(sale.date).toLocaleDateString('en-LK')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
