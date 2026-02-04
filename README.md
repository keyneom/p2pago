# ZKP2P Donate SDK

Client-side SDK for donations via **Venmo / Cash App** (ZKP2P) or **direct crypto**.

**Live demo:** [keyneom.github.io/p2pago](https://keyneom.github.io/p2pago/)

---

## What this is

A **client-side SDK** for accepting donations and optional **HTTP 402 (Payment Required)** flows:

1. **Donations**: Let users pay you via **direct crypto** (send to your address) or **fiat → crypto** via **ZKP2P** (Venmo, Cash App, etc.). Recipient absorbs processing fees; donor sends the exact amount (exact-fiat).
2. **Time-based “support status”**: Store when a user last donated (e.g. in `localStorage`) with **multiple accounts**. Check if the last donation is within a configured window; if not, your app can prompt again or gate features. All client-side, so it’s soft gating (bypassable); for hard gating, use 402 + server.
3. **Optional 402 flow**: When your server returns **402 Payment Required**, the SDK can drive the client through pay → prove → retry. Supports **two proof types**: (a) **crypto** — user sends to an address, you get tx hash; (b) **ZKP2P** — user pays Venmo/etc., proof is submitted on-chain, you get the `fulfillIntent` tx hash. Server verifies the proof (on-chain) and returns 200. Useful for protecting server-side resources (e.g. API, download) behind payment.

**Audience**: App developers who want a single library for donation UX, optional “support expired” prompts, and optional 402-backed payment for server resources.

---

## How it works (high level)

### Donation flow

- **Direct crypto**: User sends to your address (you show address / QR). App (or SDK) records the tx hash and optional amount; you can store that for “last donation” and for 402 proof.
- **ZKP2P (Venmo / Cash App / etc.)**:  
  1. Get quote (exact-fiat, e.g. $5).  
  2. Your backend calls ZKP2P `/verify/intent` (API key stays on server).  
  3. User connects wallet; SDK calls `signalIntent` on ZKP2P Escrow (Base).  
  4. User pays the quoted Venmo/Cash App recipient (out of band).  
  5. User clicks “I’ve paid”; SDK uses PeerAuth extension to generate and encode proof, then calls `fulfillIntent`.  
  Tokens are released to your `recipientAddress`. Recipient absorbs fees; donor sends the exact quoted amount.

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
    "label": "Premium access",
    "zkp2p": { "enabled": true, "verifyUrl": "https://your-backend/verify-intent" }
  }
  ```

  Client uses this to either (a) send crypto to `recipient` and get a tx hash, or (b) run the ZKP2P flow (quote → verify via `verifyUrl` → signalIntent → pay Venmo → proof → fulfillIntent) and get the fulfillIntent tx hash.

- **Client**: SDK provides something like `handle402(response, options)` that:  
  - Parses the 402 body.  
  - If user chooses crypto: trigger send to `recipient`, return proof `{ type: 'crypto', chainId, txHash }`.  
  - If user chooses ZKP2P: run donation flow to same `recipient`, return proof `{ type: 'zkp2p', chainId, txHash }` (fulfillIntent tx).  
  Then the app **retries the original request** with a proof (e.g. `Payment-Proof: <base64 or JSON>` or a body field). Server verifies the tx on-chain (and optionally amount/recipient) and returns 200.

- **Proof format (for server)**: Unified shape the server can verify: e.g. `{ type: 'crypto' | 'zkp2p', chainId, txHash, recipient?, amount? }`. Server checks: tx exists on `chainId`, and (if needed) that the tx sent funds to `recipient`. For ZKP2P, the “payment” to you is the `fulfillIntent` tx, so that’s the tx hash the client sends.

- **Dual proof**: Same 402 flow supports both “pay with wallet” (direct transfer) and “pay with Venmo” (ZKP2P). Server doesn’t care which; it only needs a valid tx that pays the right recipient.

All of this is **possible**: 402 is in the HTTP spec; verification is “check this tx on this chain.” The SDK is client-only; the server implements 402 and verification in its own stack.

---

## Installation

### npm (bundler)

```bash
npm install @p2pago/zkp2p-donate
```

```js
import {
  openDonation,
  openRedirectOnramp,
  getQuote,
  signalIntent,
  fulfillIntent,
  generateAndEncodeProof,
  recordDonation,
  getDonationStatus,
  handle402,
  runZkp2pDonation,
  completeZkp2pDonation,
  verifyIntent,
  getWalletStatus,
  getZkp2pStatus,
  whenExtensionAvailable,
  isSmallDonation,
  resolveRecipient,
  verifyPaymentTx,
  getSupportedChains,
  ZKP2P_EXTENSION_INSTALL_URL,
  P2PAGO_DEFAULT_RECIPIENT,
  P2PAGO_DEFAULT_REFERRER,
  MIN_DONATION_WARNING_USD,
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

**Orchestration helper** (quote + verify + signal in one call):
```js
const { intentHash, payeeAddress, platform } = await runZkp2pDonation({
  signer,
  recipient: '0xYOUR_ADDRESS',
  amountUsd: 5,
  platform: 'venmo',
  getVerifiedIntent: (intent) => yourBackend.verifyIntent(intent),
  provider,
});
// Show user: "Pay $5 to " + payeeAddress
// After user pays:
const { hash } = await completeZkp2pDonation(signer, intentHash, platform);
await recordDonation('my-app', { txHash: hash, chainId: 8453 });
```

**Manual steps** (same flow, more control):
```js
const quote = await getQuote({
  recipient: '0xYOUR_ADDRESS', // or myapp.fkey.eth for recipient privacy
  amountUsd: 5,
  userAddress: await signer.getAddress(),
  platform: 'venmo',
  provider, // for ENS resolution (e.g. FluidKey)
});
const verified = await yourBackend.verifyIntent(quote.intent); // or use verifyIntent(quote.intent, { apiKey }) from serverless
const intentHash = await signalIntent(signer, verified);
// Show user: "Pay $5 to " + quote.payeeAddress + " (Venmo)"
// User pays, then clicks "I've paid"
const proofBytes = await generateAndEncodeProof(intentHash, quote.platform);
const { hash } = await fulfillIntent(signer, proofBytes, intentHash);
await recordDonation('my-app', { txHash: hash, chainId: 8453 });
```

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
  const proof = await handle402(body, {
    signer,
    recipient: body.recipient,
    useZkp2p: true,
    verifyUrl: body.zkp2p?.verifyUrl,
    provider,
  });
  const retry = await fetch('/api/premium', {
    headers: { 'Payment-Proof': btoa(JSON.stringify(proof)) }
  });
}
```

---

## API Reference

### Redirect flow

| Function                       | Description                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `openDonation(options?)`       | Open donation flow. Checks extension; throws if missing (or opens install page if `openInstallPageIfMissing: true`). |
| `openRedirectOnramp(options?)` | Low-level: open Peer extension onramp. No extension check.                                                           |
| `isSmallDonation(amountUsd)`   | Returns true if amount &lt; $2 (warning threshold).                                                                  |

**openDonation / openRedirectOnramp options:**

| Option                     | Type                     | Default          | Description                                                         |
| -------------------------- | ------------------------ | ---------------- | ------------------------------------------------------------------- |
| `recipientAddress`         | string                   | `p2pago.fkey.id` | Recipient address or ENS. Set to your address to receive donations. |
| `amountUsd`                | number \| string         | —                | Amount in USD.                                                      |
| `inputAmount`              | string \| number         | —                | Overrides amountUsd; exact decimal string.                          |
| `paymentPlatform`          | string                   | —                | `'venmo'` or `'cashapp'`. User can change in extension.             |
| `referrer`                 | string                   | `'p2pago'`       | Attribution string (app name).                                      |
| `referrerLogo`             | string                   | —                | Logo URL for extension UI.                                          |
| `callbackUrl`              | string                   | —                | URL to return to after completion.                                  |
| `inputCurrency`            | string                   | `'USD'`          | Fiat currency.                                                      |
| `toToken`                  | string                   | Base USDC        | `chainId:tokenAddress`.                                             |
| `onSmallAmountWarning`     | (msg) => boolean \| void | —                | Callback when amount &lt; $2. Return `false` to abort.              |
| `openInstallPageIfMissing` | boolean                  | `false`          | If true, open Chrome Web Store instead of throwing.                 |

### Headless ZKP2P

| Function                                              | Description                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `getQuote(options)`                                   | Fetch quote from ZKP2P. Resolves ENS (FluidKey) if provider given.                          |
| `verifyIntent(intent, { apiKey, apiBaseUrl? })`       | Call ZKP2P `/verify/intent`. Use from backend (API key stays on server).                    |
| `signalIntent(signer, verifiedIntent)`                | Call Escrow.signalIntent. Returns intentHash.                                               |
| `fulfillIntent(signer, proofBytes, intentHash)`       | Call Escrow.fulfillIntent. Returns `{ hash }`.                                              |
| `generateAndEncodeProof(intentHash, platform)`        | Generate proof via PeerAuth extension. Returns encoded bytes.                               |
| `runZkp2pDonation(options)`                           | Quote → verify (callback) → signalIntent. Returns `{ intentHash, payeeAddress, platform }`. |
| `completeZkp2pDonation(signer, intentHash, platform)` | Generate proof → fulfillIntent. Call after user pays.                                       |

**getQuote options:** `recipient`, `amountUsd`, `userAddress` (required), `platform?`, `chainId?`, `destinationToken?`, `provider?` (for ENS; optional if ethers is installed — SDK uses default mainnet RPC), `apiBaseUrl?`.

**Signer** (ethers/viem compatible): `getAddress(): Promise<string>`, `sendTransaction(tx): Promise<{ hash }>`.

### Donation recording

| Function                                                              | Description                                                |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `recordDonation(accountId, { txHash?, amount?, chainId? }, options?)` | Store donation. `options.storage` = custom StorageAdapter. |
| `getDonationStatus(accountId, { maxAgeMs, storage? })`                | Returns `{ valid, lastDonationAt?, expiredAt? }`.          |

### 402 flow

| Function                   | Description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `handle402(body, options)` | Parse 402 body, pay (crypto or ZKP2P), return PaymentProof. |

**handle402 options:** `signer`, `recipient`, `useZkp2p`, `verifyUrl?` (required when useZkp2p), `provider?` (for ENS; optional if ethers is installed).

### Resolve recipient and verify direct payments

- **`resolveRecipient(recipient, options?)`** — Resolve ENS or 0x to a 0x address. Options: `provider?` (omit to use SDK default mainnet provider; requires ethers). Use for "pay with wallet" when you show a resolved address or need to verify the recipient.
- **`verifyPaymentTx(params)`** — Verify that a direct payment tx succeeded and value reached the recipient. Params: `txHash`, `chainId`, `recipientAddress`, optional `tokenAddress` (omit for native transfer), optional `rpcUrl` (override chain RPC). Uses `getSupportedChains()` for RPC by default. Returns `true` only if the tx succeeded and the recipient received the payment (native or ERC20 Transfer).
- **`getSupportedChains()`** / **`SUPPORTED_CHAINS`** — Chain config: `Record<chainId, { name, chainId, rpcUrl?, tokens? }>`. Default chains: Ethereum (1), Base (8453), Polygon (137), Arbitrum One (42161), OP Mainnet (10). Each chain includes default tokens: native ETH, USDC, USDT (address, symbol, decimals). Apps can subset or extend for "pay with wallet" UI and pass custom RPC to `verifyPaymentTx` if needed. Types: `ChainConfig`, `TokenConfig`. Constants: `NATIVE_TOKEN_ADDRESS`, `ERC20_TRANSFER_TOPIC` for advanced use.

### Capability detection

| Function                           | Returns                                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getWalletStatus()`                | `{ available: boolean }` (checks `window.ethereum`)                                                                                                                                                |
| `getZkp2pStatus()`                 | `{ available, needsInstall?, proofAvailable? }` — `available` when redirect onramp can open (`window.peer` or `window.zktls`); `proofAvailable` when proof generation is possible (`window.zktls`) |
| `whenExtensionAvailable(options?)` | `Promise<void>` — wait for extension (e.g. after async injection); listens for `zktls#initialized` and polls until available or `timeoutMs` (default 3000)                                         |

