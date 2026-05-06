import { useState, useEffect } from 'react';
import { X, ChefHat, UserPlus, LogOut, Plus, Bell, Check, Clock, AlertCircle, Heart, Users, Coffee, UtensilsCrossed, Lock } from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, supabase, todayISO, minutesAgo, APPROVAL_TIMEOUT_MINUTES, APPROVAL_CANCEL_MINUTES } from '../../lib/utils';
import { Modal, Btn, Card, Tag, EmptyState, KickerLabel } from '../ui/primitives';
import { crearNotificacion } from '../ui/NotificationsPanel';
import { AgregarComensalFlow } from './AgregarComensalFlow';
import { TomarPedido } from './TomarPedido';
import { MesaDetalle } from './MesaDetalle';

export function MeseroPanel({ activeTab, user, menu, mesas, suscriptores, orders, refresh }) {
  const tab = activeTab || 'mesas';
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [panelDerecho, setPanelDerecho] = useState(null);
  const [comensalActivo, setComensalActivo] = useState(null);
  const [configPedido, setConfigPedido] = useState(null);
  const [alertaTimeout, setAlertaTimeout] = useState(null);
  const [errorPedido, setErrorPedido] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const mesaData = mesaSeleccionada ? mesas.find(m => m.id === mesaSeleccionada.id) : null;

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

    // Cancelar pedidos que superaron el timeout — ahora con update directo
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
    // Recibimos la config del flow (tipo, nombre, suscriptor).
    // El comensal en DB se crea más tarde en enviarPedido(),
    // cuando el mesero ya armó el carrito y confirmó.
    setConfigPedido(config);
    setComensalActivo(null); // aún no existe en DB
    setPanelDerecho('pedido');
  };


  const enviarPedido = async (carrito) => {
    if (carrito.length === 0) return;
    setErrorPedido(null);
    setEnviando(true);

    try {
      // 1. Crear o reutilizar comensal
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
          console.error('❌ Error creando comensal:', errComensal);
          setErrorPedido('Error creando comensal');
          setEnviando(false);
          return;
        }

        comensal = nuevoComensal;
      }

      // 2. Crear orden
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
          precio: c.precio
        })),
        total,
        estado: requiereAprobacion ? 'esperando-aprobacion' : 'pendiente',
        pagado: false,
      });

      if (errOrder || !order) {
        console.error('❌ Error creando orden:', errOrder);
        setErrorPedido('Error creando pedido');
        setEnviando(false);
        return;
      }

      console.log('✅ Orden creada:', order);

      // 3. 🔔 NOTIFICACIÓN (AQUÍ ESTABA EL PROBLEMA)
      if (requiereAprobacion) {
        if (!configPedido.suscriptor?.id) {
          console.warn('⚠️ No hay suscriptor_id, no se envía notificación');
        } else {
          console.log('📨 Enviando notificación a suscriptor:', configPedido.suscriptor.id);

          await crearNotificacion({
            tipo: 'pedido-pendiente',
            titulo: tipoFinal === 'invitado'
              ? '🔔 Pedido de invitado pendiente'
              : '🔔 Pedido pendiente',
            mensaje: `Mesa ${mesaSeleccionada.numero}: ${carrito.map(c => `${c.cantidad}× ${c.nombre}`).join(', ')}`,
            suscriptor_id: configPedido.suscriptor.id,
            order_id: order.id,
          });

          console.log('✅ Notificación enviada');
        }
      }

      // 4. Descontar menú
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

      // 5. Final
      setEnviando(false);
      setPanelDerecho('detalle');
      setComensalActivo(null);
      setConfigPedido(null);
      setErrorPedido(null);

      await refresh(); // 🔥 importante

    } catch (err) {
      console.error('❌ Error general:', err);
      setErrorPedido('Error inesperado');
      setEnviando(false);
    }
  };  
  // const enviarPedido = async (carrito) => {
  //   if (carrito.length === 0) return;
  //   setErrorPedido(null);
  //   setEnviando(true);

  //   // 1. Reutilizar el comensal existente o crear uno nuevo (primer pedido)
  //   const tipoFinal = configPedido.tipo === 'invitado' ? 'invitado' : configPedido.tipo;
  //   let comensal = comensalActivo;
  //   if (!comensal) {
  //     const { data: nuevoComensal, error: errComensal } = await db.insert('rest:comensales', {
  //       mesa_id: mesaSeleccionada.id,
  //       nombre: configPedido.nombre,
  //       tipo: tipoFinal,
  //       suscriptor_id: configPedido.suscriptor?.id || null,
  //     });
  //     if (errComensal || !nuevoComensal) {
  //       console.error('Error creando comensal:', errComensal);
  //       setErrorPedido(`No se pudo registrar el comensal: ${errComensal?.message || 'error de permisos en la base de datos. Verifica las políticas RLS.'}`);
  //       setEnviando(false);
  //       return;
  //     }
  //     comensal = nuevoComensal;
  //   }

  //   // 2. Crear la orden
  //   const requiereAprobacion = tipoFinal === 'suscripcion' || tipoFinal === 'invitado';
  //   const total = requiereAprobacion ? 0 : carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  //   const { data: order, error: errOrder } = await db.insert('rest:orders', {
  //     comensal_id: comensal.id,
  //     mesa_numero: mesaSeleccionada.numero,
  //     mesero_id: user.id,
  //     suscriptor_id: configPedido.suscriptor?.id || null,
  //     tipo: requiereAprobacion ? 'suscripcion' : 'menu',
  //     es_invitado: tipoFinal === 'invitado',
  //     items: carrito.map(c => ({ id: c.id, nombre: c.nombre, cantidad: c.cantidad, precio: c.precio })),
  //     total,
  //     estado: requiereAprobacion ? 'esperando-aprobacion' : 'pendiente',
  //     pagado: false,
  //   });
  //   if (errOrder || !order) {
  //     console.error('Error creando orden:', errOrder);
  //     setErrorPedido(`No se pudo crear el pedido: ${errOrder?.message || 'error de permisos en la base de datos. Verifica las políticas RLS.'}`);
  //     // Limpiar el comensal recién creado para evitar duplicados en siguiente intento
  //     if (comensal && !comensalActivo) {
  //       await db.update('rest:comensales', comensal.id, { left_at: new Date().toISOString() });
  //     }
  //     setEnviando(false);
  //     return;
  //   }

  //   // 3. Notificar si requiere aprobación
  //   if (requiereAprobacion && configPedido.suscriptor) {
  //     await crearNotificacion({
  //       tipo: 'pedido-pendiente',
  //       titulo: tipoFinal === 'invitado'
  //         ? '🔔 Pedido de invitado pendiente de aprobar'
  //         : '🔔 Pedido pendiente de aprobar',
  //       mensaje: `Mesa ${mesaSeleccionada.numero}: ${carrito.map(c => `${c.cantidad}× ${c.nombre}`).join(', ')}.`,
  //       suscriptor_id: configPedido.suscriptor.id,
  //       order_id: order.id,
  //     });
  //   }

  //   // 4. Descontar disponibles del menú
  //   if (!requiereAprobacion) {
  //     await Promise.all(
  //       carrito.map(c => {
  //         const itemMenu = menu.find(m => m.id === c.id);
  //         if (!itemMenu) return Promise.resolve();
  //         return db.update('rest:menu', c.id, {
  //           disponibles: Math.max(0, itemMenu.disponibles - c.cantidad),
  //           vendidos: (itemMenu.vendidos || 0) + c.cantidad,
  //         });
  //       })
  //     );
  //   }

  //   // 5. Solo al final resetear estado y refrescar
  //   setEnviando(false);
  //   setPanelDerecho('detalle');
  //   setComensalActivo(null);
  //   setConfigPedido(null);
  //   setErrorPedido(null);
  //   refresh();  // ← una sola vez, al final
  // };

  // const enviarPedido = async (carrito) => {
  //   if (carrito.length === 0) return;

  //   // Si el comensal no existe todavía (viene directo del flow), crearlo
  //   let comensal = comensalActivo;
  //   if (!comensal) {
  //     const tipoFinal = configPedido.tipo === 'invitado' ? 'invitado' : configPedido.tipo;
  //     const { data: nuevoComensal, error } = await db.insert('rest:comensales', {
  //       mesa_id: mesaSeleccionada.id,
  //       nombre: configPedido.nombre,
  //       tipo: tipoFinal,
  //       suscriptor_id: configPedido.suscriptor?.id || null,
  //     });
  //     if (error) { console.error('Error creando comensal:', error); return; }
  //     comensal = nuevoComensal;
  //   }

  //   const requiereAprobacion = comensal.tipo === 'suscripcion' || comensal.tipo === 'invitado';
  //   const esSuscripcion = requiereAprobacion;
  //   const tipoOrder = esSuscripcion ? 'suscripcion' : 'menu';
  //   const total = esSuscripcion ? 0 : carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  //   // Insertar la orden — sin id, Postgres genera el UUID
  //   const { data: order, error: orderError } = await db.insert('rest:orders', {
  //     comensal_id: comensal.id,
  //     mesa_numero: mesaSeleccionada.numero,
  //     mesero_id: user.id,
  //     suscriptor_id: configPedido.suscriptor?.id || null,
  //     tipo: tipoOrder,
  //     es_invitado: comensal.tipo === 'invitado',
  //     items: carrito.map(c => ({ id: c.id, nombre: c.nombre, cantidad: c.cantidad, precio: c.precio })),
  //     total,
  //     estado: requiereAprobacion ? 'esperando-aprobacion' : 'pendiente',
  //     pagado: false,
  //   });

  //   if (orderError) { console.error('Error creando orden:', orderError); return; }

  //   // Notificar al suscriptor si requiere aprobación
  //   if (requiereAprobacion && configPedido.suscriptor) {
  //     await crearNotificacion({
  //       tipo: 'pedido-pendiente',
  //       titulo: comensal.tipo === 'invitado'
  //         ? '🔔 Pedido de invitado pendiente de aprobar'
  //         : '🔔 Pedido pendiente de aprobar',
  //       mensaje: `Mesa ${mesaSeleccionada.numero}: ${carrito.map(c => `${c.cantidad}× ${c.nombre}`).join(', ')}${comensal.tipo === 'invitado' ? ` (invitado: ${comensal.nombre})` : ''}.`,
  //       suscriptor_id: configPedido.suscriptor.id,
  //       order_id: order.id,
  //     });
  //   }

  //   // Descontar disponibles del menú directamente
  //   if (!requiereAprobacion) {
  //     await Promise.all(
  //       carrito.map(c =>
  //         db.update('rest:menu', c.id, {
  //           disponibles: Math.max(0, (menu.find(m => m.id === c.id)?.disponibles || 0) - c.cantidad),
  //           vendidos: (menu.find(m => m.id === c.id)?.vendidos || 0) + c.cantidad,
  //         })
  //       )
  //     );
  //   }

  //   setPanelDerecho('detalle');
  //   setComensalActivo(null);
  //   setConfigPedido(null);
  //   refresh();
  // };

  const marcarEntregado = async (orderId) => {
    await db.update('rest:orders', orderId, {
      estado: 'entregado',
      fecha_entrega: new Date().toISOString(),
    });
    // El trigger on_order_delivered en Supabase registra la asistencia automáticamente
    refresh();
  };

  const ordersListos = orders.filter(o => o.estado === 'listo');
  const ordersPendientesAprobacion = orders.filter(o => o.estado === 'esperando-aprobacion');
  const alertasMesas = {};
  ordersPendientesAprobacion.forEach(o => {
    if (minutesAgo(o.fecha) >= APPROVAL_TIMEOUT_MINUTES) alertasMesas[o.mesa_numero] = true;
  });

  const panelDerechoAbierto = panelDerecho !== null;

  return (
    <>
      <div className="flex gap-4">
        {/* COLUMNA IZQUIERDA */}
        <div className={`${panelDerechoAbierto ? 'hidden lg:block' : 'block'} ${panelDerechoAbierto ? 'lg:w-1/2' : 'w-full'} transition-all`}>
          <div>
            <h2 className="text-2xl mb-1" style={{ color: T.text, fontFamily: 'Fraunces, serif', fontWeight: 500 }}>Mesas</h2>
            <p className="text-sm mb-4" style={{ color: T.textSoft }}>Toca una mesa para gestionarla</p>

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

            <div className={`grid gap-3 ${panelDerechoAbierto ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
              {mesas.map(m => {
                const ocupada = (m.comensales || []).length > 0;
                const subsC = (m.comensales || []).filter(c => c.tipo === 'suscripcion').length;
                const menuC = (m.comensales || []).filter(c => c.tipo === 'menu').length;
                const invC  = (m.comensales || []).filter(c => c.tipo === 'invitado').length;
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
        </div>

        {/* COLUMNA DERECHA */}
        {panelDerechoAbierto && mesaSeleccionada && (
          <div className="w-full lg:w-1/2 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="p-4 rounded-2xl" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="font-medium" style={{ color: T.text, fontFamily: 'Fraunces, serif', fontSize: 18 }}>
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
                    <div style={{
                      marginBottom: 12,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: '#fef2f2',
                      border: '1px solid #fca5a5',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}>
                      <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 2 }}>
                          Error al enviar el pedido
                        </div>
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

function MiniColaCocina({ orders, mesas, onMarcarEntregado }) {
  const enCola = orders
    .filter(o => ['pendiente', 'preparando', 'listo'].includes(o.estado))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  if (enCola.length === 0) return null;

  const susc = enCola.filter(o => o.tipo === 'suscripcion');
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
          <p style={{ fontSize: 11, color: T.textMute, textAlign: 'center', padding: '20px 0', margin: 0, ...FontMono }}>
            SIN PEDIDOS
          </p>
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
  const mesa = mesas.find(m => m.numero === orden.mesa_numero);
  const comensal = (mesa?.comensales || []).find(c => c.id === orden.comensal_id);
  const min = minutesAgo(orden.fecha);

  const tagInfo = orden.es_invitado
    ? { label: 'INVITADO', tone: 'plum' }
    : orden.tipo === 'suscripcion'
      ? { label: 'PLAN', tone: 'olive' }
      : { label: 'MENÚ', tone: 'mustard' };

  const estadoLabel =
    orden.estado === 'pendiente'   ? 'EN COLA'     :
    orden.estado === 'preparando'  ? 'PREPARANDO'  :
    orden.estado === 'listo'       ? 'LISTO'       : '';

  const estadoTone =
    orden.estado === 'listo'      ? 'olive'   :
    orden.estado === 'preparando' ? 'mustard' : 'neutral';

  return (
    <div style={{
      background: T.card,
      border: orden.estado === 'listo' ? `2px solid ${T.olive}` : `1px solid ${T.border}`,
      borderRadius: 10, padding: 10, marginBottom: 8,
    }}>
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
            <span style={{ width: 18, height: 18, borderRadius: 4, background: T.bgSoft, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, ...FontMono }}>
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