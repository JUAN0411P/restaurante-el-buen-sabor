import {
  Clock, Check, UtensilsCrossed, Coffee
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, todayISO, minutesAgo } from '../../lib/utils';
import { Tag, Btn, EmptyState } from '../ui/primitives';

export function CocinaPanel({ orders, mesas, refresh }) {

  const pendientes = orders.filter(o => o.estado === 'pendiente' || o.estado === 'preparando');
  const ordersSusc = pendientes.filter(o => o.tipo === 'suscripcion').sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const ordersMenu = pendientes.filter(o => o.tipo === 'menu').sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const today = todayISO();
  const totalSuscHoy = orders.filter(o => o.tipo === 'suscripcion' && o.estado === 'entregado' && o.fecha?.slice(0, 10) === today).length;
  const totalMenuHoy = orders.filter(o => o.tipo === 'menu' && o.estado === 'entregado' && o.fecha?.slice(0, 10) === today).length;

  // Tiempo promedio de los entregados hoy
  const entregadosHoy = orders.filter(o => o.estado === 'entregado' && o.fechaEntrega && o.fecha?.slice(0, 10) === today);
  const promedioMin = entregadosHoy.length > 0
    ? Math.round(entregadosHoy.reduce((s, o) => s + (new Date(o.fechaEntrega) - new Date(o.fecha)) / 60000, 0) / entregadosHoy.length)
    : 0;

  // const cambiarEstado = async (id, nuevoEstado) => {
  //   const currentOrders = await db.get('rest:orders', []);
  //   await db.set('rest:orders', currentOrders.map(o => o.id === id
  //     ? { ...o, estado: nuevoEstado, [`fecha_${nuevoEstado}`]: new Date().toISOString() }
  //     : o));
  //   refresh();
  // };
// Reemplaza la función cambiarEstado completa:
  const cambiarEstado = async (id, nuevoEstado) => {
    const cambios = { estado: nuevoEstado };
    if (nuevoEstado === 'preparando') cambios.fecha_preparando = new Date().toISOString();
    if (nuevoEstado === 'listo')      cambios.fecha_listo      = new Date().toISOString();
    if (nuevoEstado === 'entregado')  cambios.fecha_entrega    = new Date().toISOString();
    await db.update('rest:orders', id, cambios);
    refresh();
  };

  const reveal = () => {};

  return (
    <div>
      {/* Stats pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 22 }} className="grid sm:grid-cols-3 grid-cols-1">
        <StatPill label="SUSCRIPCIONES HOY" value={totalSuscHoy} bg={T.oliveSoft} fg={T.olive} />
        <StatPill label="MENÚ DEL DÍA HOY" value={totalMenuHoy} bg={T.mustardSoft} fg={T.mustard} />
        <StatPill label="TIEMPO PROMEDIO" value={promedioMin > 0 ? `${promedioMin}` : '—'} bg={T.bgSoft} fg={T.text} suffix="min/plato" />
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="grid md:grid-cols-2 grid-cols-1">
        {/* Mensualidad */}
        <ColumnaCocina
          titulo="Mensualidad"
          dotColor={T.olive}
          tagTone="olive"
          bgColor={T.oliveSoft}
          orders={ordersSusc}
          revealedIds={revealedIds}
          onReveal={reveal}
          onCambiarEstado={cambiarEstado}
          mesas={mesas}
          emptyIcon={Coffee}
        />
        {/* Menú del día */}
        <ColumnaCocina
          titulo="Menú del día"
          dotColor={T.mustard}
          tagTone="mustard"
          bgColor={T.mustardSoft}
          orders={ordersMenu}
          revealedIds={revealedIds}
          onReveal={reveal}
          onCambiarEstado={cambiarEstado}
          mesas={mesas}
          emptyIcon={UtensilsCrossed}
        />
      </div>
    </div>
  );
}

function StatPill({ label, value, bg, fg, suffix }) {
  return (
    <div
      style={{
        padding: '14px 18px',
        background: bg,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ ...FontFraunces, fontSize: 32, color: fg, lineHeight: 1 }}>{value}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: T.textSoft, ...FontMono, letterSpacing: '.1em', fontWeight: 600 }}>
          {label}
        </div>
        {suffix && <div style={{ fontSize: 11, color: T.textMute, marginTop: 2 }}>{suffix}</div>}
      </div>
    </div>
  );
}

