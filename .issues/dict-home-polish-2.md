# Dict home polish: search margin, centered manage controls, stat icons

Three UI refinements on the dictionary home page:

## Changes
- [x] Remove `margin-top: 0.375rem` from `.search` button on dict home
- [x] Move featured entry unstar/arrows to center on hover (was top)
- [x] Add faded colored icons to 5 stats cards (lower right, part of background)

## Details

### Search spacing
Removed the margin-top on the hero search button for tighter spacing.

### Featured entry management controls
Changed `.manage` from `top/left/right` absolute positioning with `justify-content: space-between` to `inset: 0` with centered flexbox (`align-items: center`, `justify-content: center`, `gap: 0.5rem`). Controls now appear in the middle of the card on hover.

### Stats card icons
Added background icons to HomeStats.svelte:
- `entries`: list icon (blue #3b82f6)
- `with_audio`: waveform icon (purple #8b5cf6) — reused from site home "Multimedia entries"
- `with_photos`: image icon (cyan #06b6d4)
- `with_video`: video icon (orange #f59e0b)
- `speakers`: account-voice icon (green #10b981)

Positioned absolute lower right at `opacity: 0.12` at `2.5rem` font-size, matching the FeaturesGrid pattern from site home.

Verified with svelte-look: HomeStats (all flavors), HomeEntryCard ManageControls story shows centered controls on hover.
