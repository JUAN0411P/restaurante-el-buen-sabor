import {
  UserPlus, Plus, LogOut, Clock, Check, X
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, formatMoney, minutesAgo, APPROVAL_TIMEOUT_MINUTES } from '../../lib/utils';
import { Card, Tag, Btn, KickerLabel } from '../ui/primitives';

/**
 * MesaDetalle — lives inside the right split-view panel.
 * No "back" button: the parent X handles closing.
 */
export function MesaDetalle({ mesaActiva, mesaData, orders, mesas, onAgregarComensal, onTomarPedido }) {
  const removerComensal = async (comensalId) => {
    if (!confirm('¿El comensal se va de la mesa?')) return;
    const ordersComensal = orders.filter(o => o.comensal_id === comensalId);
    const sinPagar = ordersComensal.filter(o => !o.pagado && o.tipo === 'menu');
    if (sinPagar.length > 0) { alert('Este comensal tiene cuentas pendientes de pago'); return; }
    await db.set('rest:mesas', mesas.map(m => m.id === mesaActiva.id ? {
      ...m, comensales: m.comensales.filter(c => c.id !== comensalId)
    } : m));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <KickerLabel>— {mesa_data.comensales.length} {mesa_data.comensales.length === 1 ? 'comensal' : 'comensales'}</KickerLabel>
          <div style={{ ...FontFraunces, fontSize: 18, color: T.text }}>
            {mesa_data.comensales.length === 0 ? 'Mesa vacía' : 'Comensales activos'}
          </div>
        </div>
        <Btn icon={UserPlus} size="sm" onClick={onAgregarComensal}>Agregar comensal</Btn>
      </div>

      {mesa_data.comensales.length === 0 && (
        <div style={{ padding: '24px 16px', textAlign: 'center', borderRadius: 12, background: T.bg, border: `1px dashed ${T.border}` }}>
          <p style={{ fontSize: 13, color: T.textMute, margin: 0 }}>
            Aún no hay comensales. Toca "Agregar comensal" para empezar.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mesa_data.comensales.map(c => {
          const ordersC = orders.filter(o => o.comensal_id === c.id);
          const tones = { suscripcion: 'olive', menu: 'mustard', invitado: 'plum' };
          const totalC = ordersC.filter(o => !o.pagado && o.tipo === 'menu').reduce((s, o) => s + o.total, 0);
          const pendienteAprobacion = ordersC.find(o => o.estado === 'esperando-aprobacion');
          const minEspera = pendienteAprobacion ? minutesAgo(pendienteAprobacion.fecha) : 0;
          const alerta = pendienteAprobacion && minEspera >= APPROVAL_TIMEOUT_MINUTES;

          return (
            <div
              key={c.id}
              style={{
                padding: 14,
                borderRadius: 12,
                background: alerta ? T.redSoft : T.card,
                border: alerta ? `2px solid ${T.red}` : `1px solid ${T.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Tag tone={tones[c.tipo]} size="xs">
                    {c.tipo === 'suscripcion' ? 'MENSUALIDAD' : c.tipo === 'invitado' ? 'INVITADO' : 'MENÚ DÍA'}
                  </Tag>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{c.nombre}</span>
                  {alerta && <Tag tone="red" size="xs">⚠ {minEspera}MIN SIN APROBAR</Tag>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn size="sm" variant="ghost" icon={Plus} onClick={() => onTomarPedido(c)}>Pedir</Btn>
                  <Btn size="sm" variant="danger" icon={LogOut} onClick={() => removerComensal(c.id)}>Salió</Btn>
                </div>
              </div>

              {ordersC.length === 0 && (
                <p style={{ fontSize: 11, color: T.textMute, margin: 0, ...FontMono }}>SIN PEDIDOS AÚN</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ordersC.map(o => <OrderLine key={o.id} order={o} />)}
              </div>

              {totalC > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${T.borderSoft}`, fontSize: 12 }}>
                  <span style={{ color: T.textSoft }}>Pendiente de pago</span>
                  <span style={{ ...FontFraunces, color: T.terracotta, fontStyle: 'italic', fontSize: 16 }}>{formatMoney(totalC)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderLine({ order }) {
  let tone = 'neutral';
  let label = order.estado;
  let Icon = null;

  if (order.estado === 'esperando-aprobacion') {
    tone = 'mustard';
    label = 'ESPERANDO APROBACIÓN';
    Icon = Clock;
  } else if (order.estado === 'rechazado') {
    tone = 'red';
    label = 'RECHAZADO';
    Icon = X;
  } else if (order.estado === 'cancelado-timeout') {
    tone = 'red';
    label = 'CANCELADO (TIMEOUT)';
    Icon = X;
  } else if (order.estado === 'pendiente') {
    tone = 'neutral';
    label = 'EN COLA COCINA';
  } else if (order.estado === 'preparando') {
    tone = 'mustard';
    label = 'PREPARANDO';
  } else if (order.estado === 'listo') {
    tone = 'olive';
    label = 'LISTO';
    Icon = Check;
  } else if (order.estado === 'entregado') {
    tone = 'olive';
    label = 'ENTREGADO';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px', borderRadius: 6, background: T.bg, fontSize: 12, flexWrap: 'wrap' }}>
      <span style={{ color: T.text }}>{order.items.map(i => `${i.cantidad}× ${i.nombre}`).join(', ')}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {order.tipo === 'menu' && <span style={{ color: T.textSoft, ...FontMono, fontSize: 11 }}>{formatMoney(order.total)}</span>}
        <Tag tone={tone} size="xs">{Icon && <Icon size={9} />}{label}</Tag>
        {order.pagado && <Tag tone="olive" size="xs">PAGADO</Tag>}
      </div>
    </div>
  );
}