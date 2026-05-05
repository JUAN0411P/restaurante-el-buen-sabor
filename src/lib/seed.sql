-- ============================================================
-- SEED INICIAL — El Buen Sabor
-- Ejecuta esto en Supabase > SQL Editor una sola vez
-- ============================================================

-- Personal del restaurante
INSERT INTO users (id, usuario, nombre, password_hash, rol, activo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin',    'Administrador General', 'dh_6bca2f56_8',  'admin',  true),
  ('00000000-0000-0000-0000-000000000002', 'caja1',    'Sandra López',          'dh_5ca94523_7',  'caja',   true),
  ('00000000-0000-0000-0000-000000000003', 'mesero1',  'Juan Pérez',            'dh_7ab1c2e4_9',  'mesero', true),
  ('00000000-0000-0000-0000-000000000004', 'mesero2',  'Laura Vargas',          'dh_7ab1c2e4_9',  'mesero', true),
  ('00000000-0000-0000-0000-000000000005', 'cocina1',  'Doña Rosa',             'dh_8cd3f1a2_9',  'cocina', true)
ON CONFLICT (id) DO NOTHING;

-- NOTA: Las contraseñas reales se calculan con hashPw() del frontend.
-- Para obtenerlas, abre la consola del navegador en la app demo y ejecuta:
--   import { hashPw } from './src/lib/utils_local.js'  (versión localStorage)
--   hashPw('admin123')   → copia el resultado y pégalo aquí

-- Planes de mensualidad
INSERT INTO planes (id, nombre, almuerzos, precio, dias, activo) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Plan 20 Almuerzos',         20, 240000, 30, true),
  ('10000000-0000-0000-0000-000000000002', 'Plan 30 Almuerzos',         30, 330000, 30, true),
  ('10000000-0000-0000-0000-000000000003', 'Plan Ejecutivo Quincenal',  15, 195000, 15, true)
ON CONFLICT (id) DO NOTHING;

-- Menú del día
INSERT INTO menu (id, nombre, descripcion, precio, disponibles, vendidos, categoria) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Bandeja Paisa',     'Frijoles, arroz, carne, chicharrón, huevo, plátano', 22000, 15, 0, 'Plato fuerte'),
  ('20000000-0000-0000-0000-000000000002', 'Sancocho de Gallina','Sopa tradicional con yuca, plátano y mazorca',      18000, 12, 0, 'Sopa'),
  ('20000000-0000-0000-0000-000000000003', 'Trucha al Ajillo',  'Trucha fresca con arroz, ensalada y patacón',       25000,  8, 0, 'Plato fuerte'),
  ('20000000-0000-0000-0000-000000000004', 'Pollo Sudado',      'Pollo en salsa criolla con arroz y papa',           16000, 20, 0, 'Plato fuerte'),
  ('20000000-0000-0000-0000-000000000005', 'Jugo Natural',      'Mora, lulo, maracuyá o guanábana',                   4000, 50, 0, 'Bebida'),
  ('20000000-0000-0000-0000-000000000006', 'Postre del día',    'Arroz con leche o gelatina',                         5000, 30, 0, 'Postre')
ON CONFLICT (id) DO NOTHING;

-- Mesas (1–15)
INSERT INTO mesas (id, numero) VALUES
  ('30000000-0000-0000-0000-000000000001',  1), ('30000000-0000-0000-0000-000000000002',  2),
  ('30000000-0000-0000-0000-000000000003',  3), ('30000000-0000-0000-0000-000000000004',  4),
  ('30000000-0000-0000-0000-000000000005',  5), ('30000000-0000-0000-0000-000000000006',  6),
  ('30000000-0000-0000-0000-000000000007',  7), ('30000000-0000-0000-0000-000000000008',  8),
  ('30000000-0000-0000-0000-000000000009',  9), ('30000000-0000-0000-0000-000000000010', 10),
  ('30000000-0000-0000-0000-000000000011', 11), ('30000000-0000-0000-0000-000000000012', 12),
  ('30000000-0000-0000-0000-000000000013', 13), ('30000000-0000-0000-0000-000000000014', 14),
  ('30000000-0000-0000-0000-000000000015', 15)
ON CONFLICT (id) DO NOTHING;

-- Habilitar Realtime en tablas críticas
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE comensales;
ALTER PUBLICATION supabase_realtime ADD TABLE mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- Job automático: cancelar pedidos sin aprobar tras 10 min (requiere pg_cron)
SELECT cron.schedule('cancel-stale-orders', '* * * * *', 'SELECT cancel_stale_orders()');
