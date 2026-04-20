import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
  host: string
  httpPort: number
  wsPort: number
  pollInterval: number
}

export const DEFAULT_CONFIG: ModuleConfig = {
  host: '127.0.0.1',
  httpPort: 9702,
  wsPort: 9701,
  pollInterval: 1000,
}

export function getConfigFields(): SomeCompanionConfigField[] {
  return [
    {
      type: 'static-text',
      id: 'info',
      width: 12,
      label: 'Information',
      value:
        'Connects to the local Sony/Blackmagic bridge. Start the bridge first, then add actions/feedbacks in Companion.',
    },
    {
      type: 'textinput',
      id: 'host',
      label: 'Bridge Host',
      width: 6,
      default: DEFAULT_CONFIG.host,
      useVariables: true,
      regex: Regex.SOMETHING,
    },
    {
      type: 'number',
      id: 'httpPort',
      label: 'HTTP Port',
      width: 3,
      default: DEFAULT_CONFIG.httpPort,
      min: 1,
      max: 65535,
    },
    {
      type: 'number',
      id: 'wsPort',
      label: 'WebSocket Port',
      width: 3,
      default: DEFAULT_CONFIG.wsPort,
      min: 1,
      max: 65535,
    },
    {
      type: 'number',
      id: 'pollInterval',
      label: 'HTTP Poll Interval (ms)',
      width: 6,
      default: DEFAULT_CONFIG.pollInterval,
      min: 250,
      max: 10000,
    },
  ]
}
