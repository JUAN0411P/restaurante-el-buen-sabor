import { createClient } from '@supabase/supabase-js';

// ============ SUPABASE CLIENT ============
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ DB WRAPPER ============
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
  async get(key, fallback = null) {
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

  async set(key, rows) {
    const table = TABLE_MAP[key];
    if (!table || !Array.isArray(rows)) return;
    try {
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
      if (error) console.error(`db.set(${key}):`, error.message);
    } catch (e) {
      console.error(`db.set(${key}):`, e);
    }
  },

  async upsertOne(key, row) {
    const table = TABLE_MAP[key];
    if (!table) return;
    try {
      const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
      if (error) console.error(`db.upsertOne(${key}):`, error.message);
    } catch (e) {
      console.error(`db.upsertOne(${key}):`, e);
    }
  },

  async del(key) {
    console.warn('db.del() — usa activo=false en producción');
  },
};

// ============ PASSWORD HASHING ============
export const hashPw = (pw) => {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) >>> 0;
  return `dh_${h.toString(16)}_${pw.length}`;
};

// ============ FORMATTERS ============
export const formatMoney    = (n) => `$${(n || 0).toLocaleString('es-CO')}`;
export const formatDate     = (iso) => !iso ? '—' : new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatDateTime = (iso) => !iso ? '—' : new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const minutesAgo     = (iso) => !iso ? 0 : Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
export const todayISO       = () => new Date().toISOString().slice(0, 10);

// ============ VALIDATORS ============
export const validators = {
  nombre:   (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,}$/.test((v || '').trim()) || 'Mínimo 3 letras, solo texto',
  email:    (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '') || 'Email inválido',
  cedula:   (v) => /^\d{6,10}$/.test(v || '') || 'Cédula: 6 a 10 dígitos',
  telefono: (v) => /^3\d{9}$/.test(v || '') || 'Tel: 10 dígitos comenzando con 3',
  password: (v) => ((v || '').length >= 8 && /\d/.test(v || '')) || 'Mín. 8 caracteres y 1 número',
  usuario:  (v) => /^[a-z0-9_]{3,20}$/.test(v || '') || 'Usuario: 3-20 minúsculas/números',
};

// ============ CONSTANTS ============
export const DATA_VERSION              = '5';
export const APPROVAL_TIMEOUT_MINUTES  = 2;
export const APPROVAL_CANCEL_MINUTES   = 10;
export const MAX_DIAS_COMPENSADOS_AUTO = 4;
export const AVISO_INASISTENCIA_HORA   = 10;