// Post-build step for `npm run build:peer`. Two jobs, both consequences of how the peer
// app is hosted (DL-086 origin split, Catalyst Slate):
//
// 1. Slate serves an app from its root (Catalyst_Platform_Capabilities A3), so the peer
//    entry has to be that app's index.html. Vite names the output after its input, hence
//    the rename. Asset references inside are root-absolute (/assets/…) and unaffected.
//
// 2. `catalyst slate:link` writes .catalyst/slate-config.toml INTO the source directory —
//    which for us is the build output, wiped by every build (emptyOutDir). Rather than
//    keeping a copy somewhere and restoring it, the file is regenerated here: its content
//    is two static lines, and the CLI treats it as generated anyway. Keep it in sync with
//    the `slate` entry in ../catalyst.json if the framework or deployment name changes.
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'

const out = new URL('../dist-peer/', import.meta.url)

renameSync(new URL('peer.html', out), new URL('index.html', out))
console.log('dist-peer/peer.html → dist-peer/index.html')

mkdirSync(new URL('.catalyst/', out), { recursive: true })
writeFileSync(
  new URL('.catalyst/slate-config.toml', out),
  'framework = "static"\ndeployment_name = "default"\n',
)
console.log('dist-peer/.catalyst/slate-config.toml written')
