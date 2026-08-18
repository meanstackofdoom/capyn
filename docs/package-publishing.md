# Package publishing

CAPYN prepares four narrow developer packages from the public monorepo:

| Package | Purpose | Depends on |
|---|---|---|
| `@capyn/types` | Shared Zod schemas and TypeScript contracts | `zod` |
| `@capyn/policy-engine` | Deterministic, side-effect-free policy evaluation | `@capyn/types` |
| `@capyn/gate` | ES256 exact-action execution claims, verification and replay boundary | `@capyn/types`, `zod` |
| `@capyn/sdk` | Typed client for the CAPYN authorization API | `@capyn/types` |

The API, database adapter, billing package, website and video application remain
private workspaces. Publishing a package does not turn the hosted synthetic demo
into a production service.

## Owner-controlled first publish

The `@capyn` scope must exist on npm and the publishing owner must authenticate
with 2FA. CAPYN deliberately does not store a registry token in the repository.

Create or join the npm organisation, authenticate, then verify the identity:

```bash
npm login
npm whoami
```

Review npm's guidance for
[public scoped packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
before claiming the scope.

## Release gate

Start from the exact release commit with a clean working tree:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm security:audit
corepack pnpm check
```

Build and inspect each archive before publishing:

```bash
corepack pnpm --filter @capyn/types pack
corepack pnpm --filter @capyn/policy-engine pack
corepack pnpm --filter @capyn/gate pack
corepack pnpm --filter @capyn/sdk pack
```

Each archive must contain only its compiled `dist` output, package README,
licence and normalized manifest. It must not contain source maps with local
paths, tests, environment files, credentials, repository-only documentation or
other workspaces.

## Publish order

The packages use workspace ranges in the repository. pnpm rewrites those ranges
to the release version in the packed manifest.

Publish dependencies before consumers:

```bash
corepack pnpm --filter @capyn/types publish --access public
corepack pnpm --filter @capyn/policy-engine publish --access public
corepack pnpm --filter @capyn/gate publish --access public
corepack pnpm --filter @capyn/sdk publish --access public
```

For a first release, confirm all three package pages show public visibility and
the expected version before announcing npm installation.

## Independent install check

Create a clean temporary project outside the repository and install from the
registry:

```bash
npm init -y
npm install @capyn/sdk
```

Run one import and one mocked SDK request under the minimum supported Node.js
version. Repository workspace resolution is not evidence that the published
dependency graph works.

## Trusted publishing

After the initial packages exist, configure one npm
[trusted publisher](https://docs.npmjs.com/trusted-publishers/) per package for
this public GitHub repository. Restrict it to the reviewed release workflow and
the `npm publish` action. Trusted publishing uses OIDC, avoids a long-lived npm
token and automatically attaches provenance for eligible public packages.

Do not add an npm token until the ownership model is explicit. Do not publish
from an uncommitted workspace, reuse a version, or bypass the test/audit gate.
