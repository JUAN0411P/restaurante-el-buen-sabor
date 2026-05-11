import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, UtensilsCrossed, Users, DollarSign,
  CreditCard, Banknote, ArrowLeftRight, Calendar,
  Clock, CheckCircle2, X,
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { formatMoney, formatDateTime } from '../../lib/utils';
import { Card, Tag, Btn, EmptyState, KickerLabel } from '../ui/primitives';

/* ─── helpers ─────────────────────────────────────────────── */
const isoDate = (iso) => (iso || '').slice(0, 10);

const formatDayLabel = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const formatDayShort = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
};

const METODO_ICONS = {
  efectivo:       Banknote,
  tarjeta:        CreditCard,
  transferencia:  ArrowLeftRight,
};

const METODO_LABELS = {
  efectivo:      'Efectivo',
  tarjeta:       'Tarjeta',
  transferencia: 'Transferencia',
};

/* ─── Resumen de un día ─────────────────────────────────────── */
function buildDaySummary(dayOrders) {
  const pagadas    = dayOrders.filter(o => o.pagado);
  const menu       = pagadas.filter(o => o.tipo === 'menu');
  const planes     = pagadas.filter(o => o.tipo === 'plan');
  const entregados = dayOrders.filter(o => o.estado === 'entregado');
  const platos     = entregados.reduce((s, o) => s + (o.items || []).reduce((a, i) => a + i.cantidad, 0), 0);
  const totalMenu  = menu.reduce((s, o) => s + (o.total || 0), 0);
  const totalPlanes= planes.reduce((s, o) => s + (o.total || 0), 0);
  const total      = totalMenu + totalPlanes;
  const suscAlm    = dayOrders.filter(o => o.tipo === 'suscripcion' && o.estado === 'entregado').length;

  const porMetodo = {};
  pagadas.forEach(o => {
    const m = o.metodo_pago || 'otro';
    porMetodo[m] = (porMetodo[m] || 0) + (o.total || 0);
  });

  return { total, totalMenu, totalPlanes, platos, suscAlm, pagadas: pagadas.length, porMetodo };
}

