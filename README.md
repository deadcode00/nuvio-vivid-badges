# Paisa

A personal expense tracker. Runs in the browser, stores everything on your device (localStorage), nothing is uploaded.

- **Dashboard**: spend by category, spend vs budget pace, 6-month trend, top merchants, savings rate
- **Budgets**: monthly limit per category with progress bars
- **Where you can cut**: subscriptions, categories creeping up, small frequent purchases, biggest wins
- **Import**: HDFC statement CSV (bank account or credit card). Re-importing skips duplicates.

## Run
```
npm install
npm run dev      # development
npm test         # parser + insight tests
npm run build    # production build in dist/
```
On iPhone: host `dist/` anywhere (e.g. GitHub Pages), open in Safari, Share → Add to Home Screen.

## Not built yet
- Automatic capture from HDFC alert emails (planned: Google Apps Script reading Gmail)
- Credit-card PDF statements
- Offline service worker / persistent storage via IndexedDB
