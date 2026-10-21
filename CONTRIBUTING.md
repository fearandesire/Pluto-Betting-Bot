# Contributing to Pluto

Thanks for helping improve Pluto. This repository contains an open-source Discord bot client, so contributions should stay focused on the client and its documented interfaces.

## Before you start

- Read the README and check existing documentation for the area you plan to change.
- Keep credentials, tokens, personal data, production identifiers, and private configuration out of commits.
- For a local setup, copy `.env.example` to `.env` and replace its placeholders. Mock mode is the default example configuration.
- Use Node.js 22 or newer and pnpm.

## Development workflow

1. Create a focused branch from `main`.
2. Install dependencies with `pnpm install`.
3. Make the smallest change that solves the problem.
4. Add or update tests for changed behavior.
5. Run the checks below before opening a pull request.

```bash
pnpm typecheck
pnpm test:run
pnpm build
```

Use `pnpm lint` to apply the repository's formatting and lint checks. Do not commit generated output, local environment files, dependency links, or build artifacts.

## Pull requests

- Explain the user-visible behavior and why the change is needed.
- Keep unrelated cleanup in a separate pull request.
- Include verification steps and call out any limitations or follow-up work.
- Confirm that the pull request contains no secrets or private operational details.
- Reviewers, human and AI, start from `REVIEW.md`: it maps paths to blast radius and lists the checks for each.

Be respectful, specific, and constructive in reviews. Contributions are evaluated on correctness, maintainability, tests, and compatibility with the existing client behavior.

## Compiled runtime validation

| Rule | Enforcement |
| --- | --- |
| Package exports own bare imports. Use explicit `.js` for local imports; do not rewrite package subpaths to filesystem paths. | The build limits tsc-alias to configured local aliases. `pnpm verify:runtime` resolves and links the emitted graph with native Node. |
| Source tests and typecheck do not establish production import or startup compatibility. Validate the shipped dependency set. | `pnpm build` runs `verify:runtime`; the production Docker stage runs the same gate with networking disabled before PR verification or image publication can finish. |

The gate checks static linkage, literal dynamic import targets, and compiled
BullBoard authentication, HTML rendering, and queue summaries. It does not prove
full bot startup, external service connectivity, or live Discord behavior.
