import os from 'node:os'
import { execFile } from 'node:child_process'
import { access, readlink } from 'node:fs/promises'
import type { NetAddress, NetKind } from '../../../shared/types'

export interface RawInterface {
  device: string
  hardware: string
  kind: NetKind
  addresses: NetAddress[]
}

/** Adapters that never lead to the internet on their own. */
const VIRTUAL =
  /^(lo\d*|docker|veth|br-|virbr|vmnet|vboxnet|awdl|llw|anpi|ap\d|bridge\d|gif|stf|isatap|teredo|vethernet|loopback|lxc|lxd|cni|flannel|cali|kube|vnic|ham)/i

function usableAddress(a: os.NetworkInterfaceInfo): boolean {
  if (a.internal) return false
  if (a.family === 'IPv4') return !a.address.startsWith('169.254.')
  const lower = a.address.toLowerCase()
  return !(
    lower.startsWith('fe80') ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd')
  )
}

function run(cmd: string, args: string[], timeout = 4000): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) =>
      resolve(err ? '' : String(stdout))
    )
  })
}

let macPorts: Map<string, string> | null = null
let macPortsAt = 0
async function macHardware(): Promise<Map<string, string>> {
  if (macPorts && Date.now() - macPortsAt < 60_000) return macPorts
  const out = await run('networksetup', ['-listallhardwareports'])
  const map = new Map<string, string>()
  let port = ''
  for (const line of out.split('\n')) {
    const p = line.match(/^Hardware Port:\s*(.+)$/)
    if (p) port = p[1].trim()
    const d = line.match(/^Device:\s*(.+)$/)
    if (d && port) map.set(d[1].trim(), port)
  }
  macPorts = map
  macPortsAt = Date.now()
  return map
}

let winAdapters: Map<string, string> | null = null
let winAdaptersAt = 0
async function windowsHardware(): Promise<Map<string, string>> {
  if (winAdapters && Date.now() - winAdaptersAt < 60_000) return winAdapters
  const out = await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-NetAdapter | Select-Object Name,InterfaceDescription | ConvertTo-Json -Compress'
    ],
    6000
  )
  const map = new Map<string, string>()
  try {
    const parsed = JSON.parse(out) as
      | { Name: string; InterfaceDescription: string }
      | { Name: string; InterfaceDescription: string }[]
    for (const a of Array.isArray(parsed) ? parsed : [parsed])
      map.set(a.Name, a.InterfaceDescription)
  } catch {
    /* PowerShell missing or blocked: fall back to names. */
  }
  winAdapters = map
  winAdaptersAt = Date.now()
  return map
}

async function linuxDriver(device: string): Promise<string> {
  try {
    const link = await readlink(`/sys/class/net/${device}/device/driver`)
    return link.split('/').pop() ?? ''
  } catch {
    return ''
  }
}

async function linuxIsWireless(device: string): Promise<boolean> {
  try {
    await access(`/sys/class/net/${device}/wireless`)
    return true
  } catch {
    return false
  }
}

export function classify(device: string, hardware: string): NetKind {
  const s = `${device} ${hardware}`.toLowerCase()
  if (/wireguard|openvpn|\bvpn\b|tap-|tap\d|^tun|tun\d|^wg\d|tailscale|zerotier|nordlynx|proton|utun|ipsec|ppp.*vpn/.test(s))
    return 'vpn'
  if (/iphone|android|rndis|remote ndis|cdc_ether|cdc_ncm|ipheth|usb.*(tether|modem)|^usb\d|^rndis/.test(s))
    return 'usb'
  if (/wi-?fi|wireless|wlan|802\.11|airport|^wl/.test(s)) return 'wifi'
  if (/cellular|mobile broadband|wwan|lte|5g|4g|^ww|^ppp|modem/.test(s)) return 'cellular'
  if (/ethernet|\blan\b|gigabit|realtek|intel.*connection|^en|^eth|thunderbolt|usb.*lan/.test(s))
    return 'ethernet'
  return 'other'
}

/** Every adapter that could carry traffic to the internet, with its usable addresses. */
export async function listInterfaces(): Promise<RawInterface[]> {
  const all = os.networkInterfaces()
  const hw =
    process.platform === 'darwin'
      ? await macHardware()
      : process.platform === 'win32'
        ? await windowsHardware()
        : null
  const result: RawInterface[] = []
  for (const [device, infos] of Object.entries(all)) {
    if (!infos || VIRTUAL.test(device)) continue
    const addresses: NetAddress[] = infos.filter(usableAddress).map((a) => ({
      address: a.address,
      family: a.family === 'IPv4' ? 4 : 6
    }))
    if (!addresses.length) continue
    let hardware = hw?.get(device) ?? ''
    if (process.platform === 'linux') {
      const driver = await linuxDriver(device)
      if (await linuxIsWireless(device)) hardware = 'Wireless'
      if (driver) hardware = hardware ? `${hardware} (${driver})` : driver
    }
    if (/hyper-v|virtualbox|vmware|loopback|bluetooth pan/i.test(hardware)) continue
    result.push({ device, hardware, kind: classify(device, hardware), addresses })
  }
  // IPv4 first inside each adapter: it is still the faster path on most mobile networks.
  for (const r of result) r.addresses.sort((a, b) => a.family - b.family)
  return result
}
