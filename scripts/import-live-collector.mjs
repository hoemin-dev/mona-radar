// One-time, explicit vendor refresh. Runtime never accesses the source projects.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';
const source = resolve(process.argv[2] || '../mona-radar-market/collector');
const destination = resolve('server/collector/vendor');
const manifest = [];
const visited = new Set();
function copy(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const original = readFileSync(file, 'utf8');
  const code = transformSync(original, { loader: 'ts', format: 'esm', target: 'node22' }).code;
  const name = relative(source, file).replaceAll('\\', '/').replace(/\.ts$/, '.js');
  const output = resolve(destination, name);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, '// Vendored from mona-radar-market; see provenance.json.\n' + code);
  manifest.push({ source: relative(source, file).replaceAll('\\', '/'), output: name, sha256: createHash('sha256').update(original).digest('hex') });
  for (const match of code.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
    copy(resolve(dirname(file), match[1].replace(/\.js$/, '.ts')));
  }
}
for (const name of ['koneps/client', 'koneps/target-query', 'normalization/bid-notice-repository', 'orchestration/award-collector', 'orchestration/contract-collector']) copy(resolve(source, name + '.ts'));
writeFileSync(resolve(destination, 'provenance.json'), JSON.stringify({ project: 'mona-radar-market', conversion: 'esbuild TypeScript erasure, ESM, node22', files: manifest.sort((a,b)=>a.source.localeCompare(b.source)) }, null, 2) + '\n');
console.log(`Imported ${manifest.length} collector modules.`);
