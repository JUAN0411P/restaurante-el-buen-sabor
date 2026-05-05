import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, UtensilsCrossed, Users, Calendar, Shield, DollarSign,
  ChefHat, User, UserPlus, History, Soup
} from 'lucide-react';
import { T } from './lib/tokens';
import { db } from './lib/utils';
import { useStore } from './lib/store';
import { AuthScreen } from './components/auth/AuthScreen';
import { Layout } from './components/ui/Layout';
import { NotificationsPanel } from './components/ui/NotificationsPanel';
import { AdminPanel } from './components/admin/AdminPanel';
import { CajaPanel } from './components/caja/CajaPanel';
import { MeseroPanel } from './components/mesero/MeseroPanel';
import { CocinaPanel } from './components/cocina/CocinaPanel';
import { SuscriptorPanel } from './components/suscriptor/SuscriptorPanel';

// Navigation items per role
function useNavItems(roleType, counts) {
  return useMemo(() => {
    switch (roleType) {
      case 'admin':
        return [
          { id: 'dash', label: 'Dashboard', icon: TrendingUp },
          { id: 'menu', label: 'Menú', icon: UtensilsCrossed },
          { id: 'subs', label: 'Suscriptores', icon: Users, badge: counts.subsSinPlan },
          { id: 'planes', label: 'Planes', icon: Calendar },
          { id: 'users', label: 'Personal', icon: Shield },
        ];
      case 'caja':
        return [
          { id: 'cobros', label: 'Por cobrar', icon: DollarSign, badge: counts.porCobrar },
          { id: 'historial', label: 'Cobradas', icon: History },
          { id: 'activar', label: 'Activar plan', icon: UserPlus, badge: counts.subsSinPlan },
          { id: 'subs', label: 'Mensualidades', icon: Users },
        ];
      case 'mesero':
        return [{ id: 'mesas', label: 'Mesas', icon: UtensilsCrossed, badge: counts.alertasMesas }];
      case 'cocina':
        return [{ id: 'cola', label: 'Cola de cocina', icon: ChefHat, badge: counts.pendientesCocina }];
      case 'suscriptor':
        return [
          { id: 'resumen', label: 'Mi resumen', icon: User, badge: counts.aprobacionPendiente },
          { id: 'menu', label: 'Menú de hoy', icon: UtensilsCrossed },
          { id: 'calendar', label: 'Mi calendario', icon: Calendar },
          { id: 'historial', label: 'Historial', icon: History },
        ];
      default:
        return [];
    }
  }, [roleType, counts]);
}

