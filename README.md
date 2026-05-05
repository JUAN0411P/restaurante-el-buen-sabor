# 🍲 El Buen Sabor - Sistema de Restaurante v2.0

Sistema completo de gestión de restaurante con **mensualidades**, **menú del día**, **invitados autorizados**, **flujo de aprobación de pedidos**, **cola FIFO en cocina** y **panel de notificaciones**.

## 📋 Novedades de esta versión

### ✅ Problemas resueltos del feedback anterior

1. **Flujo de aprobación del suscriptor** — El mesero ya no puede enviar pedidos a cocina a nombre de un suscriptor sin su aprobación. El pedido pasa por estos estados:
   - `esperando-aprobacion` → suscriptor recibe notificación
   - A los **2 minutos sin aprobar**: el mesero ve alerta + mesa parpadea en rojo
   - A los **10 minutos sin aprobar**: el pedido se **cancela automáticamente** y se notifica al suscriptor
   - Si el suscriptor aprueba: pasa a `pendiente` y aparece en cocina
   - Si el suscriptor rechaza: queda como `rechazado` (no se cobra, no va a cocina)
   - **Los invitados también requieren aprobación del titular**

2. **Caja activa planes a suscriptores registrados** — Nueva pestaña "Activar plan" para suscriptores que se registraron pero aún no tienen plan asignado. Ya no hay duplicados.

3. **Admin robusto** — Doble clic en un suscriptor abre modal con:
   - 📅 Calendario visual con códigos de color (asistió, no asistió, avisado, reprogramado)
   - 💰 Historial de pagos
   - ⏰ Avisos de inasistencia
   - ➕ Botón "Compensar 1 día" (hasta 4 días automáticos, más requieren aprobación)

4. **CRUD de planes** — Pestaña dedicada para crear, editar, pausar y eliminar planes.

