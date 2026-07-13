# Agent Atlas

An interactive atlas of modern AI systems: one coherent map that teaches how AI
actually works — from tokens to multi-agent systems to the governance that regulates
them — using visual, interactive, first-principles explanations.

Three pillars: **understanding** (every concept from the problem that preceded it),
**judgment** (every concept classified by how essential it actually is), and
**employability** (tiered interview preparation wired into every major concept).

## Quickstart

```bash
npm ci
npm run dev        # local site
npm run validate   # content integrity: schema → graph → template
npm test           # unit + component tests
npm run test:e2e   # Playwright against the built site (CSP-enforced)
```

## Where everything is documented

One source of truth per topic — start here:

| Topic | Document |
|---|---|
| Architecture & roadmap | [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) + [docs/adr/](docs/adr/) |
| Working constitution | [docs/EXECUTION_PROTOCOL.md](docs/EXECUTION_PROTOCOL.md) |
| Writing content | [docs/AUTHORING.md](docs/AUTHORING.md) |
| Ingesting new sources | [docs/INTAKE.md](docs/INTAKE.md) |
| Knowledge graph & validation | [docs/GRAPH.md](docs/GRAPH.md) |
| Visual system | [docs/VISUAL_LANGUAGE.md](docs/VISUAL_LANGUAGE.md) |
| Model-provider layer | [docs/MODEL_PROVIDER.md](docs/MODEL_PROVIDER.md) |
| CI/CD & hosting | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Current status / queue / decisions | [CURRENT_STATE.md](CURRENT_STATE.md) · [NEXT_TASKS.md](NEXT_TASKS.md) · [DECISIONS.md](DECISIONS.md) |

Stack: Astro + TypeScript strict + React islands + Tailwind; content as code (MDX/YAML
collections, Zod-validated); no backend by design. Agent mechanics are hand-written
plain TypeScript — frameworks appear only as comparison subjects (ADR-0005).
