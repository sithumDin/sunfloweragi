'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/products', label: 'Products', icon: '📦' },
  { href: '/retail', label: 'Retail Sales', icon: '🛒' },
  { href: '/wholesale', label: 'Wholesale', icon: '🏭' },
  { href: '/quotations', label: 'Quotations', icon: '📄' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/credit', label: 'Credit Tracker', icon: '💳' },
  { href: '/reports', label: 'Reports', icon: '📈' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; username: string; role: string } | null>(null);
  const [startingLockdown, setStartingLockdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLockdownMode, setIsLockdownMode] = useState(false);
  const [allowedDomain, setAllowedDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const allowExitRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    // Check if logo exists
    const checkLogo = async () => {
      try {
        const res = await fetch('/api/logo');
        if (res.headers.get('content-type')?.includes('image')) {
          // Logo exists and is served as an image, use the endpoint as src
          setLogoUrl('/api/logo');
        }
      } catch (error) {
        console.error('Failed to check logo:', error);
      }
    };
    checkLogo();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams(window.location.search);
    setIsLockdownMode(params.get('lockdown') === '1');
    setAllowedDomain(params.get('allowedDomain') || window.location.hostname);
  }, [mounted, pathname]);

  useEffect(() => {
    if (pathname !== '/login') {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.user) setUser(data.user);
        })
        .catch(console.error);
    }
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch('/api/logo', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        alert(data.error || 'Failed to upload logo');
        return;
      }

      const data = await res.json();
      setLogoUrl(data.url + '?t=' + Date.now()); // Add timestamp to bust cache
      setShowLogoUpload(false);
      if (logoFileRef.current) logoFileRef.current.value = '';
      alert('Logo uploaded successfully!');
    } catch (error) {
      console.error('Logo upload error:', error);
      alert('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleStartLockdown = () => {
    if (typeof window === 'undefined' || startingLockdown) return;

    setStartingLockdown(true);
    const url = new URL(window.location.href);
    url.searchParams.set('lockdown', '1');
    url.searchParams.set('allowedDomain', window.location.hostname);

    const width = window.screen.availWidth || window.screen.width;
    const height = window.screen.availHeight || window.screen.height;
    const popup = window.open(
      url.toString(),
      'pos_lockdown_window',
      `popup=yes,toolbar=no,menubar=no,location=no,status=no,scrollbars=no,resizable=yes,width=${width},height=${height},left=0,top=0`
    );

    if (!popup) {
      setStartingLockdown(false);
      alert('Popup blocked. Please allow popups for this site.');
      return;
    }

    const openFullscreen = () => {
      try {
        popup.focus();
        const docEl = popup.document?.documentElement as HTMLElement | undefined;
        if (docEl?.requestFullscreen) {
          void docEl.requestFullscreen().catch(() => {});
        }
      } catch {
        // Ignore cross-window timing issues.
      }
    };

    if (popup.document?.readyState === 'complete') {
      openFullscreen();
    } else {
      popup.addEventListener('load', openFullscreen, { once: true });
    }

    setStartingLockdown(false);
  };

  const handleExitLockdown = async () => {
    if (!user || user.role !== 'admin') return;

    const password = window.prompt('Enter admin password to exit Lockdown Mode:');
    if (!password) return;

    const verify = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, password }),
    });

    if (!verify.ok) {
      alert('Incorrect password. Lockdown mode remains active.');
      return;
    }

    allowExitRef.current = true;

    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }

    const safeUrl = new URL(window.location.href);
    safeUrl.searchParams.delete('lockdown');
    safeUrl.searchParams.delete('allowedDomain');
    window.location.replace(safeUrl.toString());
  };

  useEffect(() => {
    if (!isLockdownMode) return;

    if (allowedDomain && !window.location.hostname.includes(allowedDomain)) {
      window.location.replace(`${window.location.protocol}//${allowedDomain}`);
      return;
    }

    const blocked = (e: KeyboardEvent) => {
      const key = e.key;
      const isBlockedCombo =
        (e.altKey && key === 'F4') ||
        (e.altKey && key === 'Tab') ||
        (e.ctrlKey && key.toLowerCase() === 'w') ||
        (e.ctrlKey && key.toLowerCase() === 't') ||
        (e.ctrlKey && key.toLowerCase() === 'n') ||
        (e.ctrlKey && key === 'Tab') ||
        key === 'F1' ||
        key === 'Meta';

      if (isBlockedCombo) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]',
    ].join(',');

    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    };

    const moveFocusByArrow = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.tagName.toLowerCase() === 'select' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const selectEl = targetEl as HTMLSelectElement;
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = Math.min(Math.max(selectEl.selectedIndex + dir, 0), selectEl.options.length - 1);
        if (nextIndex !== selectEl.selectedIndex) {
          e.preventDefault();
          selectEl.selectedIndex = nextIndex;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }

      // Keep native arrow behavior inside editable controls and dropdowns.
      if (isEditableTarget(e.target)) return;

      const focusables = Array.from(document.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);
      if (focusables.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      let index = active ? focusables.indexOf(active) : -1;

      const movingForward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      if (index === -1) {
        index = movingForward ? 0 : focusables.length - 1;
      } else {
        index = movingForward
          ? (index + 1) % focusables.length
          : (index - 1 + focusables.length) % focusables.length;
      }

      e.preventDefault();
      focusables[index]?.focus();
    };

    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const confirmExit = (e: BeforeUnloadEvent) => {
      if (allowExitRef.current) return;
      e.preventDefault();
      e.returnValue = 'Exit POS Lockdown Mode?';
    };

    const guardLinks = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (!anchor?.href) return;

      try {
        const hrefUrl = new URL(anchor.href, window.location.origin);
        if (!hrefUrl.hostname.includes(allowedDomain)) {
          e.preventDefault();
          alert('Navigation outside POS domain is blocked in Lockdown Mode.');
        }
      } catch {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', blocked, true);
    window.addEventListener('keydown', moveFocusByArrow, true);
    window.addEventListener('contextmenu', blockContextMenu);
    window.addEventListener('beforeunload', confirmExit);
    document.addEventListener('click', guardLinks, true);

    return () => {
      window.removeEventListener('keydown', blocked, true);
      window.removeEventListener('keydown', moveFocusByArrow, true);
      window.removeEventListener('contextmenu', blockContextMenu);
      window.removeEventListener('beforeunload', confirmExit);
      document.removeEventListener('click', guardLinks, true);
    };
  }, [allowedDomain, isLockdownMode]);

  if (pathname === '/login') return null;

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            className="sidebar-logo" 
            onClick={() => user?.role === 'admin' && setShowLogoUpload(true)}
            style={{ cursor: user?.role === 'admin' ? 'pointer' : 'default' }}
            title={user?.role === 'admin' ? 'Click to change logo' : ''}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} />
            ) : (
              '🌿'
            )}
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>SUNFLOWER AGRI</span>
        </div>
        <button className="menu-btn" onClick={() => setOpen(true)}>☰</button>
      </div>

      {/* Mobile Overlay */}
      <div
        className={`mobile-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div 
            className="sidebar-logo"
            onClick={() => user?.role === 'admin' && setShowLogoUpload(true)}
            style={{ cursor: user?.role === 'admin' ? 'pointer' : 'default' }}
            title={user?.role === 'admin' ? 'Click to change logo' : ''}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} />
            ) : (
              '🌿'
            )}
          </div>
          <div className="sidebar-brand">
            <h1>SUNFLOWER AGRI</h1>
            <p>Business POS</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '0 14px 8px' }}>
          {!mounted ? null : !isLockdownMode ? (
            <button
              onClick={handleStartLockdown}
              className="btn btn-danger"
              style={{ width: '100%', fontSize: '12px', padding: '8px' }}
            >
              {startingLockdown ? 'Starting Lockdown...' : 'Lockdown Mode'}
            </button>
          ) : (
            user?.role === 'admin' && (
              <button
                onClick={handleExitLockdown}
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '12px', padding: '8px' }}
              >
                EXIT Lockdown (Admin)
              </button>
            )
          )}
        </div>

        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: 'auto', paddingTop: '16px' }}>
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: 'var(--emerald-600)', color: 'white', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' 
                }}>
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{user.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user.role}</div>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '6px', fontSize: '12px' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
             <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Loading...</div>
          )}
        </div>
      </aside>

      {/* Logo Upload Modal */}
      {showLogoUpload && (
        <div className="modal-overlay" onClick={() => !uploadingLogo && setShowLogoUpload(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 700 }}>Upload Logo</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  Select Logo Image
                </label>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                  disabled={uploadingLogo}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-input)',
                  }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  PNG, JPG, or GIF. Recommended size: 100x100px or larger.
                </p>
              </div>

              {logoUrl && (
                <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Current logo:</p>
                  <img src={logoUrl} alt="Current Logo" style={{ maxWidth: '80px', maxHeight: '80px', borderRadius: '8px' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowLogoUpload(false)}
                  disabled={uploadingLogo}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  {uploadingLogo ? 'Uploading...' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
