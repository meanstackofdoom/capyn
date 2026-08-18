# Website and brand system

The CAPYN public website is a product surface and evidence layer, not a decorative landing page. It should make the authority category understandable, let a developer inspect working proof and state commercial/production boundaries without ambiguity.

## Positioning contract

Primary statement:

> Authority infrastructure for autonomous agents.

Primary contrast:

> Give agents authority. Not unlimited access.

The website must explain CAPYN as the decision point before execution. It must not imply that CAPYN is a token, wallet, payment rail, completed compliance certification or production custody product.

## Visual grammar

The interface uses a restrained security-infrastructure system:

- ink, paper and panel surfaces rather than speculative-crypto gradients;
- permission green, review amber, denial red and authority blue with written labels;
- mono labels and tabular numbers for machine evidence;
- rails, brackets and fine grid lines to represent bounded authority;
- Geologica display type, Manrope interface type and IBM Plex Mono evidence type;
- square controls and hairline borders instead of generic rounded SaaS cards.

The signature component is the interactive authority console. Its three seeded requests expose the same memorable story as the API demo: OpenAI `$18` allows, an unknown vendor denies, and AWS `$120` pauses for approval.

Mandate Studio also issues a browser-local Authority Passport. Its versioned payload travels in the URL fragment, is bounded by a strict parser and is covered by a canonical SHA-256 digest recomputed in the viewer. It is deliberately labelled as a draft-only integrity artifact rather than a signature, credential, active mandate or execution receipt.

The sandbox commissioning bay is the primary activation journey. Six instrument contacts carry a visitor through workspace, agent, mandate, credential, decision and proof. Its bearer is a real 30-minute server-authenticated sandbox credential kept only in component memory; its decision runs the shared policy engine and its proof opens in the independent client-side viewer. The page must keep the synthetic, stateless and no-real-execution boundary visible at every consequential step.

The private boundary brief is browser-local too. It collects one exact action, hard stop, human checkpoint and smallest useful outcome without posting or persisting the fields. Visitors can copy or download Markdown; an owner-approved `CAPYN_CONTACT_EMAIL` adds a prefilled mail handoff without turning CAPYN into a form processor.

## Motion contract

The authority console uses GSAP core for scoped, reversible interface motion:

- `power3.out` reveals each evaluated rule with deliberate deceleration;
- `power2.inOut` advances the policy signal through its rail;
- a GSAP media context removes animation when `prefers-reduced-motion: reduce` is active;
- cleanup reverts the complete scoped timeline during React lifecycle changes;
- animation never changes a decision, hides required content or becomes a security boundary;
- no continuous background effects, scroll hijacking or motion-only information are allowed.

GSAP is intentionally limited to the high-value interactive explanation. Ordinary navigation and reading remain server-rendered and usable before JavaScript hydrates.

## Search and sharing contract

Public routes provide:

- one canonical URL per page;
- page-specific titles, descriptions, Open Graph and Twitter metadata;
- a generated Open Graph image and application icon;
- `WebSite` and `SoftwareApplication` JSON-LD on the home page;
- a stable XML sitemap sourced from reviewed documentation dates;
- a robots policy that keeps the demo dashboard out of search results;
- crawlable server-rendered headings, links and explanatory text;
- pricing structured as visible text, not hidden only inside client JavaScript.

`NEXT_PUBLIC_SITE_URL` must hold the final HTTPS origin at build time or canonical and social URLs will point at the local fallback.

## Accessibility and performance

- Every page has one primary heading and semantic sections.
- Public navigation identifies the current page and has a keyboard-visible skip link.
- Decision state is communicated with words and reason codes, not colour alone.
- Interactive scenarios use a single keyboard tab stop, arrow/Home/End navigation, linked tab panels and a polite decision status region.
- Focus indicators remain visible.
- Motion honours the operating-system reduction preference.
- Fonts are packaged locally; the marketing site has no analytics or third-party runtime dependency.
- GSAP core is the only motion dependency and is loaded only by high-value interactive product surfaces.
- Production responses set a restrictive first-party Content Security Policy, deny framing and MIME sniffing, constrain browser permissions and add HSTS automatically for an HTTPS canonical origin.

## Copying and defensibility

HTML, CSS and browser JavaScript delivered publicly can always be inspected and reproduced. CAPYN does not use minification or obfuscation as a false security boundary.

Defensibility comes from the complete system: a recognizable brand, the authority vocabulary, working policy and concurrency semantics, audit evidence, hosted operations, integrations, reliability, compliance work, customer trust and consistent technical publishing. The MIT engine creates distribution; it does not transfer production credentials, customer relationships or operational assurance.

## Release audit

Before publishing a website release:

1. run `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`;
2. run the production dependency audit and review every high-severity result;
3. inspect desktop and mobile home, pricing, documentation and billing pages in a real browser;
4. exercise every authority-console tab and reduced-motion mode;
5. verify canonical, description, Open Graph, JSON-LD, robots and sitemap output;
6. verify keyboard navigation, visible focus, heading order and horizontal overflow;
7. confirm pricing and roadmap copy matches [Billing](billing.md), [Security](security.md) and the private status record;
8. confirm the dashboard remains excluded from indexing and execution remains labelled as simulated.
9. run `corepack pnpm smoke:production` against the built API and web artifacts; it verifies the four decisions, exact approval/execution, all public docs, dashboard noindex, metadata, sitemap, manifest and security headers on ports `4110` and `3110`.
