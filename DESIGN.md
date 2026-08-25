# Mix Studio Simple Shell — Design System

## Direction

The simple shell is a mobile-first creative console named **Black Canvas**. It keeps Mix Studio's restrained dark identity while moving technical controls behind progressive disclosure. The primary composition is a large prompt surface, a four-mode selector, a short parameter summary, and one unmistakable Generate action.

The canonical mobile viewport is 360 × 800. Content is centered and capped at 640 px on larger screens. The original advanced workspace remains available at `/studio` and is not visually restyled by this system.

## Tokens

- Canvas: `--page-bg: #000000`; pure-black mode keeps the same canvas and darkens panels.
- Surfaces: `--panel: #090b10`, `--panel-strong: #10131a`, `--panel-soft: #151922`.
- Text: `--ink: #f6f8ff`, `--ink-soft: #c9d2e7`, `--muted: #8e99b7`.
- Lines: `--line: rgba(226,232,255,.10)`, `--line-strong: rgba(226,232,255,.22)`.
- Action: Mix Studio blue-violet accent, reserved for selected modes, focus, progress, and the primary action.
- Status: green `#49c982`, amber `#f2b84b`, red `#ef6b73`.
- Type: Inter when installed, then system UI. Display 24/30 semibold; title 20/26 semibold; body 15/22; support text 13/18.
- Spacing: 4, 8, 12, 16, 24, 32 px.
- Radius: small 12 px, medium 18 px, large 24 px. Buttons never use pill geometry except compact mode/status chips.
- Elevation: none for ordinary cards; one restrained shadow only for menus and bottom sheets.

## Components

- App bar: 56 px minimum, wordmark left, icon menu right.
- Prompt surface: three visible lines, grows to eight, clear and enhance controls below the text.
- Mode switcher: four equal 44 px touch targets; horizontally scrollable only if translated labels cannot fit.
- Segmented controls and chips: minimum 40 px visual height with 44 px hit area.
- Primary action: 52 px, full available width, placed above bottom navigation and safe-area inset.
- Bottom navigation: five equal 56 px targets plus safe area. Inline SVG icons only; text remains visible.
- Cards: 1 px border, solid near-black fill, clear title/support hierarchy. No decorative card nesting.
- Bottom sheet: rounded top corners, modal scrim, drag handle, keyboard-safe scrolling.
- Empty states: one concise sentence and one relevant action; no illustration dependency.

## Interaction and accessibility

- All controls are keyboard reachable and have visible `:focus-visible` rings.
- Icon-only controls require an accessible name and a 44 × 44 px target.
- Motion uses 160 ms for control feedback and 220 ms for sheets/routes; `prefers-reduced-motion` disables nonessential transitions.
- Information is never encoded by color alone. Status dots always have adjacent text.
- The prompt remains in local state while moving between tabs. Login is the only route available without a profile.
- Offline mode loads the shell and explains that generation needs the host connection.

## Avoid

- No framework, CDN, remote font, emoji-as-icon, glassmorphism, or large decorative gradients.
- No ComfyUI node names, model filenames, file-system paths, JSON, or backend URLs in ordinary UI.
- No hover-only behavior and no destructive action without confirmation.
- No changes to the original `/studio` markup or visual tokens.
