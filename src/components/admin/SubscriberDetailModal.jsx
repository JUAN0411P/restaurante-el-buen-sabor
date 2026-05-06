import { useState } from 'react';
import {
  User, Mail, Phone, Calendar, DollarSign, Clock, Plus, CheckCircle2, XCircle
} from 'lucide-react';
import { T } from '../../lib/tokens';
import { db, formatMoney, formatDateTime, MAX_DIAS_COMPENSADOS_AUTO } from '../../lib/utils';
import { Modal, Card, Tag, Btn, EmptyState } from '../ui/primitives';
import { AttendanceCalendar } from '../ui/AttendanceCalendar';

export function SubscriberDetailModal({ open, onClose, sub, plan, events, orders, refresh }) {
  const [tab, setTab] = useState('calendar');

  if (!sub) return null;

  const subEvents = events.filter(e => e.suscriptor_id === sub.id);
  const subOrders = orders.filter(o => o.suscriptor?.id === sub.id);
  const payments = subOrders.filter(o => o.pagado);
  const avisos = subEvents.filter(e => e.tipo === 'aviso-inasistencia');
  const inasistencias = subEvents.filter(e => e.tipo === 'inasistencia-sin-aviso');

  const diasYaCompensados = sub.dias_extra_compensados || 0;
  const diasDisponiblesAuto = Math.max(0, MAX_DIAS_COMPENSADOS_AUTO - diasYaCompensados);

  // ✅ FUNCIÓN CORREGIDA
  const compensarDiaAuto = async () => {
    if (diasDisponiblesAuto <= 0) {
      alert('Ya usaste los 4 días automáticos. El suscriptor debe solicitar extensión desde su app.');
      return;
    }

    const venc = new Date(sub.fecha_vencimiento);
    venc.setDate(venc.getDate() + 1);

    await db.update('rest:subs', sub.id, {
      fecha_vencimiento: venc.toISOString().slice(0, 10),
      dias_extra_compensados: (sub.dias_extra_compensados || 0) + 1,
      almuerzos_restantes: sub.almuerzos_restantes + 1,
    });

    refresh();
  };

  const tabs = [
    { id: 'calendar', label: 'Calendario', icon: Calendar },
    { id: 'payments', label: 'Pagos', icon: DollarSign },
    { id: 'absences', label: 'Avisos', icon: Clock },
  ];

  return (
    <Modal open={open} onClose={onClose} title={sub.nombre} size="xl">
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <Card padding="p-3">
          <div className="flex items-center gap-2 text-xs mb-1" style={{ color: T.textSoft }}>
            <User size={12} /> Código
          </div>
          <p className="font-mono font-medium" style={{ color: T.text }}>{sub.codigo}</p>
        </Card>

        <Card padding="p-3">
          <div className="flex items-center gap-2 text-xs mb-1" style={{ color: T.textSoft }}>
            <Mail size={12} /> Email
          </div>
          <p className="text-sm truncate" style={{ color: T.text }}>{sub.email}</p>
        </Card>

        <Card padding="p-3">
          <div className="flex items-center gap-2 text-xs mb-1" style={{ color: T.textSoft }}>
            <Phone size={12} /> Teléfono · Cédula
          </div>
          <p className="text-sm" style={{ color: T.text }}>
            {sub.telefono} · {sub.cedula}
          </p>
        </Card>
      </div>

      {plan ? (
        <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: T.bg }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs" style={{ color: T.textSoft }}>Plan actual</p>
              <p className="font-medium" style={{ color: T.text, fontFamily: 'Fraunces, serif' }}>
                {plan.nombre}
              </p>
              <p className="text-xs mt-1" style={{ color: T.textSoft }}>
                Inicio: {sub.fecha_inicio || '—'} · Vence: {sub.fecha_vencimiento || '—'}
              </p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-medium" style={{ color: T.accent, fontFamily: 'Fraunces, serif' }}>
                {sub.almuerzos_restantes}
              </p>
              <p className="text-xs" style={{ color: T.textSoft }}>almuerzos restantes</p>
            </div>
          </div>

          {diasYaCompensados > 0 && (
            <p className="text-xs mt-2" style={{ color: T.amber }}>
              +{diasYaCompensados} días compensados por aviso previo
            </p>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-lg mb-4 text-sm" style={{ backgroundColor: T.amberSoft, color: T.amber }}>
          ⚠️ Este suscriptor no tiene un plan activo. Actívalo desde caja.
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}` }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: tab === t.id ? T.card : 'transparent',
              color: tab === t.id ? T.accent : T.textSoft,
            }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <div>
          <AttendanceCalendar
            events={subEvents}
            fechaInicio={sub.fecha_inicio}
            fechaVencimiento={sub.fecha_vencimiento}
          />

          {plan && (
            <div className="mt-4 p-3 rounded-lg flex items-center justify-between gap-3 flex-wrap" style={{ backgroundColor: T.greenSoft }}>
              <div>
                <p className="text-sm font-medium" style={{ color: T.green }}>
                  Compensación de días avisados
                </p>
                <p className="text-xs mt-0.5" style={{ color: T.textSoft }}>
                  Automático hasta {MAX_DIAS_COMPENSADOS_AUTO} días ({diasDisponiblesAuto} disponibles). Más requieren aprobación.
                </p>
              </div>

              <div className="flex gap-2">
                <Btn
                  size="sm"
                  variant="success"
                  icon={Plus}
                  onClick={compensarDiaAuto}
                  disabled={diasDisponiblesAuto <= 0}
                >
                  Compensar 1 día
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div>
          {payments.length === 0 ? (
            <EmptyState icon={DollarSign} title="Sin pagos registrados" />
          ) : (
            <div className="space-y-2">
              {payments.map(p => (
                <Card key={p.id} padding="p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-medium" style={{ color: T.text }}>
                        {p.items.map(i => i.nombre).join(', ')}
                      </p>
                      <p className="text-xs" style={{ color: T.textSoft }}>
                        {formatDateTime(p.fecha_pago || p.fecha)} · Mesa {p.mesa_numero}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Tag color="blue">{p.metodo_pago}</Tag>
                      <span className="font-medium" style={{ color: T.accent }}>
                        {formatMoney(p.total)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'absences' && (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card padding="p-3">
              <p className="text-xs" style={{ color: T.textSoft }}>Avisó antes 10am</p>
              <p className="text-2xl font-medium" style={{ color: T.amber, fontFamily: 'Fraunces, serif' }}>
                {avisos.length}
              </p>
            </Card>

            <Card padding="p-3">
              <p className="text-xs" style={{ color: T.textSoft }}>Sin avisar</p>
              <p className="text-2xl font-medium" style={{ color: T.red, fontFamily: 'Fraunces, serif' }}>
                {inasistencias.length}
              </p>
            </Card>
          </div>

          {avisos.length === 0 && inasistencias.length === 0 ? (
            <EmptyState icon={Clock} title="Sin eventos de inasistencia" />
          ) : (
            <div className="space-y-2">
              {[...avisos, ...inasistencias]
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: T.bg }}>
                    {ev.tipo === 'aviso-inasistencia'
                      ? <CheckCircle2 size={16} style={{ color: T.amber }} />
                      : <XCircle size={16} style={{ color: T.red }} />}

                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: T.text }}>
                        {ev.tipo === 'aviso-inasistencia'
                          ? 'Avisó con anticipación'
                          : 'No se presentó'}
                      </p>

                      <p className="text-xs" style={{ color: T.textSoft }}>
                        {ev.fecha}{ev.hora ? ` · aviso a las ${ev.hora}` : ''}
                      </p>
                    </div>

                    {ev.tipo === 'aviso-inasistencia' && <Tag color="amber">Compensable</Tag>}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}





























// import { useState } from 'react';
// import {
//   User, Mail, Phone, Hash, Calendar, DollarSign, Clock, Plus, CheckCircle2, XCircle
// } from 'lucide-react';
// import { T } from '../../lib/tokens';
// import { db, formatMoney, formatDateTime, MAX_DIAS_COMPENSADOS_AUTO } from '../../lib/utils';
// import { Modal, Card, Tag, Btn, EmptyState } from '../ui/primitives';
// import { AttendanceCalendar } from '../ui/AttendanceCalendar';

// /**
//  * Modal detallado del suscriptor (se abre con doble clic)
//  * - Calendario de asistencia
//  * - Historial de pagos (órdenes pagadas)
//  * - Avisos de inasistencia
//  * - Botón para compensar días (máx 4 automático)
//  */
// export function SubscriberDetailModal({ open, onClose, sub, plan, events, orders, refresh }) {
//   const [tab, setTab] = useState('calendar');

//   if (!sub) return null;

//   const subEvents = events.filter(e => e.suscriptor_id === sub.id);
//   const subOrders = orders.filter(o => o.suscriptor?.id === sub.id);
//   const payments = subOrders.filter(o => o.pagado);
//   const avisos = subEvents.filter(e => e.tipo === 'aviso-inasistencia');
//   const inasistencias = subEvents.filter(e => e.tipo === 'inasistencia-sin-aviso');

//   const diasYaCompensados = sub.dias_extra_compensados || 0;
//   const diasDisponiblesAuto = Math.max(0, MAX_DIAS_COMPENSADOS_AUTO - diasYaCompensados);

//   const compensarDiaAuto = async () => {
//     if (diasDisponiblesAuto <= 0) { alert('Ya usaste los 4 días automáticos. El suscriptor debe solicitar extensión desde su app.'); return; }
//     const subs = await db.get('rest:subs', []);
//     const venc = new Date(sub.fecha_vencimiento);
//     venc.setDate(venc.getDate() + 1);
//     await db.set('rest:subs', subs.map(s => s.id === sub.id ? {
//       ...s,
//       fecha_vencimiento: venc.toISOString().slice(0, 10),
//       dias_extra_compensados: (s.dias_extra_compensados || 0) + 1,
//       almuerzos_restantes: s.almuerzos_restantes + 1,
//     } : s));
//     refresh();
//   };

//   const tabs = [
//     { id: 'calendar', label: 'Calendario', icon: Calendar },
//     { id: 'payments', label: 'Pagos', icon: DollarSign },
//     { id: 'absences', label: 'Avisos', icon: Clock },
//   ];

//   return (
//     <Modal open={open} onClose={onClose} title={sub.nombre} size="xl">
//       <div className="grid md:grid-cols-3 gap-4 mb-4">
//         <Card padding="p-3">
//           <div className="flex items-center gap-2 text-xs mb-1" style={{ color: T.textSoft }}>
//             <User size={12} /> Código
//           </div>
//           <p className="font-mono font-medium" style={{ color: T.text }}>{sub.codigo}</p>
//         </Card>
//         <Card padding="p-3">
//           <div className="flex items-center gap-2 text-xs mb-1" style={{ color: T.textSoft }}>
//             <Mail size={12} /> Email
//           </div>
//           <p className="text-sm truncate" style={{ color: T.text }}>{sub.email}</p>
//         </Card>
//         <Card padding="p-3">
//           <div className="flex items-center gap-2 text-xs mb-1" style={{ color: T.textSoft }}>
//             <Phone size={12} /> Teléfono · Cédula
//           </div>
//           <p className="text-sm" style={{ color: T.text }}>{sub.telefono} · {sub.cedula}</p>
//         </Card>
//       </div>

//       {plan ? (
//         <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: T.bg }}>
//           <div className="flex items-center justify-between flex-wrap gap-2">
//             <div>
//               <p className="text-xs" style={{ color: T.textSoft }}>Plan actual</p>
//               <p className="font-medium" style={{ color: T.text, fontFamily: 'Fraunces, serif' }}>{plan.nombre}</p>
//               <p className="text-xs mt-1" style={{ color: T.textSoft }}>
//                 Inicio: {sub.fecha_inicio || '—'} · Vence: {sub.fecha_vencimiento || '—'}
//               </p>
//             </div>
//             <div className="text-right">
//               <p className="text-2xl font-medium" style={{ color: T.accent, fontFamily: 'Fraunces, serif' }}>{sub.almuerzos_restantes}</p>
//               <p className="text-xs" style={{ color: T.textSoft }}>almuerzos restantes</p>
//             </div>
//           </div>
//           {diasYaCompensados > 0 && (
//             <p className="text-xs mt-2" style={{ color: T.amber }}>
//               +{diasYaCompensados} días compensados por aviso previo
//             </p>
//           )}
//         </div>
//       ) : (
//         <div className="p-4 rounded-lg mb-4 text-sm" style={{ backgroundColor: T.amberSoft, color: T.amber }}>
//           ⚠️ Este suscriptor no tiene un plan activo. Actívalo desde caja.
//         </div>
//       )}

//       <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}` }}>
//         {tabs.map(t => (
//           <button key={t.id} onClick={() => setTab(t.id)}
//             className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
//             style={{
//               backgroundColor: tab === t.id ? T.card : 'transparent',
//               color: tab === t.id ? T.accent : T.textSoft,
//             }}>
//             <t.icon size={14} /> {t.label}
//           </button>
//         ))}
//       </div>

//       {tab === 'calendar' && (
//         <div>
//           <AttendanceCalendar
//             events={subEvents}
//             fechaInicio={sub.fecha_inicio}
//             fechaVencimiento={sub.fecha_vencimiento}
//           />
//           {plan && (
//             <div className="mt-4 p-3 rounded-lg flex items-center justify-between gap-3 flex-wrap" style={{ backgroundColor: T.greenSoft }}>
//               <div>
//                 <p className="text-sm font-medium" style={{ color: T.green }}>Compensación de días avisados</p>
//                 <p className="text-xs mt-0.5" style={{ color: T.textSoft }}>
//                   Automático hasta {MAX_DIAS_COMPENSADOS_AUTO} días ({diasDisponiblesAuto} disponibles). Más requieren aprobación.
//                 </p>
//               </div>
//               <div className="flex gap-2">
//                 <Btn size="sm" variant="success" icon={Plus} onClick={compensarDiaAuto} disabled={diasDisponiblesAuto <= 0}>
//                   Compensar 1 día
//                 </Btn>
//               </div>
//             </div>
//           )}
//         </div>
//       )}

//       {tab === 'payments' && (
//         <div>
//           {payments.length === 0 ? (
//             <EmptyState icon={DollarSign} title="Sin pagos registrados" />
//           ) : (
//             <div className="space-y-2">
//               {payments.map(p => (
//                 <Card key={p.id} padding="p-3">
//                   <div className="flex items-center justify-between flex-wrap gap-2">
//                     <div>
//                       <p className="text-sm font-medium" style={{ color: T.text }}>{p.items.map(i => i.nombre).join(', ')}</p>
//                       <p className="text-xs" style={{ color: T.textSoft }}>{formatDateTime(p.fecha_pago || p.fecha)} · Mesa {p.mesa_numero}</p>
//                     </div>
//                     <div className="flex items-center gap-2">
//                       <Tag color="blue">{p.metodo_pago}</Tag>
//                       <span className="font-medium" style={{ color: T.accent }}>{formatMoney(p.total)}</span>
//                     </div>
//                   </div>
//                 </Card>
//               ))}
//             </div>
//           )}
//         </div>
//       )}

//       {tab === 'absences' && (
//         <div>
//           <div className="grid grid-cols-2 gap-3 mb-4">
//             <Card padding="p-3">
//               <p className="text-xs" style={{ color: T.textSoft }}>Avisó antes 10am</p>
//               <p className="text-2xl font-medium" style={{ color: T.amber, fontFamily: 'Fraunces, serif' }}>{avisos.length}</p>
//             </Card>
//             <Card padding="p-3">
//               <p className="text-xs" style={{ color: T.textSoft }}>Sin avisar</p>
//               <p className="text-2xl font-medium" style={{ color: T.red, fontFamily: 'Fraunces, serif' }}>{inasistencias.length}</p>
//             </Card>
//           </div>
//           {avisos.length === 0 && inasistencias.length === 0 ? (
//             <EmptyState icon={Clock} title="Sin eventos de inasistencia" />
//           ) : (
//             <div className="space-y-2">
//               {[...avisos, ...inasistencias].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(ev => (
//                 <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: T.bg }}>
//                   {ev.tipo === 'aviso-inasistencia'
//                     ? <CheckCircle2 size={16} style={{ color: T.amber }} />
//                     : <XCircle size={16} style={{ color: T.red }} />}
//                   <div className="flex-1">
//                     <p className="text-sm font-medium" style={{ color: T.text }}>
//                       {ev.tipo === 'aviso-inasistencia' ? 'Avisó con anticipación' : 'No se presentó'}
//                     </p>
//                     <p className="text-xs" style={{ color: T.textSoft }}>
//                       {ev.fecha}{ev.hora ? ` · aviso a las ${ev.hora}` : ''}
//                     </p>
//                   </div>
//                   {ev.tipo === 'aviso-inasistencia' && <Tag color="amber">Compensable</Tag>}
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       )}
//     </Modal>
//   );
// }
