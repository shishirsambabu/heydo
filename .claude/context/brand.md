# Context — Brand Identity (source of truth)

> Heydo's official brand. Owned by the [Experience Oracle](../sovereigns/EXPERIENCE_ORACLE.md) +
> [design_systems_genius](../geniuses/experience/design_systems_genius.md). Every surface — Flutter app,
> Next.js admin, decks, store listings — uses these tokens. No off-palette colors, no off-brand fonts.

## Colour palette
| Token | Hex | Name | Use |
|---|---|---|---|
| `heydoGreen` | `#1D9E75` | Heydo Green | Primary brand colour, accents, highlights, brand marks |
| `trustGreen` | `#0F6E56` | Trust Green | Primary **actions** (filled buttons) — darker for text contrast on white |
| `deepForest` | `#04342C` | Deep Forest | Headings, app bars, dark surfaces, high-emphasis text |
| `mintSurface` | `#E1F5EE` | Mint Surface | Soft backgrounds, success/trust chips, selected states |
| `cleanWhite` | `#FFFFFF` | Clean White | Base surface / background |
| `richBlack` | `#1C1C1A` | Rich Black | Body text, icons (on light) |

**Contrast guidance (accessibility rule):** white text sits on **Trust Green `#0F6E56`** or **Deep Forest** for actions (Heydo Green `#1D9E75` is reserved for brand/accents and large display, where its lower contrast on white is acceptable). Body text is Rich Black on white/mint.

## Typography
| Role | Font | Weight |
|---|---|---|
| Display / headings (H1–H3, brand) | **Plus Jakarta Sans** | Bold **800** |
| Body copy, descriptions, UI text | **Inter** | Regular **400** |
| Labels, captions, supporting UI | **Inter** | Medium **500** |

- Bundled as assets (`apps/mobile/assets/fonts/`) — **offline-first**, no runtime font fetch.
- Malayalam: Plus Jakarta Sans / Inter cover Latin; Malayalam script falls back to the platform Malayalam font and must be tested for layout/overflow ([localization rule](../rules/localization.md)). A dedicated Malayalam display face can be added later.

## Tagline
**Primary: "Trust who shows up."** — chosen for capturing Heydo's trust moat (verified workers).
Malayalam rendering: *"വന്നെത്തുന്നവരെ വിശ്വസിക്കാം."*
Alternates (secondary/campaign use): "Your gig. Done right." · "Get it done."

## Voice
Warm, conversational, worker-respecting, proudly Malayali. "Just Heydo it."

## Implementation
- Flutter: `apps/mobile/lib/src/theme.dart` (`HeydoColors`, `HeydoTheme`) — the canonical code expression of this doc.
- Admin web (Next.js): the same hex tokens + Inter / Plus Jakarta Sans when built.
- Recorded as decision [0006](../memory/0006-brand-identity.md).
