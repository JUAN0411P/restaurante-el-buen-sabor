import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  UtensilsCrossed, Users, DollarSign,
  CreditCard, Banknote, ArrowLeftRight, Calendar,
  CheckCircle2, X,
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
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES   = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

const METODO_ICONS = {
  efectivo:      Banknote,
  tarjeta:       CreditCard,
  transferencia: ArrowLeftRight,
};
const METODO_LABELS = {
  efectivo:      'Efectivo',
  tarjeta:       'Tarjeta',
  transferencia: 'Transferencia',
};

/* ─── Resumen de un día ─────────────────────────────────────── */
function buildDaySummary(dayOrders) {
  const pagadas     = dayOrders.filter(o => o.pagado);
  const menu        = pagadas.filter(o => o.tipo === 'menu');
  const planes      = pagadas.filter(o => o.tipo === 'plan');
  const entregados  = dayOrders.filter(o => o.estado === 'entregado');
  const platos      = entregados.reduce((s, o) => s + (o.items || []).reduce((a, i) => a + i.cantidad, 0), 0);
  const totalMenu   = menu.reduce((s, o) => s + (o.total || 0), 0);
  const totalPlanes = planes.reduce((s, o) => s + (o.total || 0), 0);
  const total       = totalMenu + totalPlanes;
  const suscAlm     = dayOrders.filter(o => o.tipo === 'suscripcion' && o.estado === 'entregado').length;
  const porMetodo   = {};
  pagadas.forEach(o => {
    const m = o.metodo_pago || 'otro';
    porMetodo[m] = (porMetodo[m] || 0) + (o.total || 0);
  });
  return { total, totalMenu, totalPlanes, platos, suscAlm, pagadas: pagadas.length, porMetodo };
}

