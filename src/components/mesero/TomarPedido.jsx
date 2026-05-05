import { useState } from 'react';
import { Plus, Minus, ChefHat, Clock } from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { formatMoney } from '../../lib/utils';
import { Tag, Btn, KickerLabel } from '../ui/primitives';

export function TomarPedido({ mesaActiva, config, menu, onCancel, onEnviar }) {
  const [carrito, setCarrito] = useState([]);

  const tipoMostrar = config.tipo;
  const tones = { suscripcion: 'olive', menu: 'mustard', invitado: 'plum' };
  const labels = { suscripcion: 'MENSUALIDAD', menu: 'MENÚ DEL DÍA', invitado: 'INVITADO' };

  const addCarrito = (item) => {
    const existing = carrito.find(c => c.id === item.id);
    if (existing) setCarrito(carrito.map(c => c.id === item.id ? { ...c, cantidad: c.cantidad + 1 } : c));
    else setCarrito([...carrito, { ...item, cantidad: 1 }]);
  };
  const removeCarrito = (id) => {
    const e = carrito.find(c => c.id === id);
    if (e.cantidad > 1) setCarrito(carrito.map(c => c.id === id ? { ...c, cantidad: c.cantidad - 1 } : c));
    else setCarrito(carrito.filter(c => c.id !== id));
  };

  const requiereAprobacion = tipoMostrar === 'suscripcion' || tipoMostrar === 'invitado';
  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  return (
    <div>
      {/* Header con info comensal */}
      <div style={{ marginBottom: 14 }}>
        <KickerLabel>— pedido para</KickerLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...FontFraunces, fontSize: 18, color: T.text }}>{config.nombre}</span>
          <Tag tone={tones[tipoMostrar]} size="xs">{labels[tipoMostrar]}</Tag>
        </div>
      </div>

      {/* Aviso aprobación */}
      {requiereAprobacion && (
        <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: T.mustardSoft, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Clock size={16} color={T.mustard} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 2 }}>
              Requiere aprobación del suscriptor
            </div>
            <p style={{ fontSize: 11, color: T.textSoft, margin: 0 }}>
              Al enviar, se notifica a {config.suscriptor?.nombre}. Si no responde en 2 min se te alerta; a los 10 min se cancela automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* Layout 2 col */}
      <div style={{ display: 'grid', gap: 14 }} className="grid lg:grid-cols-[1.2fr_1fr] grid-cols-1">
        {/* MENÚ */}
        <div>
          <KickerLabel>— selecciona platos</KickerLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {menu.filter(m => m.disponibles > 0).map(m => {
              const incluido = requiereAprobacion && m.categoria !== 'Bebida' && m.categoria !== 'Postre';
              return (
                <div
                  key={m.id}
                  style={{
                    padding: 12,
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m.nombre}</span>
                      <Tag tone="neutral" size="xs">{m.categoria.toUpperCase()}</Tag>
                    </div>
                    <p style={{ fontSize: 11, color: T.textSoft, margin: 0 }}>{m.descripcion}</p>
                    <div style={{ marginTop: 4 }}>
                      {incluido ? (
                        <Tag tone="olive" size="xs">INCLUIDO EN PLAN</Tag>
                      ) : (
                        <span style={{ ...FontMono, fontSize: 11, color: T.terracotta, fontWeight: 600 }}>
                          {formatMoney(m.precio)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Btn size="sm" variant="ghost" icon={Plus} onClick={() => addCarrito(m)}>Agregar</Btn>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARRITO */}
        <div>
          <KickerLabel>— pedido actual</KickerLabel>
          <div style={{ marginTop: 8, padding: 14, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, position: 'sticky', top: 20 }}>
            {carrito.length === 0 && (
              <p style={{ fontSize: 11, color: T.textMute, textAlign: 'center', padding: '20px 0', margin: 0, ...FontMono }}>
                SELECCIONA PLATOS DEL MENÚ
              </p>
            )}
            {carrito.map(c => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: `1px solid ${T.borderSoft}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: T.text, margin: 0 }}>{c.nombre}</p>
                  {!requiereAprobacion && (
                    <p style={{ fontSize: 11, color: T.textSoft, margin: 0, ...FontMono }}>
                      {formatMoney(c.precio * c.cantidad)}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => removeCarrito(c.id)}
                    style={{ width: 24, height: 24, borderRadius: 6, background: T.bgSoft, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                  >
                    <Minus size={11} color={T.text} />
                  </button>
                  <span style={{ width: 22, textAlign: 'center', fontSize: 13, fontWeight: 600, color: T.text }}>{c.cantidad}</span>
                  <button
                    onClick={() => addCarrito(c)}
                    style={{ width: 24, height: 24, borderRadius: 6, background: T.bgSoft, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                  >
                    <Plus size={11} color={T.text} />
                  </button>
                </div>
              </div>
            ))}
            {carrito.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, color: T.textSoft }}>Total</span>
                  <span style={{ ...FontFraunces, fontSize: 24, fontStyle: 'italic', color: T.terracotta }}>
                    {requiereAprobacion ? 'Mensualidad' : formatMoney(total)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
                  <Btn full icon={requiereAprobacion ? Clock : ChefHat} onClick={() => onEnviar(carrito)}>
                    {requiereAprobacion ? 'Enviar para aprobación →' : 'Enviar a cocina →'}
                  </Btn>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
