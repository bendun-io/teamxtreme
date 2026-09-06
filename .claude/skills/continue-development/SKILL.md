---
name: Continue Development
description: Resume work on TeamXtreme by comparing docs/Spec.md against the current state of the repo, then picking up the next logical piece of unfinished work. Use when the user asks to "continue development", "keep going", "pick up where we left off", or asks what to work on next.
---

# Continue Development

TeamXtreme is early-stage: the spec is written before most of the app exists. This
skill's job is to figure out honestly what is already built, what the spec still
calls for, and to resume work on the single most useful next piece — not to
re-plan the whole app from scratch each time.

## 1. Orient

- Read [docs/Spec.md](../../../docs/Spec.md) in full — it is the source of truth for
  architecture and features.
- Read [docs/Architecture.md](../../../docs/Architecture.md) in full — it describes the intended structure and 
  interactions of the system's components.
- Read [docs/API.md](../../../docs/API.md) in full — it describes the backend API endpoints and their expected
  behavior.
- Read [docs/DevelopmentPlan.md](../../../docs/DevelopmentPlan.md) in full — it outlines the recommended order of 
  implementation and any pending decisions.
- Run `git log --oneline -20` and `git status` to see recent history and any
  in-progress/uncommitted work. Do not assume the spec reflects reality; the code
  and git history do.
- Look at [docker-compose.yml](../../../docker-compose.yml) and the `src/` tree to see
  what infrastructure and app code already exist (services defined, frontend/backend
  scaffolding, migrations, etc.).

## 2. Diff spec vs. reality

Build a short mental (not written-to-file) checklist from the spec's Architecture,
the existing API, Development Plan, and mark each item as: not started,
in progress, or done. Pay attention to:

- Deployment shape (docker-compose services: app, database, tunnel, etc.)
- React PWA frontend scaffolding
- Node.js backend scaffolding
- Auth (password + Google/Instagram social login, invite-only)

## 3. Pick the next piece

Prefer the smallest increment that unblocks the most future work — e.g. project
scaffolding before features, data model before UI, one feature end-to-end before
starting the next. If multiple reasonable next steps exist and the choice would
meaningfully change direction (e.g. which feature to build next, which auth
provider to wire up first), ask the user briefly instead of guessing.

## 4. Implement

- Make routine setup/scaffolding decisions yourself; don't stop to confirm things
  a careful engineer would just decide (folder layout, naming, dependency choices)
  unless the spec is genuinely silent or ambiguous on something that matters.
- Keep infrastructure changes (docker-compose, env vars) consistent with what
  already exists rather than introducing a parallel setup.
- If you discover the spec is out of date or contradicted by existing code, say so
  and confirm with the user before overwriting either.
- Deliver a working increment (it should run via docker-compose where applicable),
  not a partial stub.

## 5. Update the documentation

- Update [docs/Spec.md](../../../docs/Spec.md) with any changes to the specification.
- Update [docs/Architecture.md](../../../docs/Architecture.md) with any changes to the system's structure.
- Update [docs/API.md](../../../docs/API.md) with any changes to the backend API.
- Update [docs/DevelopmentPlan.md](../../../docs/DevelopmentPlan.md) with any changes to the implementation plan.
- Update [docs/ExternalSetup.md](../../../docs/ExternalSetup.md) with any changes to the external setup instructions, e.g., setting up the social login providers.

## 6. Wrap up

Summarize what changed and explicitly name the next unfinished item from the spec,
so a future "continue development" invocation (or session) can pick up cleanly.