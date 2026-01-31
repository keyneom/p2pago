/**
 * verifyIntent — call ZKP2P /verify/intent (for serverless/backend)
 * API key should stay on server; this is optional for apps that pass key from backend.
 */

import { verifyIntent as apiVerifyIntent } from './adapters/zkp2p-api.js';
import type { QuoteIntent, VerifiedIntent } from './types.js';
import { ZKP2P_API_BASE_URL } from './constants.js';

export interface VerifyIntentOptions {
  apiKey: string;
  apiBaseUrl?: string;
}

/**
 * Verify intent via ZKP2P API. Typically called from your backend (API key stays on server).
 * Exposed for serverless/edge setups where the app passes the key.
 */
export async function verifyIntent(
  intent: QuoteIntent,
  options: VerifyIntentOptions
): Promise<VerifiedIntent> {
  const config = { baseUrl: options.apiBaseUrl ?? ZKP2P_API_BASE_URL };
  return apiVerifyIntent(config, intent, options.apiKey);
}
