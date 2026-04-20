import { combineRgb } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function updateFeedbacks(self: ModuleInstance): void {
  self.setFeedbackDefinitions({
    bridge_connected: {
      type: 'boolean',
      name: 'Bridge reachable',
      defaultStyle: {
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(0, 102, 204),
      },
      options: [],
      callback: () => self.bridgeConnected,
    },
    camera_connected: {
      type: 'boolean',
      name: 'Camera connected',
      defaultStyle: {
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(0, 153, 0),
      },
      options: [],
      callback: () => self.cameraConnected,
    },
    tally_program: {
      type: 'boolean',
      name: 'Program tally active',
      defaultStyle: {
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(204, 0, 0),
      },
      options: [],
      callback: () => self.tallyState.program,
    },
    tally_preview: {
      type: 'boolean',
      name: 'Preview tally active',
      defaultStyle: {
        color: combineRgb(0, 0, 0),
        bgcolor: combineRgb(0, 204, 0),
      },
      options: [],
      callback: () => self.tallyState.preview,
    },
    tally_iso_rec: {
      type: 'boolean',
      name: 'ISO record active',
      defaultStyle: {
        color: combineRgb(255, 255, 255),
        bgcolor: combineRgb(255, 102, 0),
      },
      options: [],
      callback: () => self.tallyState.isoRec,
    },
  })
}
