# Pluto Betting Bot

Use pnpm 10 (matching CI), Node 22, and the existing Vitest/build scripts.

## Verification before completion and pull requests

Run `node scripts/verify.mjs` on the final source before saying the task is finished and before creating or updating each pull request. Read the resulting `.verification/<run>/manifest.json`: every required check must pass, the source fingerprint must be unchanged, and skipped external journeys must be disclosed. Run again after the final commit to record its exact SHA. Preserve existing Git hooks. See `.agents/skills/verify/SKILL.md` for the app journeys and limits.
