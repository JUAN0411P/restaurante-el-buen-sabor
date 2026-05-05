import { useEffect, useState } from 'react';
import { User, Lock, Mail, Hash, Phone } from 'lucide-react';
import { T } from '../../lib/tokens';
import { db, hashPw, validators, formatMoney } from '../../lib/utils';
import { Modal, Btn, Input, Select } from '../ui/primitives';

// ========== STAFF USER FORM ==========
export function UserFormModal({ open, onClose, user, users, refresh }) {
  const [form, setForm] = useState({ usuario: '', nombre: '', password: '', rol: 'mesero' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) setForm({ usuario: user.usuario, nombre: user.nombre, password: '', rol: user.rol });
    else setForm({ usuario: '', nombre: '', password: '', rol: 'mesero' });
    setErrors({});
  }, [user, open]);

  const guardar = async () => {
    const e = {};
    if (validators.usuario(form.usuario) !== true) e.usuario = validators.usuario(form.usuario);
    if (validators.nombre(form.nombre) !== true) e.nombre = validators.nombre(form.nombre);
    if (!user && validators.password(form.password) !== true) e.password = validators.password(form.password);
    if (form.password && validators.password(form.password) !== true) e.password = validators.password(form.password);
    if (!user && users.find(u => u.usuario.toLowerCase() === form.usuario.toLowerCase())) e.usuario = 'Usuario ya existe';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    if (user) {
      const updated = users.map(u => u.id === user.id ? {
        ...u,
        usuario: form.usuario,
        nombre: form.nombre,
        rol: form.rol,
        password: form.password ? hashPw(form.password) : u.password,
      } : u);
      await db.set('rest:users', updated);
    } else {
      await db.set('rest:users', [...users, {
        id: `u${Date.now()}`,
        usuario: form.usuario.toLowerCase(),
        nombre: form.nombre,
        password: hashPw(form.password),
        rol: form.rol,
        activo: true,
        createdAt: new Date().toISOString(),
      }]);
    }
    onClose();
    refresh();
  };

  return (
    <Modal open={open} onClose={onClose} title={user ? 'Editar usuario' : 'Nuevo usuario'}>
      <div className="space-y-3">
        <Input label="Usuario" value={form.usuario} onChange={(v) => setForm({ ...form, usuario: v })} icon={User} error={errors.usuario} hint="3-20 caracteres, minúsculas y números" />
        <Input label="Nombre completo" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} error={errors.nombre} />
        <Input label={user ? 'Nueva contraseña (vacío = mantener)' : 'Contraseña'} type="password"
          value={form.password} onChange={(v) => setForm({ ...form, password: v })} icon={Lock} error={errors.password} />
        <Select label="Rol" value={form.rol} onChange={(v) => setForm({ ...form, rol: v })}
          options={[
            { value: 'admin', label: 'Administrador' },
            { value: 'caja', label: 'Caja' },
            { value: 'mesero', label: 'Mesero' },
            { value: 'cocina', label: 'Cocina' }
          ]} />
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={guardar}>{user ? 'Guardar cambios' : 'Crear usuario'}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ========== MENU ITEM FORM ==========
export function MenuItemFormModal({ open, onClose, item, menu, refresh }) {
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: 0, disponibles: 10, categoria: 'Plato fuerte' });

  useEffect(() => {
    if (item) setForm(item);
    else setForm({ nombre: '', descripcion: '', precio: 0, disponibles: 10, categoria: 'Plato fuerte' });
  }, [item, open]);

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    if (item?.id) {
      await db.set('rest:menu', menu.map(m => m.id === item.id ? form : m));
    } else {
      await db.set('rest:menu', [...menu, { ...form, id: `m${Date.now()}`, vendidos: 0 }]);
    }
    onClose();
    refresh();
  };

  return (
    <Modal open={open} onClose={onClose} title={item?.id ? 'Editar plato' : 'Nuevo plato'}>
      <div className="space-y-3">
        <Input label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
        <Input label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Precio" type="number" value={form.precio} onChange={(v) => setForm({ ...form, precio: +v })} />
          <Input label="Disponibles" type="number" value={form.disponibles} onChange={(v) => setForm({ ...form, disponibles: +v })} />
        </div>
        <Select label="Categoría" value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v })}
          options={[
            { value: 'Plato fuerte', label: 'Plato fuerte' },
            { value: 'Sopa', label: 'Sopa' },
            { value: 'Bebida', label: 'Bebida' },
            { value: 'Postre', label: 'Postre' },
          ]} />
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={guardar}>Guardar</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ========== SUBSCRIBER FORM (create) ==========
export function NewSubModal({ open, onClose, suscriptores, refresh }) {
  const [form, setForm] = useState({ nombre: '', email: '', cedula: '', telefono: '', password: '' });
  const [errors, setErrors] = useState({});

  const guardar = async () => {
    const e = {};
    ['nombre', 'email', 'cedula', 'telefono', 'password'].forEach(k => {
      const r = validators[k](form[k] || ''); if (r !== true) e[k] = r;
    });
    if (suscriptores.find(s => s.email?.toLowerCase() === form.email.toLowerCase())) e.email = 'Email ya registrado';
    if (suscriptores.find(s => s.cedula === form.cedula)) e.cedula = 'Cédula ya registrada';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const nuevo = {
      id: `s${Date.now()}`,
      codigo: `SUB-${1000 + suscriptores.length + 1}`,
      nombre: form.nombre.trim(),
      email: form.email.toLowerCase(),
      cedula: form.cedula,
      telefono: form.telefono,
      password: hashPw(form.password),
      plan: null,
      almuerzosRestantes: 0,
      fechaInicio: null,
      fechaVencimiento: null,
      diasExtraCompensados: 0,
      activo: true,
      permitirInvitados: false,
      createdAt: new Date().toISOString(),
    };
    await db.set('rest:subs', [...suscriptores, nuevo]);
    setForm({ nombre: '', email: '', cedula: '', telefono: '', password: '' });
    setErrors({});
    onClose();
    refresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Crear suscriptor (sin plan)">
      <div className="space-y-3">
        <p className="text-xs p-3 rounded-lg" style={{ backgroundColor: T.blueSoft, color: T.blue }}>
          Este formulario solo crea la cuenta. El plan se activa después en Caja.
        </p>
        <Input label="Nombre completo" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} icon={User} error={errors.nombre} />
        <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} icon={Mail} error={errors.email} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Cédula" value={form.cedula} onChange={(v) => setForm({ ...form, cedula: v })} icon={Hash} error={errors.cedula} />
          <Input label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} icon={Phone} error={errors.telefono} />
        </div>
        <Input label="Contraseña inicial" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} icon={Lock} error={errors.password} />
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={guardar}>Registrar</Btn>
        </div>
      </div>
    </Modal>
  );
}
