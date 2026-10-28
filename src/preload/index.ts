import { contextBridge, ipcRenderer } from 'electron'
import { INVOKE_CHANNELS, type SabiApi } from '../shared/ipc'

const api: Record<string, unknown> = {}
for (const name of INVOKE_CHANNELS) {
  api[name] = (...args: unknown[]) => ipcRenderer.invoke(`sabi:${name}`, ...args)
}
api.setTitleBar = (color: string, symbolColor: string) =>
  ipcRenderer.send('sabi:setTitleBar', color, symbolColor)
api.on = (event: string, cb: (payload: unknown) => void) => {
  const listener = (_e: unknown, payload: unknown): void => cb(payload)
  ipcRenderer.on(`sabi:${event}`, listener)
  return () => ipcRenderer.removeListener(`sabi:${event}`, listener)
}

contextBridge.exposeInMainWorld('sabi', api as unknown as SabiApi)
