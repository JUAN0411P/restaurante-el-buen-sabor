import { useState, useEffect, useRef } from 'react';
import {
  UtensilsCrossed, Calendar, Check, X, Edit3, AlertTriangle,
  Crown, Heart, Clock, Bell, User, Mail, Lock, Phone, QrCode
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, formatMoney, formatDateTime, hashPw, validators, AVISO_INASISTENCIA_HORA, MAX_DIAS_COMPENSADOS_AUTO, APPROVAL_CANCEL_MINUTES } from '../../lib/utils';
import { Card, Tag, Btn, Modal, Input, EmptyState, KickerLabel, useAnimatedNumber, useCountdown, RevealOnScroll } from '../ui/primitives';
import { AttendanceCalendar } from '../ui/AttendanceCalendar';
import { crearNotificacion } from '../ui/NotificationsPanel';

export function SuscriptorPanel({ activeTab, user, menu, planes, suscriptores, orders, events, refresh }) {
  const [editProfile, setEditProfile] = useState(false);
  const tab = activeTab || 'resumen';
  const [showAvisoInasistencia, setShowAvisoInasistencia] = useState(false);
  const [showExtension, setShowExtension] = useState(false);
  const [celebrate, setCelebrate] = useState(null); // orderId que se acaba de aprobar

  const sub = suscriptores.find(s => s.id === user.id) || user;
  const plan = planes.find(p => p.id === sub.plan);

  const pendientesAprobacion = orders.filter(o =>
    o.estado === 'esperando-aprobacion' && o.suscriptor?.id === sub.id
  );

  const consumosMes = orders.filter(o => o.suscriptor?.id === sub.id && o.tipo === 'suscripcion');
  const diasRestantes = sub.fechaVencimiento
    ? Math.max(0, Math.ceil((new Date(sub.fechaVencimiento) - new Date()) / 86400000))
    : 0;
  const subEvents = events.filter(e => e.suscriptorId === sub.id);

  const aprobarPedido = async (orderId) => {
    const allOrders = await db.get('rest:orders', []);
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    // Trigger celebration animation
    setCelebrate(orderId);
    setTimeout(() => setCelebrate(null), 1100);

    await db.set('rest:orders', allOrders.map(o => o.id === orderId
      ? { ...o, estado: 'pendiente', aprobadoEn: new Date().toISOString() }
      : o));

    const allSubs = await db.get('rest:subs', []);
    await db.set('rest:subs', allSubs.map(s => s.id === sub.id
      ? { ...s, almuerzosRestantes: Math.max(0, s.almuerzosRestantes - 1) }
      : s));

    const allMenu = await db.get('rest:menu', []);
    await db.set('rest:menu', allMenu.map(m => {
      const c = order.items.find(x => x.id === m.id);
      return c ? { ...m, disponibles: Math.max(0, m.disponibles - c.cantidad), vendidos: (m.vendidos || 0) + c.cantidad } : m;
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
    <div className="space-y-5 ebs-stagger">
      <div className="ebs-enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <KickerLabel>— tu mensualidad · cuenta {sub.codigo}</KickerLabel>
          <h2 style={{ ...FontFraunces, fontSize: 30, color: T.text, margin: 0, letterSpacing: '-0.015em' }}>
            Hola, {sub.nombre.split(' ')[0]}
          </h2>
        </div>
        <Btn variant="ghost" size="sm" icon={Edit3} onClick={() => setEditProfile(true)}>Editar perfil</Btn>
      </div>

      {/* HERO ALERT — pedidos pendientes */}
      {pendientesAprobacion.length > 0 && (
        <div className="space-y-3">
          {pendientesAprobacion.map(o => (
            <PendingOrderCard
              key={o.id}
              order={o}
              celebrating={celebrate === o.id}
              onAprobar={() => aprobarPedido(o.id)}
              onRechazar={() => rechazarPedido(o.id)}
            />
          ))}
        </div>
      )}

      {/* Tab content with smooth transitions */}
      <div key={tab} className="ebs-tab-content">

      {/* Info invitados */}
      {tab === 'resumen' && sub.permitirInvitados && (
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
        <RevealOnScroll>
          <div style={{ display: 'grid', gap: 14 }} className="grid md:grid-cols-[1.6fr_1fr] grid-cols-1 ebs-stagger">
            {/* Plan card */}
            <Card padding={22}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <KickerLabel>— tu plan activo</KickerLabel>
                  <div style={{ ...FontFraunces, fontSize: 24, color: T.text, marginTop: 4 }}>{plan.nombre}</div>
                  <div style={{ fontSize: 12, color: T.textSoft, marginTop: 4 }}>
                    {plan.almuerzos} almuerzos · {plan.dias} días · vence {sub.fechaVencimiento}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="grid grid-cols-3 ebs-stagger">
                <PlanStat
                  label="ALMUERZOS"
                  value={sub.almuerzosRestantes}
                  total={plan.almuerzos}
                  bg={T.oliveSoft}
                  fg={T.olive}
                  pct={(sub.almuerzosRestantes / plan.almuerzos) * 100}
                />
                <div style={{ padding: 14, background: T.mustardSoft, borderRadius: 12 }}>
                  <div style={{ fontSize: 10, color: T.mustard, ...FontMono, letterSpacing: '.1em', fontWeight: 600 }}>
                    DÍAS
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                    <AnimatedStatNumber value={diasRestantes} delay={150} style={{ ...FontFraunces, fontSize: 36, color: T.mustard, lineHeight: 1, fontStyle: 'italic' }} />
                    <span style={{ fontSize: 12, color: T.mustard, opacity: .7 }}>/ {plan.dias}</span>
                  </div>
                  <div style={{ height: 5, background: '#fff', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (diasRestantes / plan.dias) * 100)}%`, background: T.mustard, transformOrigin: 'left', animation: 'ebs-grow 1.1s cubic-bezier(.2,.8,.2,1) both' }} />
                  </div>
                </div>
                <div style={{ padding: 14, background: T.plumSoft, borderRadius: 12 }}>
                  <div style={{ fontSize: 10, color: T.plum, ...FontMono, letterSpacing: '.1em', fontWeight: 600 }}>
                    COMPENSADOS
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                    <span style={{ ...FontFraunces, fontSize: 36, color: T.plum, lineHeight: 1, fontStyle: 'italic' }}>
                      +<AnimatedStatNumber value={sub.diasExtraCompensados || 0} delay={300} as="span" />
                    </span>
                    <span style={{ fontSize: 12, color: T.plum, opacity: .7 }}>/ {MAX_DIAS_COMPENSADOS_AUTO}</span>
                  </div>
                  <div style={{ height: 5, background: '#fff', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((sub.diasExtraCompensados || 0) / MAX_DIAS_COMPENSADOS_AUTO) * 100}%`, background: T.plum, transformOrigin: 'left', animation: 'ebs-grow 1.1s cubic-bezier(.2,.8,.2,1) both' }} />
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
        </RevealOnScroll>
      )}

      {/* MENÚ DE HOY */}
      {tab === 'menu' && (
        <RevealOnScroll>
          <KickerLabel>— oferta de hoy</KickerLabel>
          <h3 style={{ ...FontFraunces, fontSize: 22, color: T.text, margin: '4px 0 16px 0' }}>
            Lo que está disponible
          </h3>
          <div style={{ display: 'grid', gap: 10 }} className="grid md:grid-cols-2 grid-cols-1 ebs-stagger">
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
        </RevealOnScroll>
      )}

      {/* CALENDARIO */}
      {tab === 'calendar' && (
        <RevealOnScroll>
          <Card padding={20}>
            <KickerLabel>— tu calendario</KickerLabel>
            <h3 style={{ ...FontFraunces, fontSize: 22, color: T.text, margin: '4px 0 16px 0' }}>
              Asistencias y avisos
            </h3>
            <AttendanceCalendar events={subEvents} fechaInicio={sub.fechaInicio} fechaVencimiento={sub.fechaVencimiento} />
          </Card>
        </RevealOnScroll>
      )}

      {/* HISTORIAL */}
      {tab === 'historial' && (
        <RevealOnScroll>
          <KickerLabel>— últimas comidas</KickerLabel>
          <h3 style={{ ...FontFraunces, fontSize: 22, color: T.text, margin: '4px 0 16px 0' }}>
            Historial de consumo
          </h3>
          {consumosMes.length === 0 ? (
            <Card><EmptyState title="Aún no has consumido almuerzos" /></Card>
          ) : (
            <Card padding={20} className="ebs-stagger">
              {consumosMes.slice(-15).reverse().map((o, i, arr) => {
                const status =
                  o.estado === 'entregado' ? 'ok' :
                  o.estado === 'rechazado' || o.estado === 'cancelado-timeout' ? 'miss' :
                  'pending';
                const iconBg = status === 'miss' ? T.redSoft : status === 'pending' ? T.mustardSoft : T.oliveSoft;
                const iconFg = status === 'miss' ? T.red : status === 'pending' ? T.mustard : T.olive;
                const iconChar = status === 'miss' ? '✕' : status === 'pending' ? '⋯' : '✓';

                return (
                  <div
                    key={o.id}
                    className="ebs-row"
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '12px 0',
                      borderBottom: i < arr.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      className="ebs-tick-in"
                      style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        background: iconBg, color: iconFg,
                        display: 'grid', placeItems: 'center',
                        fontSize: 16, fontWeight: 700,
                      }}
                    >
                      {iconChar}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                          {o.items.map(i => i.nombre).join(', ')}
                        </span>
                        <span style={{ fontSize: 11, color: T.textMute, ...FontMono, flexShrink: 0 }}>
                          {formatDateTime(o.fecha)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: T.textSoft }}>
                        {status === 'miss' ? (
                          <span style={{ color: T.red }}>No completado · 1 almuerzo perdido</span>
                        ) : (
                          <>Mesa {o.mesa}{o.esInvitado ? ' · invitado' : ''}</>
                        )}
                      </div>
                    </div>
                    {status === 'pending' && <Tag tone="mustard" size="xs">POR APROBAR</Tag>}
                    {o.esInvitado && status !== 'pending' && <Tag tone="plum" size="xs"><Heart size={9} /> INVITADO</Tag>}
                  </div>
                );
              })}
            </Card>
          )}
        </RevealOnScroll>
      )}

      </div>{/* end tab content */}

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

