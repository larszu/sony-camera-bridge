import React, { useState } from 'react';
import { TallyState } from './TallyBar.tsx';
import type { CameraState } from '../types.ts';

interface SonyRcpPanelProps {
  state: CameraState;
  tally: TallyState;
  disabled?: boolean;
  onCommand: (cmd: string, params: Record<string, unknown>) => void;
  onSetTally: (tally: Partial<TallyState>) => void;
}

// Gain options
const GAIN_VALUES = ['0dB', '+3dB', '+6dB', '+9dB', '+12dB', '+15dB', '+18dB'];
// ND options
const ND_VALUES = ['1', '2', '3', '4'];
// CC options  
const CC_VALUES = ['A', 'B', 'C', 'D'];

/** Value box with color border */
function ValueBox({ value, color, label, onChange, disabled }: {
  value: number;
  color: 'red' | 'green' | 'blue';
  label?: string;
  onChange?: (delta: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`rcp-value-box rcp-value-box--${color} ${disabled ? 'rcp-value-box--disabled' : ''}`}>
      <span className="rcp-value-box__value">{value}</span>
      {label && <span className="rcp-value-box__label">{label}</span>}
      {onChange && (
        <div className="rcp-value-box__arrows">
          <button onClick={() => onChange(1)} disabled={disabled}>▲</button>
          <button onClick={() => onChange(-1)} disabled={disabled}>▼</button>
        </div>
      )}
    </div>
  );
}

/** Selector with up/down arrows */
function Selector({ value, label, onChange, disabled }: {
  value: string;
  label: string;
  onChange?: (delta: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`rcp-selector ${disabled ? 'rcp-selector--disabled' : ''}`}>
      <div className="rcp-selector__display">{value}</div>
      {onChange && (
        <div className="rcp-selector__arrows">
          <button onClick={() => onChange(1)} disabled={disabled}>▲</button>
          <button onClick={() => onChange(-1)} disabled={disabled}>▼</button>
        </div>
      )}
      <div className="rcp-selector__label">{label}</div>
    </div>
  );
}

/** RCP Button */
function RcpButton({ label, active, variant, onClick, disabled }: {
  label: string;
  active?: boolean;
  variant?: 'default' | 'green' | 'red';
  onClick?: () => void;
  disabled?: boolean;
}) {
  const classes = [
    'rcp-btn',
    active && 'rcp-btn--active',
    variant && `rcp-btn--${variant}`,
    disabled && 'rcp-btn--disabled'
  ].filter(Boolean).join(' ');
  return <button className={classes} onClick={onClick} disabled={disabled}>{label}</button>;
}

/**
 * Software-style RCP Panel
 */
