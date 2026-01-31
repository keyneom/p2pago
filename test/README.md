# SDK Test (script-tag / GitHub import)

## Local test (no push required)

```bash
npm run build
npx serve .
```

Open: http://localhost:3000/test/demo.html?local=1

## Test from GitHub (jsDelivr)

1. Build and commit dist:

   ```bash
   npm run build
   git add -f dist/
   git commit -m "Add dist for GitHub import test"
   git push
   ```

2. Open the demo (hosted anywhere, or use GitHub Pages):

   http://localhost:3000/test/demo.html

   (Without `?local=1` it loads from `https://cdn.jsdelivr.net/gh/keyneom/p2pago@main/dist/umd/zkp2p-donate.js`)

3. Or serve the repo and open the file directly.
