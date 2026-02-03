/**
 * On-chain verification of a direct payment tx (native or ERC20 to recipient).
 */

import { getSupportedChains, ERC20_TRANSFER_TOPIC } from './chains.js';

export interface VerifyPaymentTxParams {
  txHash: string;
  chainId: number;
  recipientAddress: string;
  /** If set, check ERC20 Transfer to recipient; otherwise check native value to recipient. */
  tokenAddress?: string;
  /** Override RPC URL for this chain. Otherwise uses SDK chain config. */
  rpcUrl?: string;
}

/**
 * Verify that a tx succeeded and that value (native or ERC20) reached the recipient.
 * Uses SDK chain config for RPC unless rpcUrl is passed. Returns true only if the tx
 * succeeded and the recipient received the payment.
 */
export async function verifyPaymentTx(params: VerifyPaymentTxParams): Promise<boolean> {
  const { txHash, chainId, recipientAddress, tokenAddress, rpcUrl } = params;

  const chains = getSupportedChains();
  const chain = chains[chainId];
  const url = rpcUrl ?? chain?.rpcUrl;
  if (!url) {
    throw new Error(`No RPC URL for chainId ${chainId}. Pass rpcUrl or use a supported chain.`);
  }

  const receipt = await rpcCall<{
    status?: string;
    logs?: Array<{ address: string; topics: string[] }>;
  }>(url, 'eth_getTransactionReceipt', [txHash]);

  if (!receipt || !receipt.status) {
    return false;
  }
  if (receipt.status !== '0x1') {
    return false;
  }

  if (tokenAddress) {
    const recipientTopic = addressToTopic(recipientAddress);
    const hasTransferToRecipient = (receipt.logs ?? []).some(
      (log) =>
        log.address.toLowerCase() === tokenAddress.toLowerCase() &&
        log.topics?.[0] === ERC20_TRANSFER_TOPIC &&
        log.topics?.[2] === recipientTopic
    );
    return hasTransferToRecipient;
  }

  const tx = await rpcCall<{ to: string | null; value: string }>(
    url,
    'eth_getTransactionByHash',
    [txHash]
  );
  if (!tx?.to || !tx.value) {
    return false;
  }
  const valueWei = BigInt(tx.value);
  if (valueWei === 0n) {
    return false;
  }
  return tx.to.toLowerCase() === recipientAddress.toLowerCase();
}

function addressToTopic(address: string): string {
  const hex = address.startsWith('0x') ? address.slice(2).toLowerCase() : address.toLowerCase();
  if (hex.length !== 40) {
    throw new Error(`Invalid address: ${address}`);
  }
  return '0x' + hex.padStart(64, '0');
}

async function rpcCall<T>(url: string, method: string, params: unknown[]): Promise<T | null> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  if (!res.ok) {
    throw new Error(`RPC request failed: ${res.status}`);
  }
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) {
    throw new Error(json.error.message ?? 'RPC error');
  }
  return json.result ?? null;
}