/* ─── Mini Calendar ─────────────────────────────────────────── */
function MiniCalendar({ activeDates, selectedDate, rangeStart, rangeEnd, onSelectDate, mode }) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const ref = selectedDate || rangeStart || todayISO;
  const [viewYear,  setViewYear]  = useState(() => parseInt(ref.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => parseInt(ref.slice(5, 7)) - 1);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth===11) { setViewMonth(0);  setViewYear(y => y+1); } else setViewMonth(m => m+1); };

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, minWidth: 280, userSelect: 'none' }}>
      {/* Nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ width:28,height:28,borderRadius:8,background:T.bgSoft,border:`1px solid ${T.border}`,display:'grid',placeItems:'center',cursor:'pointer',color:T.text }}>
          <ChevronLeft size={14}/>
        </button>
        <span style={{ ...FontFraunces, fontSize:16, color:T.text }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ width:28,height:28,borderRadius:8,background:T.bgSoft,border:`1px solid ${T.border}`,display:'grid',placeItems:'center',cursor:'pointer',color:T.text }}>
          <ChevronRight size={14}/>
        </button>
      </div>
      {/* Day names */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign:'center',fontSize:10,...FontMono,color:T.textMute,fontWeight:600,padding:'2px 0' }}>{d}</div>
        ))}
      </div>
      {/* Days */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`}/>;
          const iso = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const hasData  = activeDates.has(iso);
          const isToday  = iso === todayISO;
          const isSel    = mode === 'single' ? iso === selectedDate : (iso === rangeStart || iso === rangeEnd);
          const inRange  = mode === 'range' && rangeStart && rangeEnd && iso > rangeStart && iso < rangeEnd;
          return (
            <button
              key={iso}
              onClick={() => hasData && onSelectDate(iso)}
              style={{
                width:'100%', aspectRatio:'1', borderRadius:8, fontSize:12,
                fontWeight: isSel ? 700 : hasData ? 500 : 400,
                background: isSel ? T.olive : inRange ? T.oliveSoft : 'transparent',
                color: isSel ? '#fff' : !hasData ? T.textMute : isToday ? T.terracotta : T.text,
                border: isToday && !isSel ? `1px solid ${T.terracotta}` : '1px solid transparent',
                cursor: hasData ? 'pointer' : 'default',
                opacity: !hasData ? 0.35 : 1,
                transition:'all .1s',
                display:'flex', alignItems:'center', justifyContent:'center',
                position:'relative',
              }}
            >
              {day}
              {hasData && !isSel && (
                <span style={{ position:'absolute',bottom:2,left:'50%',transform:'translateX(-50%)',width:4,height:4,borderRadius:'50%',background:T.olive }}/>
              )}
            </button>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display:'flex',gap:12,marginTop:10,fontSize:10,color:T.textMute,...FontMono }}>
        <span style={{ display:'flex',alignItems:'center',gap:4 }}>
          <span style={{ width:6,height:6,borderRadius:'50%',background:T.olive,display:'inline-block' }}/>
          Con actividad
        </span>
        <span style={{ display:'flex',alignItems:'center',gap:4 }}>
          <span style={{ width:10,height:10,borderRadius:3,background:T.olive,display:'inline-block' }}/>
          Seleccionado
        </span>
      </div>
    </div>
  );
}

/* ─── Componente principal ──────────────────────────────────── */
export function HistorialDias({ orders, planes, suscriptores, mesas, users }) {
  const dias = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const d = isoDate(o.fecha);
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(o);
    });
    return Object.entries(map)
      .sort(([a],[b]) => b.localeCompare(a))
      .map(([fecha, ords]) => ({ fecha, orders: ords, summary: buildDaySummary(ords) }));
  }, [orders]);

  const activeDates = useMemo(() => new Set(dias.map(d => d.fecha)), [dias]);

  // Total suscriptores activos para ratio de asistencia
  const totalSuscritos = useMemo(() =>
    suscriptores.filter(s => s.activo && s.plan_id).length,
  [suscriptores]);

  const [calMode,      setCalMode]      = useState('single');
  const [selectedDate, setSelectedDate] = useState(() => dias[0]?.fecha || null);
  const [rangeStart,   setRangeStart]   = useState(null);
  const [rangeEnd,     setRangeEnd]     = useState(null);
  const [rangeStep,    setRangeStep]    = useState('start');
  const [showCal,      setShowCal]      = useState(false);
  const [expandedOrder,setExpandedOrder]= useState(null);

  if (dias.length === 0) {
    return (
      <div>
        <div style={{ marginBottom:20 }}>
          <KickerLabel>— registro histórico</KickerLabel>
          <h2 style={{ ...FontFraunces,fontSize:26,color:T.text,margin:0 }}>Historial por día</h2>
        </div>
        <Card><EmptyState icon={Calendar} title="Sin registros de ventas aún" description="Las ventas aparecerán aquí día a día."/></Card>
      </div>
    );
  }

  const handleSelectDate = (iso) => {
    if (calMode === 'single') {
      setSelectedDate(iso);
      setShowCal(false);
    } else {
      if (rangeStep === 'start') {
        setRangeStart(iso); setRangeEnd(null); setRangeStep('end');
      } else {
        if (iso < rangeStart) { setRangeStart(iso); setRangeEnd(rangeStart); }
        else { setRangeEnd(iso); }
        setRangeStep('start');
        setShowCal(false);
      }
    }
  };

  const diasFiltrados = useMemo(() => {
    if (calMode === 'single') {
      if (!selectedDate) return dias;
      return dias.filter(d => d.fecha === selectedDate);
    }
    if (!rangeStart) return dias;
    const end = rangeEnd || rangeStart;
    return dias.filter(d => d.fecha >= rangeStart && d.fecha <= end);
  }, [dias, calMode, selectedDate, rangeStart, rangeEnd]);

  const rangeSummary = useMemo(() => {
    if (diasFiltrados.length <= 1) return null;
    return {
      total:     diasFiltrados.reduce((s,d)=>s+d.summary.total,0),
      totalMenu: diasFiltrados.reduce((s,d)=>s+d.summary.totalMenu,0),
      suscAlm:   diasFiltrados.reduce((s,d)=>s+d.summary.suscAlm,0),
      platos:    diasFiltrados.reduce((s,d)=>s+d.summary.platos,0),
    };
  }, [diasFiltrados]);

  const todayISO = new Date().toISOString().slice(0, 10);

  const selLabel = calMode === 'single'
    ? (selectedDate ? formatDayLabel(selectedDate) : 'Seleccionar día')
    : rangeStart
      ? rangeEnd ? `${formatDayShort(rangeStart)} → ${formatDayShort(rangeEnd)}` : `Desde ${formatDayShort(rangeStart)} → ...`
      : 'Seleccionar rango';

  return (
    <div className="space-y-5">

      {/* Encabezado */}
      <div>
        <KickerLabel>— registro histórico · {dias.length} {dias.length===1?'día':'días'} con actividad</KickerLabel>
        <h2 style={{ ...FontFraunces,fontSize:26,color:T.text,margin:0 }}>Historial por día</h2>
      </div>

      {/* Selector modo + botón calendario */}
      <div style={{ display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-start' }}>

        {/* Toggle Día / Rango */}
        <div style={{ display:'flex',borderRadius:10,overflow:'hidden',border:`1px solid ${T.border}`,flexShrink:0 }}>
          {[{key:'single',label:'Día'},{key:'range',label:'Rango'}].map(opt => (
            <button key={opt.key} onClick={() => {
              setCalMode(opt.key);
              setRangeStart(null); setRangeEnd(null); setRangeStep('start');
              if (opt.key==='single' && !selectedDate) setSelectedDate(dias[0]?.fecha);
              setShowCal(false);
            }} style={{
              padding:'8px 18px',fontSize:12,...FontMono,fontWeight:600,
              background: calMode===opt.key ? T.olive : T.card,
              color:       calMode===opt.key ? '#fff' : T.textSoft,
              border:'none',cursor:'pointer',transition:'all .15s',
            }}>{opt.label}</button>
          ))}
        </div>

        {/* Botón fecha */}
        <div style={{ position:'relative',flex:1,minWidth:220 }}>
          <button onClick={() => setShowCal(c=>!c)} style={{
            width:'100%',display:'flex',alignItems:'center',gap:10,
            padding:'9px 14px',borderRadius:10,background:T.card,
            border:`1px solid ${showCal ? T.olive : T.border}`,cursor:'pointer',textAlign:'left',
            transition:'border-color .15s',
          }}>
            <Calendar size={15} color={T.olive} style={{ flexShrink:0 }}/>
            <span style={{ flex:1,fontSize:13,color:T.text,...FontMono }}>{selLabel}</span>
            {/* Botón limpiar */}
            {((calMode==='single'&&selectedDate)||(calMode==='range'&&rangeStart)) && (
              <button onClick={e=>{ e.stopPropagation(); if(calMode==='single'){setSelectedDate(null);}else{setRangeStart(null);setRangeEnd(null);setRangeStep('start');} setShowCal(false); }}
                style={{ padding:2,borderRadius:4,background:T.bgSoft,border:'none',color:T.textMute,cursor:'pointer',display:'grid',placeItems:'center',flexShrink:0 }}>
                <X size={12}/>
              </button>
            )}
            <ChevronDown size={14} color={T.textMute} style={{ flexShrink:0,transform:showCal?'rotate(180deg)':'none',transition:'transform .2s' }}/>
          </button>

          {showCal && (
            <div style={{ position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:100,boxShadow:'0 8px 32px rgba(0,0,0,.15)',borderRadius:14 }}>
              {calMode==='range' && rangeStep==='end' && (
                <div style={{ padding:'8px 14px',background:T.mustardSoft,borderRadius:'14px 14px 0 0',fontSize:11,color:T.mustard,...FontMono,fontWeight:600 }}>
                  AHORA SELECCIONA LA FECHA FINAL
                </div>
              )}
              <MiniCalendar
                activeDates={activeDates}
                selectedDate={selectedDate}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onSelectDate={handleSelectDate}
                mode={calMode}
              />
            </div>
          )}
        </div>

        {calMode==='range' && diasFiltrados.length > 1 && (
          <div style={{ padding:'8px 14px',borderRadius:10,background:T.bgSoft,border:`1px solid ${T.border}`,fontSize:12,color:T.textSoft,...FontMono,flexShrink:0,alignSelf:'center' }}>
            {diasFiltrados.length} días
          </div>
        )}
      </div>

      {/* Overlay para cerrar calendario */}
      {showCal && <div style={{ position:'fixed',inset:0,zIndex:99 }} onClick={()=>setShowCal(false)}/>}

      {/* Sin días filtrados */}
      {diasFiltrados.length===0 && (
        <Card><EmptyState icon={Calendar} title="Sin actividad en este período" description="Selecciona otro día o rango de fechas."/></Card>
      )}

      {/* Totales del rango */}
      {rangeSummary && (
        <div style={{ padding:14,borderRadius:12,background:T.bgSoft,border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:10,...FontMono,color:T.textMute,fontWeight:600,marginBottom:8,letterSpacing:'.08em' }}>
            TOTALES DEL RANGO · {diasFiltrados.length} DÍAS
          </div>
          <div style={{ display:'flex',gap:24,flexWrap:'wrap' }}>
            {[
              {label:'INGRESOS',  val:formatMoney(rangeSummary.total),     color:T.terracotta},
              {label:'MENÚ',      val:formatMoney(rangeSummary.totalMenu), color:T.mustard},
              {label:'SUSC.',     val:rangeSummary.suscAlm,                color:T.olive},
              {label:'PLATOS',    val:rangeSummary.platos,                 color:T.text},
            ].map(x=>(
              <div key={x.label}>
                <div style={{ fontSize:10,color:T.textSoft,...FontMono }}>{x.label}</div>
                <div style={{ ...FontFraunces,fontSize:22,color:x.color,fontStyle:'italic' }}>{x.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Días filtrados */}
      {diasFiltrados.map((diaActual) => {
        const { fecha, orders: dayOrders, summary } = diaActual;
        const menuOrders  = dayOrders.filter(o => o.tipo==='menu');
        const suscOrders  = dayOrders.filter(o => o.tipo==='suscripcion');
        const planOrders  = dayOrders.filter(o => o.tipo==='plan');
        const cancelados  = dayOrders.filter(o => ['cancelado-timeout','rechazado'].includes(o.estado));
        const esHoy       = fecha === todayISO;
        const asistieron  = suscOrders.filter(o => o.estado==='entregado').length;

        return (
          <div key={fecha} className="space-y-4">

            {/* Header del día */}
            <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderRadius:12,background:T.card,border:`1px solid ${T.border}` }}>
              <Calendar size={15} color={T.olive} style={{ flexShrink:0 }}/>
              <span style={{ ...FontFraunces,fontSize:18,color:T.text,flex:1 }}>{formatDayLabel(fecha)}</span>
              {esHoy && <span style={{ fontSize:10,...FontMono,fontWeight:700,background:T.olive,color:'#fff',padding:'2px 8px',borderRadius:6,letterSpacing:'.08em' }}>HOY</span>}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DayStat label="INGRESOS TOTALES" value={formatMoney(summary.total)}  color={T.terracotta}/>
              <DayStat label="MENÚ DEL DÍA"     value={formatMoney(summary.totalMenu)} color={T.mustard}/>
              <DayStat label="ASISTENCIA SUSC."  value={`${asistieron}/${totalSuscritos}`} color={T.olive} compact/>
              <DayStat label="PLATOS SERVIDOS"   value={summary.platos}             color={T.text}/>
            </div>

            {/* Métodos de pago */}
            {Object.keys(summary.porMetodo).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(summary.porMetodo).map(([metodo,monto]) => {
                  const Icon = METODO_ICONS[metodo] || DollarSign;
                  return (
                    <div key={metodo} style={{ padding:'12px 16px',borderRadius:12,background:T.card,border:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:12 }}>
                      <div style={{ width:36,height:36,borderRadius:10,background:T.bgSoft,display:'grid',placeItems:'center',flexShrink:0 }}>
                        <Icon size={16} color={T.olive}/>
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:10,...FontMono,color:T.textSoft,letterSpacing:'.08em',fontWeight:600 }}>{METODO_LABELS[metodo]||metodo.toUpperCase()}</div>
                        <div style={{ ...FontFraunces,fontSize:20,color:T.text,fontStyle:'italic' }}>{formatMoney(monto)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <SeccionOrdenes titulo="Menú del día" dot={T.mustard} orders={menuOrders} expandedOrder={expandedOrder} onToggle={setExpandedOrder} emptyMsg="Sin órdenes de menú este día" mesas={mesas} users={users}/>

            <SeccionOrdenes
              titulo="Mensualidades (almuerzos)"
              dot={T.olive}
              orders={suscOrders}
              expandedOrder={expandedOrder}
              onToggle={setExpandedOrder}
              emptyMsg="Sin almuerzos de suscripción este día"
              mesas={mesas}
              users={users}
              suscriptores={suscriptores}
              attendanceLabel={`${asistieron}/${totalSuscritos}`}
            />

            {planOrders.length > 0 && (
              <SeccionOrdenes titulo="Planes cobrados en caja" dot={T.plum} orders={planOrders} expandedOrder={expandedOrder} onToggle={setExpandedOrder} emptyMsg="" mesas={mesas} users={users} suscriptores={suscriptores}/>
            )}

            {cancelados.length > 0 && (
              <SeccionOrdenes titulo={`Cancelados / rechazados (${cancelados.length})`} dot={T.red} orders={cancelados} expandedOrder={expandedOrder} onToggle={setExpandedOrder} emptyMsg="" mesas={mesas} users={users} suscriptores={suscriptores} muted/>
            )}

            {diasFiltrados.length > 1 && <div style={{ height:1,background:T.borderSoft,marginTop:8 }}/>}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Stat card ────────────────────────────────────────────── */
function DayStat({ label, value, color, compact }) {
  return (
    <Card padding={16}>
      <div style={{ fontSize:10,...FontMono,color:T.textSoft,letterSpacing:'.1em',fontWeight:600,marginBottom:8 }}>{label}</div>
      <div style={{ ...FontFraunces,fontSize:compact?26:32,color,lineHeight:1,fontStyle:'italic' }}>{value}</div>
    </Card>
  );
}

/* ─── Sección colapsable ───────────────────────────────────── */
function SeccionOrdenes({ titulo, dot, orders: list, expandedOrder, onToggle, emptyMsg, mesas, users, suscriptores, muted, attendanceLabel }) {
  const [collapsed, setCollapsed] = useState(false);
  if (list.length===0 && !emptyMsg) return null;
  const totalSeccion = list.filter(o=>o.pagado).reduce((s,o)=>s+(o.total||0),0);

  return (
    <div>
      <button onClick={()=>setCollapsed(c=>!c)} style={{
        width:'100%',display:'flex',alignItems:'center',gap:10,
        padding:'10px 14px',
        borderRadius: collapsed ? 12 : '12px 12px 0 0',
        background:T.card,border:`1px solid ${T.border}`,
        borderBottom: collapsed ? `1px solid ${T.border}` : `1px solid ${T.borderSoft}`,
        cursor:'pointer',textAlign:'left',
      }}>
        <div style={{ width:10,height:10,borderRadius:5,background:muted?T.textMute:dot,flexShrink:0 }}/>
        <span style={{ ...FontFraunces,fontSize:17,color:muted?T.textSoft:T.text,flex:1 }}>{titulo}</span>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          {attendanceLabel && (
            <span style={{ ...FontFraunces,fontSize:16,color:T.olive,fontStyle:'italic',fontWeight:700,padding:'1px 8px',borderRadius:6,background:T.oliveSoft }}>
              {attendanceLabel}
            </span>
          )}
          {totalSeccion > 0 && (
            <span style={{ ...FontFraunces,fontSize:16,color:T.terracotta,fontStyle:'italic' }}>{formatMoney(totalSeccion)}</span>
          )}
          <span style={{ fontSize:11,...FontMono,fontWeight:600,padding:'2px 8px',borderRadius:6,background:T.bgSoft,color:muted?T.textMute:T.textSoft }}>
            {list.length}
          </span>
          {collapsed ? <ChevronDown size={14} color={T.textMute}/> : <ChevronUp size={14} color={T.textMute}/>}
        </div>
      </button>

      {!collapsed && (
        <div style={{ border:`1px solid ${T.border}`,borderTop:'none',borderRadius:'0 0 12px 12px',overflow:'hidden' }}>
          {list.length===0 ? (
            <div style={{ padding:20,background:T.card }}><EmptyState title={emptyMsg}/></div>
          ) : (
            list.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map((o,idx)=>(
              <OrdenFila
                key={o.id} orden={o} idx={idx} totalRows={list.length}
                expanded={expandedOrder===o.id}
                onToggle={()=>onToggle(expandedOrder===o.id?null:o.id)}
                mesas={mesas} users={users} suscriptores={suscriptores} muted={muted}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Fila de orden ────────────────────────────────────────── */
function OrdenFila({ orden, idx, totalRows, expanded, onToggle, mesas, users, suscriptores, muted }) {
  const sub    = suscriptores?.find(s => s.id === orden.suscriptor_id);
  const mesero = users?.find(u => u.id === orden.mesero_id);
  const meseroNombre = mesero?.nombre || null;

  const estadoColor = {
    entregado:'entregado',listo:T.mustard,preparando:T.mustard,pendiente:T.textSoft,
    'esperando-aprobacion':T.mustard,'cancelado-timeout':T.red,rechazado:T.red,pagado:T.olive,
  };
  const eColor = estadoColor[orden.estado] === 'entregado' ? T.olive : (estadoColor[orden.estado] || T.textSoft);

  const estadoLabel = {
    entregado:'Entregado',listo:'Listo',preparando:'Preparando',pendiente:'En cola',
    'esperando-aprobacion':'Esperando aprobación','cancelado-timeout':'Cancelado',rechazado:'Rechazado',
  }[orden.estado] || orden.estado;

  const esCancelado = ['cancelado-timeout','rechazado'].includes(orden.estado);

  return (
    <div style={{ background:expanded?T.bgSoft:T.card, borderBottom:idx<totalRows-1?`1px solid ${T.borderSoft}`:'none', transition:'background .15s', opacity:muted&&!expanded?0.75:1 }}>
      <button onClick={onToggle} style={{ width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:'none',border:'none',cursor:'pointer',textAlign:'left' }}>
        <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,background:esCancelado?T.redSoft:orden.tipo==='suscripcion'?T.oliveSoft:orden.tipo==='plan'?T.plumSoft:T.mustardSoft,display:'grid',placeItems:'center' }}>
          {orden.tipo==='menu'        && <UtensilsCrossed size={16} color={T.mustard}/>}
          {orden.tipo==='suscripcion' && <Users size={16} color={T.olive}/>}
          {orden.tipo==='plan'        && <DollarSign size={16} color={T.plum}/>}
          {esCancelado                && <X size={16} color={T.red}/>}
        </div>

        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:2 }}>
            {orden.mesa_numero && <span style={{ fontSize:13,fontWeight:600,color:T.text }}>Mesa {orden.mesa_numero}</span>}
            {sub && <span style={{ fontSize:12,color:T.textSoft }}>· {sub.nombre}</span>}
            {orden.tipo==='plan' && orden.suscriptor && <span style={{ fontSize:12,color:T.textSoft }}>· {orden.suscriptor.nombre}</span>}
            <OrdenTag tipo={orden.tipo} esInvitado={orden.es_invitado}/>
            <span style={{ fontSize:11,color:eColor,...FontMono,fontWeight:600 }}>{estadoLabel}</span>
          </div>
          <div style={{ fontSize:11,color:T.textMute,...FontMono }}>
            {formatDateTime(orden.fecha)}
            {orden.metodo_pago && ` · ${METODO_LABELS[orden.metodo_pago]||orden.metodo_pago}`}
            {meseroNombre      && ` · ${meseroNombre}`}
          </div>
        </div>

        <div style={{ flexShrink:0,textAlign:'right' }}>
          {orden.total>0 && (
            <div style={{ ...FontFraunces,fontSize:18,color:esCancelado?T.textMute:T.terracotta,fontStyle:'italic',textDecoration:esCancelado?'line-through':'none' }}>
              {formatMoney(orden.total)}
            </div>
          )}
          {orden.pagado && <CheckCircle2 size={12} color={T.olive} style={{ marginLeft:'auto' }}/>}
        </div>

        {expanded ? <ChevronUp size={14} color={T.textMute} style={{ flexShrink:0 }}/> : <ChevronDown size={14} color={T.textMute} style={{ flexShrink:0 }}/>}
      </button>

      {expanded && (
        <div style={{ padding:'0 16px 16px 64px' }}>
          <div style={{ padding:12,borderRadius:10,background:T.card,border:`1px solid ${T.borderSoft}` }}>
            {(orden.items||[]).length>0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10,...FontMono,color:T.textMute,letterSpacing:'.08em',marginBottom:6,fontWeight:600 }}>ITEMS</div>
                {orden.items.map((it,i)=>(
                  <div key={i} style={{ display:'flex',justifyContent:'space-between',fontSize:12,padding:'3px 0',color:T.text }}>
                    <span>
                      <span style={{ ...FontMono,fontSize:11,color:T.textSoft,marginRight:8 }}>{it.cantidad}×</span>
                      {it.nombre}
                      {it.observacion && <span style={{ fontSize:10,color:T.mustard,...FontMono,marginLeft:6 }}>⚡ {it.observacion}</span>}
                    </span>
                    {it.precio>0 && <span style={{ color:T.textSoft,...FontMono,fontSize:11 }}>{formatMoney(it.precio*it.cantidad)}</span>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 16px',fontSize:11,color:T.textSoft }}>
              {meseroNombre     && <div><span style={{ color:T.textMute }}>Mesero:</span> {meseroNombre}</div>}
              {orden.mesa_numero&& <div><span style={{ color:T.textMute }}>Mesa:</span> {orden.mesa_numero}</div>}
              {orden.metodo_pago && <div><span style={{ color:T.textMute }}>Pago:</span> {METODO_LABELS[orden.metodo_pago]||orden.metodo_pago}</div>}
              {orden.fecha_pago  && <div><span style={{ color:T.textMute }}>Cobrado:</span> {formatDateTime(orden.fecha_pago)}</div>}
              {orden.aprobado_en && <div><span style={{ color:T.textMute }}>Aprobado:</span> {formatDateTime(orden.aprobado_en)}</div>}
              {orden.fecha_entrega&&<div><span style={{ color:T.textMute }}>Entregado:</span> {formatDateTime(orden.fecha_entrega)}</div>}
              {orden.cancelado_en && <div><span style={{ color:T.red }}>Cancelado:</span> {formatDateTime(orden.cancelado_en)}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdenTag({ tipo, esInvitado }) {
  if (esInvitado)              return <Tag tone="plum"    size="xs">INVITADO</Tag>;
  if (tipo==='suscripcion')    return <Tag tone="olive"   size="xs">PLAN SUSC.</Tag>;
  if (tipo==='menu')           return <Tag tone="mustard" size="xs">MENÚ DÍA</Tag>;
  if (tipo==='plan')           return <Tag tone="plum"    size="xs">PLAN CAJA</Tag>;
  return null;
}
