import { hashPw } from './utils';

export const SEED_USERS = [
  { id: 'u1', usuario: 'admin', nombre: 'Administrador General', password: hashPw('admin123'), rol: 'admin', activo: true, created_at: new Date().toISOString() },
  { id: 'u2', usuario: 'caja1', nombre: 'Sandra López', password: hashPw('caja123'), rol: 'caja', activo: true, created_at: new Date().toISOString() },
  { id: 'u3', usuario: 'mesero1', nombre: 'Juan Pérez', password: hashPw('mesero123'), rol: 'mesero', activo: true, created_at: new Date().toISOString() },
  { id: 'u4', usuario: 'mesero2', nombre: 'Laura Vargas', password: hashPw('mesero123'), rol: 'mesero', activo: true, created_at: new Date().toISOString() },
  { id: 'u5', usuario: 'cocina1', nombre: 'Doña Rosa', password: hashPw('cocina123'), rol: 'cocina', activo: true, created_at: new Date().toISOString() },
];

export const SEED_MENU = [
  { id: 'm1', nombre: 'Bandeja Paisa', descripcion: 'Frijoles, arroz, carne, chicharrón, huevo, plátano', precio: 22000, disponibles: 15, vendidos: 0, categoria: 'Plato fuerte' },
  { id: 'm2', nombre: 'Sancocho de Gallina', descripcion: 'Sopa tradicional con yuca, plátano y mazorca', precio: 18000, disponibles: 12, vendidos: 0, categoria: 'Sopa' },
  { id: 'm3', nombre: 'Trucha al Ajillo', descripcion: 'Trucha fresca con arroz, ensalada y patacón', precio: 25000, disponibles: 8, vendidos: 0, categoria: 'Plato fuerte' },
  { id: 'm4', nombre: 'Pollo Sudado', descripcion: 'Pollo en salsa criolla con arroz y papa', precio: 16000, disponibles: 20, vendidos: 0, categoria: 'Plato fuerte' },
  { id: 'm5', nombre: 'Jugo Natural', descripcion: 'Mora, lulo, maracuyá o guanábana', precio: 4000, disponibles: 50, vendidos: 0, categoria: 'Bebida' },
  { id: 'm6', nombre: 'Postre del día', descripcion: 'Arroz con leche o gelatina', precio: 5000, disponibles: 30, vendidos: 0, categoria: 'Postre' },
];

export const SEED_PLANES = [
  { id: 'p1', nombre: 'Plan 20 Almuerzos', almuerzos: 20, precio: 240000, dias: 30, activo: true },
  { id: 'p2', nombre: 'Plan 30 Almuerzos', almuerzos: 30, precio: 330000, dias: 30, activo: true },
  { id: 'p3', nombre: 'Plan Ejecutivo Quincenal', almuerzos: 15, precio: 195000, dias: 15, activo: true },
];

export const SEED_SUSCRIPTORES = [
  {
    id: 's1', codigo: 'SUB-1001', nombre: 'María González',
    email: 'maria@email.com', cedula: '1234567890', telefono: '3001234567',
    password: hashPw('test1234'),
    plan_id: 'p1', almuerzos_restantes: 12, fecha_inicio: '2026-04-01',
    fecha_vencimiento: '2026-05-15', dias_xtra_compensados: 0,
    activo: true, permitir_invitados: true, created_at: new Date().toISOString()
  },
  {
    id: 's2', codigo: 'SUB-1002', nombre: 'Carlos Ramírez',
    email: 'carlos@email.com', cedula: '9876543210', telefono: '3109876543',
    password: hashPw('test1234'),
    plan_id: 'p2', almuerzos_restantes: 22, fecha_inicio: '2026-04-05',
    fecha_vencimiento: '2026-05-20', dias_xtra_compensados: 0,  
    activo: true, permitir_invitados: false, created_at: new Date().toISOString()
  },
  {
    id: 's3', codigo: 'SUB-1003', nombre: 'Ana Patricia López',
    email: 'ana@email.com', cedula: '1122334455', telefono: '3201112233',
    password: hashPw('test1234'),
    plan_id: 'p1', almuerzos_restantes: 5, fecha_inicio: '2026-04-01',
    fecha_vencimiento: '2026-04-30', dias_xtra_compensados: 0,
    activo: true, permitir_invitados: false, created_at: new Date().toISOString()
  },
  // Sin plan (demo: registrado pero sin activar)
  {
    id: 's4', codigo: 'SUB-1004', nombre: 'Pedro Ruiz',
    email: 'pedro@email.com', cedula: '5544332211', telefono: '3001234599',
    password: hashPw('test1234'),
    plan_id: null, almuerzos_restantes: 0, fecha_inicio: null,
    fecha_vencimiento: null, dias_xtra_compensados: 0,
    activo: true, permitir_invitados: false, created_at: new Date().toISOString()
  },
];

export const SEED_MESAS = Array.from({ length: 15 }, (_, i) => ({
  id: `mesa-${i + 1}`, numero: i + 1, comensales: []
}));

// Example events for the demo calendar (first subscriber)
export const SEED_EVENTS = [
  // María ha asistido algunos días
  { id: 'ev1', suscriptorId: 's1', fecha: '2026-04-05', tipo: 'asistencia' },
  { id: 'ev2', suscriptorId: 's1', fecha: '2026-04-07', tipo: 'asistencia' },
  { id: 'ev3', suscriptorId: 's1', fecha: '2026-04-08', tipo: 'aviso-inasistencia', hora: '08:30' },
  { id: 'ev4', suscriptorId: 's1', fecha: '2026-04-10', tipo: 'asistencia' },
  { id: 'ev5', suscriptorId: 's1', fecha: '2026-04-15', tipo: 'inasistencia-sin-aviso' },
  { id: 'ev6', suscriptorId: 's1', fecha: '2026-04-20', tipo: 'asistencia' },
];

export const SEED_NOTIFICATIONS = [
  {
    id: 'n1', tipo: 'nuevo-suscriptor', leida: false,
    titulo: 'Nuevo suscriptor registrado',
    mensaje: 'Pedro Ruiz se registró y espera activar su plan',
    suscriptorId: 's4',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString()
  }
];
