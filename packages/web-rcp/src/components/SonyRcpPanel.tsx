import React from 'react';
import { RotaryKnob } from './RotaryKnob.tsx';
import { TallyBar, TallyState } from './TallyBar.tsx';
import { SonyButton, SonySelect, SonyFader } from './SonyControls.tsx';
import type { CameraState } from '../types.ts';

interface SonyRcpPanelProps {
  state: CameraState;
  tally: TallyState;
  disabled?: boolean;
  onCommand: (cmd: string, params: Record<string, unknown>) => void;
  onSetTally: (tally: Partial<TallyState>) => void;
}

// Gain options (0dB to +18dB)
const GAIN_OPTIONS = [
  { value: 0, label: '0dB' },
  { value: 1, label: '+3dB' },
  { value: 2, label: '+6dB' },
  { value: 3, label: '+9dB' },
  { value: 4, label: '+12dB' },
  { value: 5, label: '+15dB' },
  { value: 6, label: '+18dB' },
];

// ND filter options
const ND_OPTIONS = [
  { value: 0, label: 'CLEAR' },
  { value: 1, label: '1/4' },
  { value: 2, label: '1/16' },
  { value: 3, label: '1/64' },
];

// Shutter options
const SHUTTER_OPTIONS = [
  { value: 0, label: 'OFF' },
  { value: 1, label: '1/60' },
  { value: 2, label: '1/100' },
  { value: 3, label: '1/120' },
  { value: 4, label: '1/250' },
  { value: 5, label: '1/500' },
  { value: 6, label: '1/1000' },
  { value: 7, label: '1/2000' },
];

/**
 * Sony RCP-1500 style control panel
 * Full camera control with realistic Sony look and feel
 */
