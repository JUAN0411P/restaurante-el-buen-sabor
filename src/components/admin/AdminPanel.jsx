import { useState } from 'react';
import {
  TrendingUp, UtensilsCrossed, Users, Calendar, Shield, DollarSign, User,
  Edit3, Trash2, Plus, UserPlus, UserCheck, Crown, Check, X, RefreshCw,
  Bell
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, formatMoney, formatDateTime, todayISO, DATA_VERSION } from '../../lib/utils';
import {
  SEED_USERS, SEED_MENU, SEED_PLANES, SEED_SUSCRIPTORES, SEED_MESAS,
  SEED_EVENTS, SEED_NOTIFICATIONS
} from '../../lib/seed';
import { Card, Tag, Btn, EmptyState, KickerLabel } from '../ui/primitives';
import { UserFormModal, MenuItemFormModal, NewSubModal } from './AdminModals';
import { PlanesTab } from './PlanesManager';
import { SubscriberDetailModal } from './SubscriberDetailModal';

export function AdminPanel({ activeTab, menu, planes, suscriptores, orders, mesas, users, events, refresh }) {
  const tab = activeTab || 'dash';
  const [editMenu, setEditMenu] = useState(null);
  const [newMenuItem, setNewMenuItem] = useState(false);
  const [newSub, setNewSub] = useState(false);
  const [newUser, setNewUser] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [detailSub, setDetailSub] = useState(null);

  const today = todayISO();
  const ordersToday = orders.filter(o => o.fecha?.slice(0, 10) === today);
  const ventasMenu = ordersToday.filter(o => o.tipo === 'menu' && o.pagado).reduce((s, o) => s + o.total, 0);
  const ventasSubs = ordersToday.filter(o => o.tipo === 'suscripcion' && o.estado === 'entregado').length;
  const platosVendidos = ordersToday.filter(o => o.estado === 'entregado').reduce((s, o) => s + o.items.reduce((a, i) => a + i.cantidad, 0), 0);

  const eliminarPlato = async (id) => {
    if (!confirm('¿Eliminar este plato?')) return;
    await db.set('rest:menu', menu.filter(m => m.id !== id));
    refresh();
  };
  const toggleSubInvitados = async (subId) => {
    await db.set('rest:subs', suscriptores.map(s => s.id === subId ? { ...s, permitir_invitados: !s.permitir_invitados } : s));
    refresh();
  };
  const toggleSubActivo = async (subId) => {
    await db.set('rest:subs', suscriptores.map(s => s.id === subId ? { ...s, activo: !s.activo } : s));
    refresh();
  };
  const toggleUserActivo = async (userId) => {
    await db.set('rest:users', users.map(u => u.id === userId ? { ...u, activo: !u.activo } : u));
    refresh();
  };
  const eliminarUser = async (userId) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    await db.set('rest:users', users.filter(u => u.id !== userId));
    refresh();
  };

  const resetData = async () => {
    if (!confirm('Esto borrará TODOS los datos y restaurará los demo. ¿Continuar?')) return;
    await db.set('rest:version', DATA_VERSION);
    await db.set('rest:users', SEED_USERS);
    await db.set('rest:menu', SEED_MENU);
    await db.set('rest:planes', SEED_PLANES);
    await db.set('rest:subs', SEED_SUSCRIPTORES);
    await db.set('rest:mesas', SEED_MESAS);
    await db.set('rest:orders', []);
    await db.set('rest:events', SEED_EVENTS);
    await db.set('rest:notifications', SEED_NOTIFICATIONS);
    refresh();
    alert('Datos restaurados');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <KickerLabel>— vista general · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}</KickerLabel>
          <h2 style={{ ...FontFraunces, fontSize: 30, color: T.text, margin: 0, letterSpacing: '-0.015em' }}>
            Panel administrativo
          </h2>
        </div>
        <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={resetData}>Restaurar demo</Btn>
      </div>

      {/* DASHBOARD */}
      {tab === 'dash' && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div style={{ display: 'grid', gap: 14 }} className="grid grid-cols-2 md:grid-cols-4">
            <DashStat label="VENTAS MENÚ HOY" value={formatMoney(ventasMenu)} tone={T.terracotta} />
            <DashStat label="ALMUERZOS SUSC." value={ventasSubs} tone={T.olive} />
            <DashStat label="PLATOS SERVIDOS" value={platosVendidos} tone={T.mustard} />
            <DashStat label="SUSCRIPTORES" value={suscriptores.filter(s => s.activo && s.plan_id).length} tone={T.plum} />
          </div>

          <div style={{ display: 'grid', gap: 18 }} className="grid md:grid-cols-[1.3fr_1fr] grid-cols-1">
            {/* Top platos */}
            <Card padding={20}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <KickerLabel>— top 5</KickerLabel>
                  <div style={{ ...FontFraunces, fontSize: 22, color: T.text }}>Platos más vendidos hoy</div>
                </div>
                <Tag tone="neutral" size="xs">ACTUALIZADO {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</Tag>
              </div>
              {menu.filter(m => m.vendidos > 0).length === 0 ? (
                <EmptyState title="Aún no hay ventas hoy" />
              ) : (
                menu.filter(m => m.vendidos > 0).sort((a, b) => b.vendidos - a.vendidos).slice(0, 5).map((p, i, arr) => {
                  const max = arr[0].vendidos;
                  const pct = (p.vendidos / max) * 100;
                  return (
                    <div key={p.id} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ ...FontMono, fontSize: 11, color: T.textMute, width: 20 }}>0{i + 1}</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{p.nombre}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                          <span style={{ fontSize: 12, color: T.textSoft, ...FontMono }}>{formatMoney(p.precio)}</span>
                          <span style={{ ...FontFraunces, fontSize: 18, color: T.olive, fontStyle: 'italic' }}>{p.vendidos}</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: T.bgSoft, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: T.olive, borderRadius: 2, transformOrigin: 'left', animation: 'ebs-grow 1.1s cubic-bezier(.2,.8,.2,1) both' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </Card>

            {/* Mesas ocupadas + acciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Card padding={18}>
                <KickerLabel>— en vivo</KickerLabel>
                <div style={{ ...FontFraunces, fontSize: 18, color: T.text, marginBottom: 12 }}>Mesas ocupadas</div>
                {mesas.filter(m => m.comensales.length > 0).length === 0 ? (
                  <p style={{ fontSize: 12, color: T.textMute, textAlign: 'center', padding: '16px 0' }}>Sin mesas ocupadas</p>
                ) : (
                  mesas.filter(m => m.comensales.length > 0).map(m => {
                    const subsC = m.comensales.filter(c => c.tipo === 'suscripcion').length;
                    const menuC = m.comensales.filter(c => c.tipo === 'menu').length;
                    const invC = m.comensales.filter(c => c.tipo === 'invitado').length;
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.borderSoft}`, gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: T.mustardSoft, color: T.mustard, ...FontFraunces, fontSize: 14, display: 'grid', placeItems: 'center' }}>
                            {m.numero}
                          </div>
                          <span style={{ fontSize: 13, color: T.text }}>Mesa {m.numero}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {subsC > 0 && <Tag tone="olive" size="xs">{subsC} SUSC</Tag>}
                          {menuC > 0 && <Tag tone="mustard" size="xs">{menuC} MENÚ</Tag>}
                          {invC > 0 && <Tag tone="plum" size="xs">{invC} INV</Tag>}
                        </div>
                      </div>
                    );
                  })
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
      {/* MENU */}
      {tab === 'menu' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm" style={{ color: T.textSoft }}>{menu.length} platos configurados</p>
            <Btn icon={Plus} onClick={() => setNewMenuItem(true)}>Nuevo plato</Btn>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {menu.map(m => (
              <Card key={m.id} padding="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium" style={{ color: T.text }}>{m.nombre}</h4>
                      <Tag>{m.categoria}</Tag>
                    </div>
                    <p className="text-xs mb-2" style={{ color: T.textSoft }}>{m.descripcion}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-medium" style={{ color: T.accent }}>{formatMoney(m.precio)}</span>
                      <span style={{ color: T.textSoft }}>·</span>
                      <span style={{ color: T.textSoft }}>{m.disponibles} disp.</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setEditMenu(m)} className="p-1.5 rounded" style={{ color: T.textSoft }}><Edit3 size={14} /></button>
                    <button onClick={() => eliminarPlato(m.id)} className="p-1.5 rounded" style={{ color: T.accent }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <MenuItemFormModal open={!!editMenu || newMenuItem} onClose={() => { setEditMenu(null); setNewMenuItem(false); }} item={editMenu} menu={menu} refresh={refresh} />
        </div>
      )}

      {/* SUBSCRIBERS */}
      {tab === 'subs' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="text-sm" style={{ color: T.textSoft }}>{suscriptores.length} suscriptores</p>
              <p className="text-xs" style={{ color: T.textMute }}>Doble clic para ver historial completo</p>
            </div>
            <Btn icon={Plus} onClick={() => setNewSub(true)}>Nuevo suscriptor</Btn>
          </div>
          <div className="space-y-2">
            {suscriptores.map(s => {
              const plan = planes.find(p => p.id === s.plan_id);
              return (
                <Card key={s.id} padding="p-4"
                  onClick={() => {}}
                  style={{ cursor: 'pointer' }}>
                  <div onDoubleClick={() => setDetailSub(s)} className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[250px]">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium" style={{ color: T.text }}>{s.nombre}</h4>
                        <Tag color={s.activo ? 'green' : 'gray'}>{s.codigo}</Tag>
                        {s.permitir_invitados && <Tag color="blue"><Crown size={10} /> Invita</Tag>}
                        {!s.plan_id && <Tag color="amber">Sin plan</Tag>}
                      </div>
                      <p className="text-xs" style={{ color: T.textSoft }}>{s.email} · {s.cedula} · {s.telefono}</p>
                      <p className="text-xs mt-1" style={{ color: T.textSoft }}>
                        {plan ? `${plan.nombre} · ${s.almuerzos_restantes} almuerzos · vence ${s.fecha_vencimiento}` : 'Pendiente de activación'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg }}>
                        <UserCheck size={14} style={{ color: s.permitir_invitados ? T.green : T.textMute }} />
                        <span className="text-xs" style={{ color: T.text }}>Invitados</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSubInvitados(s.id); }}
                          className="relative w-9 h-5 rounded-full"
                          style={{ backgroundColor: s.permitir_invitados ? T.green : T.border }}>
                          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: s.permitir_invitados ? '18px' : '2px' }} />
                        </button>
                      </div>
                      <Btn size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailSub(s); }}>
                        Ver detalle
                      </Btn>
                      <button onClick={(e) => { e.stopPropagation(); toggleSubActivo(s.id); }} className="p-1.5 rounded" style={{ color: T.textSoft }}>
                        {s.activo ? <X size={14} /> : <Check size={14} />}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <NewSubModal open={newSub} onClose={() => setNewSub(false)} suscriptores={suscriptores} refresh={refresh} />
          <SubscriberDetailModal
            open={!!detailSub}
            onClose={() => setDetailSub(null)}
            sub={detailSub}
            plan={detailSub ? planes.find(p => p.id === detailSub.plan_id) : null}
            events={events}
            orders={orders}
            refresh={refresh}
          />
        </div>
      )}

      {/* PLANS */}
      {tab === 'planes' && <PlanesTab planes={planes} refresh={refresh} />}

      {/* STAFF */}
      {tab === 'users' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm" style={{ color: T.textSoft }}>{users.length} cuentas de personal</p>
            <Btn icon={UserPlus} onClick={() => setNewUser(true)}>Nuevo usuario</Btn>
          </div>
          <Card padding="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: T.bg }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textSoft }}>Usuario</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textSoft }}>Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textSoft }}>Rol</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textSoft }}>Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textSoft }}>Último ingreso</th>
                    <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: T.textSoft }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: T.textSoft }}>{u.usuario}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: T.text }}>{u.nombre}</td>
                      <td className="px-4 py-3"><Tag color={u.rol === 'admin' ? 'accent' : 'blue'}>{u.rol}</Tag></td>
                      <td className="px-4 py-3"><Tag color={u.activo ? 'green' : 'gray'}>{u.activo ? 'Activo' : 'Inactivo'}</Tag></td>
                      <td className="px-4 py-3 text-xs" style={{ color: T.textSoft }}>{u.lastLogin ? formatDateTime(u.lastLogin) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setEditUser(u)} className="p-1.5 rounded" style={{ color: T.textSoft }}><Edit3 size={14} /></button>
                          <button onClick={() => toggleUserActivo(u.id)} className="p-1.5 rounded" style={{ color: T.textSoft }}>
                            {u.activo ? <X size={14} /> : <Check size={14} />}
                          </button>
                          <button onClick={() => eliminarUser(u.id)} className="p-1.5 rounded" style={{ color: T.accent }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <UserFormModal open={newUser || !!editUser} onClose={() => { setNewUser(false); setEditUser(null); }} user={editUser} users={users} refresh={refresh} />
        </div>
      )}
    </div>
  );
}

function DashStat({ label, value, tone }) {
  return (
    <Card padding={18}>
      <div style={{ fontSize: 10, color: T.textSoft, ...FontMono, fontWeight: 600, letterSpacing: '.1em' }}>
        {label}
      </div>
      <div style={{ ...FontFraunces, fontSize: 38, color: tone, lineHeight: 1, marginTop: 10, fontStyle: 'italic' }}>
        {value}
      </div>
    </Card>
  );
}
