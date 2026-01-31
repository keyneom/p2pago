# 402 Payment Required — Server Contract

This document specifies the contract between this SDK (client) and backend servers that implement HTTP 402 Payment Required. Implement this to verify payments and grant access.

## Overview

1. Server returns **402** with a JSON body describing how to pay
2. Client pays (crypto or ZKP2P), builds a proof, and **retries** with the proof
3. Server verifies the proof on-chain and returns **200**

## 402 Response Body (v1)

When payment is required, respond with `HTTP 402` and `Content-Type: application/json`:

### Required fields

| Field             | Type    | Description                        |
| ----------------- | ------- | ---------------------------------- |
| `paymentRequired` | boolean | Must be `true`                     |
| `recipient`       | string  | Address or ENS (e.g. FluidKey ENS) |
| `chainId`         | number  | Chain ID (e.g. 8453 for Base)      |

### Optional fields

| Field              | Type   | Description                                      |
| ------------------ | ------ | ------------------------------------------------ |
| `amountWei`        | string | Amount in wei (for crypto)                        |
| `amountFormatted`  | string | Human-readable amount (e.g. "0.001 ETH")         |
| `label`            | string | Label for the payment (e.g. "Premium access")    |
| `zkp2p.enabled`    | boolean| Whether ZKP2P (Venmo/Cash App) is supported      |
| `zkp2p.verifyUrl`  | string | Backend URL that calls ZKP2P `/verify/intent`    |

### Example

```json
{
  "paymentRequired": true,
  "recipient": "0x...",
  "chainId": 8453,
  "amountWei": "1000000000000000",
  "amountFormatted": "0.001 ETH",
  "label": "Premium access",
  "zkp2p": { "enabled": true, "verifyUrl": "https://your-backend/verify-intent" }
}
```

Client resolves `recipient` if it is ENS (including FluidKey `*.fkey.eth`) before sending.

## Retry with Proof

On retry, the client sends the proof. Accept it via:

- **Header**: `Payment-Proof: <base64(JSON.stringify(proof))>`
- Or a body field, if your API prefers

## Payment Proof (v1)

| Field       | Type              | Required | Description                    |
| ----------- | ----------------- | -------- | ------------------------------ |
| `type`      | `'crypto' \| 'zkp2p'` | Yes  | Payment method                 |
| `chainId`   | number            | Yes      | Chain ID of the transaction    |
| `txHash`    | string            | Yes      | Transaction hash               |
| `recipient` | string            | No       | Resolved recipient address     |
| `amount`    | string            | No       | Amount (optional verification) |

### Example

```json
{
  "type": "crypto",
  "chainId": 8453,
  "txHash": "0x...",
  "recipient": "0x...",
  "amount": "1000000000000000"
}
```

For ZKP2P, `txHash` is the `fulfillIntent` transaction hash.

## Server Verification

1. Decode the proof from the header or body
2. Verify `type`, `chainId`, `txHash` are present
3. Look up the transaction on `chainId` (e.g. via RPC or indexer)
4. Confirm the transaction succeeded
5. Confirm it transferred value to `recipient` (optional: check amount)
6. Return 200 and grant access (e.g. set cookie, return resource)

No ZKP2P-specific logic is needed: both crypto and ZKP2P end in an on-chain tx. The server only verifies that tx.
