# 0006 — Brand identity locked & applied
- Date: 2026-06-15
- Phase: 1
- Decider: Founder + Experience Oracle
- Status: accepted

## Decision
Locked Heydo's official brand and applied it to the Flutter app.

**Palette:** Heydo Green `#1D9E75` (primary brand), Trust Green `#0F6E56` (actions), Deep Forest `#04342C` (headings/app bars), Mint Surface `#E1F5EE` (soft bg/trust chips), Clean White `#FFFFFF`, Rich Black `#1C1C1A` (body text).

**Typography:** Plus Jakarta Sans Bold 800 (display/headings); Inter Regular 400 (body); Inter Medium 500 (labels/captions). Fonts **bundled as assets** (offline-first), not runtime-fetched.

**Tagline:** primary **"Trust who shows up."** (Malayalam: *വന്നെത്തുന്നവരെ വിശ്വസിക്കാം*). Alternates for campaigns: "Your gig. Done right." / "Get it done."

## Why
"Trust who shows up." names Heydo's moat (verified workers) better than the generic alternatives. Trust Green (darker) is used for actions to meet white-text contrast (accessibility); Heydo Green is the brand/accent colour.

## Implementation
- Source of truth: `.claude/context/brand.md`.
- Flutter: `apps/mobile/lib/src/theme.dart` (`HeydoColors`, `HeydoFonts`, `HeydoTheme.light()`); fonts in `apps/mobile/assets/fonts/`; tagline in `strings.dart`. App re-verified: `flutter analyze` clean, `flutter test` 2/2.
- Admin web (Next.js) will reuse the same hex tokens + Inter/Plus Jakarta Sans when built.

## Affects
All surfaces. Builds on [0005](0005-phase-1-http-api-and-flutter-app.md).
