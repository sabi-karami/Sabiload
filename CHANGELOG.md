# Changelog

## 1.0.1 — 2026-10-28

### Fixed
- Persian name is now spelled **صابی‌لود** everywhere: app, tray menu, browser extension, website, README and release notes

## 1.0.0 — 2026-10-28

First public release of **Sabiload**. 🎉

### Engine
- Multi-network bonding across Wi-Fi, Ethernet, mobile data and USB tethering
- Per-adapter socket pinning (source address on Windows/macOS, `SO_BINDTODEVICE` on Linux 5.7+)
- Shared chunk queue with work stealing for a fast finish
- Auto streams: 4 to 32 per network, with backoff on 429/503
- Crash-safe resume with checkpoints every 2 seconds
- Networks can be added or removed mid-download
- Expired-link replacement without losing progress
- Detects files that changed on the server
- Single-stream fallback for servers without range support

### App
- Four themes: Nebula, Aurora, Royal and Pearl
- Full Persian (RTL) and English interface
- Hero dashboard with combined speed, boost factor and a live stacked chart
- Detail drawer with block map, per-network share and throughput chart
- Queue with concurrency, reordering and bulk actions
- Scheduler (overnight windows supported), slow mode, global and per-network speed limits
- Daily and monthly data caps per network, with usage tracking
- Clipboard watcher, drag and drop, paste-to-download, `sabiload://` links
- Tray icon, notifications, keep-awake, auto-update from GitHub Releases

### Browser extension
- Chrome, Edge and Firefox (MV3)
- Hands downloads over with the site's cookies
- Right-click menu, site exclusions, minimum file size
