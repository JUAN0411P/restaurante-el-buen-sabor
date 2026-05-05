import { useState } from 'react';
import {
  Users, UtensilsCrossed, User, ChevronRight, Search, Crown, Heart, AlertTriangle
} from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';
import { Tag, Btn, Input, Modal, KickerLabel } from '../ui/primitives';

/**
 * Wizard with stepper (no "back" buttons).
 * Steps: 1. Tipo → 2. Suscriptor (si aplica) → 3. Titular/Invitado (si aplica)
 */
export function AgregarComensalFlow({ mesaActiva, mesaData, suscriptores, onCancel, onContinue }) {
  const [step, setStep] = useState(1);
  const [tipoComensal, setTipoComensal] = useState(null);
  const [subSelected, setSubSelected] = useState(null);
  const [searchSub, setSearchSub] = useState('');
  const [showInvitModal, setShowInvitModal] = useState(false);
  const [nombreComensal, setNombreComensal] = useState('');

  // ¿Cuántos pasos en total dependiendo del flow?
  const totalSteps = tipoComensal === 'menu' ? 2 : tipoComensal === 'suscripcion' ? 3 : 1;

  const subsFiltrados = suscriptores.filter(s =>
    s.activo && s.plan && s.almuerzos_restantes > 0 &&
    (s.nombre.toLowerCase().includes(searchSub.toLowerCase())
      || s.codigo?.toLowerCase().includes(searchSub.toLowerCase())
      || s.cedula?.includes(searchSub))
  );

  const goStep = (n) => {
    if (n < step) {
      // permite ir hacia atrás haciendo clic en el stepper
      setStep(n);
      if (n === 1) { setTipoComensal(null); setSubSelected(null); }
      if (n === 2) setSubSelected(null);
    }
  };

  return (
    <div>
      {/* Stepper */}
      <Stepper currentStep={step} totalSteps={totalSteps} tipoComensal={tipoComensal} onStepClick={goStep} />

      {/* STEP 1: TIPO */}
      {step === 1 && (
        <div className="ebs-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <KickerLabel>— ¿qué tipo de comensal?</KickerLabel>
          <button
            onClick={() => { setTipoComensal('suscripcion'); setStep(2); }}
            className="ebs-card"
            style={{
              padding: 16,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 11, background: T.oliveSoft, color: T.olive, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Users size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...FontFraunces, fontSize: 17, color: T.text, marginBottom: 2 }}>Cliente con mensualidad</div>
              <div style={{ fontSize: 12, color: T.textSoft }}>Identifica al suscriptor. Se enviará para aprobación.</div>
            </div>
            <ChevronRight size={16} color={T.textMute} />
          </button>
          <button
            onClick={() => { setTipoComensal('menu'); setStep(2); }}
            className="ebs-card"
            style={{
              padding: 16,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 11, background: T.mustardSoft, color: T.mustard, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <UtensilsCrossed size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...FontFraunces, fontSize: 17, color: T.text, marginBottom: 2 }}>Cliente del día</div>
              <div style={{ fontSize: 12, color: T.textSoft }}>Cliente paga cada plato directamente.</div>
            </div>
            <ChevronRight size={16} color={T.textMute} />
          </button>
        </div>
      )}

      {/* STEP 2 (suscripcion): elegir suscriptor */}
      {step === 2 && tipoComensal === 'suscripcion' && (
        <div>
          <KickerLabel>— identifica al suscriptor</KickerLabel>
          <div style={{ marginTop: 8, marginBottom: 12 }}>
            <Input placeholder="Buscar por nombre, código o cédula" value={searchSub} onChange={setSearchSub} icon={Search} />
          </div>
          <div className="ebs-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {subsFiltrados.map(s => (
              <button
                key={s.id}
                onClick={() => { setSubSelected(s); setStep(3); }}
                className="ebs-card"
                style={{
                  padding: 14,
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: T.oliveSoft, color: T.olive, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  {s.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{s.nombre}</div>
                  <div style={{ fontSize: 11, color: T.textSoft, ...FontMono }}>{s.codigo} · {s.cedula}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {s.permitir_invitados && <Tag tone="plum" size="xs"><Crown size={10} /> INVITA</Tag>}
                  <Tag tone={s.almuerzos_restantes <= 5 ? 'mustard' : 'olive'} size="xs">{s.almuerzos_restantes} REST</Tag>
                </div>
              </button>
            ))}
            {subsFiltrados.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: T.textMute }}>
                No se encontraron suscriptores
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3 (suscripcion): titular o invitado */}
      {step === 3 && tipoComensal === 'suscripcion' && subSelected && (
        <div>
          <div style={{ padding: 14, background: T.bg, borderRadius: 12, marginBottom: 14, border: `1px solid ${T.border}` }}>
            <KickerLabel>— suscriptor seleccionado</KickerLabel>
            <div style={{ ...FontFraunces, fontSize: 17, color: T.text }}>{subSelected.nombre}</div>
            <div style={{ fontSize: 11, color: T.textSoft, ...FontMono }}>
              {subSelected.codigo} · {subSelected.almuerzos_restantes} almuerzos restantes
            </div>
          </div>

          <KickerLabel>— ¿quién consumirá?</KickerLabel>
          <div className="ebs-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => onContinue({ tipo: 'suscripcion', suscriptor: subSelected, nombre: subSelected.nombre })}
              className="ebs-card"
              style={{
                padding: 14,
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.oliveSoft, color: T.olive, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <User size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>El titular</div>
                <div style={{ fontSize: 11, color: T.textSoft }}>Consume su propio almuerzo</div>
              </div>
              <ChevronRight size={16} color={T.textMute} />
            </button>
            {subSelected.permitir_invitados && subSelected.almuerzos_restantes > 1 && (
              <button
                onClick={() => setShowInvitModal(true)}
                className="ebs-card"
                style={{
                  padding: 14,
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: T.plumSoft, color: T.plum, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Heart size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Un invitado del titular</div>
                  <div style={{ fontSize: 11, color: T.textSoft }}>
                    Consume 1 almuerzo del plan. El titular debe aprobar.
                  </div>
                </div>
                <ChevronRight size={16} color={T.textMute} />
              </button>
            )}
            {!subSelected.permitir_invitados && (
              <div style={{ padding: 12, borderRadius: 10, background: T.bg, fontSize: 11, color: T.textSoft, display: 'flex', alignItems: 'center', gap: 8, ...FontMono }}>
                <AlertTriangle size={14} color={T.mustard} />
                Este suscriptor no tiene autorización para invitar.
              </div>
            )}
          </div>

          <Modal open={showInvitModal} onClose={() => setShowInvitModal(false)} title="Datos del invitado">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input
                label="Nombre del invitado (opcional)"
                value={nombreComensal}
                onChange={setNombreComensal}
                placeholder={`Invitado de ${subSelected.nombre.split(' ')[0]}`}
              />
              <div style={{ padding: 10, borderRadius: 10, background: T.mustardSoft, color: T.mustard, fontSize: 11 }}>
                Se descontará 1 almuerzo del plan de {subSelected.nombre} cuando el titular apruebe.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn variant="ghost" onClick={() => setShowInvitModal(false)}>Cancelar</Btn>
                <Btn onClick={() => onContinue({
                  tipo: 'invitado',
                  suscriptor: subSelected,
                  nombre: nombreComensal || `Invitado de ${subSelected.nombre.split(' ')[0]}`
                })}>
                  Continuar →
                </Btn>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* STEP 2 (menu): nombre opcional */}
      {step === 2 && tipoComensal === 'menu' && (
        <div>
          <KickerLabel>— cliente del día</KickerLabel>
          <div style={{ marginTop: 12 }}>
            <Input
              label="Nombre o referencia (opcional)"
              value={nombreComensal}
              onChange={setNombreComensal}
              placeholder={`Cliente ${mesaData.comensales.length + 1}`}
              icon={User}
              hint="Útil para identificar al cobrar"
            />
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
              <Btn onClick={() => onContinue({
                tipo: 'menu',
                nombre: nombreComensal || `Cliente ${mesaData.comensales.length + 1}`
              })}>
                Continuar al pedido →
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ currentStep, totalSteps, tipoComensal, onStepClick }) {
  const labels = tipoComensal === 'menu'
    ? ['Tipo', 'Nombre']
    : tipoComensal === 'suscripcion'
      ? ['Tipo', 'Suscriptor', 'Titular/Invitado']
      : ['Tipo'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, ...FontMono }}>
      {labels.map((lbl, i) => {
        const n = i + 1;
        const isActive = n === currentStep;
        const isPast = n < currentStep;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => onStepClick(n)}
              disabled={n >= currentStep}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: isActive ? T.olive : isPast ? T.oliveSoft : T.bgSoft,
                color: isActive ? '#fff' : isPast ? T.olive : T.textMute,
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: n < currentStep ? 'pointer' : 'default',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {n}
            </button>
            <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: isActive ? T.text : T.textMute }}>
              {lbl}
            </span>
            {i < labels.length - 1 && (
              <div style={{ width: 16, height: 1, background: T.border, margin: '0 4px' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
