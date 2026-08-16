# Security policy

CAPYN is an early developer MVP for security-sensitive financial authorization. It does not currently custody or move real funds and must not be treated as production-ready payment infrastructure.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Once the repository is public, use GitHub's private security-advisory flow. Before publication, send the report directly to the maintainer through the private contact channel used to share this repository.

Include the affected version or commit, reproduction steps, impact, and any suggested mitigation. Do not include live credentials, customer data, or proof against systems you do not own.

The maintainer will acknowledge a complete report as soon as practical, coordinate validation and remediation privately, and disclose only after a fix is available.

## Supported versions

Only the latest tagged v0.1 release is supported during the MVP phase.

## Current boundary

See [docs/security.md](docs/security.md) for implemented controls, known limitations, and the production gate. In particular, the demo human-auth adapter and `MockPaymentExecutor` must be replaced before any real-money deployment.
