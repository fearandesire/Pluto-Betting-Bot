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

Be respectful, specific, and constructive in reviews. Contributions are evaluated on correctness, maintainability, tests, and compatibility with the existing client behavior.
