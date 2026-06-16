# RULE — Malayalam-first, always

> Hard constraints for language and localization.
> Owner: [Experience Oracle](../sovereigns/EXPERIENCE_ORACLE.md).
> Violating these blocks the phase gate.

1. **No hard-coded user-facing strings.** Every string goes through localization from the first commit. A hard-coded English label is a bug.
2. **Malayalam is the default**, English is secondary. Design and review screens in Malayalam first.
3. **Malayalam typography is first-class.** Correct fonts, rendering, sizing, and line-breaking on low-end Android. Test real Malayalam strings (which are often longer) for layout/overflow.
4. **No text-only meaning for critical actions.** Pair text with icons/voice cues for low-literacy users (overlaps [accessibility.md](accessibility.md)).
5. **Localize formats**: numbers, currency (₹), dates, times for the Kerala context.
6. **Notifications, errors, and WhatsApp messages are localized too**, not just in-app screens.
7. **Translation quality matters.** Use natural, warm, conversational Malayalam — not literal machine translation. Trust copy especially must feel human.

> A worker who can't read the screen can't be verified, can't apply, and won't trust us. Malayalam is the market, not a feature.