5. **Cocina con cola FIFO estricta** — Las tarjetas:
   - Muestran posición (#1, #2, #3...)
   - **Solo la posición #1 habilita botones de acción**
   - Los siguientes pedidos aparecen **bloqueados** (con opción "ver anticipadamente solo lectura")
   - Tags visibles: `Plan mensual`, `Invitado`, `Cliente del día`, `Prioritario`
   - Dos columnas separadas: Mensualidad y Menú del día

6. **Mesero con sidebar** — Reemplazamos los botones "atrás" con navegación por sidebar y flujo claro:
   `Mesas → Mesa → Agregar comensal → Tomar pedido → Confirmación/Aprobación`

7. **Panel de notificaciones global** — Campana en header con contador, modal para ver y gestionar.

8. **Liberación automática de mesas** — Al pagar en caja, si un cliente del menú ya pagó todo, se libera automáticamente de la mesa.

9. **Integración en tiempo real** — La app se auto-refresca cada 3 segundos para sincronizar cambios entre roles (ej: mesero ve instantáneamente cuando suscriptor aprueba).

10. **Compensación inteligente de días** — Suscriptor puede avisar antes de 10 AM que no asistirá. Admin puede compensar hasta 4 días automáticamente; más requieren solicitud de extensión.

---

## 🏗️ Arquitectura modular

```
src/
├── App.jsx                          # Orquestador raíz
├── main.jsx                         # Entry point
├── index.css                        # Estilos + animaciones
├── lib/
│   ├── tokens.js                    # Paleta de colores
│   ├── utils.js                     # db, hash, validators, constantes
│   ├── seed.js                      # Datos iniciales demo
│   └── store.js                     # Hook de estado compartido
└── components/
    ├── ui/
    │   ├── primitives.jsx           # Btn, Card, Tag, Modal, Input…
    │   ├── Layout.jsx               # Sidebar + header
    │   ├── AttendanceCalendar.jsx   # Calendario con códigos de color
    │   └── NotificationsPanel.jsx   # Campana + helper crearNotificacion
    ├── auth/AuthScreen.jsx          # Login staff + suscriptor + registro
    ├── admin/
    │   ├── AdminPanel.jsx           # Dashboard, menú, subs, users
    │   ├── AdminModals.jsx          # Formularios de usuario, menú, sub
    │   ├── PlanesManager.jsx        # CRUD planes
    │   └── SubscriberDetailModal.jsx # Detalle de suscriptor con calendario
    ├── caja/CajaPanel.jsx           # Cobros + historial + activar plan + subs
    ├── mesero/
    │   ├── MesasGrid.jsx            # Grilla con alertas
    │   ├── MesaDetalle.jsx          # Lista de comensales y pedidos
    │   ├── AgregarComensalFlow.jsx  # Flujo multi-nivel de agregar comensal
    │   ├── TomarPedido.jsx          # Selección de platos
    │   └── MeseroPanel.jsx          # Orquestador + vigilancia de timeouts
    ├── cocina/CocinaPanel.jsx       # Cola FIFO estricta
    └── suscriptor/SuscriptorPanel.jsx # Aprobación + calendario + perfil
```

---

## 🚀 Instalación

### Requisitos
- Node.js 18 o superior ([descargar](https://nodejs.org))
- Un navegador moderno

### Pasos (Windows / Mac / Linux)

1. **Descomprime el proyecto** en una carpeta.

2. **Abre PowerShell / Terminal en esa carpeta** (en VS Code: `Ctrl + ñ`).

3. **Instala las dependencias:**
   ```bash
   npm install
   ```

4. **Ejecuta el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

5. Abre tu navegador en **http://localhost:5173**

### 💡 Problema común en Windows con PowerShell
Si ves un error de "scripts deshabilitados", ejecuta una sola vez:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Y responde "S" (Sí).

---

## 🧪 Cuentas de prueba

### Personal
| Rol | Usuario | Contraseña |
|-----|---------|------------|
| Admin | `admin` | `admin123` |
| Caja | `caja1` | `caja123` |
| Mesero | `mesero1` | `mesero123` |
| Mesero 2 | `mesero2` | `mesero123` |
| Cocina | `cocina1` | `cocina123` |

### Suscriptores
| Email | Contraseña | Estado |
|-------|-----------|--------|
| `maria@email.com` | `test1234` | ✅ Con plan, autoriza invitados |
| `carlos@email.com` | `test1234` | ✅ Con plan, no invitados |
| `ana@email.com` | `test1234` | ⚠️ Quedan pocos almuerzos |
| `pedro@email.com` | `test1234` | ❌ **Sin plan** (para probar activación desde caja) |

---

## 🎬 Flujo recomendado para probar

### Prueba 1: Activar plan a suscriptor registrado
1. Entra como **caja1** → pestaña **"Activar plan"**
2. Haz clic en **Activar plan** en la tarjeta de Pedro Ruiz
3. Elige un plan y método de pago → confirma
4. Pedro ahora tiene plan activo

### Prueba 2: Flujo completo de aprobación (el cambio grande)
1. Entra como **mesero1** → mesa 4 → **Agregar comensal**
2. Elige **"Cliente con mensualidad"** → selecciona a **María**
3. Toma el pedido de **Bandeja Paisa + Jugo** → **Enviar para aprobación**
4. **Abre otra pestaña** del navegador (o ventana privada) y entra como **maria@email.com**
5. Verás arriba una tarjeta amarilla "Pedidos esperando tu aprobación" con botones **Aprobar** / **Rechazar**
6. Aprueba → se descuenta 1 almuerzo
7. Entra como **cocina1** → verás el pedido en la columna **Mensualidad** en posición #1
8. Empezar → Listo → vuelve al mesero y marca **Entregado**
9. Vuelve a María → verás el día de hoy marcado en verde en su calendario (asistencia)

### Prueba 3: Timeout automático
1. Como mesero, toma un pedido de mensualidad igual que antes
2. **No apruebes desde el suscriptor**
3. Espera 2 minutos → verás alerta flotante al mesero + la mesa parpadea en rojo
4. A los 10 minutos → el pedido se cancela automáticamente
5. El suscriptor recibe notificación de cancelación

### Prueba 4: Invitado (también requiere aprobación)
1. Con María logueada en mesa, agrega otro comensal como **Invitado de María**
2. Envía pedido → María también debe aprobarlo
3. Al aprobar, se descuenta otro almuerzo del plan de María

### Prueba 5: Compensación de días
1. Entra como María antes de las 10:00 AM y haz clic en **"Avisar inasistencia"**
2. Entra como **admin** → pestaña Suscriptores → doble clic en María
3. Verás la pestaña "Avisos" con el aviso registrado
4. En la pestaña Calendario, haz clic en **"Compensar 1 día"** → el plan se extiende +1 día y +1 almuerzo

---

## 🌐 Despliegue en producción

### Vercel (recomendado, gratis)
```bash
npm run build
# Luego sube la carpeta 'dist' a Vercel:
# npx vercel --prod
```

### Netlify
1. Arrastra la carpeta `dist` a [app.netlify.com](https://app.netlify.com/drop)

### GitHub Pages
```bash
npm install -D gh-pages
# Agrega "homepage": "https://tu-usuario.github.io/repo" en package.json
# Agrega en scripts: "deploy": "gh-pages -d dist"
npm run build && npm run deploy
```

---

## ⚠️ Importante para producción real

Esta versión usa **localStorage** (persistencia en el navegador). Es perfecta para:
- Demo, pruebas, un solo dispositivo
- Validación del flujo con el equipo del restaurante

**Para producción con múltiples dispositivos** (cajero en PC, meseros en tablets, etc.) necesitas:

1. **Backend con API real** (Supabase, Firebase, o Node+Postgres)
2. **WebSockets / Realtime** para que los cambios se propaguen instantáneamente
3. **Autenticación segura** (JWT, bcrypt server-side)

Revisa `DATABASE.md` para el esquema SQL listo para Supabase/PostgreSQL.

---

## 🎨 Diseño

- **Tipografías**: Fraunces (serif, headers) + Manrope (sans, cuerpo)
- **Paleta**: Terracota (`#C2563E`), crema, verde oliva, ámbar
- **Modo**: Solo claro (por ahora)
- **Iconos**: lucide-react
- **Animaciones**: CSS custom (pulse-warn, blink-urgent, slide-in)

---

## 🐛 Resetear datos

Si quieres volver a los datos demo originales:
1. Entra como **admin**
2. Arriba a la derecha: **"Restaurar demo"**

O alternativamente, abre la consola del navegador (`F12`) y ejecuta:
```javascript
localStorage.clear(); location.reload();
```

---

## 📞 Soporte

Si encuentras un bug, usa el botón 👎 de abajo en cualquier respuesta de Claude para reportarlo directamente a Anthropic con contexto.

¡Buen provecho! 🍲
