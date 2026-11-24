# Những bước chân của Chang — *Every step has a story.*

A local-first, installable PWA travel diary: journeys, gold-timeline itineraries, Wallet for tickets & QR codes,
Memories, Budget, Pose Book, Food Passport, a private encrypted vault, backup/restore, and offline use.

**No personal travel data is in this repository or in the deployed site.** A journey's itinerary is kept in a
private import file (`*.changjourney.json`) that the owner stores in the iPhone Files app and imports once.
After import it lives only in the device's IndexedDB and works offline.

## Commands
```
npm run typecheck   # tsc
npm test            # unit tests (fictional demo journey only)
npm run build       # → dist/
npm run check:repo  # privacy & secrets guard (add -- --dist dist to also scan the build)
npm run serve       # http://localhost:4173
npm run e2e         # Playwright: first launch → import → persistence → offline (demo file)
```

## Privacy guard
`scripts/check-repo.mjs` runs before every deployment and blocks: personal photos/PDFs/backups, any journey
import file, secrets/keys, real Chinese street addresses, unexpected service-worker cache entries, and —
when `PRIVACY_GUARD_KEY` is available — the owner's private itinerary strings, recognised through keyed
fingerprints in `privacy-fingerprints.json` (hashes only; the key is never committed).

## Deploy
GitHub Actions (`.github/workflows/deploy.yml`) type-checks, tests, builds, runs the guard on the build
output, and publishes `dist/` to GitHub Pages. All asset paths are relative, so the app works under
`https://<user>.github.io/changs-journey/`.

## Install on iPhone
Open the Pages URL in Safari → Share → **Add to Home Screen** → open from the icon →
**Nhập hành trình từ tệp** → pick your `.changjourney.json` from Files.
The Home Screen app and the Safari tab have separate storage; import inside the Home Screen app.
