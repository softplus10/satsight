# SatSight

A Bitcoin watch-only wallet built with SvelteKit, Capacitor, and Tauri. SatSight stores addresses and account public keys locally. It does not accept private keys or seed phrases. Transactions are prepared as PSBTs and signed on an external device.

## Features

- Mainnet and Testnet addresses and account public keys: `xpub`, `ypub`, `zpub`, `tpub`, `upub`, and `vpub`.
- Legacy, nested SegWit, native SegWit, and Taproot address derivation.
- QR imports for addresses, BIP21, key origins, supported single-key descriptors, Specter fragments, and SeedSigner animated UR.
- Manual or startup sync through an Esplora-compatible server.
- PSBT creation, external signing via animated QR, original-transaction comparison, and broadcasting.
- IndexedDB storage and a service worker for offline access to saved data.
- Static web/PWA, Capacitor Android/iOS, and Tauri desktop projects.
- US English, Canadian English, and Korean interfaces selected with `?lang=en_US`, `?lang=en_CA`, or `?lang=ko_KR`, with typed messages and locale-aware formatting. See [Internationalization](docs/I18N.md).

## Routes

| Route                     | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `/`                       | Balance overview, wallets, and recent transactions               |
| `/wallets`                | Wallet list                                                      |
| `/wallets/new`            | Import an address or account public key                          |
| `/wallets/[id]`           | Wallet balance, public information, and sync                     |
| `/wallets/[id]/addresses` | Receive and change addresses                                     |
| `/wallets/[id]/send`      | Prepare, externally sign, and broadcast a PSBT                   |
| `/transactions`           | Transactions and direction filters                               |
| `/transactions/[id]`      | Transaction details and explorer link                            |
| `/settings`               | Display preferences, Esplora server, startup sync, and gap limit |

The app uses client-side rendering (`ssr = false`). The static adapter's `index.html` fallback handles dynamic routes.

## Development

Use Node.js 24 or later. Android builds also require JDK 21 or 24 and the Android SDK.

```sh
npm ci
npm run dev
```

Run the project checks:

```sh
npm test
npm run check
npm run lint
npm run build
```

Domain code lives in `src/lib/domain/`, network clients in `src/lib/sync/`, IndexedDB access in `src/lib/db/`, and shared Svelte state in `src/lib/state/`. User-facing messages live in `src/lib/i18n/locales/`.

## Offline access and privacy

The service worker caches the web app shell and route chunks. Capacitor bundles the same static frontend in the native app. Saved wallets, addresses, balances, and transactions can be viewed offline. Sync, fee estimates, UTXO retrieval, and broadcasting require a network connection.

The default server is Blockstream Esplora. You can configure your own Esplora API URL in Settings. **Your sync server can see the addresses you query.** Public keys and addresses are sensitive financial information even though they cannot sign transactions.

## Web hosting

The Cloudflare configuration serves `build/` as Workers Static Assets with an SPA fallback. There is no application server Worker.

The demo is deployed as `satsight-demo` in the **Hanseung Kim** Cloudflare account at <https://satsight-demo.hskim.dev>. `wrangler.jsonc` pins the account and custom domain. Authenticate Wrangler with access to that account before deploying; API credentials must stay outside the repository.

```sh
npm run cf:dev
npm run deploy
```

## Mobile apps

Build the frontend and sync native projects:

```sh
npm run cap:sync
```

Open Android Studio or Xcode:

```sh
npm run cap:android
npm run cap:ios
```

Projects are in `android/` and `ios/`. The Android application ID is `dev.hskim.satsight`.

## Desktop apps

```sh
npm run tauri:dev
npm run tauri:build
```

The Tauri project is in `src-tauri/`. Native builds require the host platform's Tauri dependencies. Explorer links open in the system browser through the opener plugin. Release packaging is described in [Release process](docs/RELEASE.md).

## Security boundaries

- No `xprv`, WIF private keys, or seed phrases are supported.
- Signing happens on an external device such as SeedSigner.
- An imported signed PSBT must contain the same unsigned transaction as the original before it can be finalized and broadcast.
- Always verify the recipient, amount, and fee on the signing device.
- Wallet records are stored in this device's IndexedDB without a SatSight cloud account.
- SatSight is not a seed backup. Keep the original wallet's recovery material separately.
