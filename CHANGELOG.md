# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-06

First public release.

### Added
- `/pin` pins Claude's last reply; `/pin <title>` pins it under your own title,
  or renames it when that reply is already pinned.
- `/pin` typed while Claude is still writing pins the reply once it finishes.
- `/pin clear 2 3` removes pins by number; `/pins clear` removes them all.
- `/pins` toggles a pane listing every pin, each one collapsible like a spoiler,
  with a colored number, the time it was pinned and a `✕` to remove it.
- A band above the prompt lists the pins at all times; `1`–`9` open one in place.
  `/pins bar` hides or shows it.
- Keyboard control: `ctrl+x tab` to focus, `1`–`9`, Tab/arrows + Enter, Esc.
- Pins are kept per folder the session was started in, across sessions.
- The same reply is never pinned twice.

[Unreleased]: https://github.com/RamSen-IT/claude-code-pins/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RamSen-IT/claude-code-pins/releases/tag/v0.1.0
