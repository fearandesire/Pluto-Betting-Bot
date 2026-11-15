<!-- Fill each section in a line or two. Keep the headings. If one does not apply, write N/A: and the reason.
Lead with the result. No "This PR...", recaps, or filler. Image layouts and formatting rules:
https://github.com/charyon/repository-kit/blob/main/docs/pr-bodies.md -->
<!-- Service buttons appear between the two markers below only when this PR touches that service (kit job or agent).
Leave the markers; anything you write outside them is never changed. -->
<!-- kit:services:start -->
<!-- kit:services:end -->

## Outcome (required)

<!-- What is different after this merges, for users or maintainers, in 1-3 sentences.
Link the issue or ticket. One concern per PR: if you need "and also", split it.
If it could break something, add one sentence: what, and how to undo it. -->

## Screenshots (required for visual changes)

<!-- Show the result as it renders: UI, Discord messages and embeds, reports, documents.
Label each image desktop or mobile, and fixture, preview, or production. Caption with <sub>.
Pick one layout (snippets in docs/pr-bodies.md):
  Before / After: the table below.
  1-3 views: one <details name="shots"> per view, first one open. They act as tabs.
  4+ images: a <table> grid, two per row, img width="100%"; past six, collapse the rest.
Host images, videos and GIFs on R2. Repo blob links and GitHub attachments fail the pr-media check.
A recording adds to screenshots; it does not replace them.
For a nonvisual change, delete the Before / After block and write N/A: and the reason. -->

<details open>
<summary>Before / After</summary>

| Before | After |
| --- | --- |
|  |  |

</details>

## Validation (required)

<!-- The exact checks you ran and what they showed: local, CI, live.
Name anything you did not verify. Raw output goes in the logs block below. -->

-

## Docs impact

<!-- Tick exactly one and edit the text after the dash.
none takes one of: behavior-preserving, test-only, dependency-only.
exception needs a maintainer's docs-exception label. -->

- [ ] none — behavior-preserving
- [ ] updated — (paths)
- [ ] exception — (reason)

<details>
<summary>How to review (optional)</summary>

<!-- Where to start, the riskiest part, and numbered steps a reviewer can follow. -->

</details>

<details>
<summary>Full results and logs (optional)</summary>

<!-- Paste long output in the text block. Keep the Validation summary readable without opening this. -->

```text

```

</details>

<details>
<summary>Demo and rollout notes (optional)</summary>

<!-- Recording for multi-step interactions, migrations, compatibility, deploy and rollback steps. -->

</details>
