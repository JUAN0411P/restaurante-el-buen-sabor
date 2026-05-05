import { useEffect, useState, useCallback, useRef } from 'react';
import { db, supabase } from './utils';
import {
  SEED_USERS, SEED_MENU, SEED_PLANES, SEED_SUSCRIPTORES,
  SEED_MESAS, SEED_EVENTS, SEED_NOTIFICATIONS
} from './seed';

export function useStore() {
  const [users, setUsers]               = useState([]);
  const [menu, setMenu]                 = useState([]);
  const [planes, setPlanes]             = useState([]);
  const [suscriptores, setSuscriptores] = useState([]);
  const [mesas, setMesas]               = useState([]);
  const [orders, setOrders]             = useState([]);
  const [events, setEvents]             = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loaded, setLoaded]             = useState(false);
  const channelRef                      = useRef(null);

  const refresh = useCallback(async () => {
    const [u, m, p, s, ms, o, ev, n] = await Promise.all([
      db.get('rest:users',         SEED_USERS),
      db.get('rest:menu',          SEED_MENU),
      db.get('rest:planes',        SEED_PLANES),
      db.get('rest:subs',          SEED_SUSCRIPTORES),
      db.get('rest:mesas',         SEED_MESAS),
      db.get('rest:orders',        []),
      db.get('rest:events',        SEED_EVENTS),
      db.get('rest:notifications', SEED_NOTIFICATIONS),
    ]);
    setUsers(u); setMenu(m); setPlanes(p); setSuscriptores(s);
    setMesas(ms); setOrders(o); setEvents(ev); setNotifications(n);
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoaded(true);
    })();

    // Realtime: escucha cambios en las tablas críticas (reemplaza el polling)
    const channel = supabase
      .channel('restaurante-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },        () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comensales' },    () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' },         () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' },        () => refresh())
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [refresh]);

  return {
    users, menu, planes, suscriptores, mesas, orders, events, notifications,
    loaded, refresh,
  };
}