export function SonyRcpPanel({ state, tally, disabled = false, onCommand, onSetTally }: SonyRcpPanelProps) {
  const cmd = (c: string, params: Record<string, unknown> = {}) => onCommand(c, params);

  return (
    <div className={`sony-rcp ${disabled ? 'sony-rcp--disabled' : ''}`}>
      {/* ═══════════ TOP: TALLY BAR ═══════════ */}
      <TallyBar tally={tally} cameraId="CAM 1" onSetTally={onSetTally} />

      {/* ═══════════ MAIN PANEL ═══════════ */}
      <div className="sony-rcp__body">
        
        {/* ─── LEFT SECTION: EXPOSURE ─── */}
        <section className="sony-rcp__section sony-rcp__section--exposure">
          <div className="sony-rcp__section-header">EXPOSURE</div>
          
          <div className="sony-rcp__iris-group">
            <RotaryKnob
              label="IRIS"
              value={state.iris ?? 128}
              min={0}
              max={255}
              onChange={(v) => cmd('setIris', { value: v })}
              disabled={disabled}
              size="lg"
              color="default"
            />
            <SonyFader
              label="IRIS"
              value={state.iris ?? 128}
              onChange={(v) => cmd('setIris', { value: v })}
              disabled={disabled}
              vertical
            />
          </div>

          <div className="sony-rcp__row">
            <SonySelect
              label="ND FILTER"
              value={state.ndFilter ?? 0}
              options={ND_OPTIONS}
              onChange={(v) => cmd('setNdFilter', { value: v })}
              disabled={disabled}
            />
          </div>

          <div className="sony-rcp__row">
            <SonySelect
              label="GAIN"
              value={state.masterGain ?? 0}
              options={GAIN_OPTIONS}
              onChange={(v) => cmd('setMasterGain', { value: v })}
              disabled={disabled}
            />
          </div>

          <div className="sony-rcp__row">
            <SonySelect
              label="SHUTTER"
              value={state.shutterSpeed ?? 0}
              options={SHUTTER_OPTIONS}
              onChange={(v) => cmd('setShutterSpeed', { value: v })}
              disabled={disabled}
            />
          </div>
        </section>

        {/* ─── CENTER SECTION: BLACK / WHITE BALANCE ─── */}
        <section className="sony-rcp__section sony-rcp__section--paint">
          
          {/* BLACK BALANCE */}
          <div className="sony-rcp__subsection">
            <div className="sony-rcp__section-header">BLACK</div>
            <div className="sony-rcp__knob-row">
              <RotaryKnob
                label="MASTER"
                value={state.masterBlack ?? 128}
                min={0}
                max={255}
                detent={128}
                onChange={(v) => cmd('setMasterBlack', { value: v })}
                disabled={disabled}
                size="md"
              />
              <RotaryKnob
                label="R"
                value={state.blackR ?? 128}
                min={0}
                max={255}
                detent={128}
                onChange={(v) => cmd('setBlackBalance', { r: v, g: state.blackG ?? 128, b: state.blackB ?? 128 })}
                disabled={disabled}
                size="sm"
                color="red"
              />
              <RotaryKnob
                label="G"
                value={state.blackG ?? 128}
                min={0}
                max={255}
                detent={128}
                onChange={(v) => cmd('setBlackBalance', { r: state.blackR ?? 128, g: v, b: state.blackB ?? 128 })}
                disabled={disabled}
                size="sm"
                color="green"
              />
              <RotaryKnob
                label="B"
                value={state.blackB ?? 128}
                min={0}
                max={255}
                detent={128}
                onChange={(v) => cmd('setBlackBalance', { r: state.blackR ?? 128, g: state.blackG ?? 128, b: v })}
                disabled={disabled}
                size="sm"
                color="blue"
              />
            </div>
          </div>

          {/* WHITE BALANCE */}
          <div className="sony-rcp__subsection">
            <div className="sony-rcp__section-header">WHITE</div>
            <div className="sony-rcp__knob-row">
              <RotaryKnob
                label="R"
                value={state.whiteR ?? 128}
                min={0}
                max={255}
                detent={128}
                onChange={(v) => cmd('setWhiteBalance', { r: v, g: state.whiteG ?? 128, b: state.whiteB ?? 128 })}
                disabled={disabled}
                size="md"
                color="red"
              />
              <RotaryKnob
                label="G"
                value={state.whiteG ?? 128}
                min={0}
                max={255}
                detent={128}
                onChange={(v) => cmd('setWhiteBalance', { r: state.whiteR ?? 128, g: v, b: state.whiteB ?? 128 })}
                disabled={disabled}
                size="md"
                color="green"
              />
              <RotaryKnob
                label="B"
                value={state.whiteB ?? 128}
                min={0}
                max={255}
                detent={128}
                onChange={(v) => cmd('setWhiteBalance', { r: state.whiteR ?? 128, g: state.whiteG ?? 128, b: v })}
                disabled={disabled}
                size="md"
                color="blue"
              />
            </div>
            <div className="sony-rcp__btn-row">
              <SonyButton
                label="AWB"
                sublabel="A"
                onClick={() => cmd('autoWhiteBalance', { preset: 'A' })}
                disabled={disabled}
                variant="yellow"
              />
              <SonyButton
                label="AWB"
                sublabel="B"
                onClick={() => cmd('autoWhiteBalance', { preset: 'B' })}
                disabled={disabled}
                variant="yellow"
              />
            </div>
          </div>
        </section>

        {/* ─── RIGHT SECTION: PICTURE ─── */}
        <section className="sony-rcp__section sony-rcp__section--picture">
          <div className="sony-rcp__section-header">PICTURE</div>

          <div className="sony-rcp__knob-row">
            <RotaryKnob
              label="GAMMA"
              value={state.masterGamma ?? 128}
              min={0}
              max={255}
              detent={128}
              onChange={(v) => cmd('setMasterGamma', { value: v })}
              disabled={disabled}
              size="md"
            />
            <RotaryKnob
              label="SAT"
              value={state.saturation ?? 128}
              min={0}
              max={255}
              detent={128}
              onChange={(v) => cmd('setSaturation', { value: v })}
              disabled={disabled}
              size="md"
            />
          </div>

          <div className="sony-rcp__knob-row">
            <RotaryKnob
              label="DETAIL"
              value={state.detailLevel ?? 128}
              min={0}
              max={255}
              detent={128}
              onChange={(v) => cmd('setDetailLevel', { value: v })}
              disabled={disabled}
              size="md"
            />
            <RotaryKnob
              label="KNEE"
              value={128}
              min={0}
              max={255}
              detent={128}
              onChange={() => {}}
              disabled={disabled}
              size="md"
            />
          </div>
        </section>
      </div>

      {/* ═══════════ BOTTOM: SYSTEM CONTROLS ═══════════ */}
      <div className="sony-rcp__footer">
        <div className="sony-rcp__system-btns">
          <SonyButton
            label="BARS"
            active={state.bars ?? false}
            onClick={() => cmd('setBars', { on: !(state.bars ?? false) })}
            disabled={disabled}
            variant="yellow"
          />
          <SonyButton
            label="POWER"
            active={state.cameraPower ?? false}
            onClick={() => cmd('setCameraPower', { on: !(state.cameraPower ?? false) })}
            disabled={disabled}
            variant="red"
          />
          <SonyButton
            label="CALL"
            onClick={() => {}}
            disabled={disabled}
            variant="green"
          />
          <SonyButton
            label="SCENE"
            sublabel="1"
            onClick={() => {}}
            disabled={disabled}
          />
          <SonyButton
            label="SCENE"
            sublabel="2"
            onClick={() => {}}
            disabled={disabled}
          />
        </div>

        <div className="sony-rcp__logo">
          <span className="sony-rcp__logo-text">SONY</span>
          <span className="sony-rcp__model">RCP-1500</span>
        </div>
      </div>
    </div>
  );
}
