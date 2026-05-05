import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { T } from '../../lib/tokens';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Props:
 * - events: array of {fecha: 'YYYY-MM-DD', tipo: 'asistencia'|'inasistencia-sin-aviso'|'aviso-inasistencia'|'habilitado'|'reprogramado'}
 * - fechaInicio, fechaVencimiento: 'YYYY-MM-DD' (optional)
 */
export function AttendanceCalendar({ events = [], fechaInicio, fechaVencimiento }) {
  const [cursor, setCursor] = useState(() => {
    if (fechaInicio) return new Date(fechaInicio);
    return new Date();
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // lunes=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsByDate = {};
  events.forEach(ev => { eventsByDate[ev.fecha] = ev; });

  const getColor = (dateStr, ev) => {
    if (ev) {
      if (ev.tipo === 'asistencia') return { bg: T.greenSoft, text: T.green, label: '✓' };
      if (ev.tipo === 'inasistencia-sin-aviso') return { bg: T.redSoft, text: T.red, label: '✗' };
      if (ev.tipo === 'aviso-inasistencia') return { bg: T.amberSoft, text: T.amber, label: '!' };
      if (ev.tipo === 'reprogramado') return { bg: T.purpleSoft, text: T.purple, label: 'R' };
    }
    // Días dentro del rango del plan = habilitados (azul claro)
    if (fechaInicio && fechaVencimiento && dateStr >= fechaInicio && dateStr <= fechaVencimiento) {
      return { bg: T.blueSoft, text: T.blue, label: '' };
    }
    return null;
  };

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, ev: eventsByDate[dateStr] });
  }

  const prevMonth = () => setCursor(new Date(year, month - 1, 1));
  const nextMonth = () => setCursor(new Date(year, month + 1, 1));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 rounded-md" style={{ color: T.textSoft, backgroundColor: T.bg }}>
          <ChevronLeft size={16} />
        </button>
        <p className="font-medium" style={{ color: T.text, fontFamily: 'Fraunces, serif' }}>
          {MONTHS[month]} {year}
        </p>
        <button onClick={nextMonth} className="p-1.5 rounded-md" style={{ color: T.textSoft, backgroundColor: T.bg }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium py-1" style={{ color: T.textMute }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />;
          const style = getColor(cell.dateStr, cell.ev);
          return (
            <div
              key={i}
              className="aspect-square rounded-md flex flex-col items-center justify-center text-xs relative"
              style={{
                backgroundColor: style?.bg || T.bg,
                color: style?.text || T.textMute,
                border: `1px solid ${style ? style.bg : T.borderSoft}`
              }}
              title={cell.ev?.tipo || ''}>
              <span className="font-medium">{cell.day}</span>
              {style?.label && <span className="text-[10px] leading-none">{style.label}</span>}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: T.greenSoft, border: `1px solid ${T.green}` }} />
          <span style={{ color: T.textSoft }}>Asistió</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: T.redSoft, border: `1px solid ${T.red}` }} />
          <span style={{ color: T.textSoft }}>No asistió</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: T.amberSoft, border: `1px solid ${T.amber}` }} />
          <span style={{ color: T.textSoft }}>Avisó antes 10am</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: T.blueSoft, border: `1px solid ${T.blue}` }} />
          <span style={{ color: T.textSoft }}>Habilitado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: T.purpleSoft, border: `1px solid ${T.purple}` }} />
          <span style={{ color: T.textSoft }}>Reprogramado</span>
        </div>
      </div>
    </div>
  );
}
