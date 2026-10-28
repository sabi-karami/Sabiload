# Security Policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please **do not** open a public issue. Email **saheb.karami@gmail.com** with:

- a description of the issue and its impact
- steps to reproduce
- the version and operating system

You will get a reply within 72 hours.

## Design notes

- The browser bridge listens on `127.0.0.1` only and requires a custom header, so ordinary web pages cannot add downloads (the header forces a CORS preflight, which is answered only for extension origins).
- The renderer runs with `contextIsolation` and talks to the main process only through a fixed list of IPC channels.
- `openExternal` accepts only `http`, `https`, `mailto` and `tg` links.
