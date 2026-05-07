import { useState, useEffect } from 'react';
import {
  UtensilsCrossed, Calendar, Check, X, Edit3, AlertTriangle,
  Crown, Heart, Clock, Bell, User, Mail, Lock, Phone, QrCode
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, supabase, formatMoney, formatDateTime, hashPw, validators, minutesAgo, AVISO_INASISTENCIA_HORA, MAX_DIAS_COMPENSADOS_AUTO, APPROVAL_CANCEL_MINUTES } from '../../lib/utils';
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

  const pendientesAprobacion = orders.filter(o =>
    o.estado === 'esperando-aprobacion' && o.suscriptor_id === sub.id
  );

  const consumosMes = orders.filter(o => o.suscriptor?.id === sub.id && o.tipo === 'suscripcion');
  const diasRestantes = sub.fecha_vencimiento
    ? Math.max(0, Math.ceil((new Date(sub.fecha_vencimiento) - new Date()) / 86400000))
    : 0;
  const subEvents = events.filter(e => e.suscriptorId === sub.id);

  const aprobarPedido = async (orderId) => {
    if (!confirm('¿Aprobar este pedido? Se enviará a cocina y se descontará 1 almuerzo de tu plan.')) return;
    try {
      // 1. Obtener la orden primero (necesitamos los items para descontar menú)
      const allOrders = await db.get('rest:orders', []);
      const order = allOrders.find(o => o.id === orderId);
      if (!order) { alert('No se encontró el pedido.'); return; }

      // 2. Cambiar estado a pendiente (va a cocina)
      const { error: errOrder } = await db.update('rest:orders', orderId, {
        estado: 'pendiente',
        aprobado_en: new Date().toISOString(),
      });
      if (errOrder) { alert('Error al aprobar el pedido.'); return; }

      // 3. Descontar 1 almuerzo al suscriptor
      await db.update('rest:subs', sub.id, {
        almuerzos_restantes: Math.max(0, (sub.almuerzos_restantes || 1) - 1),
      });

      // 4. Descontar disponibles del menú
      const allMenu = await db.get('rest:menu', []);
      await Promise.all(
        (order.items || []).map(item => {
          const m = allMenu.find(x => x.id === item.id);
          if (!m) return Promise.resolve();
          return db.update('rest:menu', m.id, {
            disponibles: Math.max(0, m.disponibles - item.cantidad),
            vendidos: (m.vendidos || 0) + item.cantidad,
          });
        })
      );

      // 5. Eliminar la notificación para que no vuelva a aparecer ni se apruebe dos veces
      const allNotifs = await db.get('rest:notifications', []);
      const notifRelacionada = allNotifs.find(n =>
        n.tipo === 'pedido-pendiente' && n.order_id === orderId && n.suscriptor_id === sub.id
      );
      if (notifRelacionada) {
        await supabase.from('notifications').delete().eq('id', notifRelacionada.id);
      }

      refresh();
    } catch (e) {
      console.error('Error aprobando pedido:', e);
      alert('Error inesperado al aprobar.');
    }
  };

  const rechazarPedido = async (orderId) => {
    if (!confirm('¿Rechazar este pedido? No se cobrará ni se enviará a cocina.')) return;
    try {
      await db.update('rest:orders', orderId, {
        estado: 'rechazado',
        rechazado_en: new Date().toISOString(),
      });

      // Eliminar la notificación asociada
      const allNotifs = await db.get('rest:notifications', []);
      const notifRelacionada = allNotifs.find(n =>
        n.tipo === 'pedido-pendiente' && n.order_id === orderId && n.suscriptor_id === sub.id
      );
      if (notifRelacionada) {
        await supabase.from('notifications').delete().eq('id', notifRelacionada.id);
      }

      refresh();
    } catch (e) {
      console.error('Error rechazando pedido:', e);
      alert('Error inesperado al rechazar.');
    }
  };

  const enviarAvisoInasistencia = async () => {
    const ahora = new Date();
    const hora = ahora.getHours();
    if (hora >= AVISO_INASISTENCIA_HORA) {
      alert(`El aviso de inasistencia solo aplica antes de las ${AVISO_INASISTENCIA_HORA}:00 AM.`);
      return;
    }
    const today = ahora.toISOString().slice(0, 10);
    const allEvents = await db.get('rest:events', []);
    if (allEvents.find(e => e.suscriptorId === sub.id && e.fecha === today)) {
      alert('Ya registraste un evento para hoy.');
      return;
    }
    await db.set('rest:events', [...allEvents, {
      id: `ev${Date.now()}`,
      suscriptorId: sub.id,
      fecha: today,
      tipo: 'aviso-inasistencia',
      hora: `${String(hora).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`,
    }]);
    setShowAvisoInasistencia(false);
    refresh();
    alert('Aviso registrado correctamente.');
  };

  // Sin plan activo
  if (!plan) {
    return (
      <div className="space-y-5">
        <div>
          <KickerLabel>— cuenta {sub.codigo}</KickerLabel>
          <h2 style={{ ...FontFraunces, fontSize: 30, color: T.text, margin: 0, letterSpacing: '-0.015em' }}>
            Hola, {sub.nombre.split(' ')[0]}
          </h2>
        </div>

        <div style={{ padding: 24, borderRadius: 16, background: T.mustardSoft, border: `1px solid ${T.mustard}55`, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 16, background: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <AlertTriangle size={26} color={T.mustard} />
          </div>
          <div style={{ ...FontFraunces, fontSize: 22, color: T.text, marginBottom: 8 }}>
            No tienes un plan activo
          </div>
          <p style={{ fontSize: 13, color: T.textSoft, maxWidth: 420, margin: '0 auto' }}>
            Acércate a caja con tu cédula o código <strong style={{ ...FontMono, color: T.text }}>{sub.codigo}</strong> para activar tu mensualidad.
          </p>
        </div>

        <div>
          <KickerLabel>— planes disponibles</KickerLabel>
          <div style={{ display: 'grid', gap: 14, marginTop: 8 }} className="grid md:grid-cols-3 grid-cols-1">
            {planes.filter(p => p.activo !== false).map(p => (
              <Card key={p.id} padding={20}>
                <div style={{ ...FontFraunces, fontSize: 18, color: T.text, marginBottom: 6 }}>{p.nombre}</div>
                <div style={{ ...FontFraunces, fontSize: 28, fontStyle: 'italic', color: T.terracotta, marginBottom: 12 }}>
                  {formatMoney(p.precio)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: T.textSoft }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={13} color={T.olive} /> {p.almuerzos} almuerzos
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={13} color={T.olive} /> {p.dias} días de vigencia
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <KickerLabel>— tu mensualidad · cuenta {sub.codigo}</KickerLabel>
          <h2 style={{ ...FontFraunces, fontSize: 30, color: T.text, margin: 0, letterSpacing: '-0.015em' }}>
            Hola, {sub.nombre.split(' ')[0]}
          </h2>
        </div>
        <Btn variant="ghost" size="sm" icon={Edit3} onClick={() => setEditProfile(true)}>Editar perfil</Btn>
      </div>

      {/* HERO ALERT — pedidos pendientes (estilo mockup: flotante, shimmer, countdown) */}
      {pendientesAprobacion.length > 0 && (
        <div className="space-y-3">
          {pendientesAprobacion.map(o => (
            <PedidoHeroCard
              key={o.id}
              orden={o}
              onAprobar={aprobarPedido}
              onRechazar={rechazarPedido}
            />
          ))}
        </div>
      )}

      {/* Info invitados */}
      {tab === 'resumen' && sub.permitir_invitados && (
        <div style={{ padding: 14, borderRadius: 12, background: T.plumSoft, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Crown size={18} color={T.plum} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ ...FontFraunces, fontSize: 15, color: T.text, marginBottom: 2 }}>
              Puedes invitar a otras personas
            </div>
            <p style={{ fontSize: 12, color: T.textSoft, margin: 0 }}>
              Cada invitado consume 1 almuerzo de tu plan y tú apruebas el pedido.
            </p>
          </div>
        </div>
      )}

      {/* RESUMEN: PLAN + PROFILE */}
      {tab === 'resumen' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-4">
            {/* Plan card */}
            <Card padding={22}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <KickerLabel>— tu plan activo</KickerLabel>
                  <div style={{ ...FontFraunces, fontSize: 24, color: T.text, marginTop: 4 }}>{plan.nombre}</div>
                  <div style={{ fontSize: 12, color: T.textSoft, marginTop: 4 }}>
                    {plan.almuerzos} almuerzos · {plan.dias} días · vence {sub.fecha_vencimiento}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...FontFraunces, fontSize: 26, fontStyle: 'italic', color: T.terracotta }}>
                    {formatMoney(plan.precio)}
                  </div>
                  <div style={{ fontSize: 11, color: T.textSoft, ...FontMono }}>/MES</div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <PlanStat
                  label="ALMUERZOS"
                  value={sub.almuerzos_restantes}
                  total={plan.almuerzos}
                  bg={T.oliveSoft}
                  fg={T.olive}
                  pct={(sub.almuerzos_restantes / plan.almuerzos) * 100}
                />
                <div style={{ padding: 14, background: T.mustardSoft, borderRadius: 12 }}>
                  <div style={{ fontSize: 10, color: T.mustard, ...FontMono, letterSpacing: '.1em', fontWeight: 600 }}>
                    DÍAS
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                    <span style={{ ...FontFraunces, fontSize: 36, color: T.mustard, lineHeight: 1, fontStyle: 'italic' }}>
                      {diasRestantes}
                    </span>
                    <span style={{ fontSize: 12, color: T.mustard, opacity: .7 }}>restantes</span>
                  </div>
                  <div style={{ fontSize: 10, color: T.textSoft, marginTop: 10, ...FontMono }}>
                    VENCE {sub.fecha_vencimiento}
                  </div>
                </div>
                <div style={{ padding: 14, background: T.plumSoft, borderRadius: 12 }}>
                  <div style={{ fontSize: 10, color: T.plum, ...FontMono, letterSpacing: '.1em', fontWeight: 600 }}>
                    COMPENSADOS
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                    <span style={{ ...FontFraunces, fontSize: 36, color: T.plum, lineHeight: 1, fontStyle: 'italic' }}>
                      +{sub.dias_extra_compensados || 0}
                    </span>
                    <span style={{ fontSize: 12, color: T.plum, opacity: .7 }}>días</span>
                  </div>
                  <div style={{ fontSize: 10, color: T.textSoft, marginTop: 10, ...FontMono }}>
                    {(sub.dias_extra_compensados || 0) >= MAX_DIAS_COMPENSADOS_AUTO ? 'MÁXIMO ALCANZADO' : `${MAX_DIAS_COMPENSADOS_AUTO - (sub.dias_extra_compensados || 0)} DISPONIBLES`}
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <Btn size="sm" variant="ghost" icon={Clock} onClick={() => setShowAvisoInasistencia(true)}>
                  Avisar inasistencia
                </Btn>
                <Btn size="sm" variant="ghost" icon={Calendar} onClick={() => setShowExtension(true)}>
                  Solicitar extensión
                </Btn>
              </div>
            </Card>

            {/* Profile + QR */}
            <Card padding={22}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: T.terraSoft, color: T.terracotta, display: 'grid', placeItems: 'center', ...FontFraunces, fontSize: 22, fontStyle: 'italic', flexShrink: 0 }}>
                  {sub.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...FontFraunces, fontSize: 17, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: T.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.email}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMute, ...FontMono, marginTop: 2 }}>
                    CC {sub.cedula} · 📱 {sub.telefono}
                  </div>
                </div>
              </div>

              <div style={{ padding: 12, background: T.bg, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 50, height: 50, borderRadius: 8, background: T.text, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <QrCode size={28} color={T.bg} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, ...FontMono, letterSpacing: '.1em' }}>
                    TU CÓDIGO
                  </div>
                  <div style={{ ...FontFraunces, fontSize: 20, color: T.text, fontStyle: 'italic', lineHeight: 1.1 }}>
                    {sub.codigo}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMute, marginTop: 2 }}>
                    muestra en caja al entrar
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* MENÚ DE HOY */}
      {tab === 'menu' && (
        <div>
          <KickerLabel>— oferta de hoy</KickerLabel>
          <h3 style={{ ...FontFraunces, fontSize: 22, color: T.text, margin: '4px 0 16px 0' }}>
            Lo que está disponible
          </h3>
          <div style={{ display: 'grid', gap: 10 }} className="grid md:grid-cols-2 grid-cols-1">
            {menu.filter(m => m.disponibles > 0).map(m => (
              <Card key={m.id} padding={14}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{m.nombre}</span>
                  <Tag tone="neutral" size="xs">{m.categoria.toUpperCase()}</Tag>
                </div>
                <p style={{ fontSize: 11, color: T.textSoft, margin: 0, marginBottom: 6 }}>{m.descripcion}</p>
                {m.categoria !== 'Bebida' && m.categoria !== 'Postre' ? (
                  <Tag tone="olive" size="xs"><Check size={10} /> INCLUIDO EN PLAN</Tag>
                ) : (
                  <span style={{ ...FontMono, fontSize: 11, color: T.terracotta, fontWeight: 600 }}>+{formatMoney(m.precio)}</span>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* CALENDARIO */}
      {tab === 'calendar' && (
        <Card padding={20}>
          <KickerLabel>— tu calendario</KickerLabel>
          <h3 style={{ ...FontFraunces, fontSize: 22, color: T.text, margin: '4px 0 16px 0' }}>
            Asistencias y avisos
          </h3>
          <AttendanceCalendar events={subEvents} fechaInicio={sub.fecha_inicio} fechaVencimiento={sub.fecha_vencimiento} />
        </Card>
      )}

      {/* HISTORIAL */}
      {tab === 'historial' && (
        <div>
          <KickerLabel>— últimas comidas</KickerLabel>
          <h3 style={{ ...FontFraunces, fontSize: 22, color: T.text, margin: '4px 0 16px 0' }}>
            Historial de consumo
          </h3>
          {consumosMes.length === 0 ? (
            <Card><EmptyState title="Aún no has consumido almuerzos" /></Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {consumosMes.slice(-15).reverse().map(o => (
                <Card key={o.id} padding={14}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                          {o.items.map(i => i.nombre).join(', ')}
                        </span>
                        {o.esInvitado && <Tag tone="plum" size="xs"><Heart size={9} /> INVITADO</Tag>}
                      </div>
                      <p style={{ fontSize: 11, color: T.textSoft, margin: 0, ...FontMono }}>
                        Mesa {o.mesa} · {formatDateTime(o.fecha)}
                      </p>
                    </div>
                    <Tag tone={
                      o.estado === 'entregado' ? 'olive' :
                      o.estado === 'rechazado' || o.estado === 'cancelado-timeout' ? 'red' :
                      'mustard'
                    } size="xs">{o.estado.toUpperCase()}</Tag>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <ProfileModal open={editProfile} onClose={() => setEditProfile(false)} sub={sub} suscriptores={suscriptores} refresh={refresh} />

      <Modal open={showAvisoInasistencia} onClose={() => setShowAvisoInasistencia(false)} title="Avisar que no asistiré hoy">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 10, background: T.mustardSoft }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.mustard, marginBottom: 6 }}>Condiciones del aviso:</div>
            <ul style={{ fontSize: 11, color: T.textSoft, paddingLeft: 16, margin: 0 }}>
              <li>Solo válido antes de las {AVISO_INASISTENCIA_HORA}:00 AM del día.</li>
              <li>Hasta 4 días avisados se compensan automáticamente.</li>
              <li>Más días requieren aprobación del administrador.</li>
            </ul>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="ghost" onClick={() => setShowAvisoInasistencia(false)}>Cancelar</Btn>
            <Btn onClick={enviarAvisoInasistencia}>Confirmar aviso</Btn>
          </div>
        </div>
      </Modal>

      <ExtensionRequestModal
        open={showExtension}
        onClose={() => setShowExtension(false)}
        sub={sub}
        plan={plan}
        subEvents={subEvents}
        refresh={refresh}
      />
    </div>
  );
}

// ─── Tarjeta hero de pedido pendiente — diseño fiel al mockup ───────────────
function PedidoHeroCard({ orden, onAprobar, onRechazar }) {
  const [procesando, setProcesando] = useState(false);

  // Countdown en segundos hasta el timeout
  const totalSegundos = APPROVAL_CANCEL_MINUTES * 60;
  const transcurridos = Math.floor((Date.now() - new Date(orden.fecha).getTime()) / 1000);
  const [segsRestantes, setSegsRestantes] = useState(Math.max(0, totalSegundos - transcurridos));

  useEffect(() => {
    const t = setInterval(() => {
      setSegsRestantes(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(segsRestantes / 60)).padStart(2, '0');
  const ss = String(segsRestantes % 60).padStart(2, '0');
  const urgente = segsRestantes < 120; // últimos 2 min

  const handleAprobar = async () => {
    setProcesando(true);
    await onAprobar(orden.id);
    setProcesando(false);
  };

  const handleRechazar = async () => {
    setProcesando(true);
    await onRechazar(orden.id);
    setProcesando(false);
  };

  return (
    <div style={{
      padding: 20,
      borderRadius: 18,
      background: T.mustardSoft,
      border: `1.5px solid ${urgente ? T.red : T.mustard}`,
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color .4s ease',
    }}>
      {/* Shimmer animado */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.45) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'ebs-shimmer 2.4s linear infinite',
      }} />

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, position: 'relative' }}>
        <span style={{
          width: 9, height: 9, borderRadius: '50%',
          background: urgente ? T.red : T.mustard,
          flexShrink: 0,
          animation: 'ebs-pulse 1.6s ease-in-out infinite',
        }} />
        <span style={{ ...FontMono, fontSize: 11, color: urgente ? T.red : T.mustard, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          PEDIDO POR APROBAR
        </span>
        {orden.es_invitado && <Tag tone="plum" size="xs"><Heart size={9} /> INVITADO</Tag>}
      </div>

      {/* Descripción del pedido */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div style={{ ...FontFraunces, fontSize: 20, color: T.text, marginBottom: 3 }}>
          Mesa {orden.mesa_numero} · {(orden.items || []).map(i => i.nombre).join(', ')}
        </div>
        <div style={{ fontSize: 12, color: T.textSoft }}>
          {(orden.items || []).map(i => `${i.cantidad}× ${i.nombre}`).join(' · ')}
          {orden.mesero_id ? ` · Mesero ${orden.mesero_id}` : ''}
        </div>
      </div>

      {/* Countdown */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: T.card, borderRadius: 10, marginBottom: 14,
        position: 'relative',
      }}>
        <span style={{ fontSize: 11, color: T.textSoft, ...FontMono }}>expira en</span>
        <span style={{
          ...FontFraunces, fontSize: 26, fontStyle: 'italic',
          color: urgente ? T.red : T.mustard, lineHeight: 1,
          animation: urgente ? 'ebs-countdown 1s ease-in-out infinite' : 'none',
          display: 'inline-block',
        }}>
          {mm}:{ss}
        </span>
      </div>

      {/* Nota de descuento */}
      <div style={{ fontSize: 11, color: T.textMute, ...FontMono, marginBottom: 14, position: 'relative' }}>
        Se descontará 1 almuerzo de tu plan
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
        <button
          disabled={procesando}
          onClick={handleAprobar}
          style={{
            flex: 1, padding: '13px 0', borderRadius: 12,
            background: procesando ? T.oliveSoft : T.olive,
            color: '#fff', border: 0, fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: procesando ? 'not-allowed' : 'pointer',
            fontFamily: "'Manrope', sans-serif",
            transition: 'background .2s ease',
          }}
        >
          <Check size={16} />{procesando ? 'Procesando…' : 'Aprobar'}
        </button>
        <button
          disabled={procesando}
          onClick={handleRechazar}
          style={{
            flex: 1, padding: '13px 0', borderRadius: 12,
            background: 'transparent', color: T.red,
            border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: procesando ? 'not-allowed' : 'pointer',
            fontFamily: "'Manrope', sans-serif",
            transition: 'border-color .2s ease',
          }}
        >
          <X size={16} />Rechazar
        </button>
      </div>
    </div>
  );
}

function PlanStat({ label, value, total, bg, fg, pct }) {
  return (
    <div style={{ padding: 14, background: bg, borderRadius: 12 }}>
      <div style={{ fontSize: 10, color: fg, ...FontMono, letterSpacing: '.1em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <span style={{ ...FontFraunces, fontSize: 36, color: fg, lineHeight: 1, fontStyle: 'italic' }}>{value}</span>
        <span style={{ fontSize: 13, color: fg, opacity: .7 }}>/ {total}</span>
      </div>
      <div style={{ height: 5, background: '#fff', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: fg, transformOrigin: 'left', animation: 'ebs-grow 1.1s cubic-bezier(.2,.8,.2,1) both' }} />
      </div>
    </div>
  );
}

function ExtensionRequestModal({ open, onClose, sub, plan, subEvents, refresh }) {
  const [dias, setDias] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const avisosCount = subEvents.filter(e => e.tipo === 'aviso-inasistencia').length;
  const inasistCount = subEvents.filter(e => e.tipo === 'inasistencia-sin-aviso').length;
  const diasCompensados = sub.dias_extra_compensados || 0;

  const enviarSolicitud = async () => {
    if (!motivo.trim() || dias < 1) return;
    setEnviando(true);
    await crearNotificacion({
      tipo: 'solicitud-extension',
      titulo: `Solicitud de extensión de ${sub.nombre}`,
      mensaje: `${sub.nombre} solicita ${dias} día(s) adicional(es). Motivo: ${motivo}`,
      suscriptorId: sub.id,
      dias,
      motivo,
      snapshot: {
        nombre: sub.nombre,
        codigo: sub.codigo,
        plan: plan?.nombre || '—',
        almuerzosRestantes: sub.almuerzos_restantes,
        fechaVencimiento: sub.fecha_vencimiento,
        diasYaCompensados: diasCompensados,
        avisosInasistencia: avisosCount,
        inasistenciasSinAviso: inasistCount,
      },
      accion: { label: 'Revisar solicitud', type: 'aprobar-extension' },
    });
    setEnviando(false);
    setDias(1);
    setMotivo('');
    onClose();
    refresh();
    alert('Solicitud enviada al administrador. Te notificaremos cuando sea revisada.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Solicitar extensión especial">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: 12, borderRadius: 10, background: T.bg, border: `1px solid ${T.border}` }}>
          <KickerLabel>— resumen de tu cuenta</KickerLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 11, marginTop: 6 }} className="grid grid-cols-1 sm:grid-cols-2">
            <div><span style={{ color: T.textMute }}>Plan:</span> <strong style={{ color: T.text }}>{plan?.nombre || '—'}</strong></div>
            <div><span style={{ color: T.textMute }}>Vence:</span> <strong style={{ color: T.text }}>{sub.fecha_vencimiento || '—'}</strong></div>
            <div><span style={{ color: T.textMute }}>Almuerzos rest.:</span> <strong style={{ color: T.text }}>{sub.almuerzos_restantes}</strong></div>
            <div><span style={{ color: T.textMute }}>Compensados:</span> <strong style={{ color: T.text }}>{diasCompensados} / {MAX_DIAS_COMPENSADOS_AUTO}</strong></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }} className="grid grid-cols-2">
          <div style={{ padding: 12, borderRadius: 10, background: T.mustardSoft, textAlign: 'center' }}>
            <div style={{ ...FontFraunces, fontSize: 28, color: T.mustard, fontStyle: 'italic' }}>{avisosCount}</div>
            <div style={{ fontSize: 10, color: T.textSoft, ...FontMono, letterSpacing: '.05em' }}>DÍAS AVISADOS</div>
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: T.redSoft, textAlign: 'center' }}>
            <div style={{ ...FontFraunces, fontSize: 28, color: T.red, fontStyle: 'italic' }}>{inasistCount}</div>
            <div style={{ fontSize: 10, color: T.textSoft, ...FontMono, letterSpacing: '.05em' }}>SIN AVISAR</div>
          </div>
        </div>

        {diasCompensados < MAX_DIAS_COMPENSADOS_AUTO ? (
          <div style={{ padding: 10, borderRadius: 10, fontSize: 11, background: T.oliveSoft, color: T.oliveDark }}>
            ℹ️ Aún tienes {MAX_DIAS_COMPENSADOS_AUTO - diasCompensados} día(s) automáticos disponibles.
          </div>
        ) : (
          <div style={{ padding: 10, borderRadius: 10, fontSize: 11, background: T.mustardSoft, color: T.mustard }}>
            ⚠️ Esta solicitud requiere aprobación manual del admin.
          </div>
        )}

        <Input label="¿Cuántos días adicionales?" type="number" value={dias} onChange={(v) => setDias(+v)} />
        <Input label="Motivo" value={motivo} onChange={setMotivo} placeholder="Ej: viaje, enfermedad…" hint="Sé claro para facilitar la aprobación" />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={enviarSolicitud} disabled={!motivo.trim() || dias < 1 || enviando}>
            {enviando ? 'Enviando…' : 'Enviar →'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function ProfileModal({ open, onClose, sub, suscriptores, refresh }) {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', password: '', password2: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (sub) setForm({ nombre: sub.nombre, email: sub.email, telefono: sub.telefono, password: '', password2: '' });
    setErrors({});
  }, [sub, open]);

  const guardar = async () => {
    const e = {};
    if (validators.nombre(form.nombre) !== true) e.nombre = validators.nombre(form.nombre);
    if (validators.email(form.email) !== true) e.email = validators.email(form.email);
    if (validators.telefono(form.telefono) !== true) e.telefono = validators.telefono(form.telefono);
    if (form.password && validators.password(form.password) !== true) e.password = validators.password(form.password);
    if (form.password && form.password !== form.password2) e.password2 = 'No coinciden';
    if (form.email !== sub.email && suscriptores.find(s => s.id !== sub.id && s.email === form.email)) e.email = 'Email ya registrado';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    await db.set('rest:subs', suscriptores.map(s => s.id === sub.id ? {
      ...s, nombre: form.nombre.trim(), email: form.email.toLowerCase(), telefono: form.telefono,
      password: form.password ? hashPw(form.password) : s.password
    } : s));
    onClose();
    refresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar mi perfil">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Nombre completo" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} icon={User} error={errors.nombre} />
        <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} icon={Mail} error={errors.email} />
        <Input label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} icon={Phone} error={errors.telefono} />
        <div style={{ paddingTop: 8, borderTop: `1px dashed ${T.border}` }}>
          <KickerLabel>— cambiar contraseña (opcional)</KickerLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
            <Input label="Nueva contraseña" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} icon={Lock} error={errors.password} />
            <Input label="Confirmar" type="password" value={form.password2} onChange={(v) => setForm({ ...form, password2: v })} icon={Lock} error={errors.password2} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 6 }}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={guardar}>Guardar cambios</Btn>
        </div>
      </div>
    </Modal>
  );
}