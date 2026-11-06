# Visual artifact manifest

Objective: replace Pluto's generic profile badge pills with a composed sports scorecard and eight original achievement illustrations while preserving the achievement contract and private interaction flow.

All figures are local renders with synthetic fixtures. No live Discord acceptance is claimed. [README](README.md) records provenance, verified behavior, limitations and reproduction. [manifest.json](manifest.json) records identical before/after fixture values and SHA-256 hashes of the renderer and illustration source. [metrics.json](metrics.json) records byte sizes, timings and SVG text bounds.

| Media | Caption |
| --- | --- |
| `populated-1440.png`, `populated-390.png` | Current main versus the new profile with identical stats and five earned awards. |
| `empty-1440.png`, `empty-390.png` | A genuine zero record and no earned achievements. |
| `unavailable-1440.png`, `unavailable-390.png` | Missing achievement data is explicitly unavailable. |
| `stress-1440.png`, `stress-390.png` | Long names, negative profit, large payouts and unknown future awards remain bounded. |
| `*-before.png` | Unmodified baseline renderer at `bc4e31c908a9d1493913caec49bb0a422d67767d`. |
| `*-after.png`, `*-after.svg` | Production renderer output from the source hashes in the fixture manifest. |
| `achievement-collection.png`, `achievement-collection.svg` | All eight original SVG achievement illustrations and presentation names. |
| `index.html` | Self-contained before/after carousel; keyboard navigation, reduced motion and ordered static fallback. |

Viewed: all four paired states at 1440 and 390, all native after states and the complete art collection. No unexplained clipping or canvas overflow remained. Native rasterization, responsive width and keyboard checks passed. Real Discord layout and client assistive technology remain unverified.

The PR description embeds immutable repository-hosted images. No Drive/Saga upload or sharing change is part of this task.
