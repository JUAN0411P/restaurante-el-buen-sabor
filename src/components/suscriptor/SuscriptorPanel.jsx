import { useState, useEffect } from 'react';
import {
  UtensilsCrossed, Calendar, Check, X, Edit3, AlertTriangle,
  Crown, Heart, Clock, Bell, User, Mail, Lock, Phone, QrCode
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, formatMoney, formatDateTime, hashPw, validators, minutesAgo, AVISO_INASISTENCIA_HORA, MAX_DIAS_COMPENSADOS_AUTO, APPROVAL_CANCEL_MINUTES } from '../../lib/utils';
import { Card, Tag, Btn, Modal, Input, EmptyState, KickerLabel } from '../ui/primitives';
import { AttendanceCalendar } from '../ui/AttendanceCalendar';
import { crearNotificacion } from '../ui/NotificationsPanel';

export function SuscriptorPanel({ activeTab, user, menu, planes, suscriptores, orders, events, refresh }) {
  const [editProfile, setEditProfile] = useState(false);
  const tab = activeTab || 'resumen';
  const [showAvisoInasistencia, setShowAvisoInasistencia] = useState(false);
  const [showExtension, setShowExtension] = useState(false);

  const sub = suscriptores.find(s => s.id === user.id) || user;
  const plan = planes.find(p => p.id === sub.plan_id);

  // ✅ FIX AQUÍ
  const pendientesAprobacion = orders.filter(o =>
    o.estado === 'esperando-aprobacion' &&
    (o.suscriptor_id === sub.id || o.suscriptor?.id === sub.id)
  );

  const consumosMes = orders.filter(o =>
    (o.suscriptor_id === sub.id || o.suscriptor?.id === sub.id) &&
    o.tipo === 'suscripcion'
  );

  const diasRestantes = sub.fecha_vencimiento
    ? Math.max(0, Math.ceil((new Date(sub.fecha_vencimiento) - new Date()) / 86400000))
    : 0;

  const subEvents = events.filter(e => e.suscriptor_id === sub.id);

  const aprobarPedido = async (orderId) => {
    const allOrders = await db.get('rest:orders', []);
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    await db.set('rest:orders', allOrders.map(o => o.id === orderId
      ? { ...o, estado: 'pendiente', aprobadoEn: new Date().toISOString() }
      : o));

    const allSubs = await db.get('rest:subs', []);
    await db.set('rest:subs', allSubs.map(s => s.id === sub.id
      ? { ...s, almuerzos_restantes: Math.max(0, s.almuerzos_restantes - 1) }
      : s));

    const allMenu = await db.get('rest:menu', []);
    await db.set('rest:menu', allMenu.map(m => {
      const c = order.items.find(x => x.id === m.id);
      return c
        ? {
            ...m,
            disponibles: Math.max(0, m.disponibles - c.cantidad),
            vendidos: (m.vendidos || 0) + c.cantidad
          }
        : m;
    }));

    refresh();
  };

  const rechazarPedido = async (orderId) => {
    if (!confirm('¿Rechazar este pedido? No se cobrará ni se enviará a cocina.')) return;

    const allOrders = await db.get('rest:orders', []);
    await db.set('rest:orders', allOrders.map(o => o.id === orderId
      ? { ...o, estado: 'rechazado', rechazadoEn: new Date().toISOString() }
      : o));

    refresh();
  };

  if (!plan) {
    return <div>Sin plan activo</div>;
  }

  return (
    <div className="space-y-5">

      {/* 🔥 BLOQUE CLAVE */}
      {pendientesAprobacion.length > 0 && (
        <div className="space-y-3">
          {pendientesAprobacion.map(o => {
            const min = minutesAgo(o.fecha);
            const minRestantes = Math.max(0, APPROVAL_CANCEL_MINUTES - min);

            return (
              <div key={o.id} style={{
                padding: 20,
                borderRadius: 16,
                background: T.mustardSoft,
                border: `1.5px solid ${T.mustard}`,
              }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <Bell size={18} color={T.mustard} />
                  <span style={{ ...FontFraunces }}>
                    Pedido pendiente de aprobación
                  </span>
                  <Tag tone="mustard">HACE {min} MIN</Tag>
                  <span>⏱ {minRestantes} min</span>
                </div>

                <div style={{ marginBottom: 12 }}>
                  Mesa {o.mesa_numero}
                  <br />
                  {o.items.map(i => `${i.cantidad}× ${i.nombre}`).join(', ')}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn full icon={Check} onClick={() => aprobarPedido(o.id)}>
                    Aprobar
                  </Btn>
                  <Btn full variant="ghost" icon={X} onClick={() => rechazarPedido(o.id)}>
                    Rechazar
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}