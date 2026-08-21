# Accessibility

**Purpose.** Bind accessibility as a constitutional layer of the OS, independent of product atmosphere.

**Authority.** Library constitution derived from IDS-001 accessibility principles and EAS-001 Layer 3. Live chrome already includes skip-to-content.

**Audience.** Designers and engineers shipping any interactive surface.

**Dependencies.** [IDS](./IDS.md) · [Visual Constitution](./Visual-Constitution.md) · [Interaction Constitution](./Interaction-Constitution.md)

**Related Documents.** [Executive Environment Framework](../02-ARCHITECTURE/Executive-Environment-Framework.md) · [Engineering Standards](../04-ENGINEERING/Engineering-Standards.md)

**Status.** Approved (Layer 3 founder overrides specified, not fully implemented)

**Version.** 1.1.0

**Owner.** Design

**Last Updated.** 2026-08-20

---

IDS is unusable if it is not operable.

## Mandatory now

- Skip to main content on the OS chrome.
- Visible focus on interactive elements and skip targets.
- Contrast of text against paper, and of text-inverse against brand-primary, meeting WCAG 2.2 AA for the roles in use.
- Keyboard order follows visual order. No interaction exists only on hover.
- Colour is never the only encoding of health, danger, or selection.
- Empty and loading states expose status to assistive technology.
- Honour `prefers-reduced-motion`: durations collapse; meaning remains.

## Specified for Foundation v1.1 (Layer 3)

EAS-001 names founder overrides, independent of venture id and climate:

| Control | Values | Default |
|---|---|---|
| Motion | `system` (honour `prefers-reduced-motion`) or `reduced` | `system` |
| Contrast | `system` (honour `prefers-contrast`) or `high` | `system` |

High contrast may flatten atmosphere tints. It must not invent a fourth climate or a second type ladder. Settings for these controls belong in an Accessibility group, not Appearance, and not a venture switcher.

These overrides are not yet the running Settings information architecture. Record delivery in the [Roadmap Register](../05-GOVERNANCE/Roadmap-Register.md).

## Independence

Changing motion or contrast never writes atmosphere or climate. Changing atmosphere never writes accessibility attributes.
