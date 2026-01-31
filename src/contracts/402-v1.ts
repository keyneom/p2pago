/**
 * 402 Payment Required — versioned contract (v1)
 * Frozen types for cross-project compatibility. Additive changes only.
 */

/** 402 response body schema (v1) */
export interface PaymentRequiredBody {
  paymentRequired: true;
  recipient: string;
  chainId: number;
  amountWei?: string;
  amountFormatted?: string;
  label?: string;
  zkp2p?: {
    enabled?: boolean;
    verifyUrl?: string;
  };
}

/** Payment proof returned by client on retry (v1) */
export interface PaymentProof {
  type: 'crypto' | 'zkp2p';
  chainId: number;
  txHash: string;
  recipient?: string;
  amount?: string;
}

/** Validate 402 body has required fields */
export function isPaymentRequiredBody(body: unknown): body is PaymentRequiredBody {
  if (!body || typeof body !== 'object') return false;
  const o = body as Record<string, unknown>;
  return (
    o.paymentRequired === true &&
    typeof o.recipient === 'string' &&
    typeof o.chainId === 'number'
  );
}

/** Validate payment proof has required fields */
export function isPaymentProof(proof: unknown): proof is PaymentProof {
  if (!proof || typeof proof !== 'object') return false;
  const o = proof as Record<string, unknown>;
  return (
    (o.type === 'crypto' || o.type === 'zkp2p') &&
    typeof o.chainId === 'number' &&
    typeof o.txHash === 'string'
  );
}
