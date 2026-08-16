# CAPYN dashboard evidence

- `capyn-authorizations.png` shows the four seeded authorization outcomes together.
- `capyn-authorization-trace.png` opens the exact AWS request that requires approval and shows its persisted rule-by-rule evaluation trace.

The selected-trace asset is captured from the real local control plane, not assembled as a mockup. With the API and web app running and the four requests submitted, reproduce it with:

```bash
corepack pnpm media:screenshot
```

The capture script uses headless Chrome at 1600×1000. Set `CHROME_PATH`, `CAPYN_SCREENSHOT_URL` or `CAPYN_SCREENSHOT_SELECTOR` to override its defaults.
