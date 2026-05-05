import { useState } from 'react';
import {
  Plus, Banknote, CreditCard, AlertCircle, CheckCircle2, ArrowRight, Wallet
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, formatMoney, todayISO } from '../../lib/utils';
import { Card, Tag, Btn, Modal, Select, EmptyState, KickerLabel } from '../ui/primitives';
import { NewSubModal } from '../admin/AdminModals';
import { crearNotificacion } from '../ui/NotificationsPanel';

export function CajaPanel({ activeTab, menu, planes, suscriptores, orders, mesas, refresh }) {
  const tab = activeTab || 'cobros';
  const [cobrar, setCobrar] = useState(null);
  const [newSub, setNewSub] = useState(false);
  const [activarPlan, setActivarPlan] = useState(null);

  const today = todayISO();
  const ordersToday = orders.filter(o => o.fecha?.slice(0, 10) === today);
  const porCobrar = ordersToday.filter(o => o.estado === 'entregado' && !o.pagado && o.tipo === 'menu');
  const cobradas = ordersToday.filter(o => o.pagado);
  const totalDia = cobradas.reduce((s, o) => s + o.total, 0);
  const subsSinPlan = suscriptores.filter(s => s.activo && !s.plan);
  const subsPorVencer = suscriptores.filter(s => s.activo && s.plan && s.fechaVencimiento && new Date(s.fechaVencimiento) < new Date(Date.now() + 7 * 86400000));

  const procesarPago = async (order, metodo) => {
    const next = orders.map(o => o.id === order.id ? { ...o, pagado: true, metodoPago: metodo, fechaPago: new Date().toISOString() } : o);
    await db.set('rest:orders', next);

    const mesa = mesas.find(m => m.numero === order.mesa);
    if (mesa) {
      const comensalDelPedido = mesa.comensales.find(c => c.id === order.comensalId);
      if (comensalDelPedido?.tipo === 'menu') {
        const ordersDeEsteComensal = next.filter(o => o.comensalId === comensalDelPedido.id);
        const todosPagados = ordersDeEsteComensal.every(o => o.pagado);
        if (todosPagados) {
          const mesasNext = mesas.map(m => m.id === mesa.id ? {
            ...m, comensales: m.comensales.filter(c => c.id !== comensalDelPedido.id)
          } : m);
          await db.set('rest:mesas', mesasNext);
        }
      }
    }

    setCobrar(null);
    refresh();
  };

  return (
    <div>
      {/* Stats grid */}
      <div style={{ display: 'grid', gap: 14, marginBottom: 24 }} className="grid-cols-2 md:grid-cols-4 grid">
        <StatCard label="TOTAL HOY" value={formatMoney(totalDia)} tone={T.terracotta} />
        <StatCard label="ÓRDENES COBRADAS" value={cobradas.length} tone={T.text} />
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
            <div className="ebs-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {porCobrar.map(o => {
                const mesa = mesas.find(m => m.numero === o.mesa);
                const comensal = mesa?.comensales.find(c => c.id === o.comensalId);
                return (
                  <Card key={o.id} padding={18} hover>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: T.mustardSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <span style={{ ...FontFraunces, fontSize: 22, color: T.mustard }}>{o.mesa}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Mesa {o.mesa}</span>
                          <Tag tone="mustard" size="xs">MENÚ DÍA</Tag>
                          {comensal && <span style={{ fontSize: 11, color: T.textSoft }}>· {comensal.nombre}</span>}
                          <span style={{ fontSize: 11, color: T.textSoft, ...FontMono }}>· mesero {o.mesero}</span>
                        </div>
                        <div style={{ fontSize: 13, color: T.textSoft }}>
                          {o.items.map(i => `${i.cantidad}× ${i.nombre}`).join(' · ')}
                        </div>
                      </div>
                      <div style={{ ...FontFraunces, fontSize: 26, color: T.terracotta, fontStyle: 'italic' }}>
                        {formatMoney(o.total)}
                      </div>
                      <Btn variant="primary" size="md" onClick={() => setCobrar({ ...o, _comensal: comensal })}>
                        Cobrar →
                      </Btn>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cobradas.map(o => (
                <Card key={o.id} padding={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: o.tipo === 'suscripcion' ? T.oliveSoft : T.mustardSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {o.tipo === 'plan'
                        ? <Wallet size={16} color={T.terracotta} />
                        : <span style={{ ...FontFraunces, fontSize: 14, color: o.tipo === 'suscripcion' ? T.olive : T.mustard }}>{o.mesa}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' }}>
                        <Tag tone={o.tipo === 'suscripcion' ? 'olive' : o.tipo === 'plan' ? 'terra' : 'mustard'} size="xs">
                          {o.tipo === 'suscripcion' ? 'SUSC' : o.tipo === 'plan' ? 'PLAN' : 'MENÚ'}
                        </Tag>
                        {o.metodoPago && <Tag tone="neutral" size="xs">{o.metodoPago}</Tag>}
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
            <div className="ebs-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {subsSinPlan.map(s => (
                <Card key={s.id} padding={16} hover>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: T.plumSoft, color: T.plum, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                      {s.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <KickerLabel>— mensualidades activas</KickerLabel>
              <h3 style={{ ...FontFraunces, fontSize: 22, color: T.text, margin: 0 }}>
                Renovaciones pendientes
              </h3>
            </div>
            <Btn icon={Plus} onClick={() => setNewSub(true)}>Registrar nuevo</Btn>
          </div>
          <div style={{ display: 'grid', gap: 12 }} className="grid md:grid-cols-2 grid-cols-1">
            {suscriptores.filter(s => s.plan).map(s => {
              const plan = planes.find(p => p.id === s.plan);
              const venceProto = s.fechaVencimiento && new Date(s.fechaVencimiento) < new Date(Date.now() + 7 * 86400000);
              return (
                <Card key={s.id} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: T.oliveSoft, color: T.olive, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {s.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{s.nombre}</span>
                        <Tag tone={venceProto ? 'mustard' : 'olive'} size="xs">{s.codigo}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: T.textSoft, marginBottom: 4 }}>{plan?.nombre}</div>
                      <div style={{ fontSize: 12, color: T.textSoft, ...FontMono }}>
                        {s.almuerzosRestantes} alm · vence {s.fechaVencimiento}
                      </div>
                      {(venceProto || s.almuerzosRestantes <= 3) && (
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
      <Modal open={!!cobrar} onClose={() => setCobrar(null)} title="Procesar pago">
        {cobrar && (
          <div>
            <div style={{ padding: 16, borderRadius: 12, marginBottom: 16, background: T.bg, border: `1px solid ${T.border}` }}>
              <KickerLabel>— detalle del pedido</KickerLabel>
              <p style={{ fontSize: 12, color: T.textSoft, margin: '0 0 8px 0', ...FontMono }}>
                Mesa {cobrar.mesa} {cobrar._comensal && `· ${cobrar._comensal.nombre}`} · mesero {cobrar.mesero}
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
            <KickerLabel>— método de pago</KickerLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
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
    <Card padding={18}>
      <div style={{ fontSize: 10, color: T.textSoft, ...FontMono, fontWeight: 600, letterSpacing: '.1em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
        <div style={{ ...FontFraunces, fontSize: 38, color: tone, lineHeight: 1 }}>{value}</div>
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
      ...s, plan: plan.id, almuerzosRestantes: plan.almuerzos,
      fechaInicio: hoy.toISOString().slice(0, 10),
      fechaVencimiento: venc.toISOString().slice(0, 10),
      diasExtraCompensados: 0,
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
      metodoPago: metodo,
      fecha: new Date().toISOString(),
      fechaPago: new Date().toISOString(),
      mesa: '—',
      mesero: 'Caja',
    }]);

    await crearNotificacion({
      tipo: 'aviso-general',
      titulo: 'Plan activado',
      mensaje: `Tu plan "${plan.nombre}" fue activado. Tienes ${plan.almuerzos} almuerzos hasta el ${venc.toISOString().slice(0, 10)}.`,
      suscriptorId: sub.id,
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