/* ─── Componente principal ──────────────────────────────────── */
export function HistorialDias({ orders, planes, suscriptores, mesas }) {
  // Agrupar órdenes por fecha
  const dias = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const d = isoDate(o.fecha);
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(o);
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a)) // desc: más reciente primero
      .map(([fecha, ords]) => ({ fecha, orders: ords, summary: buildDaySummary(ords) }));
  }, [orders]);

  const [diaIdx, setDiaIdx] = useState(0); // índice en el array `dias`
  const [expandedOrder, setExpandedOrder] = useState(null);

  if (dias.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <KickerLabel>— registro histórico</KickerLabel>
          <h2 style={{ ...FontFraunces, fontSize: 26, color: T.text, margin: 0 }}>Historial por día</h2>
        </div>
        <Card><EmptyState icon={Calendar} title="Sin registros de ventas aún" description="Las ventas aparecerán aquí día a día." /></Card>
      </div>
    );
  }

  const diaActual = dias[diaIdx] || dias[0];
  const { fecha, orders: dayOrders, summary } = diaActual;
  const hayAnterior = diaIdx < dias.length - 1;
  const haySiguiente = diaIdx > 0;

  // Separar por tipo para el detalle
  const menuOrders     = dayOrders.filter(o => o.tipo === 'menu');
  const suscOrders     = dayOrders.filter(o => o.tipo === 'suscripcion');
  const planOrders     = dayOrders.filter(o => o.tipo === 'plan');
  const cancelados     = dayOrders.filter(o => ['cancelado-timeout', 'rechazado'].includes(o.estado));

  const todayISO = new Date().toISOString().slice(0, 10);
  const esHoy = fecha === todayISO;

  return (
    <div className="space-y-5">

      {/* ── Encabezado + navegación ── */}
      <div>
        <KickerLabel>— registro histórico · {dias.length} {dias.length === 1 ? 'día' : 'días'} con actividad</KickerLabel>
        <h2 style={{ ...FontFraunces, fontSize: 26, color: T.text, margin: 0 }}>Historial por día</h2>
      </div>

      {/* Selector de día */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          borderRadius: 14,
          background: T.card,
          border: `1px solid ${T.border}`,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setDiaIdx(i => i + 1)}
          disabled={!hayAnterior}
          style={{
            width: 34, height: 34, borderRadius: 10,
            background: hayAnterior ? T.bgSoft : 'transparent',
            border: `1px solid ${hayAnterior ? T.border : 'transparent'}`,
            color: hayAnterior ? T.text : T.textMute,
            display: 'grid', placeItems: 'center',
            cursor: hayAnterior ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={16} />
        </button>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ ...FontFraunces, fontSize: 20, color: T.text }}>
              {formatDayLabel(fecha)}
            </span>
            {esHoy && (
              <span style={{
                fontSize: 10, ...FontMono, fontWeight: 700,
                background: T.olive, color: '#fff',
                padding: '2px 8px', borderRadius: 6, letterSpacing: '.08em',
              }}>HOY</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: T.textMute, ...FontMono, marginTop: 2 }}>
            día {diaIdx + 1} de {dias.length}
          </div>
        </div>

        <button
          onClick={() => setDiaIdx(i => i - 1)}
          disabled={!haySiguiente}
          style={{
            width: 34, height: 34, borderRadius: 10,
            background: haySiguiente ? T.bgSoft : 'transparent',
            border: `1px solid ${haySiguiente ? T.border : 'transparent'}`,
            color: haySiguiente ? T.text : T.textMute,
            display: 'grid', placeItems: 'center',
            cursor: haySiguiente ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Acceso rápido a otros días */}
      {dias.length > 1 && (
        <div
          style={{
            display: 'flex', gap: 6, flexWrap: 'wrap',
          }}
        >
          {dias.map((d, i) => (
            <button
              key={d.fecha}
              onClick={() => setDiaIdx(i)}
              style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 12,
                background: i === diaIdx ? T.olive : T.bgSoft,
                color: i === diaIdx ? '#fff' : T.textSoft,
                border: `1px solid ${i === diaIdx ? T.olive : T.border}`,
                cursor: 'pointer',
                fontWeight: i === diaIdx ? 600 : 400,
                ...FontMono,
                transition: 'all .15s',
              }}
            >
              {formatDayShort(d.fecha)}
            </button>
          ))}
        </div>
      )}

      {/* ── Stat cards del día ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DayStat label="INGRESOS TOTALES" value={formatMoney(summary.total)} color={T.terracotta} />
        <DayStat label="MENÚ DEL DÍA" value={formatMoney(summary.totalMenu)} color={T.mustard} />
        <DayStat label="ALMUERZOS SUSC." value={summary.suscAlm} color={T.olive} />
        <DayStat label="PLATOS SERVIDOS" value={summary.platos} color={T.text} />
      </div>

      {/* Métodos de pago */}
      {Object.keys(summary.porMetodo).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(summary.porMetodo).map(([metodo, monto]) => {
            const Icon = METODO_ICONS[metodo] || DollarSign;
            return (
              <div
                key={metodo}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: T.bgSoft,
                  display: 'grid', placeItems: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={16} color={T.olive} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, ...FontMono, color: T.textSoft, letterSpacing: '.08em', fontWeight: 600 }}>
                    {METODO_LABELS[metodo] || metodo.toUpperCase()}
                  </div>
                  <div style={{ ...FontFraunces, fontSize: 20, color: T.text, fontStyle: 'italic' }}>
                    {formatMoney(monto)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detalle órdenes: Menú del día ── */}
      <SeccionOrdenes
        titulo="Menú del día"
        dot={T.mustard}
        orders={menuOrders}
        expandedOrder={expandedOrder}
        onToggle={setExpandedOrder}
        emptyMsg="Sin órdenes de menú este día"
        mesas={mesas}
      />

      {/* ── Detalle órdenes: Suscripciones ── */}
      <SeccionOrdenes
        titulo="Mensualidades (almuerzos)"
        dot={T.olive}
        orders={suscOrders}
        expandedOrder={expandedOrder}
        onToggle={setExpandedOrder}
        emptyMsg="Sin almuerzos de suscripción este día"
        mesas={mesas}
        suscriptores={suscriptores}
      />

      {/* ── Planes cobrados ── */}
      {planOrders.length > 0 && (
        <SeccionOrdenes
          titulo="Planes cobrados en caja"
          dot={T.plum}
          orders={planOrders}
          expandedOrder={expandedOrder}
          onToggle={setExpandedOrder}
          emptyMsg=""
          mesas={mesas}
          suscriptores={suscriptores}
        />
      )}

      {/* ── Cancelados / rechazados ── */}
      {cancelados.length > 0 && (
        <SeccionOrdenes
          titulo={`Cancelados / rechazados (${cancelados.length})`}
          dot={T.red}
          orders={cancelados}
          expandedOrder={expandedOrder}
          onToggle={setExpandedOrder}
          emptyMsg=""
          mesas={mesas}
          suscriptores={suscriptores}
          muted
        />
      )}
    </div>
  );
}

