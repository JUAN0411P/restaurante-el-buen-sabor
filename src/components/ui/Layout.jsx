import { useState } from 'react';
import {
  Leaf, LogOut, Bell, Menu, X, Search,
  Shield, DollarSign, UtensilsCrossed, ChefHat, User
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';

const ROLE_LABELS = {
  admin: 'Admin',
  caja: 'Caja',
  mesero: 'Mesero',
  cocina: 'Cocina',
  suscriptor: 'Mi cuenta',
};

const ROLE_SUBTITLES = {
  admin: 'Panel administrativo',
  caja: 'Cobros y mensualidades',
  mesero: 'Mesas del servicio',
  cocina: 'Cola FIFO',
  suscriptor: 'Tu mensualidad',
};

export function Layout({ role, onLogout, navItems, activeTab, onChangeTab, notificationsCount = 0, onOpenNotifications, sidebarExtra, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initials = (role.data?.nombre || ROLE_LABELS[role.type])
    .split(' ').map(p => p[0]).slice(0, 2).join('');

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div style={{ padding: '20px 20px 18px', borderBottom: `1px solid ${T.borderSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: T.olive,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}
          >
            <Leaf size={18} color="#f4ede0" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...FontFraunces, fontSize: 17, color: T.text, lineHeight: 1 }}>El Buen Sabor</div>
            <div
              style={{
                fontSize: 11, color: T.textSoft, marginTop: 2,
                ...FontMono, textTransform: 'uppercase', letterSpacing: '.08em',
              }}
            >
              {ROLE_LABELS[role.type]}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: 10, flex: 1, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const ItemIcon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { onChangeTab(item.id); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10, marginBottom: 2,
                fontSize: 13, fontWeight: 500,
                background: isActive ? T.oliveSoft : 'transparent',
                color: isActive ? T.oliveDark : T.textSoft,
                position: 'relative',
                textAlign: 'left',
                border: 'none',
                cursor: 'pointer',
                transition: 'background .15s, color .15s',
              }}
            >
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: -10, top: 10, bottom: 10,
                    width: 3,
                    background: T.olive,
                    borderRadius: 2,
                  }}
                />
              )}
              <ItemIcon size={15} style={{ opacity: isActive ? 1 : 0.7 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    background: T.mustard,
                    color: '#fff',
                    padding: '1px 6px',
                    borderRadius: 5,
                    ...FontMono,
                    fontWeight: 600,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Extra slot (ej: color picker para meseros) */}
      {sidebarExtra && sidebarExtra}

      {/* User card */}
      <div style={{ padding: 12, borderTop: `1px solid ${T.borderSoft}` }}>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: T.bg,
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: T.terraSoft, color: T.terracotta,
              display: 'grid', placeItems: 'center',
              fontSize: 12, fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {role.data?.nombre || ROLE_LABELS[role.type]}
            </div>
            <div style={{ fontSize: 10, color: T.textSoft, ...FontMono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {role.data?.usuario || role.data?.email || ''}
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            background: 'transparent',
            color: T.textSoft,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </>
  );

  const activeNav = navItems.find(n => n.id === activeTab);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: T.bg, fontFamily: "'Manrope', sans-serif" }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex"
        style={{
          width: 240,
          background: T.card,
          borderRight: `1px solid ${T.border}`,
          flexDirection: 'column',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar (drawer) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(42,42,31,0.45)' }} />
          <aside
            className="absolute left-0 top-0 bottom-0 flex flex-col animate-slide-in"
            style={{ width: 280, background: T.card }}
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* TopBar */}
        <header
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${T.borderSoft}`,
            background: T.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16,
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
          className="lg:px-7"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
              style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: T.text }}
            >
              <Menu size={20} />
            </button>

            <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: T.olive, display: 'grid', placeItems: 'center' }}>
                <Leaf size={16} color="#f4ede0" />
              </div>
            </div>

            <div className="hidden lg:block" style={{ minWidth: 0 }}>
              <div
                style={{
                  ...FontMono,
                  fontSize: 11, color: T.textSoft,
                  textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4,
                }}
              >
                {ROLE_SUBTITLES[role.type]}
              </div>
              <div style={{ ...FontFraunces, fontSize: 24, color: T.text, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeNav?.label || ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                style={{
                  position: 'relative',
                  padding: 8,
                  borderRadius: 10,
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  cursor: 'pointer',
                  color: T.textSoft,
                }}
                className="ebs-btn"
              >
                <Bell size={16} />
                {notificationsCount > 0 && (
                  <div
                    className="ebs-pulse-ring"
                    style={{
                      position: 'absolute',
                      top: 4, right: 4,
                      minWidth: 16, height: 16,
                      borderRadius: 8,
                      background: T.terracotta,
                      color: '#fff',
                      fontSize: 9, fontWeight: 700,
                      display: 'grid', placeItems: 'center',
                      padding: '0 4px',
                    }}
                  >
                    {notificationsCount > 9 ? '9+' : notificationsCount}
                  </div>
                )}
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: '24px 20px', maxWidth: 1400, width: '100%', margin: '0 auto', flex: 1 }} className="lg:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}