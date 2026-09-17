(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const networks = { '0x1': 'Ethereum', '0x2105': 'Base', '0xa4b1': 'Arbitrum' };
  const providers = [];
  const state = { provider: null, account: '', chain: '', sample: false, revision: 0, connecting: false, verified: null };
  let walletTrigger = null;
  let connectionAttempt = 0;
  let providerHandlers = null;
  const short = (value) => value.slice(0, 6) + '…' + value.slice(-4);
  const status = (text, error = false) => { $('appStatus').textContent = text; $('appStatus').classList.toggle('error', error); };
  const announce = (entry) => {
    if (!entry || !entry.provider || typeof entry.provider.request !== 'function') return;
    if (providers.some((item) => item.provider === entry.provider)) return;
    providers.push({ provider: entry.provider, name: String(entry.info?.name || 'Browser wallet').slice(0, 70) });
    if ($('walletDialog').open && !state.connecting) renderWallets();
  };
  window.addEventListener('eip6963:announceProvider', (event) => announce(event.detail));
  function discover() {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const injected = window.ethereum;
    if (injected) (injected.providers || [injected]).forEach((provider) => announce({ provider, info: { name: provider.isMetaMask ? 'MetaMask' : provider.isCoinbaseWallet ? 'Coinbase Wallet' : 'Browser wallet' } }));
  }
  function renderWallets() {
    $('walletOptions').replaceChildren();
    providers.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wallet-option';
      const name = document.createElement('span');
      name.textContent = entry.name;
      button.append(name, $('connectMain').querySelector('svg').cloneNode(true));
      button.addEventListener('click', () => connect(entry));
      $('walletOptions').append(button);
    });
    $('walletMessage').textContent = providers.length ? 'Choose a wallet, then approve account access in its prompt.' : 'No browser wallet detected. Open this page in your wallet’s browser, or enable an Ethereum wallet extension and try again.';
  }
  function openWallet(event) {
    walletTrigger = event?.currentTarget || $('connectHeader');
    discover();
    renderWallets();
    if (!$('walletDialog').open) $('walletDialog').showModal();
  }
  function detachProvider() {
    if (state.provider?.removeListener && providerHandlers) {
      Object.entries(providerHandlers).forEach(([event, handler]) => state.provider.removeListener(event, handler));
    }
    providerHandlers = null;
  }
  function attachProvider(provider) {
    detachProvider();
    state.provider = provider;
    providerHandlers = {
      accountsChanged: (accounts) => {
        if (state.provider !== provider) return;
        if (!accounts?.length) { disconnect(); return; }
        state.account = accounts[0];
        resetLive();
        status('Wallet account changed. Check your NFT again for this account.');
      },
      chainChanged: (chain) => {
        if (state.provider !== provider) return;
        state.chain = String(chain).toLowerCase();
        resetLive();
        status(networks[state.chain] ? 'Network changed to ' + networks[state.chain] + '. Check your NFT again.' : 'Unsupported network. Switch your wallet to Ethereum, Base or Arbitrum.', !networks[state.chain]);
      },
      disconnect: () => { if (state.provider === provider) disconnect(); }
    };
    if (provider.on) Object.entries(providerHandlers).forEach(([event, handler]) => provider.on(event, handler));
  }
  async function connect(entry) {
    if (state.connecting) return;
    const attempt = ++connectionAttempt;
    state.connecting = true;
    $('walletOptions').querySelectorAll('button').forEach((button) => { button.disabled = true; });
    $('retryWallet').disabled = true;
    $('walletMessage').textContent = 'Waiting for ' + entry.name + '. Approve the connection in your wallet.';
    try {
      const accounts = await entry.provider.request({ method: 'eth_requestAccounts' });
      if (attempt !== connectionAttempt) return;
      if (!Array.isArray(accounts) || !/^0x[a-fA-F0-9]{40}$/.test(accounts[0] || '')) throw new Error('No account was shared. Unlock your wallet and try again.');
      const chain = await entry.provider.request({ method: 'eth_chainId' });
      if (attempt !== connectionAttempt) return;
      attachProvider(entry.provider);
      state.account = accounts[0];
      state.chain = String(chain).toLowerCase();
      resetLive();
      $('walletDialog').close();
      status(networks[state.chain] ? 'Wallet connected. Enter your NFT to check ownership. Live offers are currently unavailable.' : 'Wallet connected on an unsupported network. Switch to Ethereum, Base or Arbitrum.', !networks[state.chain]);
      $('nftLink').focus();
    } catch (error) {
      if (attempt !== connectionAttempt) return;
      $('walletMessage').textContent = error.code === 4001 ? 'Connection declined. Your wallet remains unchanged. Choose a wallet to try again.' : error.code === -32002 ? 'A connection request is already open. Check your wallet to approve or dismiss it.' : 'Could not connect. Unlock your wallet, check its network connection and try again.';
    } finally {
      if (attempt === connectionAttempt) {
        state.connecting = false;
        $('walletOptions').querySelectorAll('button').forEach((button) => { button.disabled = false; });
        $('retryWallet').disabled = false;
      }
    }
  }
  function disconnect() {
    detachProvider();
    state.provider = null;
    state.account = '';
    state.chain = '';
    resetLive();
    status('Disconnected from this app. Manage any saved site permissions in your wallet.');
  }
  function setTraits(traits) {
    $('nftTraits').replaceChildren();
    traits.slice(0, 6).forEach((trait) => { const chip = document.createElement('span'); chip.textContent = String(trait).slice(0, 80); $('nftTraits').append(chip); });
  }
  function renderArt() {
    const sampleArt = state.sample || !state.account;
    $('nftImage').hidden = !sampleArt;
    $('nftImage').onerror = null;
    $('nftNoArt').hidden = sampleArt;
    $('artEdition').hidden = !sampleArt;
    $('sampleLabel').hidden = !sampleArt;
    if (sampleArt) {
      $('nftImage').src = '../assets/nft.svg';
      $('nftImage').alt = 'Illustrative Chrome Bloom digital collectible';
      $('collectionName').textContent = 'Chrome studies';
      $('nftName').textContent = 'Bloom #0084';
      $('nftBadge').textContent = state.sample ? 'EXAMPLE NFT' : 'PREVIEW ARTWORK';
      setTraits(['Liquid chrome', 'Violet aura', 'Edition 1/1']);
    } else {
      $('nftImage').removeAttribute('src');
      $('collectionName').textContent = 'Connected collection';
      $('nftName').textContent = 'Select your NFT';
      $('nftBadge').textContent = 'WALLET CONNECTED';
      $('noArtTitle').textContent = 'Your collection starts here';
      $('nftNoArt').querySelector('span').textContent = 'Add an NFT below to verify ownership.';
      setTraits([]);
    }
  }
  function renderMode() {
    $('quoteGate').hidden = !!state.account || state.sample;
    $('connectedPanel').hidden = !state.account || state.sample;
    $('examplePanel').hidden = !state.sample;
    $('nftEntry').hidden = state.sample;
    $('resetExample').hidden = !state.sample;
    $('quoteBadge').textContent = state.sample ? 'EXAMPLE VALUATION' : state.account ? 'LIVE OFFERS UNAVAILABLE' : 'WALLET REQUIRED';
    $('walletLabel').textContent = state.account ? short(state.account) : 'Connect Wallet';
    $('connectHeader').setAttribute('aria-label', state.account ? 'Change connected wallet ' + short(state.account) : 'Connect Wallet');
    $('disconnectBtn').hidden = !state.account;
    $('networkLabel').textContent = networks[state.chain] || (state.account ? 'Unsupported network' : 'Ethereum');
    $('connectedAccount').textContent = state.account ? short(state.account) : '';
    $('connectedAccount').title = state.account;
    $('stepConnect').classList.toggle('is-active', !state.sample);
    $('stepValue').classList.toggle('is-active', state.sample);
    $('stepPayout').classList.remove('is-active');
    $('inputHint').textContent = state.account ? 'Read-only check on ' + (networks[state.chain] || 'your current network') + '. ERC-721 NFTs only. An item link can supply the token ID.' : 'Connect an Ethereum, Base or Arbitrum wallet to check ownership. An item link can supply the token ID.';
  }
  function resetLive() {
    state.revision++;
    state.sample = false;
    state.verified = null;
    $('inspectBtn').disabled = false;
    $('inspectBtn').removeAttribute('aria-busy');
    $('connectedEyebrow').textContent = 'WALLET CONNECTED';
    $('connectedTitle').textContent = 'Bring your collectible.';
    $('connectedDescription').textContent = 'Paste an NFT link or its collection address and token ID to verify that it belongs to this wallet.';
    renderMode();
    renderArt();
  }
  function sample() {
    state.revision++;
    state.sample = true;
    state.verified = null;
    $('inspectBtn').disabled = false;
    renderMode();
    renderArt();
    renderCurrency();
    status('Example loaded. All prices, traits, rarity and fees are illustrative. No sale can be submitted.');
    $('reviewBtn').focus({ preventScroll: true });
  }
  function renderCurrency() {
    const usdc = $('currency').value === 'USDC';
    $('payoutAmount').textContent = usdc ? '4,032.00' : '1.344';
    $('payoutCurrency').textContent = usdc ? 'USDC' : 'ETH';
    $('rateNote').textContent = usdc ? 'Example rate: 1 ETH = 3,000 USDC. Ethereum network. Not a live rate.' : 'Payout network: Ethereum. Illustrative amounts.';
  }
  function parseItem() {
    const input = $('nftLink').value.trim();
    let address = input;
    let token = $('tokenId').value.trim();
    let linkedChain = '';
    if (!/^0x[a-fA-F0-9]{40}$/.test(input)) {
      let url;
      try { url = new URL(input); } catch { throw new Error('Enter a collection contract address or a complete HTTPS NFT item link.'); }
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a complete HTTPS NFT item link or a collection contract address.');
      const match = url.pathname.match(/\/(0x[a-fA-F0-9]{40})\/(\d+)\/?$/);
      if (!match) throw new Error('This link does not include a collection contract and token ID. Enter them separately.');
      address = match[1];
      if (token && (!/^\d+$/.test(token) || token.length > 78)) throw new Error('Enter a valid non-negative token ID for this collection.');
      if (token && BigInt(token).toString() !== BigInt(match[2]).toString()) throw new Error('The token ID differs from the item link. Clear it or use the same token ID.');
      token = match[2];
      const chainPart = url.pathname.split('/').find((part) => ['ethereum', 'base', 'arbitrum', 'matic', 'polygon', 'solana', 'optimism', 'bsc', 'avalanche', 'klaytn', 'zora'].includes(part));
      const linkNetworks = { ethereum: '0x1', base: '0x2105', arbitrum: '0xa4b1' };
      if (chainPart && !linkNetworks[chainPart]) throw new Error('This item link uses an unsupported network. Use an Ethereum, Base or Arbitrum ERC-721 NFT.');
      linkedChain = linkNetworks[chainPart] || '';
    }
    if (!/^\d+$/.test(token) || token.length > 78 || BigInt(token) >= (1n << 256n)) throw new Error('Enter a valid non-negative token ID for this collection.');
    return { address, token: BigInt(token).toString(), linkedChain };
  }
  function decodeString(hex) {
    if (typeof hex !== 'string' || !/^0x[0-9a-f]*$/i.test(hex) || hex.length < 130) throw new Error('Metadata unavailable');
    const data = hex.slice(2);
    const offset = Number(BigInt('0x' + data.slice(0, 64))) * 2;
    if (!Number.isSafeInteger(offset) || offset + 64 > data.length) throw new Error('Invalid metadata');
    const length = Number(BigInt('0x' + data.slice(offset, offset + 64)));
    if (!Number.isSafeInteger(length) || length > 1000000 || offset + 64 + length * 2 > data.length) throw new Error('Invalid metadata');
    const bytes = data.slice(offset + 64, offset + 64 + length * 2).match(/.{2}/g) || [];
    return new TextDecoder().decode(Uint8Array.from(bytes, (byte) => parseInt(byte, 16)));
  }
  async function readMetadata(uri) {
    if (uri.startsWith('data:application/json')) {
      const comma = uri.indexOf(',');
      const payload = uri.slice(comma + 1);
      const text = uri.slice(0, comma).includes(';base64') ? new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))) : decodeURIComponent(payload);
      return JSON.parse(text);
    }
    const url = new URL(uri);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Metadata unavailable');
    const response = await fetch(url.href, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Metadata unavailable');
    const text = await response.text();
    if (text.length > 1000000) throw new Error('Metadata too large');
    return JSON.parse(text);
  }
  function safeImage(value) {
    if (typeof value !== 'string' || value.length > 2000000) return '';
    if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)) return value;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  async function readCall(provider, params) {
    let timer;
    try {
      return await Promise.race([provider.request({ method: 'eth_call', params }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Wallet read timed out')), 15000); })]);
    } finally { clearTimeout(timer); }
  }
  async function inspect(event) {
    event.preventDefault();
    $('nftLink').removeAttribute('aria-invalid');
    $('tokenId').removeAttribute('aria-invalid');
    let item;
    try { item = parseItem(); } catch (error) {
      status(error.message, true);
      const field = error.message.includes('token ID') ? $('tokenId') : $('nftLink');
      field.setAttribute('aria-invalid', 'true');
      field.focus();
      return;
    }
    if (!state.account) { status('Connect your wallet to verify ownership of this NFT.'); openWallet(event); return; }
    if (!networks[state.chain]) { status('Switch your wallet to Ethereum, Base or Arbitrum before checking your NFT.', true); return; }
    if (item.linkedChain && item.linkedChain !== state.chain) { status('This NFT is on ' + networks[item.linkedChain] + '. Switch networks in your wallet, then check again.', true); return; }
    resetLive();
    const revision = state.revision;
    const provider = state.provider;
    const account = state.account;
    const word = BigInt(item.token).toString(16).padStart(64, '0');
    $('inspectBtn').disabled = true;
    $('inspectBtn').setAttribute('aria-busy', 'true');
    status('Checking NFT ownership on ' + networks[state.chain] + '…');
    try {
      const owner = await readCall(provider, [{ to: item.address, data: '0x6352211e' + word }, 'latest']);
      if (revision !== state.revision) return;
      if (!/^0x[0-9a-fA-F]{64}$/.test(owner || '')) throw new Error('Could not read ERC-721 ownership. Check the collection, token ID and network.');
      if (('0x' + owner.slice(-40)).toLowerCase() !== account.toLowerCase()) throw new Error('This NFT is not owned by the connected account. Choose the correct wallet or check another NFT.');
      state.verified = item;
      $('nftBadge').textContent = 'OWNERSHIP VERIFIED';
      $('collectionName').textContent = short(item.address);
      $('collectionName').title = item.address;
      $('nftName').textContent = 'Token #' + item.token;
      $('noArtTitle').textContent = 'NFT ownership verified';
      $('nftNoArt').querySelector('span').textContent = 'Reading the collectible’s artwork…';
      $('connectedEyebrow').textContent = 'OWNERSHIP VERIFIED';
      $('connectedTitle').textContent = 'Your NFT. Verified.';
      $('connectedDescription').textContent = 'This collectible belongs to your connected wallet. Floor, rarity and a sellable offer require live market data, which is not available here yet.';
      status('Ownership verified. Reading NFT metadata. Live valuation and offers are unavailable.');
      try {
        const raw = await readCall(provider, [{ to: item.address, data: '0xc87b56dd' + word }, 'latest']);
        if (revision !== state.revision) return;
        const metadata = await readMetadata(decodeString(raw));
        if (revision !== state.revision) return;
        if (metadata && typeof metadata.name === 'string') $('nftName').textContent = metadata.name.slice(0, 140);
        if (Array.isArray(metadata?.attributes)) setTraits(metadata.attributes.filter((a) => a && ['string', 'number'].includes(typeof a.value)).map((a) => (a.trait_type ? String(a.trait_type).slice(0, 30) + ': ' : '') + a.value));
        const image = safeImage(metadata?.image);
        if (image) {
          $('nftImage').referrerPolicy = 'no-referrer';
          $('nftImage').alt = $('nftName').textContent;
          $('nftImage').onerror = () => { if (revision === state.revision) { $('nftImage').hidden = true; $('nftNoArt').hidden = false; } };
          $('nftImage').src = image;
          $('nftImage').hidden = false;
          $('nftNoArt').hidden = true;
        }
      } catch {}
      if (revision !== state.revision) return;
      $('nftNoArt').querySelector('span').textContent = 'Artwork metadata is unavailable.';
      status('NFT ownership verified. Live pricing and executable offers are currently unavailable.');
    } catch (error) {
      if (revision !== state.revision) return;
      status(error.message?.startsWith('This NFT') || error.message?.startsWith('Could not read') ? error.message : 'Could not read this NFT. Check your wallet connection, network, collection address and token ID, then retry.', true);
    } finally {
      if (revision === state.revision) { $('inspectBtn').disabled = false; $('inspectBtn').removeAttribute('aria-busy'); }
    }
  }
  $('connectHeader').addEventListener('click', openWallet);
  $('connectMain').addEventListener('click', openWallet);
  $('retryWallet').addEventListener('click', () => { discover(); renderWallets(); });
  $('disconnectBtn').addEventListener('click', disconnect);
  $('sampleBtn').addEventListener('click', sample);
  $('connectedSampleBtn').addEventListener('click', sample);
  $('resetExample').addEventListener('click', () => { resetLive(); status('Add your NFT to check its ownership. Live offers are currently unavailable.'); $('nftLink').focus(); });
  $('currency').addEventListener('change', renderCurrency);
  $('nftForm').addEventListener('submit', inspect);
  ['nftLink', 'tokenId'].forEach((id) => $(id).addEventListener('input', () => { $(id).removeAttribute('aria-invalid'); if (state.verified || $('inspectBtn').disabled) { resetLive(); status('NFT details changed. Check ownership again.'); } }));
  $('reviewBtn').addEventListener('click', () => {
    if (!state.sample) return;
    $('reviewAmount').textContent = $('payoutAmount').textContent + ' ' + $('payoutCurrency').textContent;
    $('stepValue').classList.remove('is-active');
    $('stepPayout').classList.add('is-active');
    $('reviewDialog').showModal();
  });
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
  ['walletDialog', 'reviewDialog'].forEach((id) => $(id).addEventListener('click', (event) => {
    if (event.target !== $(id)) return;
    const rect = $(id).getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $(id).close();
  }));
  $('walletDialog').addEventListener('close', () => {
    connectionAttempt++;
    state.connecting = false;
    $('retryWallet').disabled = false;
    if (!state.account && walletTrigger instanceof HTMLElement) walletTrigger.focus();
  });
  $('reviewDialog').addEventListener('close', () => { renderMode(); $('reviewBtn').focus(); });
  discover();
  renderMode();
})();
