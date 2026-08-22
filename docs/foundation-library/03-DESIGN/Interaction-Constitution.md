# Interaction Constitution

**Purpose.** Bind how the founder moves through the desk: focus, commands, interruption, and primary action.

**Authority.** Library constitution derived from IDS-001 component philosophy and the live shell. Subordinate to the [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md).

**Audience.** Designers and engineers adding controls, dialogs, or commands.

**Dependencies.** [IDS](./IDS.md) · [Visual Constitution](./Visual-Constitution.md)

**Related Documents.** [VentureOS Project Constitution](../../PROJECT_CONSTITUTION.md) · [Writing Constitution](./Writing-Constitution.md) · [Accessibility](./Accessibility.md) · [Situation Room](../02-ARCHITECTURE/Situation-Room.md) · [Sprint Standard](../04-ENGINEERING/Sprint-Standard.md)

**Status.** Approved

**Version.** 1.1.0

**Owner.** Design

**Last Updated.** 2026-08-20

---

## Rank of action

One primary act per region. Secondary actions recede. Destructive acts are labelled as such and use danger only when the risk is real.

Buttons express acts. Cards group a single judgement or artefact, not an application. Dialogs and popovers interrupt; they do not become a second app.

## Wayfinding

Navigation is wayfinding. It does not instantiate ventures or call the Runtime.

The command palette (`Mod+K`) is a command surface. Ask (`Mod+I`) is not a chat Runtime. Commands are grouped as Intelligence, Navigate, and System.

Keyboard order follows visual order. No interaction exists only on hover.

## Focus and skip

Skip to main content is part of the OS chrome. Focus indicators remain visible on interactive elements and on skip targets. The main landmark is `#main-content`.

## Forms and authentication

Authentication is part of the desk, not a marketing page. Fields stay empty after logout. Remembered credentials belong to the browser’s password manager, not to VentureOS storage. Application session memory is the session cookie and optional Remember me — see the auth module, not this constitution.

## Loading and empty

Loading prefers structure. Empty states guide the next founding or return to the Situation Room. Neither state is a chance to invent a mascot.

## Honesty with features

If a definition excludes a feature, do not offer a control that leads nowhere. Hidden is honest. Disabled-as-costume is not.
