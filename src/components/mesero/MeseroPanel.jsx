import { useState, useEffect } from 'react';
import { X, ChefHat, UserPlus, LogOut, Plus, Bell, Check, Clock, AlertCircle, Heart, Users, Coffee, UtensilsCrossed, Lock } from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, todayISO, minutesAgo, APPROVAL_TIMEOUT_MINUTES, APPROVAL_CANCEL_MINUTES } from '../../lib/utils';
import { Modal, Btn, Card, Tag, EmptyState, KickerLabel } from '../ui/primitives';
import { crearNotificacion } from '../ui/NotificationsPanel';
import { AgregarComensalFlow } from './AgregarComensalFlow';
import { TomarPedido } from './TomarPedido';
import { MesaDetalle } from './MesaDetalle';

/**
 * MeseroPanel con dos vistas:
 * - 'mesas': split view (grid + panel contextual derecho)
 * - 'cola': vista de cola de cocina FIFO sin bloqueo (ve todos, opera cualquiera)
 */
export function MeseroPanel({ activeTab, user, menu, mesas, suscriptores, orders, refresh }) {
  const tab = activeTab || 'mesas';
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [panelDerecho, setPanelDerecho] = useState(null); // 'detalle' | 'agregar' | 'pedido'
  const [comensalActivo, setComensalActivo] = useState(null);
  const [configPedido, setConfigPedido] = useState(null);
  const [alertaTimeout, setAlertaTimeout] = useState(null);

  const mesaData = mesaSeleccionada ? mesas.find(m => m.id === mesaSeleccionada.id) : null;

  // Vigilar timeouts de aprobación
  useEffect(() => {
    const pendientes = orders.filter(o =>
      o.estado === 'esperando-aprobacion' && o.mesero === user.nombre
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
        const currentOrders = await db.get('rest:orders', []);
        const updated = currentOrders.map(o => {
          if (o.estado === 'esperando-aprobacion' && minutesAgo(o.fecha) >= APPROVAL_CANCEL_MINUTES) {
            return { ...o, estado: 'cancelado-timeout', canceladoEn: new Date().toISOString() };
          }
          return o;
        });
        await db.set('rest:orders', updated);
        for (const o of toCancel) {
          if (o.suscriptor?.id) {
            await crearNotificacion({
              tipo: 'pedido-rechazado',
              titulo: 'Pedido cancelado por falta de aprobación',
              mensaje: `Se canceló un pedido a tu nombre por no aprobarlo en ${APPROVAL_CANCEL_MINUTES} minutos.`,
              suscriptor_id: o.suscriptor.id,
            });
          }
        }
        refresh();
      })();
    }
  }, [orders, user.nombre, refresh]);

  // Helpers
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

    let comensal = comensalActivo;
    const isNew = !comensal;

    if (isNew) {
      const tipoFinal = configPedido.tipo === 'invitado' ? 'invitado' : configPedido.tipo;
      comensal = {
        id: `c${Date.now()}`,
        nombre: configPedido.nombre,
        tipo: tipoFinal,
        suscriptor_id: configPedido.suscriptor?.id || null,
        addedAt: new Date().toISOString(),
      };
      const mesasCurrent = await db.get('rest:mesas', []);
      await db.set('rest:mesas', mesasCurrent.map(m => m.id === mesaSeleccionada.id ? {
        ...m, comensales: [...m.comensales, comensal]
      } : m));
    }

    const requiereAprobacion = comensal.tipo === 'suscripcion' || comensal.tipo === 'invitado';
    const esSuscripcion = requiereAprobacion;
    const tipoOrder = esSuscripcion ? 'suscripcion' : 'menu';
    const total = esSuscripcion ? 0 : carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

    const order = {
      id: `o${Date.now()}`,
      mesa: mesaSeleccionada.numero,
      comensal_id: comensal.id,
      mesero: user.nombre,
      meseroId: user.id,
      tipo: tipoOrder,
      es_invitado: comensal.tipo === 'invitado',
      suscriptor: configPedido.suscriptor
        ? { id: configPedido.suscriptor.id, nombre: configPedido.suscriptor.nombre, codigo: configPedido.suscriptor.codigo }
        : null,
      items: carrito.map(c => ({ id: c.id, nombre: c.nombre, cantidad: c.cantidad, precio: c.precio })),
      total,
      estado: requiereAprobacion ? 'esperando-aprobacion' : 'pendiente',
      pagado: esSuscripcion,
      fecha: new Date().toISOString(),
    };

    const currentOrders = await db.get('rest:orders', []);
    await db.set('rest:orders', [...currentOrders, order]);

    if (requiereAprobacion && configPedido.suscriptor) {
      await crearNotificacion({
        tipo: 'pedido-pendiente',
        titulo: comensal.tipo === 'invitado' ? '🔔 Pedido de invitado pendiente de aprobar' : '🔔 Pedido pendiente de aprobar',
        mensaje: `Mesa ${mesaSeleccionada.numero}: ${carrito.map(c => `${c.cantidad}× ${c.nombre}`).join(', ')}${comensal.tipo === 'invitado' ? ` (invitado: ${comensal.nombre})` : ''}.`,
        suscriptor_id: configPedido.suscriptor.id,
        orderId: order.id,
      });
    }

    if (!requiereAprobacion) {
      const currentMenu = await db.get('rest:menu', []);
      await db.set('rest:menu', currentMenu.map(m => {
        const c = carrito.find(x => x.id === m.id);
        return c ? { ...m, disponibles: Math.max(0, m.disponibles - c.cantidad), vendidos: (m.vendidos || 0) + c.cantidad } : m;
      }));
    }

    setPanelDerecho('detalle');
    setComensalActivo(null);
    setConfigPedido(null);
    refresh();
  };

  const marcarEntregado = async (orderId) => {
    const currentOrders = await db.get('rest:orders', []);
    await db.set('rest:orders', currentOrders.map(o => o.id === orderId
      ? { ...o, estado: 'entregado', fechaEntrega: new Date().toISOString() }
      : o));

    const ord = currentOrders.find(o => o.id === orderId);
    if (ord?.tipo === 'suscripcion' && ord.suscriptor?.id) {
      const events = await db.get('rest:events', []);
      const today = new Date().toISOString().slice(0, 10);
      if (!events.find(e => e.suscriptor_id === ord.suscriptor.id && e.fecha === today && e.tipo === 'asistencia')) {
        await db.set('rest:events', [...events, {
          id: `ev${Date.now()}`,
          suscriptor_id: ord.suscriptor.id,
          fecha: today,
          tipo: 'asistencia',
          orderId: ord.id,
        }]);
      }
    }
    refresh();
  };

  // Computar alertas y pedidos listos
  const ordersListos = orders.filter(o => o.estado === 'listo');
  const ordersPendientesAprobacion = orders.filter(o => o.estado === 'esperando-aprobacion');
  const alertasMesas = {};
  ordersPendientesAprobacion.forEach(o => {
    if (minutesAgo(o.fecha) >= APPROVAL_TIMEOUT_MINUTES) alertasMesas[o.mesa] = true;
  });

  const panelDerechoAbierto = panelDerecho !== null;

  return (
    <>
      <div className="flex gap-4">
        {/* COLUMNA IZQUIERDA: Grid de mesas (siempre visible) */}
        <div className={`${panelDerechoAbierto ? 'hidden lg:block' : 'block'} ${panelDerechoAbierto ? 'lg:w-1/2' : 'w-full'} transition-all`}>
          <div>
            <h2 className="text-2xl mb-1" style={{ color: T.text, fontFamily: 'Fraunces, serif', fontWeight: 500 }}>Mesas</h2>
            <p className="text-sm mb-4" style={{ color: T.textSoft }}>Toca una mesa para gestionarla</p>

            {/* Alertas */}
            {Object.keys(alertasMesas).length > 0 && (
              <div className="p-3 rounded-xl flex items-start gap-2 mb-4 animate-pulse-warn"
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

            {/* Grilla de mesas */}
            <div className={`grid gap-3 ${panelDerechoAbierto ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
              {mesas.map(m => {
                const ocupada = m.comensales.length > 0;
                const subsC = m.comensales.filter(c => c.tipo === 'suscripcion').length;
                const menuC = m.comensales.filter(c => c.tipo === 'menu').length;
                const invC = m.comensales.filter(c => c.tipo === 'invitado').length;
                const alerta = alertasMesas[m.numero];
                const seleccionada = mesaSeleccionada?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => seleccionarMesa(m)}
                    className={`p-3 rounded-xl text-left transition-all ${alerta ? 'animate-blink-urgent' : ''}`}
                    style={{
                      backgroundColor: alerta ? T.redSoft : (seleccionada ? T.accentSoft : (ocupada ? T.amberSoft : T.card)),
                      border: `2px solid ${seleccionada ? T.accent : (alerta ? T.red : (ocupada ? T.amber : T.border))}`,
                    }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-medium" style={{ color: T.text, fontFamily: 'Fraunces, serif' }}>{m.numero}</span>
                      {alerta ? <Tag color="red">⚠️</Tag> : ocupada && <Tag color="amber">{m.comensales.length}</Tag>}
                    </div>
                    {!ocupada && <p className="text-xs" style={{ color: T.textSoft }}>Disponible</p>}
                    {ocupada && (
                      <div className="flex flex-wrap gap-1">
                        {subsC > 0 && <Tag color="green">{subsC}s</Tag>}
                        {menuC > 0 && <Tag color="amber">{menuC}m</Tag>}
                        {invC > 0 && <Tag color="blue">{invC}i</Tag>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mini cola de cocina (debajo de la grilla de mesas) */}
            <MiniColaCocina
              orders={orders}
              mesas={mesas}
              onMarcarEntregado={marcarEntregado}
            />
          </div>
        </div>

        {/* COLUMNA DERECHA: Panel contextual */}
        {panelDerechoAbierto && mesaSeleccionada && (
          <div className="w-full lg:w-1/2 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="p-4 rounded-2xl" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              {/* Header del panel con breadcrumb */}
              <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="font-medium" style={{ color: T.text, fontFamily: 'Fraunces, serif', fontSize: 18 }}>
                    Mesa {mesaSeleccionada.numero}
                  </span>
                  {panelDerecho === 'agregar' && (
                    <>
                      <span style={{ color: T.textMute }}>›</span>
                      <span style={{ color: T.textSoft }}>Agregar comensal</span>
                    </>
                  )}
                  {panelDerecho === 'pedido' && (
                    <>
                      <span style={{ color: T.textMute }}>›</span>
                      <span style={{ color: T.textSoft }}>Tomar pedido · {configPedido?.nombre}</span>
                    </>
                  )}
                </div>
                <button onClick={cerrarPanel} className="p-1.5 rounded-lg hover:bg-opacity-80" style={{ color: T.textSoft }}>
                  <X size={18} />
                </button>
              </div>

              {/* Contenido según estado */}
              {panelDerecho === 'detalle' && mesaData && (
                <MesaDetalle
                  mesaActiva={mesaSeleccionada}
                  mesaData={mesaData}
                  orders={orders}
                  mesas={mesas}
                  onAgregarComensal={abrirAgregarComensal}
                  onTomarPedido={tomarPedidoDeComensal}
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
                <TomarPedido
                  mesaActiva={mesaSeleccionada}
                  config={configPedido}
                  menu={menu}
                  onCancel={() => setPanelDerecho('detalle')}
                  onEnviar={enviarPedido}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <TimeoutAlertModal alerta={alertaTimeout} onClose={() => setAlertaTimeout(null)} />
    </>
  );
}

function TimeoutAlertModal({ alerta, onClose }) {
  if (!alerta) return null;
  return (
    <Modal open={true} onClose={onClose} title="⚠️ Pedido sin aprobar">
      <div className="space-y-3">
        <div className="p-3 rounded-lg" style={{ backgroundColor: T.redSoft }}>
          <p className="text-sm font-medium" style={{ color: T.red }}>
            {alerta.suscriptor?.nombre} no ha aprobado su pedido en mesa {alerta.mesa}.
          </p>
          <p className="text-xs mt-1" style={{ color: T.textSoft }}>
            Lleva {minutesAgo(alerta.fecha)} minutos esperando. Si no aprueba en breve, se cancelará a los {APPROVAL_CANCEL_MINUTES} minutos.
          </p>
        </div>
        <div className="flex justify-end">
          <Btn onClick={onClose}>Entendido</Btn>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Mini cola de cocina visible bajo la grilla de mesas.
 * - Muestra pedidos en orden FIFO (#1, #2, #3...)
 * - Sin bloqueo de información (todo visible)
 * - Solo botón "Entregado" (asume que cocina los preparó)
 * - Al entregar, sale de la cola automáticamente y queda como asistencia (suscripcion)
 * - Pedidos ya "listos" también aparecen aquí (ya marcados por cocina)
 */
function MiniColaCocina({ orders, mesas, onMarcarEntregado }) {
  // Mostrar todos los pedidos activos en cocina (pendiente | preparando | listo)
  // Excluir los ya entregados o cancelados
  const enCola = orders
    .filter(o => ['pendiente', 'preparando', 'listo'].includes(o.estado))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  if (enCola.length === 0) return null;

  const susc = enCola.filter(o => o.tipo === 'suscripcion');
  const menu = enCola.filter(o => o.tipo === 'menu');

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 10 }}>
        <KickerLabel>— cola de cocina · entregar al cliente</KickerLabel>
        <h3 style={{ ...FontFraunces, fontSize: 18, color: T.text, margin: 0 }}>
          Pedidos en preparación o listos ({enCola.length})
        </h3>
        <p style={{ fontSize: 11, color: T.textSoft, margin: '2px 0 0 0' }}>
          Marca como entregado cuando lleves el plato a la mesa. Sale automáticamente de la cola en cocina.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grid md:grid-cols-2 grid-cols-1">
        {/* Mensualidad */}
        <ColumnaMini
          titulo="Mensualidad"
          dotColor={T.olive}
          tagTone="olive"
          bgColor={T.oliveSoft}
          orders={susc}
          mesas={mesas}
          onMarcarEntregado={onMarcarEntregado}
        />
        {/* Menú del día */}
        <ColumnaMini
          titulo="Menú del día"
          dotColor={T.mustard}
          tagTone="mustard"
          bgColor={T.mustardSoft}
          orders={menu}
          mesas={mesas}
          onMarcarEntregado={onMarcarEntregado}
        />
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
          <p style={{ fontSize: 11, color: T.textMute, textAlign: 'center', padding: '20px 0', margin: 0, ...FontMono }}>
            SIN PEDIDOS
          </p>
        ) : (
          cola.map((o, idx) => (
            <TicketMini
              key={o.id}
              orden={o}
              posicion={idx + 1}
              mesas={mesas}
              onMarcarEntregado={onMarcarEntregado}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TicketMini({ orden, posicion, mesas, onMarcarEntregado }) {
  const mesa = mesas.find(m => m.numero === orden.mesa);
  const comensal = mesa?.comensales.find(c => c.id === orden.comensal_id);
  const min = minutesAgo(orden.fecha);

  const tagInfo = orden.es_invitado
    ? { label: 'INVITADO', tone: 'plum' }
    : orden.tipo === 'suscripcion'
      ? { label: 'PLAN', tone: 'olive' }
      : { label: 'MENÚ', tone: 'mustard' };

  // Estado actual de cocina (solo informativo)
  const estadoLabel =
    orden.estado === 'pendiente' ? 'EN COLA'
    : orden.estado === 'preparando' ? 'PREPARANDO'
    : orden.estado === 'listo' ? 'LISTO'
    : '';

  const estadoTone =
    orden.estado === 'listo' ? 'olive'
    : orden.estado === 'preparando' ? 'mustard'
    : 'neutral';

  return (
    <div
      style={{
        background: T.card,
        border: orden.estado === 'listo' ? `2px solid ${T.olive}` : `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 22, height: 22, borderRadius: 11,
              background: T.bgSoft,
              color: T.textSoft,
              display: 'grid', placeItems: 'center',
              fontSize: 10, fontWeight: 700, ...FontMono,
              flexShrink: 0,
            }}
          >
            {posicion}
          </div>
          <span style={{ ...FontFraunces, fontSize: 15, color: T.text }}>Mesa {orden.mesa}</span>
          <Tag tone={tagInfo.tone} size="xs">{tagInfo.label}</Tag>
          {estadoLabel && <Tag tone={estadoTone} size="xs">{estadoLabel}</Tag>}
        </div>
        <span style={{ ...FontMono, fontSize: 10, color: T.textMute }}>
          {min < 1 ? 'recién' : `${min}min`}
        </span>
      </div>

      {comensal && (
        <div style={{ fontSize: 11, color: T.textSoft, marginBottom: 6, ...FontMono }}>
          {comensal.nombre}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        {orden.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text }}>
            <span
              style={{
                width: 18, height: 18, borderRadius: 4,
                background: T.bgSoft,
                display: 'grid', placeItems: 'center',
                fontSize: 10, fontWeight: 700,
                ...FontMono,
              }}
            >
              {it.cantidad}
            </span>
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