/* ─── Stat card pequeño ────────────────────────────────────── */
function DayStat({ label, value, color }) {
  return (
    <Card padding={16}>
      <div style={{ fontSize: 10, ...FontMono, color: T.textSoft, letterSpacing: '.1em', fontWeight: 600, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ ...FontFraunces, fontSize: 32, color, lineHeight: 1, fontStyle: 'italic' }}>
        {value}
      </div>
    </Card>
  );
}

/* ─── Sección colapsable de órdenes ───────────────────────── */
function SeccionOrdenes({ titulo, dot, orders: list, expandedOrder, onToggle, emptyMsg, mesas, suscriptores, muted }) {
  const [collapsed, setCollapsed] = useState(false);

  if (list.length === 0 && !emptyMsg) return null;

  const totalSeccion = list.filter(o => o.pagado).reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div>
      {/* Header sección */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          borderRadius: collapsed ? 12 : '12px 12px 0 0',
          background: T.card,
          border: `1px solid ${T.border}`,
          borderBottom: collapsed ? `1px solid ${T.border}` : `1px solid ${T.borderSoft}`,
          cursor: 'pointer',
          marginBottom: 0,
          textAlign: 'left',
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 5, background: muted ? T.textMute : dot, flexShrink: 0 }} />
        <span style={{ ...FontFraunces, fontSize: 17, color: muted ? T.textSoft : T.text, flex: 1 }}>
          {titulo}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {totalSeccion > 0 && (
            <span style={{ ...FontFraunces, fontSize: 16, color: T.terracotta, fontStyle: 'italic' }}>
              {formatMoney(totalSeccion)}
            </span>
          )}
          <span style={{
            fontSize: 11, ...FontMono, fontWeight: 600,
            padding: '2px 8px', borderRadius: 6,
            background: muted ? T.bgSoft : T.bgSoft,
            color: muted ? T.textMute : T.textSoft,
          }}>
            {list.length}
          </span>
          {collapsed ? <ChevronDown size={14} color={T.textMute} /> : <ChevronUp size={14} color={T.textMute} />}
        </div>
      </button>

      {!collapsed && (
        <div
          style={{
            border: `1px solid ${T.border}`,
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            overflow: 'hidden',
          }}
        >
          {list.length === 0 ? (
            <div style={{ padding: 20, background: T.card }}>
              <EmptyState title={emptyMsg} />
            </div>
          ) : (
            list
              .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
              .map((o, idx) => (
                <OrdenFila
                  key={o.id}
                  orden={o}
                  idx={idx}
                  totalRows={list.length}
                  expanded={expandedOrder === o.id}
                  onToggle={() => onToggle(expandedOrder === o.id ? null : o.id)}
                  mesas={mesas}
                  suscriptores={suscriptores}
                  muted={muted}
                />
              ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Fila de orden expandible ─────────────────────────────── */
function OrdenFila({ orden, idx, totalRows, expanded, onToggle, mesas, suscriptores, muted }) {
  const mesa = mesas?.find(m => m.numero === orden.mesa_numero);
  const sub  = suscriptores?.find(s => s.id === orden.suscriptor_id);

  const estadoColor = {
    'entregado': T.olive,
    'listo': T.mustard,
    'preparando': T.mustard,
    'pendiente': T.textSoft,
    'esperando-aprobacion': T.mustard,
    'cancelado-timeout': T.red,
    'rechazado': T.red,
    'pagado': T.olive,
  }[orden.estado] || T.textSoft;

  const estadoLabel = {
    'entregado': 'Entregado',
    'listo': 'Listo',
    'preparando': 'Preparando',
    'pendiente': 'En cola',
    'esperando-aprobacion': 'Esperando aprobación',
    'cancelado-timeout': 'Cancelado',
    'rechazado': 'Rechazado',
  }[orden.estado] || orden.estado;

  const Icon = METODO_ICONS[orden.metodo_pago];
  const esCancelado = ['cancelado-timeout', 'rechazado'].includes(orden.estado);

  return (
    <div
      style={{
        background: expanded ? T.bgSoft : T.card,
        borderBottom: idx < totalRows - 1 ? `1px solid ${T.borderSoft}` : 'none',
        transition: 'background .15s',
        opacity: muted && !expanded ? 0.75 : 1,
      }}
    >
      {/* Fila principal — siempre visible */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Ícono tipo */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: esCancelado ? T.redSoft
            : orden.tipo === 'suscripcion' ? T.oliveSoft
            : orden.tipo === 'plan' ? T.plumSoft
            : T.mustardSoft,
          display: 'grid', placeItems: 'center',
        }}>
          {orden.tipo === 'menu' && <UtensilsCrossed size={16} color={T.mustard} />}
          {orden.tipo === 'suscripcion' && <Users size={16} color={T.olive} />}
          {orden.tipo === 'plan' && <DollarSign size={16} color={T.plum} />}
          {esCancelado && <X size={16} color={T.red} />}
        </div>

        {/* Info principal */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            {orden.mesa_numero && (
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Mesa {orden.mesa_numero}</span>
            )}
            {sub && <span style={{ fontSize: 12, color: T.textSoft }}>· {sub.nombre}</span>}
            {orden.tipo === 'plan' && orden.suscriptor && (
              <span style={{ fontSize: 12, color: T.textSoft }}>· {orden.suscriptor.nombre}</span>
            )}
            <OrdenTag tipo={orden.tipo} esInvitado={orden.es_invitado} />
            <span style={{ fontSize: 11, color: estadoColor, ...FontMono, fontWeight: 600 }}>
              {estadoLabel}
            </span>
          </div>
          <div style={{ fontSize: 11, color: T.textMute, ...FontMono }}>
            {formatDateTime(orden.fecha)}
            {orden.metodo_pago && ` · ${METODO_LABELS[orden.metodo_pago] || orden.metodo_pago}`}
          </div>
        </div>

        {/* Total */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {orden.total > 0 && (
            <div style={{ ...FontFraunces, fontSize: 18, color: esCancelado ? T.textMute : T.terracotta, fontStyle: 'italic', textDecoration: esCancelado ? 'line-through' : 'none' }}>
              {formatMoney(orden.total)}
            </div>
          )}
          {orden.pagado && <CheckCircle2 size={12} color={T.olive} style={{ marginLeft: 'auto' }} />}
        </div>

        {expanded ? <ChevronUp size={14} color={T.textMute} style={{ flexShrink: 0 }} /> : <ChevronDown size={14} color={T.textMute} style={{ flexShrink: 0 }} />}
      </button>

      {/* Detalle expandido */}
      {expanded && (
        <div style={{ padding: '0 16px 16px 64px' }}>
          <div style={{
            padding: 12, borderRadius: 10,
            background: T.card, border: `1px solid ${T.borderSoft}`,
          }}>
            {/* Items */}
            {(orden.items || []).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, ...FontMono, color: T.textMute, letterSpacing: '.08em', marginBottom: 6, fontWeight: 600 }}>
                  ITEMS
                </div>
                {orden.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: T.text }}>
                    <span>
                      <span style={{ ...FontMono, fontSize: 11, color: T.textSoft, marginRight: 8 }}>{it.cantidad}×</span>
                      {it.nombre}
                      {it.observacion && (
                        <span style={{ fontSize: 10, color: T.mustard, ...FontMono, marginLeft: 6 }}>⚡ {it.observacion}</span>
                      )}
                    </span>
                    {it.precio > 0 && (
                      <span style={{ color: T.textSoft, ...FontMono, fontSize: 11 }}>
                        {formatMoney(it.precio * it.cantidad)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Meta-datos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 11, color: T.textSoft }}>
              {orden.mesero_id && (
                <div><span style={{ color: T.textMute }}>Mesero ID:</span> {orden.mesero_id}</div>
              )}
              {orden.metodo_pago && (
                <div><span style={{ color: T.textMute }}>Pago:</span> {METODO_LABELS[orden.metodo_pago] || orden.metodo_pago}</div>
              )}
              {orden.fecha_pago && (
                <div><span style={{ color: T.textMute }}>Cobrado:</span> {formatDateTime(orden.fecha_pago)}</div>
              )}
              {orden.aprobado_en && (
                <div><span style={{ color: T.textMute }}>Aprobado:</span> {formatDateTime(orden.aprobado_en)}</div>
              )}
              {orden.fecha_entrega && (
                <div><span style={{ color: T.textMute }}>Entregado:</span> {formatDateTime(orden.fecha_entrega)}</div>
              )}
              {orden.cancelado_en && (
                <div><span style={{ color: T.red }}>Cancelado:</span> {formatDateTime(orden.cancelado_en)}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tag de tipo de orden ─────────────────────────────────── */
function OrdenTag({ tipo, esInvitado }) {
  if (esInvitado) return <Tag tone="plum" size="xs">INVITADO</Tag>;
  if (tipo === 'suscripcion') return <Tag tone="olive" size="xs">PLAN SUSC.</Tag>;
  if (tipo === 'menu')        return <Tag tone="mustard" size="xs">MENÚ DÍA</Tag>;
  if (tipo === 'plan')        return <Tag tone="plum" size="xs">PLAN CAJA</Tag>;
  return null;
}
