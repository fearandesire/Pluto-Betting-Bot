<!-- Fill top to bottom. Two or three short sentences per visible section; anything longer goes in a toggle.
Write what changed and what to check, not how the work went.
Optional: add a Screenshots section when a user sees the change, and a one-line ## Docs entry when docs moved.
Keep the commented snippets below as they are; paste one in only when it applies.
Rules, examples and the title format: https://github.com/charyon/repository-kit/blob/main/docs/pr-bodies.md -->
<!-- Service buttons appear between these markers only when the PR touches that service. Leave the markers. -->
<!-- kit:services:start -->
<!-- kit:services:end -->

## Summary

<!-- One or two sentences. What is different after this merges, for whom, and why. Link the issue here. -->

## Guided Tour

<!-- Where to look, in the order to look. Three stops at most, one clause each on why it matters.
Delete this section when the diff is one file. -->

1. `path/to/file:line` —
2. `path/to/file:line` —

## Verified

<!-- One line per check: the command, an arrow, the result. Name what you did not run. -->

-

## Risk

<!-- One line: what it touches and how to undo it. -->

Low: revert the commit.

---

<details>
<summary>Evidence</summary>

<!-- What a reviewer or an agent needs to re-check the claim. Fill every line or write n/a. -->

- Issue:
- Spec or decision:
- Related PRs:
- Not verified:

```text
<the commands, and the output that matters>
```

</details>

<details>
<summary>Scope and rollout</summary>

- Covers:
- Leaves out:
- Tradeoff taken:
- Rollout and rollback:

</details>

<!-- Screenshots, only when a user sees the change. Desktop and mobile, labelled, hosted on R2:

## Screenshots

<details name="shots" open>
<summary><b>Desktop</b> · preview</summary>

</details>

<details name="shots">
<summary><b>Mobile</b> · preview</summary>

</details>

-->

<!-- Docs, one line, only when it applies. Otherwise leave it out:

## Docs

- [ ] none — behavior-preserving
- [ ] updated — (paths)
- [ ] exception — (reason)

-->
