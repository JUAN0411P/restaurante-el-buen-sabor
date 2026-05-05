import { useState } from 'react';
import { Bell, UserPlus, Clock, CheckCircle2, AlertCircle, X, Utensils, Check, Calendar } from 'lucide-react';
import { T } from '../../lib/tokens';
import { db, formatDateTime } from '../../lib/utils';
import { Modal, EmptyState, Btn, Tag } from './primitives';

const TIPO_ICONS = {
  'nuevo-suscriptor': UserPlus,
  'solicitud-extension': Calendar,
  'extension-aprobada': CheckCircle2,
  'extension-rechazada': X,
  'aviso-inasistencia': Clock,
  'pedido-aprobado': CheckCircle2,
  'pedido-rechazado': X,
  'pedido-pendiente': Utensils,
  'aviso-general': Bell,
};

const TIPO_COLORS = {
  'nuevo-suscriptor': 'blue',
  'solicitud-extension': 'amber',
  'extension-aprobada': 'green',
  'extension-rechazada': 'red',
  'aviso-inasistencia': 'amber',
  'pedido-aprobado': 'green',
  'pedido-rechazado': 'red',
  'pedido-pendiente': 'amber',
  'aviso-general': 'gray',
};

export function NotificationsPanel({ open, onClose, notifications, refresh, onAction, canApprove = false }) {
  const sorted = [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const marcarLeida = async (id) => {
    const all = await db.get('rest:notifications', []);
    await db.set('rest:notifications', all.map(n => n.id === id ? { ...n, leida: true } : n));
    refresh();
  };

  const marcarTodasLeidas = async () => {
    const all = await db.get('rest:notifications', []);
    await db.set('rest:notifications', all.map(n => ({ ...n, leida: true })));
    refresh();
  };

  const eliminar = async (id) => {
    const all = await db.get('rest:notifications', []);
    await db.set('rest:notifications', all.filter(n => n.id !== id));
    refresh();
  };

  const unread = sorted.filter(n => !n.leida).length;

  return (
    <Modal open={open} onClose={onClose} title={`Notificaciones ${unread > 0 ? `(${unread} sin leer)` : ''}`} size="lg">
      {sorted.length === 0 ? (
        <EmptyState icon={Bell} title="No hay notificaciones" />
      ) : (
        <>
          {unread > 0 && (
            <div className="mb-3 flex justify-end">
              <Btn size="sm" variant="ghost" onClick={marcarTodasLeidas}>Marcar todas leídas</Btn>
            </div>
          )}
          <div className="space-y-2">
            {sorted.map((n) => {
              const Icon = TIPO_ICONS[n.tipo] || Bell;
              const color = TIPO_COLORS[n.tipo] || 'gray';
              const esSolicitudExtension = n.tipo === 'solicitud-extension' && canApprove;
              const yaProcesada = n.procesada;

              return (
                <div key={n.id}
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: n.leida ? T.bg : T.accentSoft,
                    border: `1px solid ${n.leida ? T.border : T.accent}`,
                  }}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md flex-shrink-0" style={{ backgroundColor: T.card }}>
                      <Icon size={14} style={{ color: T[color] || T.textSoft }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-sm" style={{ color: T.text }}>{n.titulo}</p>
                        {!n.leida && <Tag color="accent">Nuevo</Tag>}
                        {yaProcesada && <Tag color={n.procesadaResultado === 'aprobada' ? 'green' : 'red'}>
                          {n.procesadaResultado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                        </Tag>}
                      </div>
                      <p className="text-xs" style={{ color: T.textSoft }}>{n.mensaje}</p>
                      <p className="text-xs mt-1" style={{ color: T.textMute }}>{formatDateTime(n.created_at)}</p>

                      {/* Detalles especiales para solicitud-extension (vista admin) */}
                      {esSolicitudExtension && n.snapshot && (
                        <ExtensionDetails snapshot={n.snapshot} dias={n.dias} motivo={n.motivo} />
                      )}

                      <div className="flex gap-2 mt-2 flex-wrap">
                        {esSolicitudExtension && !yaProcesada && (
                          <ExtensionActions notif={n} refresh={refresh} />
                        )}
                        {!n.leida && (
                          <button onClick={() => marcarLeida(n.id)} className="text-xs font-medium" style={{ color: T.accent }}>
                            Marcar leída
                          </button>
                        )}
                        {onAction && n.accion && !esSolicitudExtension && (
                          <button onClick={() => { onAction(n); onClose(); }} className="text-xs font-medium" style={{ color: T.blue }}>
                            {n.accion.label}
                          </button>
                        )}
                        <button onClick={() => eliminar(n.id)} className="text-xs font-medium" style={{ color: T.red }}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}

function ExtensionDetails({ snapshot, dias, motivo }) {
  return (
    <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div>
          <span style={{ color: T.textMute }}>Suscriptor:</span>
          <span className="font-medium ml-1" style={{ color: T.text }}>{snapshot.nombre}</span>
        </div>
        <div>
          <span style={{ color: T.textMute }}>Código:</span>
          <span className="font-medium ml-1" style={{ color: T.text }}>{snapshot.codigo}</span>
        </div>
        <div>
          <span style={{ color: T.textMute }}>Plan:</span>
          <span className="font-medium ml-1" style={{ color: T.text }}>{snapshot.plan}</span>
        </div>
        <div>
          <span style={{ color: T.textMute }}>Vence:</span>
          <span className="font-medium ml-1" style={{ color: T.text }}>{snapshot.fecha_vencimiento}</span>
        </div>
        <div>
          <span style={{ color: T.textMute }}>Almuerzos:</span>
          <span className="font-medium ml-1" style={{ color: T.text }}>{snapshot.almuerzos_restantes}</span>
        </div>
        <div>
          <span style={{ color: T.textMute }}>Ya compensados:</span>
          <span className="font-medium ml-1" style={{ color: T.text }}>{snapshot.diasYaCompensados}</span>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-2">
        <Tag color="amber">{snapshot.avisosInasistencia} avisos con anticipación</Tag>
        <Tag color="red">{snapshot.inasistenciasSinAviso} sin avisar</Tag>
      </div>
      <div className="pt-2 mt-2" style={{ borderTop: `1px dashed ${T.border}` }}>
        <p className="text-xs" style={{ color: T.textSoft }}>
          <strong>Solicita:</strong> {dias} día(s) adicional(es)
        </p>
        <p className="text-xs mt-1" style={{ color: T.textSoft }}>
          <strong>Motivo:</strong> {motivo}
        </p>
      </div>
    </div>
  );
}

function ExtensionActions({ notif, refresh }) {
  const [procesando, setProcesando] = useState(false);

  const aprobar = async () => {
    if (!confirm(`¿Aprobar extensión de ${notif.dias} día(s) para ${notif.snapshot?.nombre}?`)) return;
    setProcesando(true);

    const subs = await db.get('rest:subs', []);
    const updated = subs.map(s => {
      if (s.id !== notif.suscriptorId) return s;
      const venc = s.fecha_vencimiento ? new Date(s.fecha_vencimiento) : new Date();
      venc.setDate(venc.getDate() + notif.dias);
      return {
        ...s,
        fecha_vencimiento: venc.toISOString().slice(0, 10),
        almuerzos_restantes: s.almuerzos_restantes + notif.dias,
        dias_xtra_compensados: (s.dias_xtra_compensados || 0) + notif.dias,
      };
    });
    await db.set('rest:subs', updated);

    const all = await db.get('rest:notifications', []);
    await db.set('rest:notifications', all.map(n =>
      n.id === notif.id ? { ...n, procesada: true, procesadaResultado: 'aprobada', leida: true } : n
    ));

    await crearNotificacion({
      tipo: 'extension-aprobada',
      titulo: '✓ Tu extensión fue aprobada',
      mensaje: `El admin aprobó ${notif.dias} día(s) adicionales. Tu plan se extendió y tienes ${notif.dias} almuerzo(s) más.`,
      suscriptorId: notif.suscriptorId,
    });

    refresh();
    setProcesando(false);
  };

  const rechazar = async () => {
    const razon = prompt('Motivo del rechazo (opcional):') || '';

    const all = await db.get('rest:notifications', []);
    await db.set('rest:notifications', all.map(n =>
      n.id === notif.id ? { ...n, procesada: true, procesadaResultado: 'rechazada', leida: true, razonRechazo: razon } : n
    ));

    await crearNotificacion({
      tipo: 'extension-rechazada',
      titulo: 'Tu solicitud de extensión fue rechazada',
      mensaje: razon
        ? `El admin rechazó tu solicitud de ${notif.dias} día(s). Motivo: ${razon}`
        : `El admin rechazó tu solicitud de ${notif.dias} día(s).`,
      suscriptorId: notif.suscriptorId,
    });

    refresh();
  };

  return (
    <>
      <Btn size="sm" variant="success" icon={Check} onClick={aprobar} disabled={procesando}>
        {procesando ? 'Procesando…' : 'Aprobar'}
      </Btn>
      <Btn size="sm" variant="danger" icon={X} onClick={rechazar} disabled={procesando}>
        Rechazar
      </Btn>
    </>
  );
}

// Helper: crear notificaciones
export async function crearNotificacion(notif) {
  const all = await db.get('rest:notifications', []);
  await db.set('rest:notifications', [...all, {
    id: `n${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    leida: false,
    createdAt: new Date().toISOString(),
    ...notif,
  }]);
}
