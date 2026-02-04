# GitHub Pages demo

Serves at `https://keyneom.github.io/p2pago/` when GitHub Pages is enabled (Settings → Pages → Source: Deploy from branch → Branch: main, folder: /docs).

**`zkp2p-donate.js`** — UMD script-tag bundle. Consumers load it from GitHub via jsDelivr (`https://cdn.jsdelivr.net/gh/keyneom/p2pago@main/docs/zkp2p-donate.js`). After npm publish they can also use unpkg. After source changes: run `npm run build:docs`, then commit this file.
