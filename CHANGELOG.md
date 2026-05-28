# Changelog

All notable releases are tagged in git as `v<version>` (see [Versioning](docs/VERSIONING.md)).

## [1.0.1] - 2026-05-28

### Changed

- Pendulum bob radii scale with the virtual world so each purchasable bob has a distinct in-game size.
- Customize shop shows size-accurate bob previews and a Size stat per pendulum.
- Hit-zone layout respects bob clearance for larger bobs.

## [1.0.0] - 2026-05-28

### Added

- Scaled virtual world (`worldConstants`) with default camera pan/zoom for upper/lower multiplier bands.
- Attachment physics integration and expanded attachment/pendulum/site data.
- Adaptive hit-zone spawning in upper/lower bands with dynamic grid spacing.

### Changed

- Customize UI, game canvas layout, pendulum simulation, and render pipeline aligned to the scaled world.
- Store/selectors updated for MVP progression and customization flow.

[1.0.1]: https://github.com/eduardotai/pendulum-clicker/releases/tag/v1.0.1
[1.0.0]: https://github.com/eduardotai/pendulum-clicker/releases/tag/v1.0.0
