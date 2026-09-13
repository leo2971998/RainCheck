import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps the WASM runtime peer packages needed by clean Linux installs', () => {
  const { packages } = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  // A Windows npm install can prune these while the warm local build still passes.
  // Vercel validates these required peers during npm ci, even when WASM is optional.
  const peers = packages['node_modules/@napi-rs/wasm-runtime'].peerDependencies;
  for (const name of ['@emnapi/core', '@emnapi/runtime']) {
    expect(peers[name]).toBeTruthy();
    expect(packages[`node_modules/${name}`]?.version, `${name} must remain locked`).toBeTruthy();
    expect(packages[`node_modules/${name}`]?.integrity).toMatch(/^sha512-/);
  }
});
