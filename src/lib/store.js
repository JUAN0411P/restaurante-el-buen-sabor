import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './utils';

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
    const [
      { data: u },
      { data: m },
      { data: p },
      { data: s },
      { data: ms },
      { data: comensales },
      { data: o },
      { data: ev },
      { data: n },
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('menu').select('*'),
      supabase.from('planes').select('*'),
      supabase.from('suscriptores').select('*'),
      supabase.from('mesas').select('*'),
      supabase.from('comensales').select('*').is('left_at', null),
      supabase.from('orders').select('*'),
      supabase.from('events').select('*'),
      supabase.from('notifications').select('*'),
    ]);

    // ← CLAVE: inyectar comensales activos dentro de cada mesa
    const mesasConComensales = (ms ?? []).map(mesa => ({
      ...mesa,
      comensales: (comensales ?? []).filter(c => c.mesa_id === mesa.id),
    }));

    setUsers(u ?? []);
    setMenu(m ?? []);
    setPlanes(p ?? []);
    setSuscriptores(s ?? []);
    setMesas(mesasConComensales);
    setOrders(o ?? []);
    setEvents(ev ?? []);
    setNotifications(n ?? []);
  }, []);

  useEffect(() => {
    (async () => { await refresh(); setLoaded(true); })();

    const channel = supabase
      .channel('restaurante-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },        () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comensales' },    () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' },         () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' },        () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' },         () => refresh())
      .subscribe();

    channelRef.current = channel;
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [refresh]);

  return { users, menu, planes, suscriptores, mesas, orders, events, notifications, loaded, refresh };
}