function ColumnaCocina({ titulo, dotColor, tagTone, bgColor, orders: cola, revealedIds, onReveal, onCambiarEstado, mesas, emptyIcon }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: dotColor }} />
          <span style={{ ...FontFraunces, fontSize: 19, color: T.text }}>{titulo}</span>
        </div>
        <Tag tone={tagTone} size="xs">{cola.length} EN COLA</Tag>
      </div>
      <div
        style={{
          background: bgColor,
          borderRadius: 14,
          padding: 12,
          minHeight: 200,
        }}
      >
        {cola.length === 0 ? (
          <EmptyState icon={emptyIcon} title="Sin pedidos pendientes" />
        ) : (
          cola.map((o, idx) => (
            <Ticket
              key={o.id}
              orden={o}
              posicion={idx + 1}
              esTurno={idx === 0}
              revealed={revealedIds.has(o.id)}
              onReveal={onReveal}
              onCambiarEstado={onCambiarEstado}
              mesas={mesas}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Ticket({ orden, posicion, esTurno, revealed, onReveal, onCambiarEstado, mesas }) {
  const mesa = mesas.find(m => m.numero === orden.mesa);
  const comensal = mesa?.comensales.find(c => c.id === orden.comensal_id);
  const min = minutesAgo(orden.fecha);
  const esRetrasado = min >= 10;

  const tagInfo = orden.es_invitado
    ? { label: 'INVITADO', tone: 'plum' }
    : orden.tipo === 'suscripcion'
      ? { label: 'PLAN MENSUAL', tone: 'olive' }
      : { label: 'CLIENTE DÍA', tone: 'mustard' };

  // Pedidos siempre visibles — ya no se bloquean
  return (
    <div
      className={esRetrasado ? 'ebs-late' : ''}
      style={{
        background: esTurno ? T.card : T.cardAlt,
        border: esTurno
          ? `2px solid ${T.olive}`
          : esRetrasado
            ? `2px solid #a83c2c`
            : `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 26, height: 26, borderRadius: 13,
              background: esTurno ? T.olive : T.bgSoft,
              color: esTurno ? '#fff' : T.textSoft,
              display: 'grid', placeItems: 'center',
              fontSize: 12, fontWeight: 700, ...FontMono,
              flexShrink: 0,
            }}
          >
            {posicion}
          </div>
          <span style={{ ...FontFraunces, fontSize: 20, color: T.text }}>Mesa {orden.mesa}</span>
          <Tag tone={tagInfo.tone} size="xs">{tagInfo.label}</Tag>
          {orden.estado === 'preparando' && <Tag tone="mustard" size="xs">PREPARANDO</Tag>}
          {esRetrasado && (
            <Tag tone="red" size="xs">⚠ {min} MIN</Tag>
          )}
        </div>
        <span style={{ ...FontMono, fontSize: 11, color: esRetrasado ? '#a83c2c' : T.textMute, fontWeight: esRetrasado ? 700 : 400 }}>
          {min < 1 ? 'recién' : `${min} min`}
        </span>
      </div>

      {/* Comensal name */}
      {comensal && (
        <div style={{ fontSize: 12, color: T.textSoft, marginBottom: 8, ...FontMono }}>
          {comensal.nombre}
          {orden.suscriptor && orden.es_invitado && ` · plan de ${orden.suscriptor.nombre}`}
        </div>
      )}

      {/* Items con observaciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {orden.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.text }}>
              <span
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: T.bgSoft,
                  display: 'grid', placeItems: 'center',
                  fontSize: 11, fontWeight: 700,
                  ...FontMono,
                  flexShrink: 0,
                }}
              >
                {it.cantidad}
              </span>
              {it.nombre}
            </div>
            {it.observacion && (
              <div
                className="ebs-obs-tag"
                style={{
                  marginLeft: 32,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#7a5a00',
                  ...FontMono,
                  letterSpacing: '.04em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                ⚡ {it.observacion.toUpperCase()}
              </div>
            )}
          </div>
        ))}
      </div>

      {esTurno && orden.estado === 'pendiente' && (
        <Btn variant="dark" size="sm" full icon={Clock} onClick={() => onCambiarEstado(orden.id, 'preparando')}>
          ▶ Empezar a preparar
        </Btn>
      )}
      {esTurno && orden.estado === 'preparando' && (
        <Btn variant="primary" size="sm" full icon={Check} onClick={() => onCambiarEstado(orden.id, 'listo')}>
          Marcar como listo
        </Btn>
      )}
      {!esTurno && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: T.bg,
            fontSize: 11,
            color: T.textMute,
            textAlign: 'center',
            ...FontMono,
            letterSpacing: '.05em',
          }}
        >
          EN COLA · #{posicion}
        </div>
      )}
    </div>
  );
}