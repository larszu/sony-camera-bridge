/**
 * Blackmagic RCP Panel
 * 
 * Sony RCP-style interface for controlling Blackmagic cameras via REST API.
 * Uses same visual design but with Blackmagic-specific color correction controls.
 * 
 * Blackmagic Color Correction Model:
 * - Lift (shadows): RGBL -2.0 to +2.0, default 0.0
 * - Gamma (midtones): RGBL -4.0 to +4.0, default 0.0
 * - Gain (highlights): RGBL 0.0 to 16.0, default 1.0
 * - Offset: RGBL -8.0 to +8.0, default 0.0
 * 
 * Sony to Blackmagic Mapping:
 * - Sony Master Black → Blackmagic Lift Luma
 * - Sony Black R/G/B → Blackmagic Lift R/G/B
 * - Sony Master Gamma → Blackmagic Gamma Luma
 * - Sony White R/G/B → Blackmagic Gain R/G/B (highlights)
 * - Sony Knee → No direct equivalent (use Contrast/Gamma curve)
 * - Sony Detail → No direct equivalent
 */

import React, { useState } from 'react';
import { TallyState } from './TallyBar.tsx';
import { RotaryKnob } from './RotaryKnob.tsx';
import type { CameraCapabilities, CameraState } from '../types.ts';

interface BlackmagicRcpPanelProps {
  state: CameraState;
  tally: TallyState;
  cameraId?: number;
  disabled?: boolean;
  capabilities?: CameraCapabilities;
  onCommand: (cmd: string, params: Record<string, unknown>) => void;
  onSetTally: (tally: Partial<TallyState>) => void;
}

// ISO options (Blackmagic cameras)
const ISO_VALUES = ['100', '200', '400', '800', '1600', '3200', '6400', '12800', '25600'];
// Shutter angle options
const SHUTTER_VALUES = ['45°', '90°', '180°', '270°', '360°'];
// White balance presets
const WB_PRESETS = [
  { label: 'SUN', value: 5600 },
  { label: 'TUNG', value: 3200 },
  { label: 'FLUOR', value: 4000 },
  { label: 'CLOUD', value: 6500 },
];

// ═══════════════════════════════════════════════════════════════════════════
// Sony-to-Blackmagic Value Mapping Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert Sony 0-255 value to Blackmagic Lift range (-2.0 to +2.0)
 * Sony: 0-127 = negative, 128 = center, 129-255 = positive
 */
function sonyToLift(sonyValue: number): number {
  return ((sonyValue - 128) / 64); // Maps 0-255 to -2.0 to +2.0
}

/**
 * Convert Blackmagic Lift (-2.0 to +2.0) to Sony 0-255
 */
function liftToSony(liftValue: number): number {
  return Math.round(liftValue * 64 + 128);
}

/**
 * Convert Sony 0-255 value to Blackmagic Gamma range (-4.0 to +4.0)
 */
function sonyToGamma(sonyValue: number): number {
  return ((sonyValue - 128) / 32); // Maps 0-255 to -4.0 to +4.0
}

/**
 * Convert Sony 0-255 value to Blackmagic Gain range (0.0 to 4.0)
 * Sony white balance affects highlights, similar to Gain
 */
function sonyToGain(sonyValue: number): number {
  // Sony 0-255 maps to BM 0.0-4.0, with 128 = 1.0 (neutral)
  return (sonyValue / 128); // 0=0.0, 128=1.0, 255=2.0
}

/**
 * Convert Sony 0-255 value to Blackmagic Offset range (-8.0 to +8.0)
 */
