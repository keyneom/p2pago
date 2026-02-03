# SDK Test (script-tag / GitHub import)

## Node smoke test (no browser)

Verifies CJS build and new APIs (getZkp2pStatus, getSupportedChains, resolveRecipient, verifyPaymentTx, whenExtensionAvailable):

```bash
npm run build
node test/smoke-node.js
```

## Local demo (browser)

```bash
npm run build
npx serve .
```

- **demo-local.html** — Loads ethers (unpkg) then the local UMD bundle. Use for testing new APIs in the browser. Open: http://localhost:3000/test/demo-local.html  
  If `Zkp2pDonate` is empty, the ethers script may have failed to load (e.g. CDN blocked); check the console.

- **demo.html?local=1** — Loads the local UMD bundle only (no ethers). The UMD bundle expects `window.ethers` at load time (from @zkp2p/sdk), so for full behavior use **demo-local.html** or load ethers before the SDK.

## Test from GitHub (jsDelivr)

1. Build and commit dist:

   ```bash
   npm run build
   git add -f dist/
   git commit -m "Add dist for GitHub import test"
   git push
   ```

2. Open the demo (hosted anywhere, or use GitHub Pages):

   http://localhost:3000/test/demo.html

   (Without `?local=1` it loads from `https://cdn.jsdelivr.net/gh/keyneom/p2pago@main/dist/umd/zkp2p-donate.js`)

3. Or serve the repo and open the file directly.