---

## PeerAuth extension

The ZKP2P (Venmo / Cash App) path requires the **Peer extension**. The redirect onramp (`openDonation` / `openRedirectOnramp`) uses `window.peer` (Peer SDK); proof generation (`generateAndEncodeProof`) uses `window.zktls`. The SDK treats extension as **available** when either `peer` or `zktls` is present, so the onramp can open in environments where only `peer` is injected. Use `getZkp2pStatus().proofAvailable` if you need to know whether the user can complete the headless proof step. When the extension is not installed, `generateAndEncodeProof` throws with the install URL. Use `getZkp2pStatus()` to drive your UI and `whenExtensionAvailable({ timeoutMs })` to avoid flashing "not installed" when the extension injects after load.

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
| Redirect flow     | `openDonation()` / `openRedirectOnramp()` — gasless, Peer extension side panel. Referrer defaults to "p2pago".                                            |
| ZKP2P headless    | Quote → verify (backend) → signalIntent → user pays Venmo/etc → PeerAuth proof → fulfillIntent. Recipient absorbs fees; donor sends exact amount.         |
| Direct crypto     | User sends to your address; app records tx hash.                                                                                                          |
| Time-based status | localStorage (or custom store) per accountId; getDonationStatus(accountId, { maxAgeMs }); app prompts or soft-gates. Bypassable; for hard gating use 402. |
| 402 flow          | Server returns 402 with payment spec; client pays (crypto or ZKP2P) and retries with proof; server verifies tx on-chain.                                  |
| Dual proof        | Crypto = tx hash of transfer. ZKP2P = tx hash of fulfillIntent. Same proof shape for server.                                                              |
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
