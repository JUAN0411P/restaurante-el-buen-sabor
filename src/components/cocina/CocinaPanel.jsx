import { useState } from 'react';
import {
  Clock, Check, Lock, Eye, UtensilsCrossed, Heart, Users, Coffee
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, todayISO, minutesAgo } from '../../lib/utils';
import { Tag, Btn, EmptyState } from '../ui/primitives';

export function CocinaPanel({ orders, mesas, refresh }) {
  const [revealedIds, setRevealedIds] = useState(new Set());

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

  const cambiarEstado = async (id, nuevoEstado) => {
    const currentOrders = await db.get('rest:orders', []);
    await db.set('rest:orders', currentOrders.map(o => o.id === id
      ? { ...o, estado: nuevoEstado, [`fecha_${nuevoEstado}`]: new Date().toISOString() }
      : o));
    refresh();
  };

  const reveal = (id) => setRevealedIds(prev => new Set([...prev, id]));

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
  const comensal = mesa?.comensales.find(c => c.id === orden.comensalId);
  const min = minutesAgo(orden.fecha);

  const tagInfo = orden.esInvitado
    ? { label: 'INVITADO', tone: 'plum' }
    : orden.tipo === 'suscripcion'
      ? { label: 'PLAN MENSUAL', tone: 'olive' }
      : { label: 'CLIENTE DÍA', tone: 'mustard' };

  const puedeVer = esTurno || revealed;
  const locked = !esTurno && !revealed;

  return (
    <div
      className={locked ? 'ebs-locked' : ''}
      style={{
        background: esTurno ? T.card : T.cardAlt,
        border: esTurno ? `2px solid ${T.olive}` : `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        opacity: locked ? 0.9 : 1,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: locked ? 10 : 12, flexWrap: 'wrap', gap: 6 }}>
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
        </div>
        <span style={{ ...FontMono, fontSize: 11, color: T.textMute }}>
          {min < 1 ? 'recién' : `${min} min`}
        </span>
      </div>

      {puedeVer ? (
        <>
          {/* Comensal name */}
          {comensal && (
            <div style={{ fontSize: 12, color: T.textSoft, marginBottom: 8, ...FontMono }}>
              {comensal.nombre}
              {orden.suscriptor && orden.esInvitado && ` · plan de ${orden.suscriptor.nombre}`}
            </div>
          )}
          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {orden.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.text }}>
                <span
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: T.bgSoft,
                    display: 'grid', placeItems: 'center',
                    fontSize: 11, fontWeight: 700,
                    ...FontMono,
                  }}
                >
                  {it.cantidad}
                </span>
                {it.nombre}
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
              🔒 ESPERA TU TURNO · #{posicion}
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            background: T.bg,
            textAlign: 'center',
          }}
        >
          <span className="ebs-lock-icon" style={{ display: 'inline-block' }}>
            <Lock size={18} color={T.textMute} />
          </span>
          <div style={{ fontSize: 12, color: T.textSoft, fontWeight: 600, marginTop: 4 }}>
            Pedido bloqueado
          </div>
          <div style={{ fontSize: 10, color: T.textMute, marginTop: 2 }}>
            Se revela cuando sea su turno
          </div>
          <button
            onClick={() => onReveal(orden.id)}
            style={{
              marginTop: 8,
              fontSize: 10,
              color: T.terracotta,
              ...FontMono,
              fontWeight: 600,
              letterSpacing: '.05em',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Eye size={11} /> VER ANTICIPADAMENTE
          </button>
        </div>
      )}
    </div>
  );
}
