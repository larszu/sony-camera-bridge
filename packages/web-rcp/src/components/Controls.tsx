import React from 'react';

interface DialProps {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
  disabled?: boolean;
}

export function Dial({ label, value, min = 0, max = 4096, step = 1, onChange, unit = '', disabled = false }: DialProps) {
  const display = value !== undefined ? value : '—';
  const pct = value !== undefined ? Math.round(((value - min) / (max - min)) * 100) : 0;

  return (
    <div className="dial">
      <label className="dial__label">{label}</label>
      <div className="dial__value">{display}{unit && value !== undefined ? <span className="dial__unit"> {unit}</span> : null}</div>
      <input
        type="range"
        className="dial__slider"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        disabled={disabled || value === undefined}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="dial__pct">{pct}%</div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  value: boolean | undefined;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
}

export function Toggle({ label, value, onChange, disabled = false, activeColor = '#e84343' }: ToggleProps) {
  const active = value === true;
  return (
    <button
      className={`toggle ${active ? 'toggle--on' : ''}`}
      style={active ? { background: activeColor, color: '#fff' } : undefined}
      disabled={disabled}
      onClick={() => onChange(!active)}
    >
      {label}
    </button>
  );
}

interface SelectProps {
  label: string;
  value: number | undefined;
  options: { label: string; value: number }[];
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function Select({ label, value, options, onChange, disabled = false }: SelectProps) {
  return (
    <div className="select-group">
      <label className="select-group__label">{label}</label>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="select-group__select"
      >
        {value === undefined && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
