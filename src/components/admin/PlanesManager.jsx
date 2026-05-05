import { useEffect, useState } from 'react';
import { T } from '../../lib/tokens';
import { db, formatMoney } from '../../lib/utils';
import { Modal, Card, Btn, Input, Toggle } from '../ui/primitives';
import { Edit3, Trash2, Plus, Check } from 'lucide-react';

export function PlanFormModal({ open, onClose, plan, planes, refresh }) {
  const [form, setForm] = useState({ nombre: '', almuerzos: 20, precio: 0, dias: 30, activo: true });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (plan) setForm(plan);
    else setForm({ nombre: '', almuerzos: 20, precio: 0, dias: 30, activo: true });
    setErrors({});
  }, [plan, open]);

  const guardar = async () => {
    const e = {};
    if (!form.nombre?.trim()) e.nombre = 'Requerido';
    if (form.almuerzos < 1) e.almuerzos = 'Mínimo 1';
    if (form.precio < 1000) e.precio = 'Mínimo $1.000';
    if (form.dias < 1) e.dias = 'Mínimo 1 día';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    if (plan?.id) {
      await db.set('rest:planes', planes.map(p => p.id === plan.id ? { ...form } : p));
    } else {
      await db.set('rest:planes', [...planes, { ...form, id: `p${Date.now()}` }]);
    }
    onClose();
    refresh();
  };

  return (
    <Modal open={open} onClose={onClose} title={plan?.id ? 'Editar plan' : 'Nuevo plan'}>
      <div className="space-y-3">
        <Input label="Nombre del plan" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} error={errors.nombre} placeholder="Plan Mensual Premium" />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Almuerzos" type="number" value={form.almuerzos} onChange={(v) => setForm({ ...form, almuerzos: +v })} error={errors.almuerzos} />
          <Input label="Días" type="number" value={form.dias} onChange={(v) => setForm({ ...form, dias: +v })} error={errors.dias} />
          <Input label="Precio" type="number" value={form.precio} onChange={(v) => setForm({ ...form, precio: +v })} error={errors.precio} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: T.bg }}>
          <div>
            <p className="text-sm font-medium" style={{ color: T.text }}>Plan activo</p>
            <p className="text-xs" style={{ color: T.textSoft }}>Los planes inactivos no se muestran a clientes</p>
          </div>
          <Toggle checked={form.activo} onChange={(v) => setForm({ ...form, activo: v })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={guardar}>{plan?.id ? 'Guardar cambios' : 'Crear plan'}</Btn>
        </div>
      </div>
    </Modal>
  );
}

export function PlanesTab({ planes, refresh }) {
  const [newPlan, setNewPlan] = useState(false);
  const [editPlan, setEditPlan] = useState(null);

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este plan? Solo recomendado si nadie lo usa.')) return;
    await db.set('rest:planes', planes.filter(p => p.id !== id));
    refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: T.textSoft }}>{planes.length} planes configurados</p>
        <Btn icon={Plus} onClick={() => setNewPlan(true)}>Nuevo plan</Btn>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {planes.map(p => (
          <Card key={p.id}>
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium" style={{ color: T.text, fontFamily: 'Fraunces, serif', fontSize: 18 }}>{p.nombre}</h4>
              <div className="flex gap-1">
                <button onClick={() => setEditPlan(p)} className="p-1.5 rounded" style={{ color: T.textSoft }}>
                  <Edit3 size={14} />
                </button>
                <button onClick={() => eliminar(p.id)} className="p-1.5 rounded" style={{ color: T.accent }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <p className="text-2xl font-medium mb-3" style={{ color: T.accent, fontFamily: 'Fraunces, serif' }}>{formatMoney(p.precio)}</p>
            <div className="space-y-1.5 text-sm" style={{ color: T.textSoft }}>
              <div className="flex items-center gap-2"><Check size={14} style={{ color: T.green }} /> {p.almuerzos} almuerzos</div>
              <div className="flex items-center gap-2"><Check size={14} style={{ color: T.green }} /> Vigencia {p.dias} días</div>
              <div className="flex items-center gap-2"><Check size={14} style={{ color: T.green }} /> {p.activo ? 'Plan activo' : 'Plan pausado'}</div>
            </div>
          </Card>
        ))}
      </div>
      <PlanFormModal open={newPlan || !!editPlan} onClose={() => { setNewPlan(false); setEditPlan(null); }} plan={editPlan} planes={planes} refresh={refresh} />
    </div>
  );
}
