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

  // Con plan activo
  return (
    <div className="space-y-5">

      {/* ── Bienvenida ── */}
      <div>
        <KickerLabel>— cuenta {sub.codigo}</KickerLabel>
        <h2 style={{ ...FontFraunces, fontSize: 30, color: T.text, margin: 0, letterSpacing: '-0.015em' }}>
          Hola, {sub.nombre.split(' ')[0]} 👋
        </h2>
      </div>

      {/* ── Pedidos por aprobar ── */}
      {pendientesAprobacion.length > 0 && (
        <PedidoHeroCard
          orden={pendientesAprobacion[0]}
          onAprobar={aprobarPedido}
          onRechazar={rechazarPedido}
        />
      )}

      {/* ── Navegación tabs ── */}
      <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${T.border}`, overflow: 'auto' }} className="scrollbar-hide">
        {[
          { id: 'resumen', label: 'Resumen', icon: <Crown size={14} /> },
          { id: 'menu', label: 'Menú de hoy', icon: <UtensilsCrossed size={14} /> },
          { id: 'calendar', label: 'Calendario', icon: <Calendar size={14} /> },
          { id: 'historial', label: 'Historial', icon: <Clock size={14} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => refresh && refresh()} // trigger parent navigation
            style={{
              padding: '12px 16px', borderBottom: tab === t.id ? `2px solid ${T.olive}` : 'none',
              background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              color: tab === t.id ? T.olive : T.textSoft, fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
              whiteSpace: 'nowrap', transition: 'color .15s',
            }}
            data-tab={t.id}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* RESUMEN */}
      {tab === 'resumen' && (
        <>
          {/* Stats del plan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <PlanStat
              label="DÍAS RESTANTES"
              value={diasRestantes}
              total={plan.dias}
              pct={(diasRestantes / plan.dias) * 100}
              bg={T.oliveSoft}
              fg={T.olive}
            />
            <PlanStat
              label="ALMUERZOS RESTANTES"
              value={sub.almuerzos_restantes}
              total={plan.almuerzos}
              pct={(sub.almuerzos_restantes / plan.almuerzos) * 100}
              bg={T.mustardSoft}
              fg={T.mustard}
            />
            <PlanStat
              label="MENSUALIDAD"
              value={formatMoney(plan.precio)}
              total=""
              pct={100}
              bg={T.plumSoft}
              fg={T.plum}
            />
            <PlanStat
              label="ESTADO"
              value={diasRestantes > 0 ? 'ACTIVO' : 'VENCIDO'}
              total=""
              pct={diasRestantes > 0 ? 100 : 0}
              bg={diasRestantes > 0 ? T.oliveSoft : T.redSoft}
              fg={diasRestantes > 0 ? T.olive : T.red}
            />
          </div>

          {/* Acciones rápidas */}
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <Btn
              variant="outlined"
              onClick={() => setShowAvisoInasistencia(true)}
              icon={<Bell size={14} />}
            >
              Avisar inasistencia
            </Btn>
            <Btn
              variant="outlined"
              onClick={() => setShowExtension(true)}
              icon={<Check size={14} />}
            >
              Solicitar extensión
            </Btn>
            <Btn
              variant="outlined"
              onClick={() => setEditProfile(true)}
              icon={<Edit3 size={14} />}
            >
              Mi perfil
            </Btn>
          </div>

          {/* Datos de la cuenta */}
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <Card padding={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 50, height: 50, borderRadius: 8, background: T.bgSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <User size={24} color={T.text} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, ...FontMono, letterSpacing: '.1em' }}>
                    TITULAR
                  </div>
                  <div style={{ ...FontFraunces, fontSize: 14, color: T.text, margin: 0 }}>
                    {sub.nombre}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMute, ...FontMono, marginTop: 2 }}>
                    CC {sub.cedula}
                  </div>
                </div>
              </div>

              <div style={{ padding: 12, background: T.bg, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
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

            <Card padding={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 50, height: 50, borderRadius: 8, background: T.bgSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Mail size={24} color={T.text} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, ...FontMono, letterSpacing: '.1em' }}>
                    CONTACTO
                  </div>
                  <div style={{ fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.email}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMute, ...FontMono, marginTop: 2 }}>
                    📱 {sub.telefono}
                  </div>
                </div>
              </div>

              <div style={{ padding: 12, background: T.bg, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
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

      {/* HISTORIAL - Con formato mejorado mostrando asistencia */}
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
              {consumosMes.slice(-15).reverse().map((o, idx) => {
                // Calcular estadísticas de asistencia hasta este día
                const diasHastaAhora = consumosMes.slice(-15).reverse().slice(0, idx + 1).length;
                const totalSuscriptoresActivos = suscriptores?.filter(s => 
                  s.plan_id === sub.plan_id && 
                  new Date(s.fecha_inicio) <= new Date(o.fecha) &&
                  (new Date(s.fecha_vencimiento) >= new Date(o.fecha) || !s.fecha_vencimiento)
                ).length || sub.plan_id ? 1 : 0;
                
                return (
                  <Card key={o.id} padding={14}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {/* Mostrar formato "30/40" para mensualidades */}
                        <div style={{
                          textAlign: 'center',
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: T.oliveSoft,
                          border: `1px solid ${T.olive}`,
                        }}>
                          <div style={{
                            ...FontFraunces,
                            fontSize: 16,
                            fontWeight: 600,
                            color: T.olive,
                            lineHeight: 1.1,
                          }}>
                            {diasHastaAhora}/{totalSuscriptoresActivos}
                          </div>
                          <div style={{
                            fontSize: 9,
                            ...FontMono,
                            color: T.olive,
                            fontWeight: 600,
                            marginTop: 2,
                            opacity: 0.7,
                          }}>
                            asistieron
                          </div>
                        </div>
                        <Tag tone={
                          o.estado === 'entregado' ? 'olive' :
                          o.estado === 'rechazado' || o.estado === 'cancelado-timeout' ? 'red' :
                          'mustard'
                        } size="xs">{o.estado.toUpperCase()}</Tag>
                      </div>
                    </div>
                  </Card>
                );
              })}
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

      {/* Resumen del pedido */}
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
          <span style={{ ...FontFraunces, fontSize: 32, color: T.text, lineHeight: 1, fontStyle: 'italic' }}>
            {orden.items?.length || 0} {orden.items?.length === 1 ? 'plato' : 'platos'}
          </span>
        </div>
        <div style={{ fontSize: 13, color: T.text, marginBottom: 8 }}>
          {orden.items?.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{it.cantidad}× {it.nombre}</span>
              {it.observacion && <span style={{ ...FontMono, fontSize: 11, color: T.mustard }}>⚡ {it.observacion}</span>}
            </div>
          ))}
        </div>
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.4)', ...FontMono, fontSize: 11, color: T.text, textAlign: 'center', fontWeight: 600 }}>
          ⏱️ {mm}:{ss}
        </div>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
        <button
          onClick={handleAprobar}
          disabled={procesando}
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: 10,
            background: T.olive,
            border: `1px solid ${T.olive}`,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: procesando ? 'not-allowed' : 'pointer',
            fontFamily: "'Manrope', sans-serif",
            transition: 'border-color .2s ease',
          }}
        >
          <Check size={16} /> Aprobar
        </button>
        <button
          onClick={handleRechazar}
          disabled={procesando}
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'transparent',
            border: `1px solid ${T.text}55`,
            color: T.text,
            fontSize: 13,
            fontWeight: 600,
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