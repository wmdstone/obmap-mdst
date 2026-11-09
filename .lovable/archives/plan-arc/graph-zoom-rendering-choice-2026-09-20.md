# Graph Zoom Rendering Choice

## Goal
Add a saved setting in **Settings → Visual Graph Engine → Layout** that lets users choose whether zooming out reduces graph detail or preserves the configured node and link appearance.

## Changes
- Add a **Zoom-out rendering** selector with:
  - **Optimized** — compact distant nodes to markers and allow thinner distant links for performance.
  - **Keep full detail** — retain node shapes/cards, labels, badges, link thickness, arrows, and particles while zooming out.
- Persist this choice with the existing graph engine settings and include it in configuration-vault sync/import/export.
- Apply the choice in the active graph renderer without changing any existing node, link, layout, or force defaults.
- Keep label visibility controls authoritative: disabled labels remain disabled in either rendering mode.

## Validation
- Verify the settings page shows and persists the selector.
- Verify both zoom modes visually in the graph.
- Run the graph tests and confirm the preview build has no errors.
