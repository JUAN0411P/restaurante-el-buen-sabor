import { useState } from 'react';
import { X, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { T, FontFraunces, FontMono } from '../../lib/tokens';

// Button — primary is now olive (not terracotta), with mono labels for outlines
export const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled, icon: Icon, full, type = 'button' }) => {
  const tones = {
    primary: { bg: T.olive, fg: '#fff', border: 'transparent', hover: T.oliveDark },
    dark: { bg: T.text, fg: T.bg, border: 'transparent', hover: '#1a1a14' },
    terra: { bg: T.terracotta, fg: '#fff', border: 'transparent', hover: T.accentHover },
    accent: { bg: T.terracotta, fg: '#fff', border: 'transparent', hover: T.accentHover },
    ghost: { bg: 'transparent', fg: T.text, border: T.border, hover: T.bgSoft },
    soft: { bg: T.bgSoft, fg: T.text, border: 'transparent', hover: T.border },
    success: { bg: T.olive, fg: '#fff', border: 'transparent', hover: T.oliveDark },
    danger: { bg: 'transparent', fg: T.red, border: T.redSoft, hover: T.redSoft },
    warn: { bg: T.mustard, fg: '#fff', border: 'transparent', hover: '#a07730' },
  };
  const c = tones[variant] || tones.primary;
  const sz = size === 'sm'
    ? { p: '7px 12px', fs: 12 }
    : size === 'lg'
      ? { p: '12px 20px', fs: 15 }
      : { p: '9px 16px', fs: 13 };

  const [hover, setHover] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="ebs-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: sz.p,
        fontSize: sz.fs,
        fontWeight: 500,
        borderRadius: 10,
        border: `1px solid ${c.border}`,
        background: hover && !disabled ? c.hover : c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
        fontFamily: "'Manrope', sans-serif",
        width: full ? '100%' : 'auto',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'transform .18s ease, background .18s ease, box-shadow .18s ease',
      }}
    >
      {Icon && <Icon size={sz.fs + 2} />}
      {children}
    </button>
  );
};

// Card — warm cream with subtle border
export const Card = ({ children, padding = 20, className = '', onClick, hover = false, style = {}, animate = true }) => {
  const padStyle = typeof padding === 'number' ? { padding } : {};
  const padClass = typeof padding === 'string' ? padding : '';
  return (
    <div
      onClick={onClick}
      className={`${animate ? 'ebs-card' : ''} ${padClass} ${className}`}
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        boxShadow: hover ? '0 8px 24px -12px rgba(60,50,20,.12)' : '0 1px 0 rgba(60,50,20,.02)',
        cursor: onClick ? 'pointer' : 'default',
        ...padStyle,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Tag — mono uppercase chip
export const Tag = ({ children, color = 'gray', tone, size = 'sm' }) => {
  const useColor = tone || color;
  const tones = {
    gray: { bg: T.bgSoft, fg: T.textSoft },
    neutral: { bg: T.bgSoft, fg: T.textSoft },
    olive: { bg: T.oliveSoft, fg: T.oliveDark },
    green: { bg: T.oliveSoft, fg: T.oliveDark },
    terra: { bg: T.terraSoft, fg: T.terracotta },
    accent: { bg: T.terraSoft, fg: T.terracotta },
    mustard: { bg: T.mustardSoft, fg: T.mustard },
    amber: { bg: T.mustardSoft, fg: T.mustard },
    plum: { bg: T.plumSoft, fg: T.plum },
    purple: { bg: T.plumSoft, fg: T.plum },
    blue: { bg: T.blueSoft, fg: T.blue },
    red: { bg: T.redSoft, fg: T.red },
    dark: { bg: T.text, fg: T.bg },
  };
  const c = tones[useColor] || tones.gray;
  const pad = size === 'xs' ? '2px 7px' : '3px 9px';
  const fs = size === 'xs' ? 10 : 11;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: pad,
        borderRadius: 6,
        fontSize: fs,
        fontWeight: 500,
        letterSpacing: '.02em',
        background: c.bg,
        color: c.fg,
        ...FontMono,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
};

// Modal — same pattern but with new T tokens
export const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(42,42,31,0.45)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${sizes[size]} rounded-2xl overflow-hidden`}
        style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          <h3 style={{ ...FontFraunces, fontSize: 20, color: T.text, margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg"
            style={{ color: T.textSoft }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// Input — with mono uppercase label
export const Input = ({ label, value, onChange, type = 'text', placeholder, error, icon: Icon, hint }) => {
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  return (
    <div className="w-full">
      {label && (
        <label
          style={{
            ...FontMono,
            display: 'block',
            fontSize: 11,
            color: T.textSoft,
            textTransform: 'uppercase',
            letterSpacing: '.1em',
            marginBottom: 6,
          }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.textMute }}>
            <Icon size={15} />
          </div>
        )}
        <input
          type={isPw && show ? 'text' : type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${Icon ? 'pl-9' : 'pl-3'} ${isPw ? 'pr-10' : 'pr-3'} py-2.5 outline-none transition-all`}
          style={{
            backgroundColor: T.card,
            border: `1px solid ${error ? T.red : T.border}`,
            borderRadius: 10,
            color: T.text,
            fontSize: 14,
            fontFamily: "'Manrope', sans-serif",
          }}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: T.textMute }}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: T.red }}>
          <AlertCircle size={11} />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs mt-1" style={{ color: T.textMute }}>{hint}</p>
      )}
    </div>
  );
};

export const Select = ({ label, value, onChange, options }) => (
  <div className="w-full">
    {label && (
      <label
        style={{
          ...FontMono,
          display: 'block',
          fontSize: 11,
          color: T.textSoft,
          textTransform: 'uppercase',
          letterSpacing: '.1em',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 outline-none"
      style={{
        backgroundColor: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        color: T.text,
        fontSize: 14,
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

export const Toggle = ({ checked, onChange, size = 'md' }) => {
  const sizes = size === 'sm'
    ? { w: 36, h: 20, dot: 16, left: checked ? 18 : 2 }
    : { w: 44, h: 24, dot: 20, left: checked ? 22 : 2 };
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: sizes.w,
        height: sizes.h,
        borderRadius: 999,
        background: checked ? T.olive : T.border,
        border: 'none',
        cursor: 'pointer',
        transition: 'background .2s',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: sizes.left,
          width: sizes.dot,
          height: sizes.dot,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left .2s',
          boxShadow: '0 1px 3px rgba(0,0,0,.15)',
        }}
      />
    </button>
  );
};

export const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="text-center py-12">
    {Icon && <Icon size={32} className="mx-auto mb-2" style={{ color: T.textMute }} />}
    <p className="text-sm font-medium" style={{ color: T.textSoft }}>{title}</p>
    {description && (
      <p className="text-xs mt-1" style={{ color: T.textMute }}>{description}</p>
    )}
  </div>
);

// Hairline label — helper for "—" mono micro labels
export const KickerLabel = ({ children, color }) => (
  <div
    style={{
      ...FontMono,
      fontSize: 11,
      color: color || T.textSoft,
      textTransform: 'uppercase',
      letterSpacing: '.15em',
      marginBottom: 4,
    }}
  >
    {children}
  </div>
);
