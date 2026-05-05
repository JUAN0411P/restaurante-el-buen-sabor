# 🗄️ Esquema de base de datos

Este documento contiene el esquema SQL sugerido para migrar de **localStorage** a un backend real.

Compatible con **PostgreSQL** y directamente usable en **Supabase** o **Neon**.

---

## 📐 Diagrama lógico

```
users ──┐
        ├─> [staff roles: admin/caja/mesero/cocina]
        └─> orders.mesero_id (quien toma el pedido)

suscriptores ──┐
               ├─> subscribed to a plan
               ├─> events (asistencia/aviso/inasistencia)
               ├─> notifications (recibe)
               └─> orders.suscriptor_id (su pedido)

planes ──> suscriptores.plan_id

mesas ──> comensales ──> orders
                         └─> items (jsonb)
```

---

## 🧱 Tablas

### `users` — Personal del restaurante

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  password_hash TEXT NOT NULL,                 -- bcrypt/argon2
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'caja', 'mesero', 'cocina')),
  activo BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_usuario ON users(usuario);
CREATE INDEX idx_users_rol ON users(rol) WHERE activo = true;
```

### `planes` — Planes de mensualidad

```sql
CREATE TABLE planes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  almuerzos INT NOT NULL CHECK (almuerzos > 0),
  precio NUMERIC(10, 2) NOT NULL CHECK (precio > 0),
  dias INT NOT NULL CHECK (dias > 0),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `suscriptores` — Clientes de mensualidad

```sql
CREATE TABLE suscriptores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,                 -- ej: SUB-1001
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cedula TEXT UNIQUE NOT NULL,
  telefono TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  plan_id UUID REFERENCES planes(id) ON DELETE SET NULL,
  almuerzos_restantes INT NOT NULL DEFAULT 0 CHECK (almuerzos_restantes >= 0),
  fecha_inicio DATE,
  fecha_vencimiento DATE,
  dias_extra_compensados INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  permitir_invitados BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subs_email ON suscriptores(email);
CREATE INDEX idx_subs_cedula ON suscriptores(cedula);
CREATE INDEX idx_subs_sin_plan ON suscriptores(id) WHERE plan_id IS NULL AND activo = true;
CREATE INDEX idx_subs_vencimiento ON suscriptores(fecha_vencimiento) WHERE activo = true;
```

### `menu` — Platos disponibles

```sql
CREATE TABLE menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10, 2) NOT NULL,
  disponibles INT NOT NULL DEFAULT 0 CHECK (disponibles >= 0),
  vendidos INT NOT NULL DEFAULT 0,
  categoria TEXT NOT NULL DEFAULT 'Plato fuerte'
    CHECK (categoria IN ('Plato fuerte', 'Sopa', 'Bebida', 'Postre')),
  activo BOOLEAN NOT NULL DEFAULT true
);
```

### `mesas` — Mesas físicas del restaurante

```sql
CREATE TABLE mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INT UNIQUE NOT NULL CHECK (numero > 0),
  capacidad INT DEFAULT 4
);
```

### `comensales` — Clientes sentados en una mesa (sesión temporal)

```sql
CREATE TABLE comensales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_id UUID NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('suscripcion', 'menu', 'invitado')),
  suscriptor_id UUID REFERENCES suscriptores(id) ON DELETE SET NULL,  -- null para 'menu'
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ                           -- cuando abandona la mesa
);

CREATE INDEX idx_comensales_mesa_active ON comensales(mesa_id) WHERE left_at IS NULL;
```

### `orders` — Pedidos (con flujo de aprobación)

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comensal_id UUID NOT NULL REFERENCES comensales(id),
  mesa_numero INT NOT NULL,
  mesero_id UUID NOT NULL REFERENCES users(id),
  suscriptor_id UUID REFERENCES suscriptores(id),     -- null para 'menu'
  tipo TEXT NOT NULL CHECK (tipo IN ('suscripcion', 'menu', 'plan')),
  es_invitado BOOLEAN NOT NULL DEFAULT false,
  items JSONB NOT NULL,                                -- [{id, nombre, cantidad, precio}]
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN (
      'esperando-aprobacion',  -- nuevo: pedido de suscripcion/invitado sin aprobar
      'rechazado',             -- nuevo: suscriptor rechazó
      'cancelado-timeout',     -- nuevo: 10min sin aprobar → auto-cancel
      'pendiente',             -- en cola de cocina
      'preparando',            -- cocinero empezó
      'listo',                 -- listo para entregar
      'entregado'              -- mesero entregó
    )),
  pagado BOOLEAN NOT NULL DEFAULT false,
  metodo_pago TEXT CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aprobado_en TIMESTAMPTZ,
  rechazado_en TIMESTAMPTZ,
  cancelado_en TIMESTAMPTZ,
  fecha_preparando TIMESTAMPTZ,
  fecha_listo TIMESTAMPTZ,
  fecha_entrega TIMESTAMPTZ,
  fecha_pago TIMESTAMPTZ
);