export function SonyRcpPanel({ state, tally, disabled = false, onCommand, onSetTally }: SonyRcpPanelProps) {
  const [autoIris, setAutoIris] = useState(false);
  const cmd = (c: string, params: Record<string, unknown> = {}) => onCommand(c, params);
  
  // Convert values to display format
  const gainIdx = state.masterGain ?? 0;
  const ndIdx = state.ndFilter ?? 0;
  const ccIdx = 0;
  const whiteR = ((state.whiteR ?? 128) - 128) / 2.56; // -50 to +50 range
  const whiteG = ((state.whiteG ?? 128) - 128) / 2.56;
  const whiteB = ((state.whiteB ?? 128) - 128) / 2.56;
  const blackR = ((state.blackR ?? 128) - 128) / 25.6; // -5 to +5 range
  const blackG = ((state.blackG ?? 128) - 128) / 25.6;
  const blackB = ((state.blackB ?? 128) - 128) / 25.6;
  const masterBlack = ((state.masterBlack ?? 128) - 128) / 25.6;
  const masterWhiteGain = 0; // placeholder
  const detail = Math.round(((state.detailLevel ?? 128) - 128) / 12.8); // -10 to +10
  const irisValue = ((state.iris ?? 128) / 255 * 16).toFixed(1); // F1.4 - F16

  return (
    <div className={`rcp-panel ${disabled ? 'rcp-panel--disabled' : ''}`}>
      
      {/* ═══════ TOP BAR ═══════ */}
      <div className="rcp-topbar">
        <div className="rcp-topbar__left">
          <span className="rcp-tab rcp-tab--active">DATA</span>
          <span className="rcp-tab">ALARM</span>
        </div>
        <div className="rcp-topbar__center">
          <span className="rcp-camera-id">{String(1).padStart(2, '0')}</span>
        </div>
        <div className="rcp-topbar__right">
          <RcpButton label="ACTIVE" active={tally.program} variant="green" onClick={() => onSetTally({ program: !tally.program })} />
          <RcpButton label="CALL" onClick={() => cmd('call')} />
        </div>
      </div>

      {/* ═══════ MODE ROW ═══════ */}
      <div className="rcp-row rcp-row--mode">
        <RcpButton label="STANDARD" active disabled={disabled} />
      </div>

      {/* ═══════ FUNCTION BUTTONS ═══════ */}
      <div className="rcp-row rcp-row--functions">
        <RcpButton label="BARS" active={state.bars} onClick={() => cmd('setBars', { on: !(state.bars ?? false) })} disabled={disabled} />
        <RcpButton label="CLOSE" onClick={() => cmd('close')} disabled={disabled} />
        <RcpButton label="D5600K" onClick={() => cmd('setColorTemp', { value: 5600 })} disabled={disabled} />
        <RcpButton label="CHARACTER" onClick={() => cmd('toggleCharacter')} disabled={disabled} />
      </div>

      {/* ═══════ GAIN ROW ═══════ */}
      <div className="rcp-row rcp-row--gain">
        <Selector 
          value={GAIN_VALUES[gainIdx] ?? '0dB'} 
          label="MASTER GAIN"
          onChange={(d) => cmd('setMasterGain', { value: Math.max(0, Math.min(6, gainIdx + d)) })}
          disabled={disabled}
        />
        <div className="rcp-row__spacer" />
        <RcpButton label="AWB" onClick={() => cmd('autoWhiteBalance', { preset: 'A' })} disabled={disabled} />
        <RcpButton label="ABB" onClick={() => cmd('autoBlackBalance')} disabled={disabled} />
      </div>

      {/* ═══════ WHITE SECTION ═══════ */}
      <div className="rcp-section rcp-section--white">
        <div className="rcp-section__header">
          <span className="rcp-section__label">ATW</span>
        </div>
        <div className="rcp-section__row">
          <div className="rcp-rgb-group">
            <ValueBox 
              value={Math.round(whiteR)} 
              color="red"
              onChange={(d) => cmd('setWhiteBalance', { 
                r: Math.max(0, Math.min(255, (state.whiteR ?? 128) + d * 2.56)),
                g: state.whiteG ?? 128,
                b: state.whiteB ?? 128
              })}
              disabled={disabled}
            />
            <ValueBox 
              value={Math.round(whiteG)} 
              color="green"
              onChange={(d) => cmd('setWhiteBalance', { 
                r: state.whiteR ?? 128,
                g: Math.max(0, Math.min(255, (state.whiteG ?? 128) + d * 2.56)),
                b: state.whiteB ?? 128
              })}
              disabled={disabled}
            />
            <ValueBox 
              value={Math.round(whiteB)} 
              color="blue"
              onChange={(d) => cmd('setWhiteBalance', { 
                r: state.whiteR ?? 128,
                g: state.whiteG ?? 128,
                b: Math.max(0, Math.min(255, (state.whiteB ?? 128) + d * 2.56))
              })}
              disabled={disabled}
            />
          </div>
          <span className="rcp-section__divider-label">WHITE</span>
        </div>
        <div className="rcp-section__sidebar">
          <div className="rcp-value-display">
            <span className="rcp-value-display__value">{detail}</span>
            <span className="rcp-value-display__label">DETAIL</span>
          </div>
          <div className="rcp-value-display">
            <span className="rcp-value-display__value">{masterWhiteGain.toFixed(1)}dB</span>
            <span className="rcp-value-display__label">MASTER<br/>WHITE GAIN</span>
          </div>
        </div>
      </div>

      {/* ═══════ BLACK SECTION ═══════ */}
      <div className="rcp-section rcp-section--black">
        <div className="rcp-section__row">
          <div className="rcp-rgb-group">
            <ValueBox 
              value={Math.round(blackR)} 
              color="red"
              onChange={(d) => cmd('setBlackBalance', { 
                r: Math.max(0, Math.min(255, (state.blackR ?? 128) + d * 25.6)),
                g: state.blackG ?? 128,
                b: state.blackB ?? 128
              })}
              disabled={disabled}
            />
            <ValueBox 
              value={Math.round(blackG)} 
              color="green"
              onChange={(d) => cmd('setBlackBalance', { 
                r: state.blackR ?? 128,
                g: Math.max(0, Math.min(255, (state.blackG ?? 128) + d * 25.6)),
                b: state.blackB ?? 128
              })}
              disabled={disabled}
            />
            <ValueBox 
              value={Math.round(blackB)} 
              color="blue"
              onChange={(d) => cmd('setBlackBalance', { 
                r: state.blackR ?? 128,
                g: state.blackG ?? 128,
                b: Math.max(0, Math.min(255, (state.blackB ?? 128) + d * 25.6))
              })}
              disabled={disabled}
            />
          </div>
          <span className="rcp-section__divider-label">BLACK</span>
        </div>
        <div className="rcp-section__sidebar">
          <div className="rcp-value-display">
            <span className="rcp-value-display__value">{masterBlack.toFixed(1)}</span>
            <span className="rcp-value-display__label">MASTER BLACK</span>
          </div>
        </div>
      </div>

      {/* ═══════ IRIS SECTION ═══════ */}
      <div className="rcp-section rcp-section--iris">
        <div className="rcp-iris-left">
          <label className="rcp-checkbox">
            <input 
              type="checkbox" 
              checked={autoIris}
              onChange={(e) => {
                setAutoIris(e.target.checked);
                cmd('setAutoIris', { on: e.target.checked });
              }}
              disabled={disabled}
            />
            <span className="rcp-checkbox__label">AUTO IRIS</span>
          </label>
          <div className="rcp-filter-group">
            <Selector 
              value={ND_VALUES[ndIdx] ?? '1'} 
              label="ND"
              onChange={(d) => cmd('setNdFilter', { value: Math.max(0, Math.min(3, ndIdx + d)) })}
              disabled={disabled}
            />
            <Selector 
              value={CC_VALUES[ccIdx] ?? 'A'} 
              label="CC"
              onChange={() => {}}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="rcp-iris-center">
          <div className="rcp-iris-display">
            <span className="rcp-iris-display__value">{irisValue}</span>
            <span className="rcp-iris-display__label">IRIS</span>
          </div>
        </div>
        <div className="rcp-iris-right">
          <div className="rcp-fader">
            <div className="rcp-fader__scale">
              <span>3.4</span>
            </div>
            <div className="rcp-fader__track">
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={state.iris ?? 128}
                onChange={(e) => cmd('setIris', { value: parseInt(e.target.value) })}
                disabled={disabled || autoIris}
                className="rcp-fader__input"
              />
              <div 
                className="rcp-fader__handle"
                style={{ bottom: `${((state.iris ?? 128) / 255) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ BOTTOM BAR ═══════ */}
      <div className="rcp-bottombar">
        <RcpButton label="PREVIEW" active={tally.preview} onClick={() => onSetTally({ preview: !tally.preview })} />
        <div className="rcp-status-indicators">
          <span className="rcp-status rcp-status--out">OUT</span>
          <span className="rcp-status rcp-status--opt">OPT</span>
          <span className="rcp-status rcp-status--sync">SYNC</span>
          <span className="rcp-status rcp-status--drop">DROP</span>
        </div>
      </div>
    </div>
  );
}
