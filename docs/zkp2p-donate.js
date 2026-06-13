(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('ethers'), require('@zkp2p/sdk')) :
    typeof define === 'function' && define.amd ? define(['exports', 'ethers', '@zkp2p/sdk'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Zkp2pDonate = {}, global.ethers, global.Zkp2pSdk));
})(this, (function (exports, ethers, sdk) { 'use strict';

    /**
     * p2pago constants.
     *
     * Contract addresses, payment-method hashes, fiat-currency hashes, and verifier
     * addresses are NOT defined here — those live in @zkp2p/sdk (re-exported via
     * this package's top-level entry) and stay in sync with the contracts.
     */
    /** Base chain ID */
    const BASE_CHAIN_ID = 8453;
    /** USDC token address on Base */
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    /** Default Ethereum mainnet RPC URL used for ENS resolution when no provider is passed. */
    const DEFAULT_MAINNET_RPC_URL = 'https://ethereum.publicnode.com';
    /** PeerAuth extension Chrome Web Store install URL. */
    const ZKP2P_EXTENSION_INSTALL_URL = 'https://chromewebstore.google.com/detail/peerauth-authenticate-and/ijpgccednehjpeclfcllnjjcmiohdjih';
    /** Hosted Peer onramp URL — receives query params and drives the full flow. */
    const PEER_ONRAMP_URL = 'https://www.peer.xyz/swap';
    /** Default recipient when no app recipient specified (FluidKey ENS). */
    const P2PAGO_DEFAULT_RECIPIENT = 'p2pago.fkey.id';
    /** Default referrer string for attribution on peer.xyz. */
    const P2PAGO_DEFAULT_REFERRER = 'p2pago';
    /** Fee parameters. Reserved for future use. */
    const P2PAGO_FEE_PERCENT = 0.01;
    const P2PAGO_FEE_MIN_USD = 0.1;
    /** Maximum allowed gas cost as fraction of donation amount. */
    const GAS_COST_MAX_FRACTION = 0.5;
    /** Amount threshold below which a small-donation warning may be shown. */
    const MIN_DONATION_WARNING_USD = 2;

    /**
     * Default RPC provider for ENS resolution (mainnet).
     * Used when callers do not pass a provider. Lazy singleton; ethers v5/v6 compatible.
     * In browser (UMD), uses global ethers; in Node/ESM uses dynamic import.
     */
    let cached = null;
    function getEthers() {
        const g = typeof globalThis !== 'undefined' ? globalThis : null;
        if (g?.ethers)
            return g.ethers;
        const w = typeof window !== 'undefined' ? window : null;
        if (w?.ethers)
            return w.ethers;
        return null;
    }
    function createProviderFromEthers(ethers, rpcUrl) {
        const RpcProvider = ethers.JsonRpcProvider ??
            ethers.providers?.JsonRpcProvider;
        if (!RpcProvider)
            return null;
        return new RpcProvider(rpcUrl);
    }
    /**
     * Return a mainnet provider suitable for ENS resolution when no provider is passed.
     * Uses global ethers in browser (UMD); otherwise dynamic import. Cached after first success.
     */
    async function getDefaultProvider() {
        if (cached)
            return cached;
        const globalEthers = getEthers();
        if (globalEthers) {
            const p = createProviderFromEthers(globalEthers, DEFAULT_MAINNET_RPC_URL);
            if (p) {
                cached = p;
                return cached;
            }
        }
        try {
            const m = await import('ethers');
            const ethers = m.default ?? m;
            const p = createProviderFromEthers(ethers, DEFAULT_MAINNET_RPC_URL);
            if (p) {
                cached = p;
                return cached;
            }
        }
        catch {
            // ignore
        }
        return null;
    }

    /**
     * Address resolution — ENS (including FluidKey) or raw 0x address
     */
    const HEX_REGEX = /^0x[a-fA-F0-9]{40}$/;
    /** Check if input looks like a raw Ethereum address */
    function isAddress(value) {
        return HEX_REGEX.test(value);
    }
    /**
     * Normalize address to checksummed format (EIP-55).
     * ZKP2P's gating service signs checksummed addresses, so we must match.
     */
    function toChecksumAddress(address) {
        try {
            return ethers.ethers.getAddress(address);
        }
        catch {
            // ethers v5 fallback
            if (ethers.ethers.utils?.getAddress) {
                return ethers.ethers.utils.getAddress(address);
            }
            throw new Error(`Invalid address: ${address}`);
        }
    }
    /**
     * Resolve recipient to address. If ENS (e.g. FluidKey p2pago.fkey.id), resolve via provider.
     *
     * - ENS resolution only works on Ethereum mainnet (ethers throws on Base/L2). We always use
     *   a mainnet provider for resolution.
     * - The resolved 0x address is valid on all EVM chains. FluidKey uses a derivation (coinType
     *   for chainId 0) so stealth addresses work across Base, Polygon, etc. So resolving on L1
     *   and sending on Base is safe—FluidKey will detect the payment. See FluidKey technical docs.
     */
    async function resolveAddress(recipient, provider) {
        if (isAddress(recipient)) {
            // Always return checksummed address (EIP-55) for consistency with ZKP2P gating service
            return toChecksumAddress(recipient);
        }
        // ENS resolution requires mainnet (ethers throws "network does not support ENS" on Base/L2).
        // FluidKey .fkey.id is ENS; use default mainnet provider so resolution works regardless of caller's chain.
        const effectiveProvider = await getDefaultProvider();
        if (!effectiveProvider) {
            throw new Error('ENS resolution requires a provider. Pass provider in options when recipient is an ENS name (e.g. myapp.fkey.eth), or ensure ethers is installed for default mainnet resolution.');
        }
        let resolved = null;
        if (effectiveProvider.resolveName) {
            resolved = await effectiveProvider.resolveName(recipient);
        }
        else if (effectiveProvider.getResolver) {
            const resolver = await effectiveProvider.getResolver(recipient);
            if (resolver?.resolve) {
                resolved = await resolver.resolve(recipient);
            }
        }
        if (!resolved) {
            throw new Error(`Failed to resolve ENS name: ${recipient}`);
        }
        // Always return checksummed address (EIP-55) for consistency with ZKP2P gating service
        return toChecksumAddress(resolved);
    }
    /**
     * Resolve recipient to a 0x address. Input may be ENS (e.g. p2pago.fkey.id) or already a 0x address.
     * When no provider is passed, uses SDK default mainnet provider (requires ethers).
     */
    async function resolveRecipient(recipient, options = {}) {
        return resolveAddress(recipient, options.provider);
    }

    /**
     * Redirect flow — open the hosted Peer onramp UI with prefilled params.
     *
     * Peer extension 0.6.0 (rolled out via Chrome Web Store auto-update) removed
     * `peerExtensionSdk.onramp()` and the entire deeplink/side-panel API. The
     * extension is now headless and only handles payment-capture inside the
     * hosted Peer UI. To open an onramp from an external site we navigate to
     * https://www.peer.xyz/swap with the same query params the deeplink used to
     * forward. This works whether or not the extension is installed — peer.xyz
     * surfaces the install prompt inline as needed.
     */
    /** Base USDC on Base (chainId:tokenAddress) */
    const BASE_USDC = '8453:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const intentHashRegex = /^0x[0-9a-fA-F]{64}$/;
    function buildOnrampUrl(params) {
        const search = new URLSearchParams();
        const set = (key, value) => {
            if (value !== undefined && value !== '')
                search.set(key, value);
        };
        set('referrer', params.referrer);
        set('referrerLogo', params.referrerLogo);
        set('inputCurrency', params.inputCurrency);
        set('inputAmount', params.inputAmount);
        set('paymentPlatform', params.paymentPlatform);
        set('toToken', params.toToken);
        set('recipientAddress', params.recipientAddress);
        set('callbackUrl', params.callbackUrl);
        if (params.intentHash) {
            if (!intentHashRegex.test(params.intentHash)) {
                throw new Error('intentHash must be a 0x-prefixed 32-byte hex string');
            }
            set('intentHash', params.intentHash.toLowerCase());
        }
        const qs = search.toString();
        return qs ? `${PEER_ONRAMP_URL}?${qs}` : PEER_ONRAMP_URL;
    }
    /**
     * Open the hosted Peer onramp (redirect flow) in a new tab.
     * Resolves recipientAddress (ENS/fkey) to a checksummed 0x address so the
     * gating service receives the EIP-55 format it signs against.
     *
     * @param options — Override defaults. referrer defaults to "p2pago".
     */
    async function openRedirectOnramp(options = {}) {
        const { recipientAddress = P2PAGO_DEFAULT_RECIPIENT, provider, amountUsd, inputAmount, toToken = BASE_USDC, paymentPlatform, referrer = P2PAGO_DEFAULT_REFERRER, referrerLogo, callbackUrl, inputCurrency = 'USD', target = '_blank', } = options;
        const resolvedRecipient = await resolveAddress(recipientAddress);
        const resolvedInputAmount = inputAmount != null ? String(inputAmount) : amountUsd != null ? String(amountUsd) : undefined;
        const url = buildOnrampUrl({
            referrer,
            referrerLogo,
            inputCurrency,
            inputAmount: resolvedInputAmount,
            paymentPlatform,
            toToken,
            recipientAddress: resolvedRecipient,
            callbackUrl,
        });
        if (typeof window === 'undefined') {
            throw new Error('openRedirectOnramp requires a browser window');
        }
        window.open(url, target, target === '_blank' ? 'noopener,noreferrer' : undefined);
    }
    /**
     * Returns true if amount is below the small-donation warning threshold.
     */
    function isSmallDonation(amountUsd) {
        const n = typeof amountUsd === 'string' ? parseFloat(amountUsd) : amountUsd;
        return !Number.isNaN(n) && n < MIN_DONATION_WARNING_USD;
    }
    /**
     * Open donation flow (redirect). Optionally warns on small amount.
     * Resolves recipientAddress to a checksummed 0x address before redirecting.
     */
    async function openDonation(options = {}) {
        // openInstallPageIfMissing is retained but unused; the hosted UI no longer requires the extension to start the flow.
        const { onSmallAmountWarning, openInstallPageIfMissing: _ignored, ...onrampOpts } = options;
        const amount = onrampOpts.inputAmount != null
            ? (typeof onrampOpts.inputAmount === 'string'
                ? parseFloat(onrampOpts.inputAmount)
                : onrampOpts.inputAmount)
            : onrampOpts.amountUsd != null
                ? (typeof onrampOpts.amountUsd === 'string' ? parseFloat(onrampOpts.amountUsd) : onrampOpts.amountUsd)
                : undefined;
        if (amount != null && isSmallDonation(amount) && onSmallAmountWarning) {
            const msg = `Donations under $${MIN_DONATION_WARNING_USD} may take longer to process.`;
            const proceed = onSmallAmountWarning(msg);
            if (proceed === false)
                return;
        }
        await openRedirectOnramp(onrampOpts);
    }

    /**
     * Default storage adapter — localStorage
     */
    const KEY_PREFIX = 'zkp2p-donate:v1:';
    function storageKey(accountId) {
        return `${KEY_PREFIX}${accountId}`;
    }
    const defaultStorage = {
        async get(key) {
            if (typeof localStorage === 'undefined')
                return null;
            const raw = localStorage.getItem(key);
            if (!raw)
                return null;
            try {
                const parsed = JSON.parse(raw);
                if (typeof parsed.lastDonationAt !== 'string')
                    return null;
                return parsed;
            }
            catch {
                return null;
            }
        },
        async set(key, value) {
            if (typeof localStorage === 'undefined') {
                throw new Error('localStorage is not available');
            }
            localStorage.setItem(key, JSON.stringify(value));
        },
    };

    /**
     * recordDonation, getDonationStatus — donation recording and support status
     */
    /**
     * Record a donation for an account. Call after successful crypto or ZKP2P donation.
     */
    async function recordDonation(accountId, data, options) {
        const storage = options?.storage ?? defaultStorage;
        const key = storageKey(accountId);
        const record = {
            lastDonationAt: new Date().toISOString(),
            ...(data.txHash && { txHash: data.txHash }),
            ...(data.amount && { amount: data.amount }),
            ...(data.chainId != null && { chainId: data.chainId }),
        };
        await storage.set(key, record);
    }
    /**
     * Get donation status for an account. Returns valid if last donation is within maxAgeMs.
     */
    async function getDonationStatus(accountId, options) {
        const { maxAgeMs, storage = defaultStorage } = options;
        const key = storageKey(accountId);
        const record = await storage.get(key);
        if (!record) {
            return { valid: false };
        }
        const lastAt = new Date(record.lastDonationAt).getTime();
        const now = Date.now();
        const valid = lastAt + maxAgeMs > now;
        const expiredAt = valid ? undefined : new Date(lastAt + maxAgeMs).toISOString();
        return {
            valid,
            lastDonationAt: record.lastDonationAt,
            expiredAt,
        };
    }

    /**
     * 402 Payment Required — versioned contract (v1)
     * Frozen types for cross-project compatibility. Additive changes only.
     */
    /** Validate 402 body has required fields */
    function isPaymentRequiredBody(body) {
        if (!body || typeof body !== 'object')
            return false;
        const o = body;
        return (o.paymentRequired === true &&
            typeof o.recipient === 'string' &&
            typeof o.chainId === 'number');
    }

    /**
     * handle402 — client-side HTTP 402 Payment Required flow.
     *
     * Pays the 402 body's recipient with a direct on-chain transfer (native or ERC-20)
     * and returns a PaymentProof the caller can retry the request with.
     *
     * The previous ZKP2P-via-extension path has been removed: Peer extension 0.6.0
     * dropped the in-extension proof generation API this depended on. Apps that
     * want a ZKP2P-backed 402 flow should compose `Zkp2pClient` (re-exported from
     * `@zkp2p/sdk`) directly and feed the resulting tx hash into PaymentProof
     * themselves.
     */
    /**
     * Pay a 402 body via direct on-chain transfer. Returns a PaymentProof.
     */
    async function handle402(body, options) {
        if (!isPaymentRequiredBody(body)) {
            throw new Error('Invalid 402 body: missing paymentRequired, recipient, or chainId');
        }
        const { recipient, chainId, amountWei } = body;
        const resolvedRecipient = await resolveAddress(recipient, options.provider);
        const chain = chainId ?? BASE_CHAIN_ID;
        const value = amountWei ? BigInt(amountWei) : 0n;
        const tx = await options.signer.sendTransaction({
            to: resolvedRecipient,
            value,
        });
        return {
            type: 'crypto',
            chainId: chain,
            txHash: tx.hash,
            recipient: resolvedRecipient,
            ...(amountWei && { amount: amountWei }),
        };
    }

    /**
     * Capability detection — wallet and ZKP2P extension availability
     */
    /** Check if a wallet (e.g. MetaMask) is available via window.ethereum */
    function getWalletStatus() {
        if (typeof window === 'undefined') {
            return { available: false };
        }
        return { available: typeof window.ethereum !== 'undefined' };
    }
    /**
     * Check if the Peer extension is installed.
     * The redirect onramp no longer requires the extension — it opens peer.xyz directly.
     * The proof-generation path still requires `window.zktls`.
     */
    function getZkp2pStatus() {
        if (typeof window === 'undefined') {
            return { available: false, needsInstall: true, proofAvailable: false };
        }
        const peer = typeof window.peer !== 'undefined';
        const zktls = typeof window.zktls !== 'undefined';
        const available = peer || zktls;
        return { available, needsInstall: !available, proofAvailable: zktls };
    }
    /**
     * Wait for the Peer extension to become available (e.g. after async injection).
     * Listens for zktls#initialized and polls getZkp2pStatus(). Resolves when available or after timeoutMs.
     * Use before deciding to show "install extension" so UIs don't flash "not installed" when the extension is installed but not yet injected.
     */
    function whenExtensionAvailable(options = {}) {
        const { timeoutMs = 3000, pollIntervalMs = 100 } = options;
        if (typeof window === 'undefined') {
            return Promise.resolve();
        }
        const status = getZkp2pStatus();
        if (status.available) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const deadline = Date.now() + timeoutMs;
            const check = () => {
                if (getZkp2pStatus().available) {
                    cleanup();
                    resolve();
                    return;
                }
                if (Date.now() >= deadline) {
                    cleanup();
                    resolve();
                    return;
                }
            };
            const onInitialized = () => {
                check();
            };
            const cleanup = () => {
                window.removeEventListener('zktls#initialized', onInitialized);
                clearInterval(intervalId);
            };
            window.addEventListener('zktls#initialized', onInitialized);
            const intervalId = setInterval(check, pollIntervalMs);
        });
    }

    /**
     * Supported chains and token metadata for payments and verification.
     * Apps can subset or extend; SDK uses this as the canonical source for RPC and token addresses.
     */
    /** Native ETH sentinel (zero address). Use for native transfer verification. */
    const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
    /** ERC20 Transfer event topic (Transfer(address,address,uint256)) */
    const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const BASE_RPC = 'https://mainnet.base.org';
    const ETHEREUM_RPC = 'https://ethereum.publicnode.com';
    const POLYGON_RPC = 'https://polygon-rpc.com';
    const ARBITRUM_RPC = 'https://arb1.arbitrum.io/rpc';
    const OPTIMISM_RPC = 'https://mainnet.optimism.io';
    /** USDC addresses (Circle canonical mainnet). */
    const USDC = {
        1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    };
    /** USDT addresses (Tether, common mainnet). */
    const USDT = {
        1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    };
    function buildChains() {
        const chains = {};
        const entries = [
            { chainId: 1, name: 'Ethereum', rpcUrl: ETHEREUM_RPC, usdc: USDC[1], usdt: USDT[1] },
            { chainId: 8453, name: 'Base', rpcUrl: BASE_RPC, usdc: USDC[8453], usdt: USDT[8453] },
            { chainId: 137, name: 'Polygon', rpcUrl: POLYGON_RPC, usdc: USDC[137], usdt: USDT[137] },
            { chainId: 42161, name: 'Arbitrum One', rpcUrl: ARBITRUM_RPC, usdc: USDC[42161], usdt: USDT[42161] },
            { chainId: 10, name: 'OP Mainnet', rpcUrl: OPTIMISM_RPC, usdc: USDC[10], usdt: USDT[10] },
        ];
        for (const { chainId, name, rpcUrl, usdc, usdt } of entries) {
            chains[chainId] = {
                name,
                chainId,
                rpcUrl,
                tokens: [
                    { address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH', decimals: 18 },
                    { address: usdc, symbol: 'USDC', decimals: 6 },
                    { address: usdt, symbol: 'USDT', decimals: 6 },
                ],
            };
        }
        return chains;
    }
    /** Supported chains with name, rpcUrl, and default tokens (ETH, USDC, USDT). Apps can subset or extend. */
    const SUPPORTED_CHAINS = buildChains();
    /**
     * Return the supported chain config. Use for "pay with wallet" UI (display names, USDC address, decimals)
     * and for verification (RPC URL). Apps can pass a custom chain map to verifyPaymentTx if needed.
     */
    function getSupportedChains() {
        return SUPPORTED_CHAINS;
    }

    /**
     * On-chain verification of a direct payment tx (native or ERC20 to recipient).
     */
    /**
     * Verify that a tx succeeded and that value (native or ERC20) reached the recipient.
     * Uses SDK chain config for RPC unless rpcUrl is passed. Returns true only if the tx
     * succeeded and the recipient received the payment.
     */
    async function verifyPaymentTx(params) {
        const { txHash, chainId, recipientAddress, tokenAddress, rpcUrl } = params;
        const chains = getSupportedChains();
        const chain = chains[chainId];
        const url = rpcUrl ?? chain?.rpcUrl;
        if (!url) {
            throw new Error(`No RPC URL for chainId ${chainId}. Pass rpcUrl or use a supported chain.`);
        }
        const receipt = await rpcCall(url, 'eth_getTransactionReceipt', [txHash]);
        if (!receipt || !receipt.status) {
            return false;
        }
        if (receipt.status !== '0x1') {
            return false;
        }
        if (tokenAddress) {
            const recipientTopic = addressToTopic(recipientAddress);
            const hasTransferToRecipient = (receipt.logs ?? []).some((log) => log.address.toLowerCase() === tokenAddress.toLowerCase() &&
                log.topics?.[0] === ERC20_TRANSFER_TOPIC &&
                log.topics?.[2] === recipientTopic);
            return hasTransferToRecipient;
        }
        const tx = await rpcCall(url, 'eth_getTransactionByHash', [txHash]);
        if (!tx?.to || !tx.value) {
            return false;
        }
        const valueWei = BigInt(tx.value);
        if (valueWei === 0n) {
            return false;
        }
        return tx.to.toLowerCase() === recipientAddress.toLowerCase();
    }
    function addressToTopic(address) {
        const hex = address.startsWith('0x') ? address.slice(2).toLowerCase() : address.toLowerCase();
        if (hex.length !== 40) {
            throw new Error(`Invalid address: ${address}`);
        }
        return '0x' + hex.padStart(64, '0');
    }
    async function rpcCall(url, method, params) {
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
        const json = (await res.json());
        if (json.error) {
            throw new Error(json.error.message ?? 'RPC error');
        }
        return json.result ?? null;
    }

    /** SDK version for debugging and proof metadata */
    const SDK_VERSION = '0.1.0';

    exports.BASE_CHAIN_ID = BASE_CHAIN_ID;
    exports.DEFAULT_MAINNET_RPC_URL = DEFAULT_MAINNET_RPC_URL;
    exports.ERC20_TRANSFER_TOPIC = ERC20_TRANSFER_TOPIC;
    exports.GAS_COST_MAX_FRACTION = GAS_COST_MAX_FRACTION;
    exports.MIN_DONATION_WARNING_USD = MIN_DONATION_WARNING_USD;
    exports.NATIVE_TOKEN_ADDRESS = NATIVE_TOKEN_ADDRESS;
    exports.P2PAGO_DEFAULT_RECIPIENT = P2PAGO_DEFAULT_RECIPIENT;
    exports.P2PAGO_DEFAULT_REFERRER = P2PAGO_DEFAULT_REFERRER;
    exports.P2PAGO_FEE_MIN_USD = P2PAGO_FEE_MIN_USD;
    exports.P2PAGO_FEE_PERCENT = P2PAGO_FEE_PERCENT;
    exports.PEER_ONRAMP_URL = PEER_ONRAMP_URL;
    exports.SDK_VERSION = SDK_VERSION;
    exports.SUPPORTED_CHAINS = SUPPORTED_CHAINS;
    exports.USDC_ADDRESS = USDC_ADDRESS;
    exports.ZKP2P_EXTENSION_INSTALL_URL = ZKP2P_EXTENSION_INSTALL_URL;
    exports.getDonationStatus = getDonationStatus;
    exports.getSupportedChains = getSupportedChains;
    exports.getWalletStatus = getWalletStatus;
    exports.getZkp2pStatus = getZkp2pStatus;
    exports.handle402 = handle402;
    exports.isSmallDonation = isSmallDonation;
    exports.openDonation = openDonation;
    exports.openRedirectOnramp = openRedirectOnramp;
    exports.recordDonation = recordDonation;
    exports.resolveRecipient = resolveRecipient;
    exports.verifyPaymentTx = verifyPaymentTx;
    exports.whenExtensionAvailable = whenExtensionAvailable;
    Object.keys(sdk).forEach(function (k) {
        if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
            enumerable: true,
            get: function () { return sdk[k]; }
        });
    });

}));
