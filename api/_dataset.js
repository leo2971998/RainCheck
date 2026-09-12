import { loadNessieSnapshot, loadSnapshotLike } from './_nessie.js';

export function datasetConfig(name = 'demo', env = process.env) {
  if (!['demo', 'backend'].includes(name)) throw new Error('Unknown dataset. Use demo or backend.');
  const prefix = name === 'backend' ? 'NESSIE_TEST_' : 'NESSIE_';
  const config = { customerId: env[prefix + 'CUSTOMER_ID'], checkingId: env[prefix + 'CHECKING_ID'], savingsId: env[prefix + 'SAVINGS_ID'],
    asOf: name === 'backend' ? env.NESSIE_TEST_AS_OF : env.VITE_DEMO_DATE || new Date().toISOString().slice(0, 10) };
  if (name === 'backend' && Object.values(config).some(v => !v)) throw new Error('The backend test dataset is not configured.');
  return config;
}

export async function readDataset(name = 'demo', { allowSnapshot = false } = {}) {
  const config = datasetConfig(name);
  const snap = name === 'demo' && allowSnapshot ? await loadSnapshotLike() : await loadNessieSnapshot(config);
  return { ...snap, dataset: name, asOf: config.asOf };
}
