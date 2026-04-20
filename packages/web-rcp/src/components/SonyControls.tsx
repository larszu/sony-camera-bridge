import React from 'react';

interface SonyButtonProps {
  label: string;
  sublabel?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant?: 'default' | 'red' | 'green' | 'yellow' | 'blue';
  size?: 'sm' | 'md' | 'lg';
  momentary?: boolean;
}

/**
 * Sony RCP style pushbutton with LED indicator
 */
export function SonyButton({
  label,
  sublabel,
  active = false,
  disabled = false,
  onClick,
  variant = 'default',
  size = 'md',
  momentary = false,
}: SonyButtonProps) {
  return (
    <button
      className={`sony-btn sony-btn--${variant} sony-btn--${size} ${active ? 'sony-btn--active' : ''} ${disabled ? 'sony-btn--disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="sony-btn__led" />
      <span className="sony-btn__label">{label}</span>
      {sublabel && <span className="sony-btn__sublabel">{sublabel}</span>}
    </button>
  );
}

interface SonySelectProps {
  label: string;
  value: number;
  options: Array<{ value: number; label: string }>;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * Sony RCP style selector with up/down buttons
 */
export function SonySelect({ label, value, options, onChange, disabled = false }: SonySelectProps) {
  const currentIndex = options.findIndex((o) => o.value === value);
  const currentLabel = options[currentIndex]?.label ?? '---';

  const handlePrev = () => {
    if (currentIndex > 0) {
      onChange(options[currentIndex - 1].value);
    }
  };

  const handleNext = () => {
    if (currentIndex < options.length - 1) {
      onChange(options[currentIndex + 1].value);
    }
  };

  return (
    <div className={`sony-select ${disabled ? 'sony-select--disabled' : ''}`}>
      <div className="sony-select__label">{label}</div>
      <div className="sony-select__controls">
        <button
          className="sony-select__btn sony-select__btn--prev"
          onClick={handlePrev}
          disabled={disabled || currentIndex <= 0}
        >
          ◀
        </button>
        <div className="sony-select__display">{currentLabel}</div>
        <button
          className="sony-select__btn sony-select__btn--next"
          onClick={handleNext}
          disabled={disabled || currentIndex >= options.length - 1}
        >
          ▶
        </button>
      </div>
    </div>
  );
}

interface SonyFaderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  vertical?: boolean;
}

/**
 * Sony RCP style linear fader
 */
export function SonyFader({
  label,
  value,
  min = 0,
  max = 255,
  onChange,
  disabled = false,
  vertical = true,
}: SonyFaderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10));
  };

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className={`sony-fader ${vertical ? 'sony-fader--vertical' : 'sony-fader--horizontal'} ${disabled ? 'sony-fader--disabled' : ''}`}>
      <div className="sony-fader__label">{label}</div>
      <div className="sony-fader__track">
        <div className="sony-fader__fill" style={{ [vertical ? 'height' : 'width']: `${percent}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="sony-fader__input"
        />
        <div className="sony-fader__handle" style={{ [vertical ? 'bottom' : 'left']: `${percent}%` }} />
      </div>
      <div className="sony-fader__value">{value}</div>
    </div>
  );
}
