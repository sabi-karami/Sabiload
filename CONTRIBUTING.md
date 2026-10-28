# Contributing to Sabiload

Thanks for helping make Sabiload faster! · ممنون که به بهتر شدن صابی‌لود کمک می‌کنید!

## Getting started

```bash
npm ci
npm run dev        # app with hot reload
npm test           # engine tests
npm run typecheck
```

Node.js 22 or newer is required.

## Where things live

| Area | Path |
|---|---|
| Transfer engine (chunks, stealing, autoscaling, resume) | `src/main/core/engine.ts` |
| Queue, persistence, schedule | `src/main/core/manager.ts` |
| Adapter discovery and pinned sockets | `src/main/core/net/` |
| UI | `src/renderer/src/` |
| Translations (fa/en) | `src/renderer/src/i18n.ts` |
| Browser extension | `extension/` |
| Website and live demo | `docs/` |

## Pull requests

- Keep each PR focused on one change, and describe *why* it is needed.
- Add or update a test in `tests/` whenever you touch the engine.
- Every new UI string needs both a Persian and an English translation.
- Run `npm run typecheck && npm test` before pushing.

## Reporting bugs

Please open an issue with your OS, Sabiload version, the networks you use (Wi-Fi, USB phone, …) and, if possible, a link that reproduces the problem.
