import { useState, useEffect } from 'react';
import { X, Bell, Check, AlertTriangle, Lock, Palette, ChevronDown } from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, supabase, todayISO, minutesAgo, APPROVAL_TIMEOUT_MINUTES, APPROVAL_CANCEL_MINUTES } from '../../lib/utils';
import { Modal, Btn, Card, Tag, EmptyState, KickerLabel } from '../ui/primitives';
import { crearNotificacion } from '../ui/NotificationsPanel';
import { AgregarComensalFlow } from './AgregarComensalFlow';
import { TomarPedido } from './TomarPedido';
import { MesaDetalle } from './MesaDetalle';

/* ─── Paleta de colores disponibles para meseros ──────────────
   Colores cálidos/artesanales que contrastan bien entre sí y
   se ven bien sobre el fondo crema del sistema.              */
const COLORES_MESERO = [
  { value: '#4a5d3a', label: 'Oliva',      bg: '#e3e8d4' },
  { value: '#b4553e', label: 'Terracota',  bg: '#f3e0d6' },
  { value: '#b8873a', label: 'Mostaza',    bg: '#f3e6c8' },
  { value: '#6d4157', label: 'Ciruela',    bg: '#ead6de' },
  { value: '#3f5a6e', label: 'Azul pizarra', bg: '#dde6ec' },
  { value: '#7a5c3a', label: 'Café',       bg: '#ede0ce' },
  { value: '#5a7a5a', label: 'Salvia',     bg: '#d6e8d6' },
  { value: '#a83c2c', label: 'Ladrillo',   bg: '#f3dbd4' },
  { value: '#4a6a8a', label: 'Celeste',    bg: '#d4e4f0' },
  { value: '#8a5a2a', label: 'Madera',     bg: '#f0e2ca' },
  { value: '#5a4a7a', label: 'Lila',       bg: '#e4daf5' },
  { value: '#2a7a6a', label: 'Teal',       bg: '#c8e8e4' },
];

/* Devuelve el color del mesero, o un gris si no tiene color */
function getColorMesero(users, meseroId) {
  if (!meseroId || !users) return null;
  const u = users.find(u => u.id === meseroId);
  return u?.color || null;
}

/* Devuelve el bg suave del color del mesero */
function getBgSuave(color) {
  const found = COLORES_MESERO.find(c => c.value === color);
  return found?.bg || color + '22';
}

