/**
 * ZKP2P Escrow contract adapter
 * Uses ethers Contract; signer should be from ethers (e.g. provider.getSigner()).
 */

import { ethers } from 'ethers';
import type { Signer } from '../types.js';
import type { VerifiedIntent } from '../types.js';
import { ESCROW_ADDRESS } from '../constants.js';

const ESCROW_ABI = [
  'function signalIntent(uint256 _depositId, uint256 _amount, address _to, address _paymentVerifier, bytes32 _fiatCurrency, bytes calldata _gatingServiceSignature) external returns (bytes32 intentHash)',
  'function fulfillIntent(bytes calldata _paymentProof, bytes32 _intentHash) external',
];

/** Ethers-compatible signer (has provider) */
type EthersSigner = ethers.Signer;

function asEthersSigner(signer: Signer): EthersSigner {
  const s = signer as unknown as EthersSigner;
  if (s?.provider) return s;
  throw new Error(
    'Signer must have a provider. Use ethers BrowserProvider.getSigner() for ZKP2P flows.'
  );
}

/**
 * Call signalIntent on Escrow. Returns intentHash.
 */
export async function callSignalIntent(
  signer: Signer,
  verified: VerifiedIntent
): Promise<string> {
  const ethersSigner = asEthersSigner(signer);
  const contract = new ethers.Contract(
    ESCROW_ADDRESS,
    ESCROW_ABI,
    ethersSigner
  );

  const { intentData } = verified;
  const intentHash = await contract.signalIntent(
    BigInt(intentData.depositId),
    BigInt(intentData.tokenAmount),
    intentData.recipientAddress,
    intentData.verifierAddress,
    intentData.currencyCodeHash,
    intentData.gatingServiceSignature
  );

  return intentHash as string;
}

/**
 * Call fulfillIntent on Escrow. Returns tx hash.
 */
export async function callFulfillIntent(
  signer: Signer,
  proofBytes: string,
  intentHash: string
): Promise<{ hash: string }> {
  const ethersSigner = asEthersSigner(signer);
  const contract = new ethers.Contract(
    ESCROW_ADDRESS,
    ESCROW_ABI,
    ethersSigner
  );

  const tx = await contract.fulfillIntent(proofBytes, intentHash);
  const receipt = await tx.wait();
  return { hash: receipt.hash };
}
