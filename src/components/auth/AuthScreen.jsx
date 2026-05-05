import { useState } from 'react';
import {
  Soup, User, Lock, Mail, Hash, Phone, AlertCircle, ArrowLeft, Leaf
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { db, hashPw, validators } from '../../lib/utils';
import { Btn, Card, Input, KickerLabel } from '../ui/primitives';

function StaffLogin({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    const users = await db.get('rest:users', []);
    const user = users.find(u => u.usuario.toLowerCase() === usuario.toLowerCase() && u.activo);
    if (!user) { setError('Usuario no encontrado o inactivo'); setLoading(false); return; }
    if (user.passwordHash !== hashPw(password)) { setError('Contraseña incorrecta'); setLoading(false); return; }
    await db.set('rest:users', users.map(u => u.id === user.id ? { ...u, last_login: new Date().toISOString() } : u));
    onLogin({ type: user.rol, data: user });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Input label="Usuario" value={usuario} onChange={setUsuario} placeholder="admin" icon={User} />
      <Input label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="••••••••" icon={Lock} />
      {error && (
        <div style={{ padding: 10, borderRadius: 10, background: T.redSoft, color: T.red, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} />{error}
        </div>
      )}
      <Btn full size="lg" onClick={handleSubmit} disabled={!usuario || !password || loading}>
        {loading ? 'Verificando…' : 'Ingresar →'}
      </Btn>
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: T.bgSoft,
          fontSize: 11,
          color: T.textSoft,
          ...FontMono,
        }}
      >
        <div style={{ color: T.text, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.1em' }}>
          // demo
        </div>
        admin / admin123 · caja1 / caja123<br />
        mesero1 / mesero123 · cocina1 / cocina123
      </div>
    </div>
  );
}

function SubLogin({ onLogin, onRegister }) {
  const [identificador, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    const subs = await db.get('rest:subs', []);
    const sub = subs.find(s => (
      s.email?.toLowerCase() === identificador.toLowerCase() ||
      s.cedula === identificador ||
      s.codigo?.toLowerCase() === identificador.toLowerCase()
    ) && s.activo);
    if (!sub) { setError('No se encontró ningún suscriptor con ese dato'); return; }
    if (sub.password !== hashPw(password)) { setError('Contraseña incorrecta'); return; }
    onLogin({ type: 'suscriptor', data: sub });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Input label="Email, cédula o código" value={identificador} onChange={setId} placeholder="maria@email.com" icon={Mail} />
      <Input label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="••••••••" icon={Lock} />
      {error && (
        <div style={{ padding: 10, borderRadius: 10, background: T.redSoft, color: T.red, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} />{error}
        </div>
      )}
      <Btn full size="lg" onClick={handleSubmit} disabled={!identificador || !password}>Ingresar →</Btn>
      <div style={{ textAlign: 'center', paddingTop: 4 }}>
        <button onClick={onRegister} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.terracotta, fontSize: 13, fontWeight: 500 }}>
          ¿No tienes cuenta? Regístrate aquí →
        </button>
      </div>
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: T.bgSoft,
          fontSize: 11,
          color: T.textSoft,
          ...FontMono,
        }}
      >
        <div style={{ color: T.text, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.1em' }}>
          // demo
        </div>
        maria@email.com / test1234
      </div>
    </div>
  );
}

function SubRegister({ onBack, onSuccess }) {
  const [form, setForm] = useState({ nombre: '', email: '', cedula: '', telefono: '', password: '', password2: '', acepta: false });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async () => {
    setSubmitError('');
    const e = {};
    ['nombre', 'email', 'cedula', 'telefono', 'password'].forEach(k => {
      const r = validators[k](form[k]);
      if (r !== true) e[k] = r;
    });
    if (form.password !== form.password2) e.password2 = 'Las contraseñas no coinciden';
    if (!form.acepta) e.acepta = 'Debes aceptar los términos';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const subs = await db.get('rest:subs', []);
    if (subs.find(s => s.email?.toLowerCase() === form.email.toLowerCase())) {
      setSubmitError('Ya existe una cuenta con ese email'); return;
    }
    if (subs.find(s => s.cedula === form.cedula)) {
      setSubmitError('Ya existe una cuenta con esa cédula'); return;
    }

    const newSub = {
      id: `s${Date.now()}`,
      codigo: `SUB-${1000 + subs.length + 1}`,
      nombre: form.nombre.trim(),
      email: form.email.toLowerCase(),
      cedula: form.cedula,
      telefono: form.telefono,
      password: hashPw(form.password),
      plan_id: null,
      almuerzos_restantes: 0,
      fecha_inicio: null,
      fecha_vencimiento: null,
      dias_extra_compensados: 0,
      activo: true,
      permitir_invitados: false,
      created_at: new Date().toISOString(),
    };
    await db.set('rest:subs', [...subs, newSub]);

    const notifs = await db.get('rest:notifications', []);
    await db.set('rest:notifications', [...notifs, {
      id: `n${Date.now()}`,
      tipo: 'nuevo-suscriptor',
      leida: false,
      titulo: 'Nuevo suscriptor registrado',
      mensaje: `${newSub.nombre} se registró y espera activar su plan`,
      suscriptorId: newSub.id,
      created_at: new Date().toISOString(),
    }]);

    onSuccess({ type: 'suscriptor', data: newSub });
  };

  return (
    <Card padding={24}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSoft, fontSize: 12, marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <ArrowLeft size={12} /> Volver al login
      </button>
      <h2 style={{ ...FontFraunces, fontSize: 28, color: T.text, margin: 0, marginBottom: 6 }}>Crea tu cuenta</h2>
      <p style={{ fontSize: 12, color: T.textSoft, marginBottom: 20 }}>
        Tras registrarte, acércate a caja con tu cédula para activar tu plan
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Nombre completo" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} icon={User} error={errors.nombre} />
        <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} icon={Mail} error={errors.email} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Cédula" value={form.cedula} onChange={(v) => setForm({ ...form, cedula: v })} icon={Hash} error={errors.cedula} />
          <Input label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} icon={Phone} error={errors.telefono} />
        </div>
        <Input label="Contraseña" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} icon={Lock} error={errors.password} hint="Mín. 8 caracteres y 1 número" />
        <Input label="Confirmar contraseña" type="password" value={form.password2} onChange={(v) => setForm({ ...form, password2: v })} icon={Lock} error={errors.password2} />
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', paddingTop: 4 }}>
          <input
            type="checkbox"
            checked={form.acepta}
            onChange={(e) => setForm({ ...form, acepta: e.target.checked })}
            style={{ marginTop: 2 }}
          />
          <span style={{ fontSize: 12, color: T.textSoft }}>Acepto los términos y el tratamiento de datos personales</span>
        </label>
        {errors.acepta && <p style={{ fontSize: 12, color: T.red }}>{errors.acepta}</p>}
        {submitError && (
          <div style={{ padding: 10, borderRadius: 10, background: T.redSoft, color: T.red, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={13} />{submitError}
          </div>
        )}
        <Btn full size="lg" onClick={handleSubmit}>Registrarme →</Btn>
      </div>
    </Card>
  );
}