export default function App() {
  const [role, setRole] = useState(null);
  const [activeTab, setActiveTab] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const store = useStore();

  // Try to restore session on mount
  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('rest:session') || 'null');
    if (!session) return;
    // La sesión se valida contra los datos ya cargados en el store
    // Se maneja abajo cuando store.loaded cambia
  }, []);

  useEffect(() => {
    if (role) localStorage.setItem('rest:session', JSON.stringify({ type: role.type, id: role.data.id }));
    else localStorage.removeItem('rest:session');
  }, [role]);
  // Agrega este useEffect para restaurar sesión una vez que el store cargue:
  useEffect(() => {
    if (!store.loaded || role) return;
    const session = JSON.parse(localStorage.getItem('rest:session') || 'null');
    if (!session) return;
    if (session.type === 'suscriptor') {
      const found = store.suscriptores.find(s => s.id === session.id && s.activo);
      if (found) setRole({ type: 'suscriptor', data: found });
    } else {
      const found = store.users.find(u => u.id === session.id && u.activo);
      if (found) setRole({ type: found.rol, data: found });
    }
  }, [store.loaded]);

  // Auto-refresh every 3 seconds when logged in (cross-role real-time sync)
  useEffect(() => {
    if (!role) return;
    const interval = setInterval(() => { store.refresh(); }, 3000);
    return () => clearInterval(interval);
  }, [role, store]);

  // Compute counts for badges
  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const porCobrar = store.orders.filter(o =>
      o.fecha?.slice(0, 10) === today && o.estado === 'entregado' && !o.pagado && o.tipo === 'menu'
    ).length;
    const subsSinPlan = store.suscriptores.filter(s => s.activo && !s.plan_id).length;
    const pendientesCocina = store.orders.filter(o => o.estado === 'pendiente' || o.estado === 'preparando').length;
    const alertasMesas = new Set(
      store.orders
        .filter(o => o.estado === 'esperando-aprobacion')
        .filter(o => (Date.now() - new Date(o.fecha).getTime()) / 60000 >= 2)
        .map(o => o.mesa)
    ).size;
    const aprobacionPendiente = role?.type === 'suscriptor'
      ? store.orders.filter(o => o.estado === 'esperando-aprobacion' && o.suscriptor?.id === role.data.id).length
      : 0;
    return { porCobrar, subsSinPlan, pendientesCocina, alertasMesas, aprobacionPendiente };
  }, [store.orders, store.suscriptores, role]);

  // Notifications relevant to this role
  const relevantNotifs = useMemo(() => {
    if (!role) return [];
    if (role.type === 'suscriptor') {
      return store.notifications.filter(n => n.suscriptor_id === role.data.id);
    }
    if (role.type === 'admin') {
      return store.notifications.filter(n =>
        n.tipo === 'nuevo-suscriptor' || n.tipo === 'solicitud-extension'
      );
    }
    return [];
  }, [store.notifications, role]);

  const unreadCount = relevantNotifs.filter(n => !n.leida).length;

  const navItems = useNavItems(role?.type, counts);

  // Set initial active tab when role changes
  useEffect(() => {
    if (role && navItems.length > 0 && !navItems.find(n => n.id === activeTab)) {
      setActiveTab(navItems[0].id);
    }
  }, [role, navItems, activeTab]);

  if (!store.loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg }}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 animate-pulse" style={{ backgroundColor: T.accent }}>
            <Soup size={28} color="#fff" />
          </div>
          <p className="text-sm" style={{ color: T.textSoft, fontFamily: 'Manrope' }}>Cargando…</p>
        </div>
      </div>
    );
  }

  if (!role) {
    return <AuthScreen onLogin={(r) => { setRole(r); }} />;
  }

  const handleLogout = () => { setRole(null); setActiveTab(''); };

  return (
    <>
      <Layout
        role={role}
        onLogout={handleLogout}
        navItems={navItems}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        notificationsCount={unreadCount}
        onOpenNotifications={relevantNotifs.length > 0 ? () => setShowNotifs(true) : null}>
        {role.type === 'admin' && (
          <AdminPanel
            activeTab={activeTab}
            menu={store.menu}
            planes={store.planes}
            suscriptores={store.suscriptores}
            orders={store.orders}
            mesas={store.mesas}
            users={store.users}
            events={store.events}
            refresh={store.refresh}
          />
        )}
        {role.type === 'caja' && (
          <CajaPanel
            activeTab={activeTab}
            menu={store.menu}
            planes={store.planes}
            suscriptores={store.suscriptores}
            orders={store.orders}
            mesas={store.mesas}
            refresh={store.refresh}
          />
        )}
        {role.type === 'mesero' && (
          <MeseroPanel
            activeTab={activeTab}
            user={role.data}
            menu={store.menu}
            mesas={store.mesas}
            suscriptores={store.suscriptores}
            orders={store.orders}
            refresh={store.refresh}
          />
        )}
        {role.type === 'cocina' && (
          <CocinaPanel
            orders={store.orders}
            mesas={store.mesas}
            refresh={store.refresh}
          />
        )}
        {role.type === 'suscriptor' && (
          <SuscriptorPanel
            activeTab={activeTab}
            user={role.data}
            menu={store.menu}
            planes={store.planes}
            suscriptores={store.suscriptores}
            orders={store.orders}
            events={store.events}
            refresh={store.refresh}
          />
        )}
      </Layout>
      <NotificationsPanel
        open={showNotifs}
        onClose={() => setShowNotifs(false)}
        notifications={relevantNotifs}
        refresh={store.refresh}
        canApprove={role.type === 'admin'}
      />
    </>
  );
}