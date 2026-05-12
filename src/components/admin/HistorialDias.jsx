import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, UtensilsCrossed, Users, DollarSign,
  CreditCard, Banknote, ArrowLeftRight, Calendar,
  Clock, CheckCircle2, X, Filter,
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

/* ─── Calendario para seleccionar rango de fechas ─────────────── */
function DateRangeCalendar({ startDate, endDate, onStartChange, onEndChange, availableDates }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(new Date(startDate || new Date()));

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const availableDatesSet = new Set(availableDates);
  const daysInMonth = getDaysInMonth(displayMonth);
  const firstDay = getFirstDayOfMonth(displayMonth);
  const days = [];

  // Días vacíos al inicio
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Días del mes
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${displayMonth.getFullYear()}-${String(displayMonth.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({
      day: i,
      dateStr,
      available: availableDatesSet.has(dateStr),
    });
  }

  const monthName = displayMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const isInRange = (dateStr) => {
    if (!startDate || !endDate) return false;
    return dateStr >= startDate && dateStr <= endDate;
  };

  const isStartDate = (dateStr) => dateStr === startDate;
  const isEndDate = (dateStr) => endDate && dateStr === endDate;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowCalendar(!showCalendar)}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 10,
          background: T.bgSoft,
          border: `1px solid ${T.border}`,
          color: T.text,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
        }}
      >
        <Calendar size={16} />
        <span>
          {startDate && endDate ? `${startDate} a ${endDate}` : 'Seleccionar rango de fechas'}
        </span>
      </button>

      {showCalendar && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 8,
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 16,
            zIndex: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            width: 320,
          }}
        >
          {/* Encabezado del mes */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1))}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: T.bgSoft,
                border: `1px solid ${T.border}`,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                color: T.text,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ ...FontFraunces, fontSize: 14, color: T.text, textTransform: 'capitalize' }}>
              {monthName}
            </span>
            <button
              onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1))}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: T.bgSoft,
                border: `1px solid ${T.border}`,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                color: T.text,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Días de la semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.textMute,
                  padding: 4,
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {days.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} />;
              }

              const inRange = isInRange(day.dateStr);
              const isStart = isStartDate(day.dateStr);
              const isEnd = isEndDate(day.dateStr);
              const isDisabled = !day.available;

              return (
                <button
                  key={day.dateStr}
                  onClick={() => {
                    if (!endDate || day.dateStr < startDate) {
                      onStartChange(day.dateStr);
                      onEndChange(null);
                    } else if (day.dateStr >= startDate) {
                      onEndChange(day.dateStr);
                    }
                  }}
                  disabled={isDisabled}
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    background:
                      isStart || isEnd ? T.olive :
                      inRange ? T.oliveSoft :
                      isDisabled ? T.bgSoft : T.card,
                    border: `1px solid ${
                      isStart || isEnd ? T.olive :
                      inRange ? T.olive :
                      isDisabled ? T.borderSoft : T.border
                    }`,
                    color:
                      isStart || isEnd ? '#fff' :
                      inRange ? T.olive :
                      isDisabled ? T.textMute : T.text,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: isStart || isEnd ? 600 : 400,
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                >
                  {day.day}
                </button>
              );
            })}
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setShowCalendar(false);
                onStartChange(null);
                onEndChange(null);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: T.bgSoft,
                border: `1px solid ${T.border}`,
                color: T.text,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Limpiar
            </button>
            <button
              onClick={() => setShowCalendar(false)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: T.olive,
                border: `1px solid ${T.olive}`,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);

  // Obtener fechas disponibles
  const availableDates = useMemo(() => dias.map(d => d.fecha), [dias]);

  // Filtrar días según el rango seleccionado
  const filteredDias = useMemo(() => {
    if (!startDate) return dias;
    const end = endDate || startDate;
    return dias.filter(d => d.fecha >= startDate && d.fecha <= end);
  }, [dias, startDate, endDate]);

  // Estadísticas del rango
  const rangeStats = useMemo(() => {
    let totalIncome = 0;
    let totalOrders = 0;
    let totalDishes = 0;
    let totalSubscriptions = 0;

    filteredDias.forEach(d => {
      totalIncome += d.summary.total;
      totalOrders += d.summary.pagadas;
      totalDishes += d.summary.platos;
      totalSubscriptions += d.summary.suscAlm;
    });

    return { totalIncome, totalOrders, totalDishes, totalSubscriptions };
  }, [filteredDias]);

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

  return (
    <div className="space-y-5">

      {/* ── Encabezado ── */}
      <div>
        <KickerLabel>— registro histórico · {dias.length} {dias.length === 1 ? 'día' : 'días'} con actividad</KickerLabel>
        <h2 style={{ ...FontFraunces, fontSize: 26, color: T.text, margin: 0 }}>Historial por día</h2>
      </div>

      {/* ── Calendario y filtros ── */}
      <Card padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Filter size={16} color={T.text} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Selecciona un rango de fechas</span>
        </div>
        <DateRangeCalendar
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          availableDates={availableDates}
        />
      </Card>

      {/* ── Estadísticas del rango seleccionado ── */}
      {(startDate || filteredDias.length > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card padding={14}>
            <div style={{ fontSize: 10, ...FontMono, color: T.textMute, letterSpacing: '.08em', marginBottom: 8, fontWeight: 600 }}>INGRESOS</div>
            <div style={{ ...FontFraunces, fontSize: 24, color: T.terracotta, fontStyle: 'italic', margin: 0 }}>
              {formatMoney(rangeStats.totalIncome)}
            </div>
            <div style={{ fontSize: 11, color: T.textSoft, marginTop: 4 }}>
              {filteredDias.length} {filteredDias.length === 1 ? 'día' : 'días'}
            </div>
          </Card>
          <Card padding={14}>
            <div style={{ fontSize: 10, ...FontMono, color: T.textMute, letterSpacing: '.08em', marginBottom: 8, fontWeight: 600 }}>ÓRDENES</div>
            <div style={{ ...FontFraunces, fontSize: 24, color: T.mustard, fontStyle: 'italic', margin: 0 }}>
              {rangeStats.totalOrders}
            </div>
            <div style={{ fontSize: 11, color: T.textSoft, marginTop: 4 }}>
              pagadas
            </div>
          </Card>
          <Card padding={14}>
            <div style={{ fontSize: 10, ...FontMono, color: T.textMute, letterSpacing: '.08em', marginBottom: 8, fontWeight: 600 }}>PLATOS</div>
            <div style={{ ...FontFraunces, fontSize: 24, color: T.olive, fontStyle: 'italic', margin: 0 }}>
              {rangeStats.totalDishes}
            </div>
            <div style={{ fontSize: 11, color: T.textSoft, marginTop: 4 }}>
              entregados
            </div>
          </Card>
          <Card padding={14}>
            <div style={{ fontSize: 10, ...FontMono, color: T.textMute, letterSpacing: '.08em', marginBottom: 8, fontWeight: 600 }}>SUSCRIPCIONES</div>
            <div style={{ ...FontFraunces, fontSize: 24, color: T.plum, fontStyle: 'italic', margin: 0 }}>
              {rangeStats.totalSubscriptions}
            </div>
            <div style={{ fontSize: 11, color: T.textSoft, marginTop: 4 }}>
              almuerzos
            </div>
          </Card>
        </div>
      )}

      {/* ── Listado de días filtrados ── */}
      {filteredDias.length === 0 ? (
        <Card>
          <EmptyState
            icon={Calendar}
            title="Sin registros en este rango"
            description="Selecciona otro rango de fechas o verifica disponibilidad."
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredDias.map(diaData => (
            <DayCard
              key={diaData.fecha}
              diaData={diaData}
              expandedOrder={expandedOrder}
              setExpandedOrder={setExpandedOrder}
              mesas={mesas}
              suscriptores={suscriptores}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Tarjeta de un día ─────────────────────────────────────── */
function DayCard({ diaData, expandedOrder, setExpandedOrder, mesas, suscriptores }) {
  const { fecha, orders: dayOrders, summary } = diaData;
  const [collapsed, setCollapsed] = useState(false);

  const menuOrders = dayOrders.filter(o => o.tipo === 'menu');
  const suscOrders = dayOrders.filter(o => o.tipo === 'suscripcion');
  const planOrders = dayOrders.filter(o => o.tipo === 'plan');

  const todayISO = new Date().toISOString().slice(0, 10);
  const esHoy = fecha === todayISO;

  return (
    <Card>
      {/* Encabezado del día */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: '100%',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderBottom: collapsed ? 'none' : `1px solid ${T.border}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ ...FontFraunces, fontSize: 16, color: T.text, fontWeight: 600 }}>
              {formatDayLabel(fecha)}
            </span>
            {esHoy && (
              <span style={{
                fontSize: 9, ...FontMono, fontWeight: 700,
                background: T.olive, color: '#fff',
                padding: '2px 8px', borderRadius: 6, letterSpacing: '.08em',
              }}>HOY</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.textSoft, ...FontMono }}>
            {summary.pagadas} órdenes · {summary.platos} platos · {formatMoney(summary.total)}
          </div>
        </div>
        {collapsed ? <ChevronDown size={16} color={T.textMute} /> : <ChevronUp size={16} color={T.textMute} />}
      </button>

      {!collapsed && (
        <div style={{ padding: '0 16px 16px 16px' }}>
          {/* Secciones de órdenes */}
          <OrderSection
            title="Menú del día"
            orders={menuOrders}
            emptyMsg="Sin órdenes de menú"
            expanded={expandedOrder}
            onToggle={(id) => setExpandedOrder(expandedOrder === id ? null : id)}
            mesas={mesas}
            suscriptores={suscriptores}
            muted={false}
            tone="mustard"
          />
          <OrderSection
            title="Suscripciones"
            orders={suscOrders}
            emptyMsg="Sin órdenes de suscripción"
            expanded={expandedOrder}
            onToggle={(id) => setExpandedOrder(expandedOrder === id ? null : id)}
            mesas={mesas}
            suscriptores={suscriptores}
            muted={false}
            tone="olive"
          />
          <OrderSection
            title="Planes catering"
            orders={planOrders}
            emptyMsg="Sin órdenes de plan"
            expanded={expandedOrder}
            onToggle={(id) => setExpandedOrder(expandedOrder === id ? null : id)}
            mesas={mesas}
            suscriptores={suscriptores}
            muted={false}
            tone="plum"
          />
        </div>
      )}
    </Card>
  );
}

/* ─── Sección de órdenes agrupadas ──────────────────────────── */
function OrderSection({ title, orders, emptyMsg, expanded, onToggle, mesas, suscriptores, muted, tone }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: '100%', padding: '12px', borderRadius: 10, background: T.bgSoft, border: 'none',
          cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
          {title} ({orders.length})
        </span>
        {collapsed ? <ChevronDown size={14} color={T.textMute} /> : <ChevronUp size={14} color={T.textMute} />}
      </button>

      {!collapsed && (
        <div style={{ borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          {orders.length === 0 ? (
            <div style={{ padding: 16, background: T.card, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: T.textMute }}>{emptyMsg}</div>
            </div>
          ) : (
            orders
              .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
              .map((o, idx) => (
                <OrdenFila
                  key={o.id}
                  orden={o}
                  idx={idx}
                  totalRows={orders.length}
                  expanded={expanded === o.id}
                  onToggle={() => onToggle(expanded === o.id ? null : o.id)}
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
  const sub = suscriptores?.find(s => s.id === orden.suscriptor_id);
  
  // Buscar el mesero por ID
  const mesero = suscriptores?.find(s => s.id === orden.mesero_id);
  const meseroName = mesero?.nombre || orden.mesero_id || 'N/A';

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
            {formatDateTime(orden.fecha)} · Mesero: {meseroName}
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
                <div><span style={{ color: T.textMute }}>Mesero:</span> {meseroName}</div>
              )}
              {orden.mesa_numero && (
                <div><span style={{ color: T.textMute }}>Mesa:</span> {orden.mesa_numero}</div>
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