/* ─── Panel de selección de color (sidebar del mesero) ─────── */
function ColorPickerPanel({ user, users, refresh }) {
  const currentColor = users.find(u => u.id === user.id)?.color || COLORES_MESERO[0].value;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const handleSelect = async (color) => {
    if (color === currentColor) return;
    setSaving(true);
    await db.update('rest:users', user.id, { color });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    refresh();
  };

  return (
    <div style={{
      padding: '14px 16px',
      borderTop: `1px solid ${T.borderSoft}`,
      background: T.card,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Palette size={14} color={T.olive} />
        <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft, ...FontMono, letterSpacing: '.06em' }}>
          MI COLOR DE MESA
        </span>
        {saved && (
          <span style={{ fontSize: 10, color: T.olive, ...FontMono, marginLeft: 'auto' }}>✓ Guardado</span>
        )}
        {saving && (
          <span style={{ fontSize: 10, color: T.textMute, ...FontMono, marginLeft: 'auto' }}>Guardando…</span>
        )}
      </div>

      {/* Muestra el color actual */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
        padding: '7px 10px', borderRadius: 8,
        background: getBgSuave(currentColor),
        border: `1px solid ${currentColor}44`,
      }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: currentColor, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>
          {COLORES_MESERO.find(c => c.value === currentColor)?.label || 'Color personalizado'}
        </span>
        <span style={{ fontSize: 10, color: T.textMute, ...FontMono, marginLeft: 'auto' }}>ACTUAL</span>
      </div>

      {/* Grid de colores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
        {COLORES_MESERO.map(c => {
          const isSelected = c.value === currentColor;
          return (
            <button
              key={c.value}
              title={c.label}
              onClick={() => handleSelect(c.value)}
              disabled={saving}
              style={{
                width: '100%', aspectRatio: '1', borderRadius: 7,
                background: c.value,
                border: isSelected ? `2.5px solid ${T.text}` : `2px solid transparent`,
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'transform .1s, border .1s',
                transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                boxShadow: isSelected ? `0 0 0 1px ${T.card}, 0 0 0 3px ${c.value}` : 'none',
              }}
            />
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: T.textMute, marginTop: 8, ...FontMono, lineHeight: 1.4 }}>
        Las mesas atendidas por ti se marcarán con este color. Solo tú puedes cambiarlo.
      </p>
    </div>
  );
}

/* ─── Indicador de meseros activos en la vista (leyenda) ────── */
function LeyendaMeseros({ users, orders, mesas }) {
  // Descubrir qué meseros tienen mesas ocupadas hoy
  const hoy = todayISO();
  const meseroIds = new Set(
    orders
      .filter(o => o.fecha?.slice(0, 10) === hoy && ['pendiente','preparando','listo','esperando-aprobacion'].includes(o.estado))
      .map(o => o.mesero_id)
      .filter(Boolean)
  );

  const meseros = users.filter(u => u.rol === 'mesero' && u.activo && meseroIds.has(u.id));
  if (meseros.length < 2) return null; // solo mostrar si hay más de 1 mesero activo

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {meseros.map(m => (
        <div
          key={m.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 9px', borderRadius: 20,
            background: getBgSuave(m.color || COLORES_MESERO[0].value),
            border: `1px solid ${(m.color || COLORES_MESERO[0].value)}55`,
            fontSize: 11, color: T.text, ...FontMono, fontWeight: 600,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color || COLORES_MESERO[0].value, flexShrink: 0 }} />
          {m.nombre.split(' ')[0]}
        </div>
      ))}
    </div>
  );
}

/* ─── Componente principal ──────────────────────────────────── */
export function MeseroPanel({ activeTab, user, menu, mesas, suscriptores, orders, users, refresh }) {
  const tab = activeTab || 'mesas';
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [panelDerecho, setPanelDerecho]         = useState(null);
  const [comensalActivo, setComensalActivo]      = useState(null);
  const [configPedido, setConfigPedido]          = useState(null);
  const [alertaTimeout, setAlertaTimeout]        = useState(null);
  const [errorPedido, setErrorPedido]            = useState(null);
  const [enviando, setEnviando]                  = useState(false);

  const mesaData = mesaSeleccionada ? mesas.find(m => m.id === mesaSeleccionada.id) : null;

  // Color del mesero actual
  const miColor = getColorMesero(users || [], user.id) || COLORES_MESERO[0].value;

  // Vigilar timeouts de aprobación
  useEffect(() => {
    const pendientes = orders.filter(o =>
      o.estado === 'esperando-aprobacion' && o.mesero_id === user.id
    );
    for (const o of pendientes) {
      const min = minutesAgo(o.fecha);
      if (min >= APPROVAL_TIMEOUT_MINUTES && min < APPROVAL_CANCEL_MINUTES && !o.alertaMostrada) {
        setAlertaTimeout(o);
        return;
      }
    }

    const toCancel = orders.filter(o =>
      o.estado === 'esperando-aprobacion' && minutesAgo(o.fecha) >= APPROVAL_CANCEL_MINUTES
    );
    if (toCancel.length > 0) {
      (async () => {
        await Promise.all(toCancel.map(o =>
          db.update('rest:orders', o.id, {
            estado: 'cancelado-timeout',
            cancelado_en: new Date().toISOString(),
          })
        ));
        for (const o of toCancel) {
          if (o.suscriptor_id) {
            await crearNotificacion({
              tipo: 'pedido-rechazado',
              titulo: 'Pedido cancelado por falta de aprobación',
              mensaje: `Se canceló un pedido a tu nombre por no aprobarlo en ${APPROVAL_CANCEL_MINUTES} minutos.`,
              suscriptor_id: o.suscriptor_id,
            });
          }
        }
        refresh();
      })();
    }
  }, [orders, user.id, refresh]);

  const seleccionarMesa = (m) => {
    setMesaSeleccionada(m);
    setPanelDerecho('detalle');
    setComensalActivo(null);
    setConfigPedido(null);
  };

  const cerrarPanel = () => {
    setMesaSeleccionada(null);
    setPanelDerecho(null);
    setComensalActivo(null);
    setConfigPedido(null);
  };

  const abrirAgregarComensal = () => {
    setPanelDerecho('agregar');
    setComensalActivo(null);
    setConfigPedido(null);
  };

  const tomarPedidoDeComensal = (comensal) => {
    setComensalActivo(comensal);
    setConfigPedido({
      tipo: comensal.tipo,
      nombre: comensal.nombre,
      suscriptor: comensal.suscriptor_id ? suscriptores.find(s => s.id === comensal.suscriptor_id) : null,
    });
    setPanelDerecho('pedido');
  };

  const onComensalConfig = (config) => {
    setConfigPedido(config);
    setComensalActivo(null);
    setPanelDerecho('pedido');
  };

  const enviarPedido = async (carrito) => {
    if (carrito.length === 0) return;
    setErrorPedido(null);
    setEnviando(true);

    try {
      const tipoFinal = configPedido.tipo === 'invitado' ? 'invitado' : configPedido.tipo;
      let comensal = comensalActivo;

      if (!comensal) {
        const { data: nuevoComensal, error: errComensal } = await db.insert('rest:comensales', {
          mesa_id: mesaSeleccionada.id,
          nombre: configPedido.nombre,
          tipo: tipoFinal,
          suscriptor_id: configPedido.suscriptor?.id || null,
        });

        if (errComensal || !nuevoComensal) {
          setErrorPedido('Error creando comensal');
          setEnviando(false);
          return;
        }
        comensal = nuevoComensal;
      }

      const requiereAprobacion = tipoFinal === 'suscripcion' || tipoFinal === 'invitado';
      const total = requiereAprobacion
        ? 0
        : carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

      const { data: order, error: errOrder } = await db.insert('rest:orders', {
        comensal_id: comensal.id,
        mesa_numero: mesaSeleccionada.numero,
        mesero_id: user.id,
        suscriptor_id: configPedido.suscriptor?.id || null,
        tipo: requiereAprobacion ? 'suscripcion' : 'menu',
        es_invitado: tipoFinal === 'invitado',
        items: carrito.map(c => ({
          id: c.id,
          nombre: c.nombre,
          cantidad: c.cantidad,
          precio: c.precio,
          observacion: c.observacion || null,
        })),
        total,
        estado: requiereAprobacion ? 'esperando-aprobacion' : 'pendiente',
        pagado: false,
      });

      if (errOrder || !order) {
        setErrorPedido('Error creando pedido');
        setEnviando(false);
        return;
      }

      if (requiereAprobacion && configPedido.suscriptor?.id) {
        await crearNotificacion({
          tipo: 'pedido-pendiente',
          titulo: tipoFinal === 'invitado' ? '🔔 Pedido de invitado pendiente' : '🔔 Pedido pendiente',
          mensaje: `Mesa ${mesaSeleccionada.numero}: ${carrito.map(c => `${c.cantidad}× ${c.nombre}`).join(', ')}`,
          suscriptor_id: configPedido.suscriptor.id,
          order_id: order.id,
        });
      }

      if (!requiereAprobacion) {
        await Promise.all(
          carrito.map(c => {
            const itemMenu = menu.find(m => m.id === c.id);
            if (!itemMenu) return Promise.resolve();
            return db.update('rest:menu', c.id, {
              disponibles: Math.max(0, itemMenu.disponibles - c.cantidad),
              vendidos: (itemMenu.vendidos || 0) + c.cantidad,
            });
          })
        );
      }

      setEnviando(false);
      setPanelDerecho('detalle');
      setComensalActivo(null);
      setConfigPedido(null);
      setErrorPedido(null);
      await refresh();

    } catch (err) {
      console.error('Error general:', err);
      setErrorPedido('Error inesperado');
      setEnviando(false);
    }
  };

  const marcarEntregado = async (orderId) => {
    await db.update('rest:orders', orderId, {
      estado: 'entregado',
      fecha_entrega: new Date().toISOString(),
    });
    refresh();
  };

  const ordersListos = orders.filter(o => o.estado === 'listo');
  const ordersPendientesAprobacion = orders.filter(o => o.estado === 'esperando-aprobacion');
  const alertasMesas = {};
  ordersPendientesAprobacion.forEach(o => {
    if (minutesAgo(o.fecha) >= APPROVAL_TIMEOUT_MINUTES) alertasMesas[o.mesa_numero] = true;
  });

  const panelDerechoAbierto = panelDerecho !== null;

  // Para cada mesa, determinar qué mesero tiene la última orden activa
  // y qué color mostrar
  const colorPorMesa = {};
  orders.forEach(o => {
    if (!['esperando-aprobacion','pendiente','preparando','listo'].includes(o.estado)) return;
    const num = o.mesa_numero;
    if (!colorPorMesa[num] || new Date(o.fecha) > new Date(colorPorMesa[num].fecha)) {
      colorPorMesa[num] = { mesero_id: o.mesero_id, fecha: o.fecha };
    }
  });

  return (
    <>
      <div className="flex gap-4">
        {/* COLUMNA IZQUIERDA */}
        <div className={`${panelDerechoAbierto ? 'hidden lg:flex' : 'flex'} flex-col gap-0`}
          style={{ flex: 1, minWidth: 0 }}>

          {/* Header */}
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ color: T.text, fontFamily: 'Fraunces, serif', fontWeight: 500, fontSize: 24, margin: '0 0 2px' }}>
              Mesas
            </h2>
            <p style={{ fontSize: 13, color: T.textSoft, margin: 0 }}>
              Toca una mesa para gestionarla
            </p>
          </div>

          {/* Alertas timeout */}
          {Object.keys(alertasMesas).length > 0 && (
            <div className="p-3 rounded-xl flex items-start gap-2 mb-4"
              style={{ backgroundColor: T.redSoft, border: `1px solid ${T.red}` }}>
              <Bell size={16} style={{ color: T.red }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium" style={{ color: T.red }}>
                  {Object.keys(alertasMesas).length} mesa(s) esperan aprobación
                </p>
                <p className="text-xs mt-0.5" style={{ color: T.textSoft }}>
                  Mesas: {Object.keys(alertasMesas).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Leyenda de meseros activos */}
          <LeyendaMeseros users={users || []} orders={orders} mesas={mesas} />

          {/* Grid de mesas */}
          <div className={`grid gap-3 ${panelDerechoAbierto ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
            {mesas.map(m => {
              const ocupada    = (m.comensales || []).length > 0;
              const subsC      = (m.comensales || []).filter(c => c.tipo === 'suscripcion').length;
              const menuC      = (m.comensales || []).filter(c => c.tipo === 'menu').length;
              const invC       = (m.comensales || []).filter(c => c.tipo === 'invitado').length;
              const alerta     = alertasMesas[m.numero];
              const seleccionada = mesaSeleccionada?.id === m.id;

              // Color del mesero que atiende esta mesa
              const mesaColorInfo = colorPorMesa[m.numero];
              const meseroColor   = mesaColorInfo
                ? getColorMesero(users || [], mesaColorInfo.mesero_id)
                : null;
              const bgSuave = meseroColor ? getBgSuave(meseroColor) : null;

              // El borde refuerza el color del mesero cuando está ocupada
              const borderColor = alerta
                ? T.red
                : seleccionada
                  ? T.olive
                  : meseroColor && ocupada
                    ? meseroColor
                    : ocupada
                      ? T.amber
                      : T.border;

              const bgColor = alerta
                ? T.redSoft
                : seleccionada
                  ? T.oliveSoft
                  : meseroColor && ocupada
                    ? bgSuave
                    : ocupada
                      ? T.amberSoft
                      : T.card;

              return (
                <button
                  key={m.id}
                  onClick={() => seleccionarMesa(m)}
                  className={`p-3 rounded-xl text-left transition-all ${alerta ? 'animate-blink-urgent' : ''}`}
                  style={{
                    backgroundColor: bgColor,
                    border: `2px solid ${borderColor}`,
                    position: 'relative',
                  }}
                >
                  {/* Punto de color del mesero en la esquina */}
                  {meseroColor && ocupada && (
                    <div style={{
                      position: 'absolute', top: 7, right: 7,
                      width: 8, height: 8, borderRadius: '50%',
                      background: meseroColor,
                      boxShadow: `0 0 0 2px ${bgSuave}`,
                    }} />
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-medium" style={{ color: T.text, fontFamily: 'Fraunces, serif' }}>
                      {m.numero}
                    </span>
                    {alerta
                      ? <Tag color="red">⚠️</Tag>
                      : ocupada && <Tag color="amber">{m.comensales.length}</Tag>
                    }
                  </div>

                  {!ocupada && <p className="text-xs" style={{ color: T.textSoft }}>Disponible</p>}
                  {ocupada && (
                    <div className="flex flex-wrap gap-1">
                      {subsC > 0 && <Tag color="green">{subsC}s</Tag>}
                      {menuC > 0 && <Tag color="amber">{menuC}m</Tag>}
                      {invC  > 0 && <Tag color="blue">{invC}i</Tag>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <MiniColaCocina
            orders={orders}
            mesas={mesas}
            onMarcarEntregado={marcarEntregado}
          />
        </div>

        {/* COLUMNA DERECHA */}
        {panelDerechoAbierto && mesaSeleccionada && (
          <div className="w-full lg:w-1/2 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              {/* Header del panel derecho */}
              <div className="flex items-center justify-between p-4 pb-3" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  {/* Indicador de color del mesero que atiende esta mesa */}
                  {(() => {
                    const info = colorPorMesa[mesaSeleccionada.numero];
                    const color = info ? getColorMesero(users || [], info.mesero_id) : miColor;
                    const nombreMesero = info
                      ? (users || []).find(u => u.id === info.mesero_id)?.nombre?.split(' ')[0] || ''
                      : user.nombre.split(' ')[0];
                    if (!color) return null;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, background: getBgSuave(color), border: `1px solid ${color}44` }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                        <span style={{ fontSize: 11, color: T.textSoft, ...FontMono }}>{nombreMesero}</span>
                      </div>
                    );
                  })()}
                  <span style={{ color: T.text, fontFamily: 'Fraunces, serif', fontSize: 18 }}>
                    Mesa {mesaSeleccionada.numero}
                  </span>
                  {panelDerecho === 'agregar' && (
                    <><span style={{ color: T.textMute }}>›</span><span style={{ color: T.textSoft }}>Agregar comensal</span></>
                  )}
                  {panelDerecho === 'pedido' && (
                    <><span style={{ color: T.textMute }}>›</span><span style={{ color: T.textSoft }}>Tomar pedido · {configPedido?.nombre}</span></>
                  )}
                </div>
                <button onClick={cerrarPanel} className="p-1.5 rounded-lg" style={{ color: T.textSoft }}>
                  <X size={18} />
                </button>
              </div>

              <div className="p-4">
                {panelDerecho === 'detalle' && mesaData && (
                  <MesaDetalle
                    mesaActiva={mesaSeleccionada}
                    mesaData={mesaData}
                    orders={orders}
                    mesas={mesas}
                    onAgregarComensal={abrirAgregarComensal}
                    onTomarPedido={tomarPedidoDeComensal}
                    refresh={refresh}
                  />
                )}
                {panelDerecho === 'agregar' && mesaData && (
                  <AgregarComensalFlow
                    mesaActiva={mesaSeleccionada}
                    mesaData={mesaData}
                    suscriptores={suscriptores}
                    onCancel={() => setPanelDerecho('detalle')}
                    onContinue={onComensalConfig}
                  />
                )}
                {panelDerecho === 'pedido' && mesaSeleccionada && configPedido && (
                  <>
                    {errorPedido && (
                      <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 2 }}>Error al enviar el pedido</div>
                          <p style={{ fontSize: 11, color: '#7f1d1d', margin: 0 }}>{errorPedido}</p>
                        </div>
                      </div>
                    )}
                    <TomarPedido
                      mesaActiva={mesaSeleccionada}
                      config={configPedido}
                      menu={menu}
                      enviando={enviando}
                      onCancel={() => { setPanelDerecho('detalle'); setErrorPedido(null); }}
                      onEnviar={enviarPedido}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <TimeoutAlertModal alerta={alertaTimeout} onClose={() => setAlertaTimeout(null)} />
    </>
  );
}

/* ─── Modal de timeout ──────────────────────────────────────── */
function TimeoutAlertModal({ alerta, onClose }) {
  if (!alerta) return null;
  return (
    <Modal open={true} onClose={onClose} title="⚠️ Pedido sin aprobar">
      <div className="space-y-3">
        <div className="p-3 rounded-lg" style={{ backgroundColor: T.redSoft }}>
          <p className="text-sm font-medium" style={{ color: T.red }}>
            Un suscriptor no ha aprobado su pedido en mesa {alerta.mesa_numero}.
          </p>
          <p className="text-xs mt-1" style={{ color: T.textSoft }}>
            Lleva {minutesAgo(alerta.fecha)} minutos esperando. Se cancelará a los {APPROVAL_CANCEL_MINUTES} minutos.
          </p>
        </div>
        <div className="flex justify-end">
          <Btn onClick={onClose}>Entendido</Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Mini cola cocina ──────────────────────────────────────── */
function MiniColaCocina({ orders, mesas, onMarcarEntregado }) {
  const enCola = orders
    .filter(o => ['pendiente', 'preparando', 'listo'].includes(o.estado))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  if (enCola.length === 0) return null;

  const susc       = enCola.filter(o => o.tipo === 'suscripcion');
  const menuOrders = enCola.filter(o => o.tipo === 'menu');

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 10 }}>
        <KickerLabel>— cola de cocina · entregar al cliente</KickerLabel>
        <h3 style={{ ...FontFraunces, fontSize: 18, color: T.text, margin: 0 }}>
          Pedidos en preparación o listos ({enCola.length})
        </h3>
        <p style={{ fontSize: 11, color: T.textSoft, margin: '2px 0 0 0' }}>
          Marca como entregado cuando lleves el plato a la mesa.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grid md:grid-cols-2 grid-cols-1">
        <ColumnaMini titulo="Mensualidad" dotColor={T.olive} tagTone="olive" bgColor={T.oliveSoft}
          orders={susc} mesas={mesas} onMarcarEntregado={onMarcarEntregado} />
        <ColumnaMini titulo="Menú del día" dotColor={T.mustard} tagTone="mustard" bgColor={T.mustardSoft}
          orders={menuOrders} mesas={mesas} onMarcarEntregado={onMarcarEntregado} />
      </div>
    </div>
  );
}

function ColumnaMini({ titulo, dotColor, tagTone, bgColor, orders: cola, mesas, onMarcarEntregado }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 9, height: 9, borderRadius: 5, background: dotColor }} />
          <span style={{ ...FontFraunces, fontSize: 16, color: T.text }}>{titulo}</span>
        </div>
        <Tag tone={tagTone} size="xs">{cola.length}</Tag>
      </div>
      <div style={{ background: bgColor, borderRadius: 12, padding: 10, minHeight: cola.length === 0 ? 80 : 0 }}>
        {cola.length === 0 ? (
          <p style={{ fontSize: 11, color: T.textMute, textAlign: 'center', padding: '20px 0', margin: 0, ...FontMono }}>SIN PEDIDOS</p>
        ) : (
          cola.map((o, idx) => (
            <TicketMini key={o.id} orden={o} posicion={idx + 1} mesas={mesas} onMarcarEntregado={onMarcarEntregado} />
          ))
        )}
      </div>
    </div>
  );
}

function TicketMini({ orden, posicion, mesas, onMarcarEntregado }) {
  const mesa     = mesas.find(m => m.numero === orden.mesa_numero);
  const comensal = (mesa?.comensales || []).find(c => c.id === orden.comensal_id);
  const min      = minutesAgo(orden.fecha);

  const tagInfo = orden.es_invitado
    ? { label: 'INVITADO', tone: 'plum' }
    : orden.tipo === 'suscripcion'
      ? { label: 'PLAN', tone: 'olive' }
      : { label: 'MENÚ', tone: 'mustard' };

  const estadoLabel =
    orden.estado === 'pendiente'  ? 'EN COLA'    :
    orden.estado === 'preparando' ? 'PREPARANDO' :
    orden.estado === 'listo'      ? 'LISTO'      : '';

  const estadoTone =
    orden.estado === 'listo'      ? 'olive'   :
    orden.estado === 'preparando' ? 'mustard' : 'neutral';

  return (
    <div style={{ background: T.card, border: orden.estado === 'listo' ? `2px solid ${T.olive}` : `1px solid ${T.border}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: T.bgSoft, color: T.textSoft, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, ...FontMono, flexShrink: 0 }}>
            {posicion}
          </div>
          <span style={{ ...FontFraunces, fontSize: 15, color: T.text }}>Mesa {orden.mesa_numero}</span>
          <Tag tone={tagInfo.tone} size="xs">{tagInfo.label}</Tag>
          {estadoLabel && <Tag tone={estadoTone} size="xs">{estadoLabel}</Tag>}
        </div>
        <span style={{ ...FontMono, fontSize: 10, color: T.textMute }}>{min < 1 ? 'recién' : `${min}min`}</span>
      </div>

      {comensal && (
        <div style={{ fontSize: 11, color: T.textSoft, marginBottom: 6, ...FontMono }}>{comensal.nombre}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        {orden.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: T.bgSoft, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, ...FontMono }}>{it.cantidad}</span>
            {it.nombre}
          </div>
        ))}
      </div>

      <Btn variant="primary" size="sm" full icon={Check} onClick={() => onMarcarEntregado(orden.id)}>
        Entregado al cliente
      </Btn>
    </div>
  );
}