export function AuthScreen({ onLogin }) {
  const [view, setView] = useState('login');
  const [tab, setTab] = useState('staff');

  if (view === 'register') {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, padding: '40px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 480, marginTop: 20 }}>
          <SubRegister onBack={() => setView('login')} onSuccess={onLogin} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        display: 'grid',
        gridTemplateColumns: '1.05fr 1fr',
      }}
      className="lg:grid lg:grid-cols-[1.05fr_1fr] grid-cols-1"
    >
      {/* LEFT — Editorial olive panel */}
      <div
        className="hidden lg:flex"
        style={{
          padding: '60px 56px',
          background: `linear-gradient(180deg, ${T.olive} 0%, ${T.oliveDark} 100%)`,
          color: '#f4ede0',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f4ede0', display: 'grid', placeItems: 'center' }}>
            <Leaf size={22} color={T.olive} />
          </div>
          <span style={{ ...FontFraunces, fontSize: 20, color: '#f4ede0' }}>El Buen Sabor</span>
        </div>

        <div>
          <div style={{ ...FontMono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.15em', opacity: .7, marginBottom: 20 }}>
            — desde 1998 —
          </div>
          <h1 style={{ ...FontFraunces, fontSize: 72, lineHeight: 0.95, margin: 0, letterSpacing: '-0.02em' }}>
            Sazón <em style={{ color: '#e0d099', fontStyle: 'italic' }}>hecha</em><br />
            en casa.
          </h1>
          <p style={{ fontSize: 15, opacity: .75, marginTop: 24, maxWidth: 360, lineHeight: 1.55 }}>
            Plataforma de gestión para mensualidades, menús del día y cocina sincronizada.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 32, fontSize: 12, opacity: .7, ...FontMono }}>
          <div>
            <div style={{ ...FontFraunces, fontSize: 22, color: '#e0d099', fontStyle: 'italic' }}>2026</div>
            EDITION
          </div>
          <div>
            <div style={{ ...FontFraunces, fontSize: 22, color: '#e0d099', fontStyle: 'italic' }}>v2</div>
            REDISEÑO
          </div>
          <div>
            <div style={{ ...FontFraunces, fontSize: 22, color: '#e0d099', fontStyle: 'italic' }}>~</div>
            ARTESANAL
          </div>
        </div>
      </div>

      {/* RIGHT — Form */}
      <div
        style={{
          padding: '60px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
        className="lg:px-[72px]"
      >
        {/* Mobile brand header */}
        <div className="lg:hidden" style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: T.olive, display: 'grid', placeItems: 'center' }}>
              <Leaf size={22} color="#f4ede0" />
            </div>
            <span style={{ ...FontFraunces, fontSize: 24, color: T.text }}>El Buen Sabor</span>
          </div>
        </div>

        <div style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
          <KickerLabel>— bienvenido de vuelta</KickerLabel>
          <h2 style={{ ...FontFraunces, fontSize: 38, color: T.text, margin: '0 0 28px 0', letterSpacing: '-0.015em' }}>
            Ingresa a tu cuenta
          </h2>

          {/* Tab pill */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              background: T.bgSoft,
              padding: 4,
              borderRadius: 12,
              marginBottom: 24,
              width: 'fit-content',
            }}
          >
            <button
              onClick={() => setTab('staff')}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                background: tab === 'staff' ? T.card : 'transparent',
                fontSize: 13,
                fontWeight: tab === 'staff' ? 600 : 500,
                color: tab === 'staff' ? T.text : T.textSoft,
                boxShadow: tab === 'staff' ? '0 1px 2px rgba(0,0,0,.04)' : 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Personal
            </button>
            <button
              onClick={() => setTab('suscriptor')}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                background: tab === 'suscriptor' ? T.card : 'transparent',
                fontSize: 13,
                fontWeight: tab === 'suscriptor' ? 600 : 500,
                color: tab === 'suscriptor' ? T.text : T.textSoft,
                boxShadow: tab === 'suscriptor' ? '0 1px 2px rgba(0,0,0,.04)' : 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Suscriptor
            </button>
          </div>

          {tab === 'staff'
            ? <StaffLogin onLogin={onLogin} />
            : <SubLogin onLogin={onLogin} onRegister={() => setView('register')} />}
        </div>
      </div>
    </div>
  );
}