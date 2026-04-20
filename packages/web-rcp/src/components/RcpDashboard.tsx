import React from 'react';
import type { CameraState } from '../types.ts';
import { Dial, Toggle, Select } from './Controls.tsx';

interface Props {
  state: CameraState;
  disabled: boolean;
  onCommand: (cmd: string, params: Record<string, unknown>) => void;
}

const GAIN_OPTIONS = [
  { label: '-3 dB', value: 0 },
  { label: '0 dB', value: 1 },
  { label: '+3 dB', value: 2 },
  { label: '+6 dB', value: 3 },
  { label: '+9 dB', value: 4 },
  { label: '+12 dB', value: 5 },
  { label: '+18 dB', value: 6 },
  { label: '+24 dB', value: 7 },
];

const ND_OPTIONS = [
  { label: 'Clear', value: 0 },
  { label: '1/4 (ND4)', value: 1 },
  { label: '1/16 (ND16)', value: 2 },
  { label: '1/64 (ND64)', value: 3 },
];

const SHUTTER_OPTIONS = [
  { label: '1/50', value: 0 },
  { label: '1/60', value: 1 },
  { label: '1/100', value: 2 },
  { label: '1/120', value: 3 },
  { label: '1/250', value: 4 },
  { label: '1/500', value: 5 },
  { label: '1/1000', value: 6 },
  { label: '1/2000', value: 7 },
];

export function RcpDashboard({ state, disabled, onCommand }: Props) {
  const cmd = (name: string, params: Record<string, unknown>) => onCommand(name, params);

  return (
    <div className="rcp">

      {/* Top Row: Power, Bars */}
      <div className="rcp__row rcp__row--top">
        <Toggle
          label={state.cameraPower ? 'CAM ON' : 'CAM OFF'}
          value={state.cameraPower}
          onChange={(on) => cmd('setCameraPower', { on })}
          disabled={disabled}
          activeColor="#2ecc71"
        />
        <Toggle
          label="BARS"
          value={state.bars}
          onChange={(on) => cmd('setBars', { on })}
          disabled={disabled}
        />
      </div>

      {/* Exposure Section */}
      <section className="rcp__section">
        <h3 className="rcp__section-title">Exposure</h3>
        <div className="rcp__grid">
          <Dial
            label="Iris"
            value={state.iris}
            min={0}
            max={4096}
            onChange={(v) => cmd('setIris', { value: v })}
            disabled={disabled}
          />
          <Select
            label="ND Filter"
            value={state.ndFilter}
            options={ND_OPTIONS}
            onChange={(v) => cmd('setNdFilter', { value: v })}
            disabled={disabled}
          />
          <Select
            label="Master Gain"
            value={state.masterGain}
            options={GAIN_OPTIONS}
            onChange={(v) => cmd('setMasterGain', { value: v })}
            disabled={disabled}
          />
          <Select
            label="Shutter"
            value={state.shutterSpeed}
            options={SHUTTER_OPTIONS}
            onChange={(v) => cmd('setShutterSpeed', { value: v })}
            disabled={disabled}
          />
        </div>
      </section>

      {/* Black Section */}
      <section className="rcp__section">
        <h3 className="rcp__section-title">Black</h3>
        <div className="rcp__grid">
          <Dial
            label="Master Black"
            value={state.masterBlack}
            min={0}
            max={4096}
            onChange={(v) => cmd('setMasterBlack', { value: v })}
            disabled={disabled}
          />
          <Dial
            label="Black R"
            value={state.blackR}
            min={0}
            max={4096}
            onChange={(v) => cmd('setBlackBalance', { r: v, g: state.blackG ?? 2048, b: state.blackB ?? 2048 })}
            disabled={disabled}
          />
          <Dial
            label="Black G"
            value={state.blackG}
            min={0}
            max={4096}
            onChange={(v) => cmd('setBlackBalance', { r: state.blackR ?? 2048, g: v, b: state.blackB ?? 2048 })}
            disabled={disabled}
          />
          <Dial
            label="Black B"
            value={state.blackB}
            min={0}
            max={4096}
            onChange={(v) => cmd('setBlackBalance', { r: state.blackR ?? 2048, g: state.blackG ?? 2048, b: v })}
            disabled={disabled}
          />
        </div>
      </section>

      {/* White Section */}
      <section className="rcp__section">
        <h3 className="rcp__section-title">White Balance</h3>
        <div className="rcp__grid">
          <Dial
            label="White R"
            value={state.whiteR}
            min={0}
            max={4096}
            onChange={(v) => cmd('setWhiteBalance', { r: v, g: state.whiteG ?? 2048, b: state.whiteB ?? 2048 })}
            disabled={disabled}
          />
          <Dial
            label="White G"
            value={state.whiteG}
            min={0}
            max={4096}
            onChange={(v) => cmd('setWhiteBalance', { r: state.whiteR ?? 2048, g: v, b: state.whiteB ?? 2048 })}
            disabled={disabled}
          />
          <Dial
            label="White B"
            value={state.whiteB}
            min={0}
            max={4096}
            onChange={(v) => cmd('setWhiteBalance', { r: state.whiteR ?? 2048, g: state.whiteG ?? 2048, b: v })}
            disabled={disabled}
          />
        </div>
      </section>

      {/* Gamma / Picture Section */}
      <section className="rcp__section">
        <h3 className="rcp__section-title">Picture</h3>
        <div className="rcp__grid">
          <Dial
            label="Master Gamma"
            value={state.masterGamma}
            min={0}
            max={4096}
            onChange={(v) => cmd('setMasterGamma', { value: v })}
            disabled={disabled}
          />
          <Dial
            label="Saturation"
            value={state.saturation}
            min={0}
            max={4096}
            onChange={(v) => cmd('setSaturation', { value: v })}
            disabled={disabled}
          />
          <Dial
            label="Detail Level"
            value={state.detailLevel}
            min={0}
            max={4096}
            onChange={(v) => cmd('setDetailLevel', { value: v })}
            disabled={disabled}
          />
          <Dial
            label="White Clip"
            value={state.masterWhiteClip}
            min={0}
            max={4096}
            onChange={(v) => cmd('setMasterWhiteClip', { value: v })}
            disabled={disabled}
          />
        </div>
      </section>

    </div>
  );
}
