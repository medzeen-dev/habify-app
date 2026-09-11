// Copies functions/_shared/peer-common.js into every function folder that uses it.
// Catalyst packs one folder per function and cannot follow a require() outside it, so the
// shared core has to be physically present in each. Run after editing the source, before
// deploying, and commit the copies — a forgotten sync must show up as a diff, not as a
// silent old deploy.
//
//     node functions/sync-shared.mjs          # copy
//     node functions/sync-shared.mjs --check  # exit 1 if any copy is stale (for CI/hooks)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '_shared', 'peer-common.js');
const targets = ['peer', 'peersweep'].map((f) => join(here, f, '_shared', 'peer-common.js'));
const check = process.argv.includes('--check');

const src = readFileSync(source, 'utf8');
let stale = 0;
for (const t of targets) {
  const cur = existsSync(t) ? readFileSync(t, 'utf8') : null;
  if (cur === src) { console.log('ok      ' + t); continue; }
  if (check) { console.log('STALE   ' + t); stale++; continue; }
  mkdirSync(dirname(t), { recursive: true });
  writeFileSync(t, src);
  console.log('synced  ' + t);
}
if (check && stale) process.exit(1);
