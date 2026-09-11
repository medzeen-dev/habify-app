// Post-build step for `npm run build` / `npm run build:dev` — the Shell counterpart of
// finalize-peer.mjs, for the same reason: `catalyst slate:link` writes
// .catalyst/slate-config.toml INTO the source directory, which for us is the build output
// and is wiped by every build (emptyOutDir). The file is two static lines, so it is
// regenerated here. Keep it in sync with the `shell` entry in ../catalyst.json if the
// framework or deployment name changes. No rename is needed: the Shell entry is index.html.
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../dist/', import.meta.url)

mkdirSync(new URL('.catalyst/', out), { recursive: true })
writeFileSync(
  new URL('.catalyst/slate-config.toml', out),
  'framework = "static"\ndeployment_name = "default"\n',
)
console.log('dist/.catalyst/slate-config.toml written')
