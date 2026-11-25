<!-- Fill top to bottom. Two or three short sentences per visible section; anything longer goes in a toggle.
Write what changed and what to check, not how the work went.
Rules, examples and the title format: https://github.com/charyon/repository-kit/blob/main/docs/pr-bodies.md -->
<!-- Service buttons appear between these markers only when the PR touches that service. Leave the markers. -->
<!-- kit:services:start -->
<!-- kit:services:end -->

## Summary

<!-- One or two sentences. What is different after this merges, for whom, and why. Link the issue here. -->

## Guided tour

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

<!-- Screenshots, only when a reviewer must see the result: paste the block below above ## Verified. Desktop and mobile, each labelled with its surface and source, hosted on R2. -->
<!--
<details name="shots" open>
<summary><b>Desktop</b> · preview</summary>

</details>

<details name="shots">
<summary><b>Mobile</b> · preview</summary>

</details>
-->

<!-- Docs, only when the change touches documentation: paste one ticked line here, none (behavior-preserving), updated (paths), or exception (reason). -->
