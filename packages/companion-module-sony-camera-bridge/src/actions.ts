import type { ModuleInstance } from './main.js'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getNumber(self: ModuleInstance, key: keyof ModuleInstance['cameraState'], fallback: number): number {
  const value = self.cameraState[key]
  return typeof value === 'number' ? value : fallback
}

export function updateActions(self: ModuleInstance): void {
  self.setActionDefinitions({
    set_iris: {
      name: 'Set iris',
      options: [
        { id: 'value', type: 'number', label: 'Iris (0-255)', default: 128, min: 0, max: 255 },
      ],
      callback: async (event) => {
        await self.sendCameraCommand('setIris', { value: Number(event.options.value) })
      },
    },
    iris_step: {
      name: 'Iris step up/down',
      options: [
        {
          id: 'direction',
          type: 'dropdown',
          label: 'Direction',
          default: 'up',
          choices: [
            { id: 'up', label: 'Up' },
            { id: 'down', label: 'Down' },
          ],
        },
        { id: 'step', type: 'number', label: 'Step size', default: 4, min: 1, max: 64 },
      ],
      callback: async (event) => {
        const current = getNumber(self, 'iris', 128)
        const delta = Number(event.options.step) * (event.options.direction === 'down' ? -1 : 1)
        await self.sendCameraCommand('setIris', { value: clamp(current + delta, 0, 255) })
      },
    },
    set_master_gain: {
      name: 'Set master gain',
      options: [
        { id: 'value', type: 'number', label: 'Gain index (0-6)', default: 0, min: 0, max: 6 },
      ],
      callback: async (event) => {
        await self.sendCameraCommand('setMasterGain', { value: Number(event.options.value) })
      },
    },
    set_master_black: {
      name: 'Set master black',
      options: [
        { id: 'value', type: 'number', label: 'Master black (0-255)', default: 128, min: 0, max: 255 },
      ],
      callback: async (event) => {
        await self.sendCameraCommand('setMasterBlack', { value: Number(event.options.value) })
      },
    },
    set_master_gamma: {
      name: 'Set master gamma',
      options: [
        { id: 'value', type: 'number', label: 'Master gamma (0-255)', default: 128, min: 0, max: 255 },
      ],
      callback: async (event) => {
        await self.sendCameraCommand('setMasterGamma', { value: Number(event.options.value) })
      },
    },
    set_saturation: {
      name: 'Set saturation',
      options: [
        { id: 'value', type: 'number', label: 'Saturation (0-255)', default: 128, min: 0, max: 255 },
      ],
      callback: async (event) => {
        await self.sendCameraCommand('setSaturation', { value: Number(event.options.value) })
      },
    },
    set_detail_level: {
      name: 'Set detail level',
      options: [
        { id: 'value', type: 'number', label: 'Detail level (0-255)', default: 128, min: 0, max: 255 },
      ],
      callback: async (event) => {
        await self.sendCameraCommand('setDetailLevel', { value: Number(event.options.value) })
      },
    },
    set_shutter_speed: {
      name: 'Set shutter speed',
      options: [
        { id: 'value', type: 'number', label: 'Shutter speed', default: 0, min: 0, max: 100000 },
      ],
      callback: async (event) => {
        await self.sendCameraCommand('setShutterSpeed', { value: Number(event.options.value) })
      },
    },
    set_nd_filter: {
      name: 'Set ND filter',
      options: [
        {
          id: 'value',
          type: 'dropdown',
          label: 'ND filter',
          default: 0,
          choices: [
            { id: 0, label: 'ND 1' },
            { id: 1, label: 'ND 2' },
            { id: 2, label: 'ND 3' },
            { id: 3, label: 'ND 4' },
          ],
        },
      ],
      callback: async (event) => {
        await self.sendCameraCommand('setNdFilter', { value: Number(event.options.value) })
      },
    },
    set_bars: {
      name: 'Set bars on/off',
      options: [
        {
          id: 'on',
          type: 'dropdown',
          label: 'Bars',
          default: 'toggle',
          choices: [
            { id: 'toggle', label: 'Toggle' },
            { id: 'on', label: 'On' },
            { id: 'off', label: 'Off' },
          ],
        },
      ],
      callback: async (event) => {
        const option = String(event.options.on)
        const next = option === 'toggle' ? !Boolean(self.cameraState.bars) : option === 'on'
        await self.sendCameraCommand('setBars', { on: next })
      },
    },
    set_camera_power: {
      name: 'Set camera power',
      options: [
        {
          id: 'on',
          type: 'dropdown',
          label: 'Power',
          default: 'toggle',
          choices: [
            { id: 'toggle', label: 'Toggle' },
            { id: 'on', label: 'On' },
            { id: 'off', label: 'Off' },
          ],
        },
      ],
      callback: async (event) => {
        const option = String(event.options.on)
        const next = option === 'toggle' ? !Boolean(self.cameraState.cameraPower) : option === 'on'
        await self.sendCameraCommand('setCameraPower', { on: next })
      },
    },
    tally_program: {
      name: 'Set program tally',
      options: [
        {
          id: 'mode',
          type: 'dropdown',
          label: 'Mode',
          default: 'toggle',
          choices: [
            { id: 'toggle', label: 'Toggle' },
            { id: 'on', label: 'On' },
            { id: 'off', label: 'Off' },
          ],
        },
      ],
      callback: async (event) => {
        const option = String(event.options.mode)
        const next = option === 'toggle' ? !self.tallyState.program : option === 'on'
        await self.sendTally({ program: next })
      },
    },
    tally_preview: {
      name: 'Set preview tally',
      options: [
        {
          id: 'mode',
          type: 'dropdown',
          label: 'Mode',
          default: 'toggle',
          choices: [
            { id: 'toggle', label: 'Toggle' },
            { id: 'on', label: 'On' },
            { id: 'off', label: 'Off' },
          ],
        },
      ],
      callback: async (event) => {
        const option = String(event.options.mode)
        const next = option === 'toggle' ? !self.tallyState.preview : option === 'on'
        await self.sendTally({ preview: next })
      },
    },
    tally_clear: {
      name: 'Clear all tally',
      options: [],
      callback: async () => {
        await self.sendTally({ program: false, preview: false, isoRec: false })
      },
    },
  })
}
