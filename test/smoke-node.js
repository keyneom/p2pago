/**
 * Smoke test for SDK (Node). Run: node test/smoke-node.js
 * Requires: npm run build first. Tests CJS build and pure APIs.
 */
const path = require('path');
const SDK_PATH = path.join(__dirname, '..', 'dist', 'cjs', 'index.js');

async function main() {
  console.log('Loading SDK from', SDK_PATH);
  const sdk = require(SDK_PATH);

  const checks = [];

  // 1. New exports exist
  const required = [
    'getZkp2pStatus',
    'whenExtensionAvailable',
    'resolveRecipient',
    'verifyPaymentTx',
    'getSupportedChains',
    'SUPPORTED_CHAINS',
    'NATIVE_TOKEN_ADDRESS',
    'ERC20_TRANSFER_TOPIC',
  ];
  for (const name of required) {
    const ok = typeof sdk[name] === 'function' || (typeof sdk[name] === 'object' && sdk[name] !== null) || typeof sdk[name] === 'string';
    checks.push({ name: `export ${name}`, ok });
    if (!ok) console.error('  Missing or wrong type:', name);
  }

  // 2. getZkp2pStatus (no window in Node -> available: false)
  const status = sdk.getZkp2pStatus();
  const statusOk =
    status && typeof status.available === 'boolean' && typeof status.proofAvailable === 'boolean';
  checks.push({ name: 'getZkp2pStatus() shape (available, proofAvailable)', ok: statusOk });
  if (!statusOk) console.error('  getZkp2pStatus() returned:', status);

  // 3. getSupportedChains / SUPPORTED_CHAINS
  const chains = sdk.getSupportedChains();
  const chainsObj = sdk.SUPPORTED_CHAINS;
  const chainsOk =
    chains &&
    chainsObj &&
    typeof chains === 'object' &&
    Object.keys(chains).length >= 5 &&
    chains[8453] &&
    chains[8453].name === 'Base' &&
    Array.isArray(chains[8453].tokens) &&
    chains[8453].tokens.some((t) => t.symbol === 'USDC');
  checks.push({ name: 'getSupportedChains() / SUPPORTED_CHAINS', ok: !!chainsOk });
  if (!chainsOk) console.error('  chains sample:', chains && chains[8453]);

  // 4. resolveRecipient with raw address (no RPC)
  try {
    const addr = '0x0000000000000000000000000000000000000001';
    const resolved = await sdk.resolveRecipient(addr);
    checks.push({ name: 'resolveRecipient(0x...) returns address', ok: resolved === addr });
  } catch (e) {
    checks.push({ name: 'resolveRecipient(0x...)', ok: false });
    console.error('  resolveRecipient(0x...) threw:', e.message);
  }

  // 5. verifyPaymentTx with unsupported chainId (expect error, not crash)
  try {
    await sdk.verifyPaymentTx({
      txHash: '0xab',
      chainId: 99999,
      recipientAddress: '0x0000000000000000000000000000000000000001',
    });
    checks.push({ name: 'verifyPaymentTx(unsupported chain) throws', ok: false });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    checks.push({
      name: 'verifyPaymentTx(unsupported chain) throws',
      ok: msg.includes('No RPC') || msg.includes('99999'),
    });
  }

  // 6. whenExtensionAvailable resolves (no window -> immediate)
  try {
    await sdk.whenExtensionAvailable({ timeoutMs: 100 });
    checks.push({ name: 'whenExtensionAvailable() resolves', ok: true });
  } catch (e) {
    checks.push({ name: 'whenExtensionAvailable()', ok: false });
    console.error('  whenExtensionAvailable threw:', e.message);
  }

  const failed = checks.filter((c) => !c.ok);
  const passed = checks.filter((c) => c.ok);
  console.log('\nPassed:', passed.length, '/', checks.length);
  if (failed.length) {
    console.log('Failed:', failed.map((c) => c.name).join(', '));
    process.exit(1);
  }
  console.log('Smoke OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
