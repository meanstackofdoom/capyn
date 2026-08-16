# CAPYN public-alpha video

The source is the Remotion composition in `apps/video`. It renders a silent 24-second, 1920×1080 H.264 demonstration of the CAPYN category thesis and four seeded authorization decisions.

Render the video and cover image:

```bash
corepack pnpm video:render
corepack pnpm video:still
```

Outputs:

- `capyn-public-alpha.mp4` — launch video;
- `capyn-public-alpha-cover.png` — social/README cover frame.

The video intentionally says public alpha and uses only simulated transactions. Update the final URL in `apps/video/src/video.tsx` if the repository moves.

The companion dashboard evidence is generated from a running local web/API pair after the four demo requests have been submitted:

```bash
corepack pnpm media:screenshot
```

This opens the real authorizations screen in headless Chrome, selects the AWS approval request and writes `outreach/screenshots/capyn-authorization-trace.png`. Set `CHROME_PATH` if Chrome or Chromium is not in a standard location.
