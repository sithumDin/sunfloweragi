'use client';

import { useEffect, useState } from 'react';
import { Customer } from '@/lib/types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    type: 'retail' as 'retail' | 'wholesale',
  });

  const fetchCustomers = () => {
    fetch('/api/customers')
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error(e);
        setCustomers([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', address: '', type: 'retail' });
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, address: c.address, type: c.type });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name) return;
    const data = {
      ...(editing ? { _id: editing._id } : {}),
      ...form,
    };

    const res = await fetch('/api/customers', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowModal(false);
      fetchCustomers();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchCustomers();
  };

  const filtered = customers.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchType = !filterType || c.type === filterType;
    return matchSearch && matchType;
  });

  const retailCount = customers.filter((c) => c.type === 'retail').length;
  const wholesaleCount = customers.filter((c) => c.type === 'wholesale').length;

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>👥 Customers</h1>
        <p>Manage your customer database</p>
      </div>

      {/* Stats */}
      <div className="stat-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Customers</span>
            <div className="stat-card-icon green">👥</div>
          </div>
          <div className="stat-card-value">{customers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Retail</span>
            <div className="stat-card-icon blue">🛒</div>
          </div>
          <div className="stat-card-value">{retailCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Wholesale</span>
            <div className="stat-card-icon yellow">🏭</div>
          </div>
          <div className="stat-card-value">{wholesaleCount}</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            style={{ width: '150px' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="icon">👥</span>
          <h3>No Customers Found</h3>
          <p>Add your first customer to get started.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Type</th>
                <th>Added</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c._id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{c.phone || '—'}</td>
                  <td style={{ maxWidth: '200px' }} className="truncate">{c.address || '—'}</td>
                  <td>
                    <span className={`badge ${c.type === 'wholesale' ? 'badge-warning' : 'badge-info'}`}>
                      {c.type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-LK') : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c._id!)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="07X XXXX XXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Type</label>
                  <select
                    className="form-select"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'retail' | 'wholesale' })}
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!form.name}>
                {editing ? 'Update' : 'Add'} Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