function sonyToOffset(sonyValue: number): number {
  return ((sonyValue - 128) / 16); // Maps 0-255 to -8.0 to +8.0
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
  variant?: 'default' | 'green' | 'red' | 'blue';
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
 * Blackmagic RCP Panel with Sony-style layout
 */
export function BlackmagicRcpPanel({ 
  state, 
  tally, 
  cameraId = 1, 
  disabled = false, 
  capabilities,
  onCommand, 
  onSetTally 
}: BlackmagicRcpPanelProps) {
  const [isoIdx, setIsoIdx] = useState(3); // Default ISO 800
  const [shutterIdx, setShutterIdx] = useState(2); // Default 180°
  const [wbKelvin, setWbKelvin] = useState(5600);
  const [wbTint, setWbTint] = useState(0);
  
  const cmd = (c: string, params: Record<string, unknown> = {}) => onCommand(c, params);
  const can = (feature: keyof CameraCapabilities): boolean => !disabled && (capabilities?.[feature] ?? true);
  
  // Calculate Blackmagic values from Sony state
  const liftLuma = sonyToLift(state.masterBlack ?? 128);
  const liftR = sonyToLift(state.blackR ?? 128);
  const liftG = sonyToLift(state.blackG ?? 128);
  const liftB = sonyToLift(state.blackB ?? 128);
  
  const gammaLuma = sonyToGamma(state.masterGamma ?? 128);
  
  const gainR = sonyToGain(state.whiteR ?? 128);
  const gainG = sonyToGain(state.whiteG ?? 128);
  const gainB = sonyToGain(state.whiteB ?? 128);

  // Send Blackmagic-format command
  const sendBmCommand = (endpoint: string, data: Record<string, unknown>) => {
    cmd('blackmagic', { endpoint, data });
  };

  return (
    <div className={`rcp-panel rcp-panel--blackmagic ${disabled ? 'rcp-panel--disabled' : ''}`}>
      
      {/* ═══════ TOP BAR ═══════ */}
      <div className="rcp-topbar rcp-topbar--blackmagic">
        <div className="rcp-topbar__left">
          <span className="rcp-brand">BLACKMAGIC</span>
        </div>
        <div className="rcp-topbar__center">
          <span className="rcp-camera-id rcp-camera-id--bm">{String(cameraId).padStart(2, '0')}</span>
        </div>
        <div className="rcp-topbar__right">
          <RcpButton 
            label="REC" 
            active={tally.isoRec} 
            variant="red" 
            onClick={() => {
              onSetTally({ isoRec: !tally.isoRec });
              sendBmCommand('/transports/0/record', { recording: !tally.isoRec });
            }}
            disabled={!can('record')}
          />
          <RcpButton 
            label="LIVE" 
            active={tally.program} 
            variant="green" 
            onClick={() => onSetTally({ program: !tally.program })}
            disabled={!can('tallyProgram')}
          />
        </div>
      </div>

      {/* ═══════ INFO ROW ═══════ */}
      <div className="rcp-row rcp-row--info">
        <span className="rcp-info-item">4K DCI</span>
        <span className="rcp-info-item">BRAW 3:1</span>
        <span className="rcp-info-item">24fps</span>
      </div>

      {/* ═══════ EXPOSURE ROW ═══════ */}
      <div className="rcp-row rcp-row--gain">
        <Selector 
          value={ISO_VALUES[isoIdx]} 
          label="ISO"
          onChange={(d) => {
            const newIdx = Math.max(0, Math.min(ISO_VALUES.length - 1, isoIdx + d));
            setIsoIdx(newIdx);
            sendBmCommand('/video/iso', { iso: parseInt(ISO_VALUES[newIdx]) });
          }}
          disabled={!can('iso')}
        />
        <Selector 
          value={SHUTTER_VALUES[shutterIdx]} 
          label="SHUTTER"
          onChange={(d) => {
            const newIdx = Math.max(0, Math.min(SHUTTER_VALUES.length - 1, shutterIdx + d));
            setShutterIdx(newIdx);
            const angleValue = [4500, 9000, 18000, 27000, 36000][newIdx];
            sendBmCommand('/video/shutter', { shutterAngle: angleValue });
          }}
          disabled={!can('shutter')}
        />
        <div className="rcp-row__spacer" />
        <RcpButton label="AWB" onClick={() => sendBmCommand('/video/whiteBalance/doAuto', {})} disabled={!can('awb')} />
      </div>

      {/* ═══════ WHITE BALANCE ROW ═══════ */}
      <div className="rcp-row rcp-row--wb">
        <div className="rcp-wb-display">
          <span className="rcp-wb-value">{wbKelvin}K</span>
          <span className="rcp-wb-label">COLOR TEMP</span>
        </div>
        <div className="rcp-wb-buttons">
          {WB_PRESETS.map(preset => (
            <RcpButton 
              key={preset.label}
              label={preset.label} 
              active={wbKelvin === preset.value}
              onClick={() => {
                setWbKelvin(preset.value);
                sendBmCommand('/video/whiteBalance', { whiteBalance: preset.value });
              }}
              disabled={!can('whiteBalance')}
            />
          ))}
        </div>
        <div className="rcp-wb-tint">
          <span className="rcp-wb-value">{wbTint > 0 ? '+' : ''}{wbTint}</span>
          <span className="rcp-wb-label">TINT</span>
        </div>
      </div>

      {/* ═══════ LIFT SECTION (Shadows = Sony Black) ═══════ */}
      <div className="rcp-section rcp-section--knobs">
        <div className="rcp-section__header">
          <span className="rcp-section__label">LIFT (Shadows)</span>
          <span className="rcp-section__hint">≈ Sony Black</span>
        </div>
        <div className="rcp-knob-row">
          <RotaryKnob
            label="LUMA"
            value={state.masterBlack ?? 128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              cmd('setMasterBlack', { value: v });
              sendBmCommand('/colorCorrection/lift', { 
                luma: sonyToLift(v),
                red: liftR,
                green: liftG,
                blue: liftB
              });
            }}
            disabled={!can('masterBlack')}
            size="md"
            editable
            displayValue={liftLuma.toFixed(2)}
          />
          <RotaryKnob
            label="R"
            value={state.blackR ?? 128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              cmd('setBlackBalance', { r: v, g: state.blackG ?? 128, b: state.blackB ?? 128 });
              sendBmCommand('/colorCorrection/lift', { 
                luma: liftLuma,
                red: sonyToLift(v),
                green: liftG,
                blue: liftB
              });
            }}
            disabled={!can('blackBalance')}
            size="sm"
            color="red"
            editable
            displayValue={liftR.toFixed(2)}
          />
          <RotaryKnob
            label="G"
            value={state.blackG ?? 128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              cmd('setBlackBalance', { r: state.blackR ?? 128, g: v, b: state.blackB ?? 128 });
              sendBmCommand('/colorCorrection/lift', { 
                luma: liftLuma,
                red: liftR,
                green: sonyToLift(v),
                blue: liftB
              });
            }}
            disabled={!can('blackBalance')}
            size="sm"
            color="green"
            editable
            displayValue={liftG.toFixed(2)}
          />
          <RotaryKnob
            label="B"
            value={state.blackB ?? 128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              cmd('setBlackBalance', { r: state.blackR ?? 128, g: state.blackG ?? 128, b: v });
              sendBmCommand('/colorCorrection/lift', { 
                luma: liftLuma,
                red: liftR,
                green: liftG,
                blue: sonyToLift(v)
              });
            }}
            disabled={!can('blackBalance')}
            size="sm"
            color="blue"
            editable
            displayValue={liftB.toFixed(2)}
          />
        </div>
      </div>

      {/* ═══════ GAMMA SECTION (Midtones) ═══════ */}
      <div className="rcp-section rcp-section--knobs">
        <div className="rcp-section__header">
          <span className="rcp-section__label">GAMMA (Midtones)</span>
        </div>
        <div className="rcp-knob-row">
          <RotaryKnob
            label="LUMA"
            value={state.masterGamma ?? 128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              cmd('setMasterGamma', { value: v });
              sendBmCommand('/colorCorrection/gamma', { 
                luma: sonyToGamma(v),
                red: 0,
                green: 0,
                blue: 0
              });
            }}
            disabled={!can('masterGamma')}
            size="md"
            editable
            displayValue={gammaLuma.toFixed(2)}
          />
          <RotaryKnob
            label="R"
            value={128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              sendBmCommand('/colorCorrection/gamma', { 
                luma: gammaLuma,
                red: sonyToGamma(v),
                green: 0,
                blue: 0
              });
            }}
            disabled={!can('masterGamma')}
            size="sm"
            color="red"
            editable
          />
          <RotaryKnob
            label="G"
            value={128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              sendBmCommand('/colorCorrection/gamma', { 
                luma: gammaLuma,
                red: 0,
                green: sonyToGamma(v),
                blue: 0
              });
            }}
            disabled={!can('masterGamma')}
            size="sm"
            color="green"
            editable
          />
          <RotaryKnob
            label="B"
            value={128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              sendBmCommand('/colorCorrection/gamma', { 
                luma: gammaLuma,
                red: 0,
                green: 0,
                blue: sonyToGamma(v)
              });
            }}
            disabled={!can('masterGamma')}
            size="sm"
            color="blue"
            editable
          />
        </div>
      </div>

      {/* ═══════ GAIN SECTION (Highlights = Sony White) ═══════ */}
      <div className="rcp-section rcp-section--knobs">
        <div className="rcp-section__header">
          <span className="rcp-section__label">GAIN (Highlights)</span>
          <span className="rcp-section__hint">≈ Sony White</span>
        </div>
        <div className="rcp-knob-row">
          <RotaryKnob
            label="LUMA"
            value={128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              sendBmCommand('/colorCorrection/gain', { 
                luma: sonyToGain(v),
                red: gainR,
                green: gainG,
                blue: gainB
              });
            }}
            disabled={disabled}
            size="md"
            editable
            displayValue="1.00"
          />
          <RotaryKnob
            label="R"
            value={state.whiteR ?? 128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              cmd('setWhiteBalance', { r: v, g: state.whiteG ?? 128, b: state.whiteB ?? 128 });
              sendBmCommand('/colorCorrection/gain', { 
                luma: 1.0,
                red: sonyToGain(v),
                green: gainG,
                blue: gainB
              });
            }}
            disabled={!can('whiteBalance')}
            size="sm"
            color="red"
            editable
            displayValue={gainR.toFixed(2)}
          />
          <RotaryKnob
            label="G"
            value={state.whiteG ?? 128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              cmd('setWhiteBalance', { r: state.whiteR ?? 128, g: v, b: state.whiteB ?? 128 });
              sendBmCommand('/colorCorrection/gain', { 
                luma: 1.0,
                red: gainR,
                green: sonyToGain(v),
                blue: gainB
              });
            }}
            disabled={!can('whiteBalance')}
            size="sm"
            color="green"
            editable
            displayValue={gainG.toFixed(2)}
          />
          <RotaryKnob
            label="B"
            value={state.whiteB ?? 128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              cmd('setWhiteBalance', { r: state.whiteR ?? 128, g: state.whiteG ?? 128, b: v });
              sendBmCommand('/colorCorrection/gain', { 
                luma: 1.0,
                red: gainR,
                green: gainG,
                blue: sonyToGain(v)
              });
            }}
            disabled={!can('whiteBalance')}
            size="sm"
            color="blue"
            editable
            displayValue={gainB.toFixed(2)}
          />
        </div>
      </div>

      {/* ═══════ IRIS/FOCUS ROW ═══════ */}
      <div className="rcp-section rcp-section--iris">
        <div className="rcp-iris-left">
          <RcpButton label="AF" variant="blue" onClick={() => sendBmCommand('/lens/focus/doAutoFocus', {})} disabled={!can('focus')} />
          <RcpButton label="AUTO" onClick={() => {}} disabled={!can('iris')} />
        </div>
        <div className="rcp-iris-center">
          <div className="rcp-iris-display">
            <span className="rcp-iris-display__value">F{((state.iris ?? 128) / 255 * 16 + 1.4).toFixed(1)}</span>
            <span className="rcp-iris-display__label">IRIS</span>
          </div>
        </div>
        <div className="rcp-iris-right">
          <div className="rcp-fader">
            <div className="rcp-fader__scale">
              <span>16</span>
            </div>
            <div className="rcp-fader__track">
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={state.iris ?? 128}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  cmd('setIris', { value: val });
                  sendBmCommand('/lens/iris', { normalised: val / 255 });
                }}
                disabled={!can('iris')}
                className="rcp-fader__input"
              />
              <div 
                className="rcp-fader__handle"
                style={{ bottom: `${((state.iris ?? 128) / 255) * 100}%` }}
              />
            </div>
            <div className="rcp-fader__scale">
              <span>1.4</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ CONTRAST/SATURATION ROW ═══════ */}
      <div className="rcp-section rcp-section--contrast">
        <div className="rcp-contrast-group">
          <RotaryKnob
            label="CONTRAST"
            value={128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              const adjust = (v / 128); // 0-2 range
              sendBmCommand('/colorCorrection/contrast', { pivot: 0.5, adjust });
            }}
            disabled={!can('contrast')}
            size="sm"
            editable
          />
          <RotaryKnob
            label="SATURATION"
            value={state.saturation ?? 128}
            min={0}
            max={255}
            detent={128}
            onChange={(v) => {
              cmd('setSaturation', { value: v });
              const sat = v / 128; // 0-2 range
              sendBmCommand('/colorCorrection/color', { hue: 0, saturation: sat });
            }}
            disabled={!can('saturation')}
            size="sm"
            editable
          />
        </div>
      </div>

      {/* ═══════ BOTTOM ROW ═══════ */}
      <div className="rcp-row rcp-row--bottom">
        <RcpButton label="RESET CC" onClick={() => {
          sendBmCommand('/colorCorrection/lift', { red: 0, green: 0, blue: 0, luma: 0 });
          sendBmCommand('/colorCorrection/gamma', { red: 0, green: 0, blue: 0, luma: 0 });
          sendBmCommand('/colorCorrection/gain', { red: 1, green: 1, blue: 1, luma: 1 });
          sendBmCommand('/colorCorrection/offset', { red: 0, green: 0, blue: 0, luma: 0 });
          sendBmCommand('/colorCorrection/contrast', { pivot: 0.5, adjust: 1 });
          sendBmCommand('/colorCorrection/color', { hue: 0, saturation: 1 });
        }} disabled={!can('resetCc')} />
        <div className="rcp-row__spacer" />
        <span className="rcp-status-text">REST API</span>
      </div>
    </div>
  );
}
