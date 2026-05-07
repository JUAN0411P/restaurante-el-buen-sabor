import { useState } from 'react';
import {
  Plus, Banknote, CreditCard, AlertCircle, CheckCircle2, ArrowRight, Wallet
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, supabase, formatMoney, todayISO } from '../../lib/utils';
import { Card, Tag, Btn, Modal, Select, EmptyState, KickerLabel } from '../ui/primitives';
import { NewSubModal } from '../admin/AdminModals';
import { crearNotificacion } from '../ui/NotificationsPanel';

export function CajaPanel({ activeTab, menu, planes, suscriptores, orders, mesas, refresh }) {
  const tab = activeTab || 'cobros';
  const [cobrar, setCobrar] = useState(null);
  const [newSub, setNewSub] = useState(false);
  const [activarPlan, setActivarPlan] = useState(null);
  const [montoRecibido, setMontoRecibido] = useState('');

  const today = todayISO();
  const ordersToday = orders.filter(o => o.fecha?.slice(0, 10) === today);
  const porCobrar = ordersToday.filter(o => o.estado === 'entregado' && !o.pagado && o.tipo === 'menu');
  const cobradas = ordersToday.filter(o => o.pagado);
  const totalDia = cobradas.reduce((s, o) => s + o.total, 0);
  const subsSinPlan = suscriptores.filter(s => s.activo && !s.plan_id);
  const subsPorVencer = suscriptores.filter(s => s.activo && s.plan_id && s.fecha_vencimiento && new Date(s.fecha_vencimiento) < new Date(Date.now() + 7 * 86400000));

  const procesarPago = async (order, metodo) => {
    await supabase
      .from('orders')
      .update({ pagado: true, metodo_pago: metodo, fecha_pago: new Date().toISOString() })
      .eq('id', order.id);

    if (order.comensal_id) {
      await db.update('rest:comensales', order.comensal_id, { left_at: new Date().toISOString() });
    }

    setCobrar(null);
    setMontoRecibido('');
    refresh();
  };

  const montoNum = parseFloat((montoRecibido || '').replace(/[^0-9.]/g, '')) || 0;
  const cambio = cobrar ? montoNum - cobrar.total : 0;

  return (
    <div>
      {/* Stats grid — 2 cols en móvil, 4 en md+ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="TOTAL HOY" value={formatMoney(totalDia)} tone={T.terracotta} />
        <StatCard label="COBRADAS" value={cobradas.length} tone={T.text} />
        <StatCard label="PENDIENTES" value={porCobrar.length} tone={T.mustard} />
        <StatCard label="SIN PLAN" value={subsSinPlan.length} tone={T.plum} />
      </div>

      {/* COBROS POR COBRAR */}
      {tab === 'cobros' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <KickerLabel>— pendientes de cobro</KickerLabel>
            <h3 style={{ ...FontFraunces, fontSize: 22, color: T.text, margin: 0 }}>
              {porCobrar.length} {porCobrar.length === 1 ? 'mesa por cobrar' : 'mesas por cobrar'}
            </h3>
          </div>
          {porCobrar.length === 0 ? (
            <Card><EmptyState icon={CheckCircle2} title="No hay órdenes por cobrar" description="Todo al día 🎉" /></Card>
          ) : (
            <div className="ebs-stagger flex flex-col gap-3">
              {porCobrar.map(o => {
                const mesa = mesas.find(m => m.numero === o.mesa_numero);
                const comensal = (mesa?.comensales || []).find(c => c.id === o.comensal_id);
                return (
                  <Card key={o.id} padding={16} hover>
                    {/* En móvil: apilado. En sm+: fila */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: T.mustardSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <span style={{ ...FontFraunces, fontSize: 22, color: T.mustard }}>{o.mesa_numero}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Mesa {o.mesa_numero}</span>
                          <Tag tone="mustard" size="xs">MENÚ DÍA</Tag>
                          {comensal && <span style={{ fontSize: 11, color: T.textSoft }}>· {comensal.nombre}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: T.textSoft }}>
                          {(o.items || []).map(i => `${i.cantidad}× ${i.nombre}`).join(' · ')}
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
                        <div style={{ ...FontFraunces, fontSize: 24, color: T.terracotta, fontStyle: 'italic' }}>
                          {formatMoney(o.total)}
                        </div>
                        <Btn variant="primary" size="md" onClick={() => setCobrar({ ...o, _comensal: comensal })}>
                          Cobrar →
                        </Btn>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {tab === 'historial' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <KickerLabel>— transacciones del día</KickerLabel>
            <h3 style={{ ...FontFraunces, fontSize: 22, color: T.text, margin: 0 }}>
              {cobradas.length} cobros realizados
            </h3>
          </div>
          {cobradas.length === 0 ? (
            <Card><EmptyState title="Aún no hay cobros hoy" /></Card>
          ) : (
            <div className="flex flex-col gap-2">
              {cobradas.map(o => (
                <Card key={o.id} padding={14}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: o.tipo === 'suscripcion' ? T.oliveSoft : T.mustardSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {o.tipo === 'plan'
                        ? <Wallet size={16} color={T.terracotta} />
                        : <span style={{ ...FontFraunces, fontSize: 14, color: o.tipo === 'suscripcion' ? T.olive : T.mustard }}>{o.mesa_numero}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Tag tone={o.tipo === 'suscripcion' ? 'olive' : o.tipo === 'plan' ? 'terra' : 'mustard'} size="xs">
                          {o.tipo === 'suscripcion' ? 'SUSC' : o.tipo === 'plan' ? 'PLAN' : 'MENÚ'}
                        </Tag>
                        {o.metodo_pago && <Tag tone="neutral" size="xs">{o.metodo_pago}</Tag>}
                      </div>
                      <div style={{ fontSize: 12, color: T.textSoft }}>
                        {o.items.map(i => i.nombre).join(', ')}
                      </div>
                    </div>
                    <span style={{ ...FontFraunces, fontSize: 18, color: T.text }}>{formatMoney(o.total)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTIVAR PLAN */}
      {tab === 'activar' && (
        <div>
          <div style={{ padding: 14, borderRadius: 12, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start', background: T.bgSoft, border: `1px solid ${T.border}` }}>
            <AlertCircle size={18} style={{ color: T.terracotta, flexShrink: 0, marginTop: 2 }} />
            <div>
              <KickerLabel color={T.terracotta}>— accion requerida</KickerLabel>
              <div style={{ ...FontFraunces, fontSize: 18, color: T.text, marginBottom: 4 }}>
                Suscriptores registrados sin plan
              </div>
              <p style={{ fontSize: 12, color: T.textSoft, margin: 0 }}>
                Estos usuarios se registraron en la app pero aún no han cobrado su plan. Asígnales uno aquí para activar su cuenta.
              </p>
            </div>
          </div>
          {subsSinPlan.length === 0 ? (
            <Card><EmptyState icon={CheckCircle2} title="Todos los suscriptores tienen plan activo" /></Card>
          ) : (
            <div className="ebs-stagger flex flex-col gap-3">
              {subsSinPlan.map(s => (
                <Card key={s.id} padding={16} hover>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: T.plumSoft, color: T.plum, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                      {s.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{s.nombre}</span>
                        <Tag tone="neutral" size="xs">{s.codigo}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: T.textSoft, ...FontMono }}>
                        {s.email} · {s.cedula} · {s.telefono}
                      </div>
                    </div>
                    <Btn variant="primary" size="md" icon={Plus} onClick={() => setActivarPlan(s)}>
                      Activar plan →
                    </Btn>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MENSUALIDADES */}
      {tab === 'subs' && (
        <div>
          <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
            <div>
              <KickerLabel>— mensualidades activas</KickerLabel>
              <h3 style={{ ...FontFraunces, fontSize: 22, color: T.text, margin: 0 }}>
                Renovaciones pendientes
              </h3>
            </div>
            <Btn icon={Plus} onClick={() => setNewSub(true)}>Registrar nuevo</Btn>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suscriptores.filter(s => s.plan_id).map(s => {
              const plan = planes.find(p => p.id === s.plan);
              const venceProto = s.fecha_vencimiento && new Date(s.fecha_vencimiento) < new Date(Date.now() + 7 * 86400000);
              return (
                <Card key={s.id} padding={16}>
                  <div className="flex items-start gap-3">
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: T.oliveSoft, color: T.olive, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {s.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{s.nombre}</span>
                        <Tag tone={venceProto ? 'mustard' : 'olive'} size="xs">{s.codigo}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: T.textSoft, marginBottom: 4 }}>{plan?.nombre}</div>
                      <div style={{ fontSize: 12, color: T.textSoft, ...FontMono }}>
                        {s.almuerzos_restantes} alm · vence {s.fecha_vencimiento}
                      </div>
                      {(venceProto || s.almuerzos_restantes <= 3) && (
                        <div style={{ marginTop: 10 }}>
                          <Btn size="sm" variant="ghost" onClick={() => setActivarPlan(s)}>Renovar plan</Btn>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <NewSubModal open={newSub} onClose={() => setNewSub(false)} suscriptores={suscriptores} refresh={refresh} />
        </div>
      )}

      {/* MODAL COBRO */}
      <Modal open={!!cobrar} onClose={() => { setCobrar(null); setMontoRecibido(''); }} title="Procesar pago">
        {cobrar && (
          <div>
            <div style={{ padding: 16, borderRadius: 12, marginBottom: 16, background: T.bg, border: `1px solid ${T.border}` }}>
              <KickerLabel>— detalle del pedido</KickerLabel>
              <p style={{ fontSize: 12, color: T.textSoft, margin: '0 0 8px 0', ...FontMono }}>
                Mesa {cobrar.mesa_numero} {cobrar._comensal && `· ${cobrar._comensal.nombre}`}
              </p>
              {cobrar.items.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: T.text }}>{i.cantidad}× {i.nombre}</span>
                  <span style={{ color: T.textSoft, ...FontMono }}>{formatMoney(i.precio * i.cantidad)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>Total</span>
                <span style={{ ...FontFraunces, fontSize: 24, color: T.terracotta, fontStyle: 'italic' }}>{formatMoney(cobrar.total)}</span>
              </div>
            </div>

            {/* Monto recibido */}
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: T.bgSoft, border: `1px solid ${T.border}` }}>
              <KickerLabel>— monto recibido</KickerLabel>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={montoRecibido}
                  onChange={e => setMontoRecibido(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: 20,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: T.card,
                    color: T.text,
                    outline: 'none',
                    ...FontMono,
                  }}
                />
              </div>
              {montoRecibido !== '' && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: cambio >= 0 ? T.oliveSoft : '#fdf0ed',
                  border: `1px solid ${cambio >= 0 ? T.olive : '#a83c2c'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}>
                  <span style={{ fontSize: 12, color: T.textSoft, ...FontMono, fontWeight: 600 }}>
                    {cambio >= 0 ? 'CAMBIO A ENTREGAR' : 'FALTA'}
                  </span>
                  <span style={{
                    ...FontFraunces,
                    fontSize: 22,
                    fontStyle: 'italic',
                    color: cambio >= 0 ? T.olive : '#a83c2c',
                  }}>
                    {formatMoney(Math.abs(cambio))}
                  </span>
                </div>
              )}
            </div>

            <KickerLabel>— método de pago</KickerLabel>
            {/* Botones de pago: 1 col en móvil muy pequeño, 3 en sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              <Btn variant="ghost" icon={Banknote} onClick={() => procesarPago(cobrar, 'efectivo')}>Efectivo</Btn>
              <Btn variant="ghost" icon={CreditCard} onClick={() => procesarPago(cobrar, 'tarjeta')}>Tarjeta</Btn>
              <Btn variant="ghost" onClick={() => procesarPago(cobrar, 'transferencia')}>Transferencia</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL ACTIVAR PLAN */}
      <ActivarPlanModal
        open={!!activarPlan}
        onClose={() => setActivarPlan(null)}
        sub={activarPlan}
        planes={planes.filter(p => p.activo !== false)}
        suscriptores={suscriptores}
        refresh={refresh}
      />
    </div>
  );
}

function StatCard({ label, value, tone, trend }) {
  return (
    <Card padding={16}>
      <div style={{ fontSize: 10, color: T.textSoft, ...FontMono, fontWeight: 600, letterSpacing: '.1em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
        <div style={{ ...FontFraunces, fontSize: 32, color: tone, lineHeight: 1 }}>{value}</div>
        {trend && (
          <span style={{ ...FontMono, fontSize: 11, color: T.olive, padding: '2px 6px', background: T.oliveSoft, borderRadius: 5 }}>
            {trend}
          </span>
        )}
      </div>
    </Card>
  );
}

function ActivarPlanModal({ open, onClose, sub, planes, suscriptores, refresh }) {
  const [planId, setPlanId] = useState(planes[0]?.id || '');
  const [metodo, setMetodo] = useState('efectivo');

  if (!sub) return null;
  const plan = planes.find(p => p.id === planId);

  const activar = async () => {
    if (!plan) return;
    const hoy = new Date();
    const venc = new Date(hoy);
    venc.setDate(venc.getDate() + plan.dias);

    const next = suscriptores.map(s => s.id === sub.id ? {
      ...s, plan_id: plan.id, almuerzos_restantes: plan.almuerzos,
      fecha_inicio: hoy.toISOString().slice(0, 10),
      fecha_vencimiento: venc.toISOString().slice(0, 10),
      dias_extra_compensados: 0,
    } : s);
    await db.set('rest:subs', next);

    const orders = await db.get('rest:orders', []);
    await db.set('rest:orders', [...orders, {
      id: `o${Date.now()}`,
      tipo: 'plan',
      suscriptor: { id: sub.id, nombre: sub.nombre, codigo: sub.codigo },
      items: [{ id: plan.id, nombre: plan.nombre, cantidad: 1, precio: plan.precio }],
      total: plan.precio,
      estado: 'entregado',
      pagado: true,
      metodo_pago: metodo,
      fecha: new Date().toISOString(),
      fecha_pago: new Date().toISOString(),
      mesa: '—',
      mesero: 'Caja',
    }]);

    await crearNotificacion({
      tipo: 'aviso-general',
      titulo: 'Plan activado',
      mensaje: `Tu plan "${plan.nombre}" fue activado. Tienes ${plan.almuerzos} almuerzos hasta el ${venc.toISOString().slice(0, 10)}.`,
      suscriptor_id: sub.id,
    });

    onClose();
    refresh();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Activar plan · ${sub.nombre}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: 14, borderRadius: 12, background: T.bg, border: `1px solid ${T.border}` }}>
          <KickerLabel>— suscriptor</KickerLabel>
          <div style={{ ...FontFraunces, fontSize: 18, color: T.text }}>{sub.nombre}</div>
          <div style={{ fontSize: 12, color: T.textSoft, ...FontMono }}>{sub.codigo} · {sub.email}</div>
        </div>
        <Select label="Plan a activar" value={planId} onChange={setPlanId}
          options={planes.map(p => ({ value: p.id, label: `${p.nombre} - ${formatMoney(p.precio)} · ${p.almuerzos} alm / ${p.dias}d` }))} />
        <Select label="Método de pago" value={metodo} onChange={setMetodo}
          options={[
            { value: 'efectivo', label: 'Efectivo' },
            { value: 'tarjeta', label: 'Tarjeta' },
            { value: 'transferencia', label: 'Transferencia' },
          ]} />
        {plan && (
          <div style={{ padding: 12, borderRadius: 10, fontSize: 13, background: T.oliveSoft, color: T.oliveDark }}>
            ✓ Se cobrará <strong>{formatMoney(plan.precio)}</strong> y se activarán <strong>{plan.almuerzos} almuerzos</strong> por <strong>{plan.dias} días</strong>.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 6 }}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={activar} disabled={!plan}>Activar y cobrar →</Btn>
        </div>
      </div>
    </Modal>
  );
}
