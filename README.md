# ZKP2P Donate SDK

Client-side SDK for donations via **Venmo / Cash App** (ZKP2P) or **direct crypto**.

**Live demo:** [keyneom.github.io/p2pago](https://keyneom.github.io/p2pago/)

---

## What this is

A **client-side SDK** for accepting donations and optional **HTTP 402 (Payment Required)** flows:

1. **Donations**: Let users pay you via **direct crypto** (send to your address) or **fiat → crypto** via **ZKP2P** (Venmo, Cash App, etc.). The donation button opens the hosted [peer.xyz](https://www.peer.xyz/swap) onramp with your recipient and amount prefilled — peer.xyz drives the full quote → wallet → payment → proof flow. For richer integrations, this package re-exports `@zkp2p/sdk` so you can build a custom UI without a second install.
2. **Time-based "support status"**: Store when a user last donated (e.g. in `localStorage`) with **multiple accounts**. Check if the last donation is within a configured window; if not, your app can prompt again or gate features. All client-side, so it's soft gating (bypassable); for hard gating, use 402 + server.
3. **Optional 402 flow**: When your server returns **402 Payment Required**, the SDK pays the body's recipient with a direct on-chain transfer (native or ERC-20) and returns a `PaymentProof` you retry with. The wire-format `PaymentProof` shape also covers a `'zkp2p'` variant for apps that roll their own ZKP2P flow via `Zkp2pClient` (re-exported); the built-in `handle402` only produces the `'crypto'` variant.

**Audience**: App developers who want a single library for donation UX, optional "support expired" prompts, and optional 402-backed payment for server resources.

---

## How it works (high level)

### Donation flow

- **Direct crypto**: User sends to your address (you show address / QR). App (or SDK) records the tx hash and optional amount; you can store that for "last donation" and for 402 proof.
- **ZKP2P (Venmo / Cash App / etc.) — redirect**: Call `openDonation({ amountUsd, recipientAddress, paymentPlatform })`. The hosted peer.xyz onramp opens in a new tab with your params prefilled and drives the full quote → wallet → payment → fulfillment flow itself. Recipient absorbs fees; donor sends the exact quoted amount.
- **ZKP2P — embedded (advanced)**: For a custom UI, import `Zkp2pClient` and `createPeerExtensionSdk` from `@p2pago/zkp2p-donate` (re-exported from `@zkp2p/sdk`) and drive `getQuote → signalIntent → peer.authenticate → onMetadataMessage → fulfillIntent` yourself. See [peer's docs](https://docs.peer.xyz/) for the headless integration recipe.

### Time-based expiration (localStorage, multi-account)

- **Storage**: One “account” per key (e.g. per app or per feature). Per account: `lastDonationAt`, optional `txHash`, optional `amount`, optional `chainId`.
- **API**:  
  - `recordDonation(accountId, { txHash?, amount?, chainId? })` — call after a successful donation (crypto or ZKP2P).  
  - `getDonationStatus(accountId, { maxAgeMs })` — returns e.g. `{ valid: boolean, lastDonationAt?, expiredAt? }`.  
  If `valid` is false, app shows “Support expired” and can prompt for a new donation or gate an action.
- **Bypass**: All of this is client-side (e.g. localStorage). Users can clear or edit it. Use for **UX and soft gating**; for **hard gating** use 402 + server verification.

### Optional 402 Payment Required

- **Server**: Protects a resource (e.g. `GET /api/premium` or `GET /file`). When payment is required, respond with **402** and a JSON body that describes how to pay, e.g.:

  ```json
  {
    "paymentRequired": true,
    "recipient": "0x...",
    "chainId": 8453,
    "amountWei": "...",
    "amountFormatted": "0.001 ETH",
    "label": "Premium access"
  }
  ```

- **Client**: `handle402(body, { signer, provider })` pays the recipient with a direct on-chain transfer (native or ERC-20) and returns `{ type: 'crypto', chainId, txHash, recipient, amount? }`. The app retries the original request with that proof (e.g. `Payment-Proof: <base64 JSON>`). Server verifies the tx on-chain and returns 200.

- **ZKP2P-backed proofs**: The `PaymentProof` wire format also covers `{ type: 'zkp2p', chainId, txHash, ... }` for apps that build a ZKP2P payment flow on top of the re-exported `Zkp2pClient` and want to submit the `fulfillIntent` tx hash as the proof. The built-in `handle402` does not produce this variant.

All of this is **possible**: 402 is in the HTTP spec; verification is "check this tx on this chain." The SDK is client-only; the server implements 402 and verification in its own stack.

---

## Installation

### npm (bundler)

```bash
npm install @p2pago/zkp2p-donate
```

```js
// p2pago value-add layer
import {
  openDonation,
  openRedirectOnramp,
  isSmallDonation,
  recordDonation,
  getDonationStatus,
  handle402,
  getWalletStatus,
  getZkp2pStatus,
  whenExtensionAvailable,
  resolveRecipient,
  verifyPaymentTx,
  getSupportedChains,
  ZKP2P_EXTENSION_INSTALL_URL,
  PEER_ONRAMP_URL,
  P2PAGO_DEFAULT_RECIPIENT,
  P2PAGO_DEFAULT_REFERRER,
  MIN_DONATION_WARNING_USD,
} from '@p2pago/zkp2p-donate';

// Full @zkp2p/sdk surface, re-exported through the same install
import {
  Zkp2pClient,
  createPeerExtensionSdk,
  peerExtensionSdk,
  PAYMENT_PLATFORMS,
  SUPPORTED_CHAIN_IDS,
} from '@p2pago/zkp2p-donate';
```

### Browser (script tag)

The UMD bundle expects **`window.ethers`** at load time (used by the bundled Peer SDK). Load ethers before the SDK:

**From npm** (after publish):
```html
<script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js"></script>
<script src="https://unpkg.com/@p2pago/zkp2p-donate/dist/umd/zkp2p-donate.js"></script>
```

**From GitHub** (before npm publish; script is served from `docs/zkp2p-donate.js` in this repo):
```html
<script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/keyneom/p2pago@main/docs/zkp2p-donate.js"></script>
```
Use `@main` for latest, or a tag for a release (e.g. `@v0.1.0`). After source changes, run `npm run build:docs` and commit `docs/zkp2p-donate.js`.

Then use `window.Zkp2pDonate`:
```html
<button id="donate">Donate</button>
<script>
  const sdk = window.Zkp2pDonate;
  document.getElementById('donate').onclick = () => {
    sdk.openDonation({ amountUsd: 5, openInstallPageIfMissing: true });
  };
</script>
```

---

## Capability detection

Use `getWalletStatus()` and `getZkp2pStatus()` to drive your payment UI:

| Capability                              | App behavior                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `getWalletStatus().available === true`  | Show "Pay with crypto" — user can send directly from wallet                                                                             |
| `getWalletStatus().available === false` | Hide or gray out crypto option; optionally prompt to install a wallet                                                                   |
| `getZkp2pStatus().available === true`   | Show "Pay with Venmo / Cash App" — run headless flow immediately                                                                        |
| `getZkp2pStatus().available === false`  | Still show "Pay with Venmo / Cash App" — prompt to install extension with `ZKP2P_EXTENSION_INSTALL_URL`, or link to ZKP2P redirect flow |

ZKP2P is always offered as a payment option. Extension availability only affects whether the headless flow runs in-place or the app must guide the user (install extension first, or redirect).

```js
import { getWalletStatus, getZkp2pStatus, ZKP2P_EXTENSION_INSTALL_URL } from '@p2pago/zkp2p-donate';

const wallet = getWalletStatus();
const zkp2p = getZkp2pStatus();

if (wallet.available) {
  // Show "Pay with crypto" button
}
if (zkp2p.available) {
  // Run ZKP2P headless flow directly
} else {
  // Show "Pay with Venmo" + link to ZKP2P_EXTENSION_INSTALL_URL
  // Or: "Install extension to pay with Venmo" with link
}
```

---

## Recipient privacy (FluidKey)

**We recommend using a [FluidKey](https://www.fluidkey.com/) ENS** (e.g. `myapp.fkey.eth`) as your recipient address. This provides recipient privacy:

- Each payment resolves to a **unique stealth address** — block explorers cannot associate multiple payments with the same recipient
- Donors don't know who else has paid
- Observers (including anyone with your ENS) cannot trace how many payments went to your account or link payments together

Use your FluidKey ENS anywhere you'd use a raw address: `getQuote`, `handle402`, 402 response body, etc. The SDK resolves ENS automatically: pass a `provider` in options, or omit it and the SDK will use a default mainnet provider (requires ethers; uses `DEFAULT_MAINNET_RPC_URL`).

```js
// Use FluidKey ENS for recipient privacy
const quote = await getQuote({
  recipient: 'myapp.fkey.eth',
  amountUsd: 5,
  userAddress: await signer.getAddress(),
  provider, // for ENS resolution
});
```

---

## Usage (minimal)

### Donation (redirect flow — gasless, recommended)

Opens the Peer extension side panel. Gasless; no wallet or backend required. Requires Peer extension.

**Simple one-liner** — `openDonation` checks extension, optionally warns on small amounts:

```js
import { openDonation } from '@p2pago/zkp2p-donate';

// Throws if extension missing (or use openInstallPageIfMissing: true to open install page)
openDonation({
  recipientAddress: 'p2pago.fkey.id',  // default; or your app's address/ENS
  amountUsd: 5,
  paymentPlatform: 'venmo',
  callbackUrl: 'https://your-app.com/thanks',
  referrer: 'p2pago',  // default; override to your app name if desired
  onSmallAmountWarning: (msg) => { alert(msg); return confirm('Continue?'); },  // optional; amount < $2
  openInstallPageIfMissing: true,  // open Chrome Web Store if extension not installed
});
```

**Lower-level** — `openRedirectOnramp` (no extension check):

```js
import { openRedirectOnramp, getZkp2pStatus, ZKP2P_EXTENSION_INSTALL_URL } from '@p2pago/zkp2p-donate';

if (!getZkp2pStatus().available) {
  window.open(ZKP2P_EXTENSION_INSTALL_URL);
  return;
}
openRedirectOnramp({ recipientAddress: 'p2pago.fkey.id', amountUsd: 5 });
```

### Donation (headless ZKP2P)

For apps that want a custom UI instead of redirecting to `peer.xyz`, use `Zkp2pClient` directly — it's re-exported from this package, so a single install is enough:

```js
import {
  Zkp2pClient,
  createPeerExtensionSdk,
  recordDonation, // still useful for donor-status tracking
} from '@p2pago/zkp2p-donate';

// Needs a viem WalletClient (see @zkp2p/sdk docs for wallet setup).
const client = new Zkp2pClient({ walletClient, chainId: 8453 });
const peer = createPeerExtensionSdk();

const quote = await client.getQuote({
  paymentPlatforms: ['venmo'],
  fiatCurrency: 'USD',
  user: payerAddress,
  recipient: '0xYOUR_ADDRESS',
  destinationChainId: 8453,
  destinationToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  amount: '5',
  isExactFiat: true,
});

const txHash = await client.signalIntent({ /* fields from quote.responseObject.quotes[0].intent */ });
// Parse IntentSignaled from the receipt for the intentHash, then:
peer.authenticate({ platform: 'venmo', actionType: 'transfer_venmo', captureMode: 'buyerTee', attestationServiceUrl: 'https://attestation-service.zkp2p.xyz' });
peer.onMetadataMessage(async (msg) => {
  const fulfillTx = await client.fulfillIntent({ intentHash, proof: { /* from msg */ }, attestationServiceUrl: '...' });
  await recordDonation('my-app', { txHash: fulfillTx, chainId: 8453 });
});
```

Full reference (and the platform → `actionType` table for Venmo / Cash App / Revolut / Wise / etc.): see the [official Peer docs](https://docs.peer.xyz/developer/integrate-zkp2p/integrate-redirect-onramp). We deliberately don't wrap this flow — peer's surface evolves quickly and a wrapper would just add a maintenance tax.

### Donation (direct crypto)

User sends to your address (you get tx hash from wallet / explorer). Then:

```js
await recordDonation('my-app', { txHash: '0x...', chainId: 8453, amount: '0.001' });
```

### Check if “support” has expired

Before a gated action:

```js
const status = await getDonationStatus('my-app', { maxAgeMs: 30 * 24 * 60 * 60 * 1000 }); // 30 days
if (!status.valid) {
  // Show "Your support has expired. Consider donating again." and prompt for donation
  return;
}
// Proceed with action
```

### 402 flow (client)

When a request returns 402:

```js
const res = await fetch('/api/premium');
if (res.status === 402) {
  const body = await res.json();
  const proof = await handle402(body, { signer, provider });
  const retry = await fetch('/api/premium', {
    headers: { 'Payment-Proof': btoa(JSON.stringify(proof)) }
  });
}
```

`handle402` pays the 402 body's recipient with a direct on-chain transfer (native or ERC-20). For a ZKP2P-backed 402 flow, compose `Zkp2pClient` (re-exported from this package) directly and feed the resulting `fulfillIntent` tx hash into the `PaymentProof` shape yourself.

---

## API Reference

### Redirect flow

| Function                       | Description                                                              |
| ------------------------------ | ------------------------------------------------------------------------ |
| `openDonation(options?)`       | Open `peer.xyz/swap` with prefilled params. Optional small-amount guard. |
| `openRedirectOnramp(options?)` | Same, without the small-amount guard.                                    |
| `isSmallDonation(amountUsd)`   | Returns true if amount &lt; $2 (warning threshold).                      |

The redirect flow no longer requires the Peer extension to start — the hosted UI handles wallet connect, quote, payment, and proof itself, and prompts the user to install the extension when it's actually needed.

**openDonation / openRedirectOnramp options:**

| Option                     | Type                     | Default          | Description                                                         |
| -------------------------- | ------------------------ | ---------------- | ------------------------------------------------------------------- |
| `recipientAddress`         | string                   | `p2pago.fkey.id` | Recipient address or ENS. Set to your address to receive donations. |
| `amountUsd`                | number \| string         | —                | Amount in USD.                                                      |
| `inputAmount`              | string \| number         | —                | Overrides amountUsd; exact decimal string.                          |
| `paymentPlatform`          | string                   | —                | `'venmo'`, `'cashapp'`, etc. User can change on peer.xyz.           |
| `referrer`                 | string                   | `'p2pago'`       | Attribution string (app name).                                      |
| `referrerLogo`             | string                   | —                | Logo URL for the hosted UI.                                         |
| `callbackUrl`              | string                   | —                | URL to return to after completion.                                  |
| `inputCurrency`            | string                   | `'USD'`          | Fiat currency.                                                      |
| `toToken`                  | string                   | Base USDC        | `chainId:tokenAddress` or plain `0x…`.                              |
| `target`                   | string                   | `'_blank'`       | `window.open` target — `'_self'` to navigate the current tab.       |
| `onSmallAmountWarning`     | (msg) => boolean \| void | —                | Callback when amount &lt; $2. Return `false` to abort.              |
| `openInstallPageIfMissing` | boolean                  | `false`          | Retained for back-compat; no-op now that the hosted UI handles install prompts. |

### Headless ZKP2P

For everything beyond the redirect button, this package re-exports the full [`@zkp2p/sdk`](https://www.npmjs.com/package/@zkp2p/sdk) surface — `Zkp2pClient`, `createPeerExtensionSdk`, `peerExtensionSdk`, `PAYMENT_PLATFORMS`, `SUPPORTED_CHAIN_IDS`, types, and the rest. Import them from `@p2pago/zkp2p-donate` and consult [peer's docs](https://docs.peer.xyz/) for usage. We do not wrap them — peer's API is evolving and a wrapper would be a tax to maintain.

### Donation recording

| Function                                                              | Description                                                |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `recordDonation(accountId, { txHash?, amount?, chainId? }, options?)` | Store donation. `options.storage` = custom StorageAdapter. |
| `getDonationStatus(accountId, { maxAgeMs, storage? })`                | Returns `{ valid, lastDonationAt?, expiredAt? }`.          |

### 402 flow

| Function                   | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `handle402(body, options)` | Parse 402 body, pay via on-chain transfer, return `PaymentProof`. |

**handle402 options:** `signer` (required), `provider?` (for ENS / FluidKey).

### Resolve recipient and verify direct payments

- **`resolveRecipient(recipient, options?)`** — Resolve ENS or 0x to a 0x address. Options: `provider?` (omit to use SDK default mainnet provider; requires ethers). Use for "pay with wallet" when you show a resolved address or need to verify the recipient.
- **`verifyPaymentTx(params)`** — Verify that a direct payment tx succeeded and value reached the recipient. Params: `txHash`, `chainId`, `recipientAddress`, optional `tokenAddress` (omit for native transfer), optional `rpcUrl` (override chain RPC). Uses `getSupportedChains()` for RPC by default. Returns `true` only if the tx succeeded and the recipient received the payment (native or ERC20 Transfer).
- **`getSupportedChains()`** / **`SUPPORTED_CHAINS`** — Chain config: `Record<chainId, { name, chainId, rpcUrl?, tokens? }>`. Default chains: Ethereum (1), Base (8453), Polygon (137), Arbitrum One (42161), OP Mainnet (10). Each chain includes default tokens: native ETH, USDC, USDT (address, symbol, decimals). Apps can subset or extend for "pay with wallet" UI and pass custom RPC to `verifyPaymentTx` if needed. Types: `ChainConfig`, `TokenConfig`. Constants: `NATIVE_TOKEN_ADDRESS`, `ERC20_TRANSFER_TOPIC` for advanced use.

### Capability detection

| Function                           | Returns                                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getWalletStatus()`                | `{ available: boolean }` (checks `window.ethereum`)                                                                                                                                                |
| `getZkp2pStatus()`                 | `{ available, needsInstall?, proofAvailable? }` — reports whether the Peer extension is installed. The redirect flow no longer requires it; `proofAvailable` is retained for legacy callers that gated on `window.zktls`. |
| `whenExtensionAvailable(options?)` | `Promise<void>` — wait for extension (e.g. after async injection); listens for `zktls#initialized` and polls until available or `timeoutMs` (default 3000)                                         |

---

## PeerAuth extension

The **redirect** flow (`openDonation` / `openRedirectOnramp`) no longer requires the Peer extension to start — `peer.xyz` drives the whole flow itself and surfaces an install prompt inline when capture is needed. You still get `getZkp2pStatus()` and `whenExtensionAvailable({ timeoutMs })` if you want to pre-flight the install in your own UI.

The **headless** flow (`Zkp2pClient` + `createPeerExtensionSdk`, both re-exported from `@zkp2p/sdk`) still needs the extension for payment-capture (`peer.authenticate` + `peer.onMetadataMessage`). The extension version must be 0.6.0 or newer — older releases used a deeplink onramp API that peer has removed.

---

## Server side (402) — contract for your backend

See [CONTRACTS.md](./CONTRACTS.md) for the full 402 server contract specification.

The SDK does **not** implement the server. For 402 to work, your server must:

1. **Return 402** with a JSON body that includes at least: `recipient`, `chainId`, and optionally `amountWei` / `amountFormatted`, `label`, and `zkp2p.verifyUrl` if you support ZKP2P.
2. **Accept proof** on retry: e.g. `Payment-Proof` header or body field, containing something like `{ type, chainId, txHash, recipient?, amount? }`.
3. **Verify**: Use the SDK's `verifyPaymentTx({ txHash, chainId, recipientAddress, tokenAddress? })` (or your own RPC check). Confirm the tx succeeded and value reached `recipient`. Then return 200 and grant access (e.g. set cookie, return resource).

No ZKP2P-specific server logic is required for verification: both crypto and ZKP2P end in an on-chain tx that pays you; the server only needs to verify that tx.

---

## Constants

| Constant                                       | Description                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `P2PAGO_DEFAULT_RECIPIENT`                     | Default recipient: `p2pago.fkey.id`                                                   |
| `P2PAGO_DEFAULT_REFERRER`                      | Default referrer string: `"p2pago"`                                                   |
| `DEFAULT_MAINNET_RPC_URL`                      | Default RPC URL for ENS resolution when no provider is passed                         |
| `MIN_DONATION_WARNING_USD`                     | Small-donation warning threshold: $2                                                  |
| `ZKP2P_EXTENSION_INSTALL_URL`                  | Chrome Web Store link for Peer extension                                              |
| `SUPPORTED_CHAINS`, `getSupportedChains()`     | Chain config (name, rpcUrl, tokens) for Base, Ethereum, Polygon, Arbitrum, OP Mainnet |
| `NATIVE_TOKEN_ADDRESS`, `ERC20_TRANSFER_TOPIC` | For native/ERC20 verification (advanced)                                              |
| `P2PAGO_FEE_PERCENT`, `P2PAGO_FEE_MIN_USD`     | Reserved for future use                                                               |
| `GAS_COST_MAX_FRACTION`                        | Reserved for future use                                                               |

---

## Summary

| Feature           | Description                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redirect flow     | `openDonation()` / `openRedirectOnramp()` — opens `peer.xyz/swap` with prefilled params. Referrer defaults to "p2pago".                                   |
| Headless ZKP2P    | `Zkp2pClient` + `createPeerExtensionSdk` re-exported from `@zkp2p/sdk` directly (no wrapper).                                                              |
| Direct crypto     | User sends to your address; app records tx hash.                                                                                                          |
| Time-based status | localStorage (or custom store) per accountId; getDonationStatus(accountId, { maxAgeMs }); app prompts or soft-gates. Bypassable; for hard gating use 402. |
| 402 flow          | Server returns 402 with payment spec; client pays via direct transfer and retries with proof; server verifies tx on-chain.                                |
| Distribution      | npm package + UMD script tag.                                                                                                                             |

---

## Custom storage

Pass a custom `StorageAdapter` to `recordDonation` and `getDonationStatus`:

```js
const myStorage = {
  async get(key) { /* return DonationRecord | null */ },
  async set(key, value) { /* store DonationRecord */ },
};
await recordDonation('app', { txHash }, { storage: myStorage });
const status = await getDonationStatus('app', { maxAgeMs: 86400000, storage: myStorage });
```

---

## Development

```bash
npm install
npm run build          # ESM + CJS + UMD
npm run build:docs     # Build + copy UMD to docs/ for GitHub Pages
npm run test:demo      # Build + serve (open test/demo.html?local=1)
```
