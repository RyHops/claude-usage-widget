## 2026-03-09 16:00 | Documentation Update

**What:** Rewrote README.md with quickstart-first approach. Created FILE_INDEX.md and ARCHITECTURE.md.
**Docs:** README.md rewritten (quickstart at top, fork-specific). FILE_INDEX.md created (all source files with purposes). ARCHITECTURE.md created (process model, data flow, auth flow, tray hover, taskbar awareness).
**Reason:** User sharing repo with coworker, needed simple onboarding + admin docs for future maintainability.

---

## 2026-03-09 | Major UI Session — Tray Popup, Taskbar, Icon, Sayings

**What:** Implemented tray hover popup with persistent quirky sayings (sci-fi/dev/AI humor in Claude orange), taskbar awareness (auto-hide detection + edge snapping), app icon regeneration (.ico from gauge design), tooltip removal, popup hover persistence via IPC + cursor polling bridge.
**Decisions:** 33/67 random vs context-aware quip split; 10-min refresh; DOM mouseenter IPC + getCursorScreenPoint polling for hover bridge; showInactive() to avoid triggering auto-hide taskbar.
**Gotchas:** Windows native tray tooltip overlaps custom popup — must set tooltip to empty or remove entirely. BrowserWindow mouse events unreliable for frameless transparent windows on Win11 — use DOM IPC instead.

---

## 2026-03-07 | Cycles 53-87 Continued Improvement Loop

**What:** Executed 35 improvement cycles (53-87). Widget now at ~4400 LOC across 5 files.

**Key changes (53-68):**
- Hover micro-popover with ETA/velocity data (CSS `::after` + `content: attr(data-tooltip)`)
- Staggered row entrance animation (`translateX(-8px)` cascade, 50ms delays)
- Workspace-style usage pips replacing mini bars (5x 4x8px i3/sway pattern)
- Fetch terminal flash with 50/50 real data readout (Unicode block chars) or fake commands
- OpenType font features (`"zero"`, `"ss01"`, `"cv01"`), slashed-zero, antialiased rendering
- Inset shadow depth on progress bar tracks
- Stale data visual decay (progressive desaturation at 2x/3x refresh interval)
- Frosted glass backdrop-filter on context menu, popovers, settings
- Data integrity hash display (#a3f1 with change flash)
- Vim j/k focus ring navigation with Enter to pin tooltip, c to copy
- Progress bar leading-edge glow (`inset -2px 0 4px` per-variant)
- Timer circle danger/warning halo (`drop-shadow`)
- Usage label text-shadow from accent border color
- Context menu staggered item entrance (reuses `row-enter` keyframe)
- Letter-spacing breathing on percentage update
- Toggle switch spring bounce, error shake, login icon breathing glow
- Expand toggle runway indicator + expand arrow scale bounce
- Compact bar accent glow, compact separator breathing pulse
- Skeleton shimmer double-wave + stagger
- Resets At urgency glow (amber text-shadow < 30min)
- Light theme color fidelity (Catppuccin Latte warning/danger)
- Settings panel inset depth, session key placeholder styling
- Sparkline container underglow (drop-shadow)
- CSS accent-color on native controls
- Font inheritance reset (removed 16 redundant font-family declarations)
- Defensive text-overflow on labels, timer text, resets-at
- CSS containment on overlays (contain: layout style paint)
- will-change compositor hints on progress fills and timer strokes
- Removed 6 !important overrides with proper specificity

**Gotchas:**
- `backdrop-filter` on `::after` pseudo-elements works in Chromium but needs `-webkit-` prefix
- Hardcoded RGBA glass backgrounds must use CSS custom properties for light theme compat
- `crypto.subtle.digest` is async — hash display uses `.then()` in synchronous `updateUI`
- j/k navigation must clear on any `mousemove` to avoid ghost focus states
- Unicode block characters (U+2588, U+2581) render well in JetBrains Mono/Fira Code
- `replace_all: true` on `font-family: var(--font-mono)` catches body declaration too — must re-add manually
- Light theme needs explicit `--color-warning`/`--color-danger` overrides or hardcoded Tailwind colors bleed through
- `contain: layout style paint` is safe on positioned overlays but breaks on inline elements

---

## 2026-03-07 | Cycles 22-50 Continued Improvement Loop

**What:** Executed 29 improvement cycles (22-50). Widget now at 4662 LOC across 5 files.

**Key changes (22-50):**
- Expand state persistence with partial save guards (`!== undefined` on all fields)
- Powerline-style CSS clip-path separators in compact mode
- i3-style 2px left accent borders on usage rows (color-coded by type)
- Status dot → 12x12 SVG countdown ring (fills as refresh approaches)
- Sparkline gradient area fill + pulsing live dot + warning threshold line
- Progress bar 25/50/75% tick marks via repeating-linear-gradient
- Context menu: keyboard shortcuts, accent border, fade-in, hover indent
- Colored compact mode percentages (session=accent, weekly=blue) + warning/danger states
- Settings: slide-in animation, accent header stripe, title indicator, version text
- Title bar mini usage bars (40x2px) with warning/danger states + tooltip
- Column header refinement (7px, 0.8px tracking, separator line)
- `prefers-reduced-motion` media query for accessibility
- Timer text warning/danger colors, selection highlight, row hover effects
- Expand section CSS slide animation (max-height 200ms)
- Ctrl+E export shortcut (was listed but never wired)
- Click-to-copy on usage percentages
- Dead CSS cleanup (compact-divider, footer, last-update)
- `appVersion` preload API from package.json

**Gotchas:**
- SVG attributes don't support CSS custom properties — use `getComputedStyle` to read vars
- Context menu items with child spans need `> span:first-child` selector for state updates
- `clip-path: polygon()` needs explicit dimensions on inline-block elements
- SVG circle `r` attribute can be animated via CSS in Chromium/Electron
- `max-height` transition needs a large enough max value (300px) for variable-height content
- Window resizes instantly but CSS slides in 200ms — acceptable visual mismatch

---

## 2026-03-07 | Cycles 10-19 Autonomous Improvement Loop

**What:** Executed 10 continuous improvement cycles on the Claude Usage Widget, transforming it from corporate SaaS aesthetic to Arch Linux rice style.

**Decisions:**
- Catppuccin Mocha (dark) + Latte (light) as the palette foundation
- All colors extracted to CSS custom properties (~60 semantic tokens)
- Warning/danger colors kept at full saturation (#f59e0b, #ef4444) for WCAG compliance
- Monospace font stack: JetBrains Mono → Fira Code → Cascadia Code → SF Mono → Consolas
- Acrylic/vibrancy for window blur (Windows 11 + macOS)
- Click-through uses `setIgnoreMouseEvents` with `{ forward: true }` for hover detection

**Gotchas:**
- Electron 28's `setBackgroundMaterial('acrylic')` needs try/catch (not all platforms support it)
- SVG tray icons via `nativeImage.createFromDataURL` work cross-platform
- `overflow: hidden` on progress-bar clips pseudo-element glow effects
- Settings panel height needs manual adjustment when adding rows (currently 395px for 7+ rows)
- Custom CSS injection via `textContent` on `<style>` element (safe, no innerHTML)

---
