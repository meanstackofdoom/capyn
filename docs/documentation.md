# Documentation policy

CAPYN treats documentation as part of the security boundary. A policy rule, state transition or operational limitation that exists only in a developer's memory is not an auditable product contract.

## One source of truth

Markdown files in `/docs` are the canonical long-form documentation. `docs/catalog.json` supplies navigation metadata. The public `/docs` website reads those files directly during the Next.js build, so website articles and repository documents cannot contain divergent copies of the same guide.

Run the consistency check:

```bash
corepack pnpm docs:check
```

The check fails when:

- a Markdown document is missing from the catalog;
- a catalog entry points to a missing file;
- slugs, files or order values are duplicated;
- a document's first heading differs from its catalog title;
- an internal Markdown link points to a missing file;
- a document contains recognized unfinished-work or placeholder markers.

The root `pnpm check` command runs documentation validation before code verification.

## Required updates by change type

| Change | Documentation that must be reviewed |
|---|---|
| Policy rule, reason code or evaluation order | `policy-engine.md`, `api.md`, tests |
| Entity, state or database invariant | `domain-model.md`, `architecture.md`, migration |
| Identity, tenant, approval, execution or audit control | `security.md`, `architecture.md`, threat tests |
| Execution claim, Gate or provider credential boundary | `execution-gate.md`, `security.md`, `architecture.md`, adapter tests |
| Environment variable or start command | `configuration.md`, `getting-started.md`, `deployment.md`, `.env.example` |
| Public endpoint or response shape | `api.md`, SDK types/examples |
| Deferred risk or completed milestone | Private status record, relevant roadmap/security document |
| Settlement adapter design | `solana-roadmap.md`, `security.md`, executor contract |

## Review metadata

Every catalog entry contains `status` and `reviewedAt`. Update `reviewedAt` only after checking the document against the current implementation. It is not an automatic file-modification timestamp.

Useful status labels are:

- `Implemented`: describes behavior exercised by code and tests;
- `Current`: current operating or developer guidance;
- `Reference`: a supported handoff, not proof that the deployment exists;
- `Live`: intentionally updated as project state changes;
- `Roadmap`: proposed work that is not implemented;
- `Thesis`: product/technical framing rather than an API contract.

## Pull-request checklist

Before merging a security-sensitive change:

1. identify which authority can be granted, denied, approved, revoked or executed;
2. update the code and its invariant tests;
3. update every affected canonical document;
4. update catalog review dates for documents actually reviewed;
5. run `pnpm docs:check` and `pnpm check`;
6. state any intentionally deferred risk in the pull request;
7. never add secrets, live credentials or customer transaction data to examples.

See the repository `CONTRIBUTING.md` for the contribution workflow. The live delivery boundary is maintained in the private deployment record.
