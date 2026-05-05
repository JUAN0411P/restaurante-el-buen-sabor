import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLE_MAP = {
  'rest:users':         'users',
  'rest:menu':          'menu',
  'rest:planes':        'planes',
  'rest:subs':          'suscriptores',
  'rest:mesas':         'mesas',
  'rest:orders':        'orders',
  'rest:events':        'events',
  'rest:notifications': 'notifications',
};

export const db = {
  async get(key, fallback = []) {
    const table = TABLE_MAP[key];
    if (!table) return fallback;
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) { console.error(`db.get(${key}):`, error.message); return fallback; }
      return data ?? fallback;
    } catch (e) {
      console.error(`db.get(${key}):`, e);
      return fallback;
    }
  },

  // ← INSERT un solo registro nuevo
  async insert(key, row) {
    const table = TABLE_MAP[key];
    if (!table) return { error: 'tabla no encontrada' };
    // Quitar el id si es falso/temporal para que Postgres genere el UUID
    const { id, ...rest } = row;
    const payload = (id && isValidUUID(id)) ? row : rest;
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) console.error(`db.insert(${key}):`, error.message);
    return { data, error };
  },

  // ← UPDATE un registro existente por id
  async update(key, id, changes) {
    const table = TABLE_MAP[key];
    if (!table) return { error: 'tabla no encontrada' };
    const { data, error } = await supabase.from(table).update(changes).eq('id', id).select().single();
    if (error) console.error(`db.update(${key}):`, error.message);
    return { data, error };
  },

  // ← UPSERT de un solo objeto (para casos donde el id ya es UUID válido)
  async upsertOne(key, row) {
    const table = TABLE_MAP[key];
    if (!table) return;
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
    if (error) console.error(`db.upsertOne(${key}):`, error.message);
  },

  async del(key, id) {
    const table = TABLE_MAP[key];
    if (!table || !id) { console.warn('db.del() — usa activo=false en producción'); return; }
    const { error } = await supabase.from(table).update({ activo: false }).eq('id', id);
    if (error) console.error(`db.del(${key}):`, error.message);
  },

  // Mantenemos set() para no romper código existente, pero ahora hace upsert inteligente
  async set(key, rows) {
    if (!Array.isArray(rows)) return;
    const table = TABLE_MAP[key];
    if (!table) return;
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) console.error(`db.set(${key}):`, error.message);
  },
};

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export const hashPw = (pw) => {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) >>> 0;
  return `dh_${h.toString(16)}_${pw.length}`;
};

export const formatMoney    = (n) => `$${(n || 0).toLocaleString('es-CO')}`;
export const formatDate     = (iso) => !iso ? '—' : new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatDateTime = (iso) => !iso ? '—' : new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const minutesAgo     = (iso) => !iso ? 0 : Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
export const todayISO       = () => new Date().toISOString().slice(0, 10);

export const validators = {
  nombre:   (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,}$/.test((v || '').trim()) || 'Mínimo 3 letras, solo texto',
  email:    (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '') || 'Email inválido',
  cedula:   (v) => /^\d{6,10}$/.test(v || '') || 'Cédula: 6 a 10 dígitos',
  telefono: (v) => /^3\d{9}$/.test(v || '') || 'Tel: 10 dígitos comenzando con 3',
  password: (v) => ((v || '').length >= 8 && /\d/.test(v || '')) || 'Mín. 8 caracteres y 1 número',
  usuario:  (v) => /^[a-z0-9_]{3,20}$/.test(v || '') || 'Usuario: 3-20 minúsculas/números',
};

export const DATA_VERSION              = '5';
export const APPROVAL_TIMEOUT_MINUTES  = 2;
export const APPROVAL_CANCEL_MINUTES   = 10;
export const MAX_DIAS_COMPENSADOS_AUTO = 4;
export const AVISO_INASISTENCIA_HORA   = 10;