-- Índices críticos para performance en producción
CREATE INDEX idx_orders_estado ON orders(estado, fecha);
CREATE INDEX idx_orders_suscriptor ON orders(suscriptor_id, fecha);
CREATE INDEX idx_orders_mesero_dia ON orders(mesero_id, fecha);
CREATE INDEX idx_orders_pendiente_fifo ON orders(tipo, fecha) WHERE estado IN ('pendiente', 'preparando');
CREATE INDEX idx_orders_esperando ON orders(fecha) WHERE estado = 'esperando-aprobacion';
```

### `events` — Calendario de asistencia/inasistencia (NUEVA)

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suscriptor_id UUID NOT NULL REFERENCES suscriptores(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'asistencia',              -- verde: consumió almuerzo
    'inasistencia-sin-aviso',  -- rojo: no vino
    'aviso-inasistencia',      -- amarillo: avisó antes 10am
    'reprogramado',            -- morado: compensado especial
    'habilitado'               -- azul claro: día hábil dentro del plan
  )),
  hora TIME,                                     -- para avisos
  order_id UUID REFERENCES orders(id),           -- link al pedido si es asistencia
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (suscriptor_id, fecha)                  -- un solo evento por día
);

CREATE INDEX idx_events_suscriptor_fecha ON events(suscriptor_id, fecha DESC);
```

### `notifications` — Panel de notificaciones (NUEVA)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'nuevo-suscriptor',
    'solicitud-extension',
    'aviso-inasistencia',
    'pedido-aprobado',
    'pedido-rechazado',
    'pedido-pendiente',
    'aviso-general'
  )),
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT false,
  suscriptor_id UUID REFERENCES suscriptores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  accion JSONB,                                  -- {label, type, payload}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_suscriptor_unread ON notifications(suscriptor_id, created_at DESC) WHERE leida = false;
CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC) WHERE leida = false;
```

---

## 🔐 Row Level Security (Supabase)

```sql
ALTER TABLE suscriptores ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Suscriptor solo ve sus propios datos
CREATE POLICY "suscriptor_self" ON suscriptores
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "suscriptor_own_orders" ON orders
  FOR SELECT USING (suscriptor_id = auth.uid());

CREATE POLICY "suscriptor_own_notifications" ON notifications
  FOR SELECT USING (suscriptor_id = auth.uid());

-- Staff puede ver todo
CREATE POLICY "staff_all_subs" ON suscriptores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND activo = true)
  );
```

---

## 🔄 Triggers automáticos útiles

### Auto-cancelar pedidos tras 10 minutos sin aprobar

```sql
CREATE OR REPLACE FUNCTION cancel_stale_orders()
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET estado = 'cancelado-timeout', cancelado_en = NOW()
  WHERE estado = 'esperando-aprobacion'
    AND fecha < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Ejecutar cada minuto con pg_cron (Supabase lo trae built-in):
SELECT cron.schedule('cancel-stale-orders', '* * * * *', 'SELECT cancel_stale_orders()');
```

### Descontar almuerzo al aprobar pedido

```sql
CREATE OR REPLACE FUNCTION on_order_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'pendiente' AND OLD.estado = 'esperando-aprobacion' THEN
    UPDATE suscriptores
    SET almuerzos_restantes = GREATEST(0, almuerzos_restantes - 1)
    WHERE id = NEW.suscriptor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_approved
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION on_order_approved();
```

### Registrar asistencia al entregar

```sql
CREATE OR REPLACE FUNCTION on_order_delivered()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'entregado' AND OLD.estado <> 'entregado'
     AND NEW.tipo = 'suscripcion' AND NEW.suscriptor_id IS NOT NULL THEN
    INSERT INTO events (suscriptor_id, fecha, tipo, order_id)
    VALUES (NEW.suscriptor_id, CURRENT_DATE, 'asistencia', NEW.id)
    ON CONFLICT (suscriptor_id, fecha) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_delivered
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION on_order_delivered();
```

---

## 📡 Realtime con Supabase

Habilita replication para que los cambios se propaguen entre dispositivos:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE comensales;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
```

Y en el frontend:
```javascript
supabase
  .channel('orders-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
      (payload) => refresh())
  .subscribe();
```

Con esto **eliminas el `setInterval(refresh, 3000)` del App.jsx** y los cambios son instantáneos (sub-segundo).

---

## 🔄 Plan de migración desde localStorage

1. Reemplaza el archivo `src/lib/utils.js` → las funciones `db.get/set/del` ahora llaman a la API de Supabase
2. Reemplaza `src/lib/store.js` → usa Realtime subscriptions en vez de polling
3. Todos los componentes siguen funcionando sin cambios (misma interfaz)

Es una arquitectura intencionalmente **agnóstica al backend**: toda la lógica de datos pasa por `db.*`, así que solo tocas un archivo.