function PlanStat({ label, value, total, bg, fg, pct }) {
  return (
    <div style={{ padding: 14, background: bg, borderRadius: 12 }}>
      <div style={{ fontSize: 10, color: fg, ...FontMono, letterSpacing: '.1em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <AnimatedStatNumber value={value} style={{ ...FontFraunces, fontSize: 36, color: fg, lineHeight: 1, fontStyle: 'italic' }} />
        <span style={{ fontSize: 13, color: fg, opacity: .7 }}>/ {total}</span>
      </div>
      <div style={{ height: 5, background: '#fff', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: fg, transformOrigin: 'left', animation: 'ebs-grow 1.1s cubic-bezier(.2,.8,.2,1) both' }} />
      </div>
    </div>
  );
}

// ===== AnimatedStatNumber — counts from 0 to value =====
function AnimatedStatNumber({ value, delay = 0, style, as = 'span' }) {
  const animated = useAnimatedNumber(value, { delay, duration: 1100 });
  const Comp = as;
  return <Comp style={style}>{animated}</Comp>;
}

// ===== PendingOrderCard — hero alert with live mm:ss countdown + waves + celebration =====
function PendingOrderCard({ order, celebrating, onAprobar, onRechazar }) {
  const totalSeconds = APPROVAL_CANCEL_MINUTES * 60;
  const { formatted, isUrgent, isCritical } = useCountdown(order.fecha, totalSeconds);

  const bg = isUrgent ? T.redSoft : T.mustardSoft;
  const border = isUrgent ? T.red : T.mustard;
  const accent = isUrgent ? T.red : T.mustard;

  return (
    <div
      className="ebs-pull-bounce"
      style={{
        position: 'relative',
        padding: 18,
        borderRadius: 16,
        background: bg,
        border: `1.5px solid ${border}`,
        overflow: 'hidden',
      }}
    >
      {/* Celebration overlay */}
      {celebrating && (
        <div
          className="ebs-celebrate"
          style={{
            width: 120, height: 120, borderRadius: '50%',
            background: T.olive, color: '#fff',
            display: 'grid', placeItems: 'center',
          }}
        >
          <Check size={70} strokeWidth={3} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Bell with concentric waves */}
        <div style={{ position: 'relative', width: 36, height: 36, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <div className="ebs-wave" style={{ color: accent }} />
          <div className="ebs-wave ebs-wave-2" style={{ color: accent }} />
          <div className="ebs-wave ebs-wave-3" style={{ color: accent }} />
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: accent, color: '#fff',
              display: 'grid', placeItems: 'center',
              position: 'relative', zIndex: 2,
            }}
          >
            <Bell size={16} />
          </div>
        </div>
        <span style={{ ...FontFraunces, fontSize: 16, color: T.text, flex: 1, minWidth: 180 }}>
          Un pedido espera tu aprobación
        </span>
        <div
          className={isCritical ? 'ebs-vibrate' : ''}
          style={{
            ...FontMono, fontSize: 13, color: accent, fontWeight: 700,
            padding: '4px 10px', borderRadius: 8,
            background: isUrgent ? '#fff' : 'rgba(255,255,255,.5)',
            boxShadow: isCritical ? `0 0 0 2px ${accent}` : 'none',
            transition: 'box-shadow .3s ease',
          }}
        >
          ⏱ {formatted}
        </div>
      </div>

      <div style={{ padding: 12, background: T.card, borderRadius: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            Mesa {order.mesa} · Mesero {order.mesero}
          </span>
          {order.esInvitado && <Tag tone="plum" size="xs"><Heart size={9} /> INVITADO</Tag>}
        </div>
        <div style={{ fontSize: 13, color: T.textSoft }}>
          {order.items.map(i => `${i.cantidad}× ${i.nombre}`).join(' · ')}
        </div>
        <div style={{ fontSize: 11, color: T.textMute, marginTop: 6, ...FontMono }}>
          Se descontará 1 almuerzo de tu plan
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Btn full variant="primary" icon={Check} onClick={onAprobar}>Aprobar</Btn>
        <Btn full variant="ghost" icon={X} onClick={onRechazar}>Rechazar</Btn>
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
  const diasCompensados = sub.diasExtraCompensados || 0;

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
        almuerzosRestantes: sub.almuerzosRestantes,
        fechaVencimiento: sub.fechaVencimiento,
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 11, marginTop: 6 }}>
            <div><span style={{ color: T.textMute }}>Plan:</span> <strong style={{ color: T.text }}>{plan?.nombre || '—'}</strong></div>
            <div><span style={{ color: T.textMute }}>Vence:</span> <strong style={{ color: T.text }}>{sub.fechaVencimiento || '—'}</strong></div>
            <div><span style={{ color: T.textMute }}>Almuerzos rest.:</span> <strong style={{ color: T.text }}>{sub.almuerzosRestantes}</strong></div>
            <div><span style={{ color: T.textMute }}>Compensados:</span> <strong style={{ color: T.text }}>{diasCompensados} / {MAX_DIAS_COMPENSADOS_AUTO}</strong></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
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