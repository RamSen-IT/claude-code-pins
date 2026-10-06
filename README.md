# claude-code-pins

A [Claude Code](https://claude.com/claude-code) plugin that pins Claude's replies and keeps
them one keystroke away: a band above the prompt and a side pane, every reply collapsible
like a spoiler. Pins are kept per folder, across sessions.

```
1: ▶ Status line setup                       06.10 18:12
2: ▼ Keyboard controls                       06.10 18:20
     (the reply unfolds right here, rendered as Markdown)
3: ▶ Plans                                   06.10 18:31
```

## Install

In a Claude Code terminal session:

```
/plugin install pins --marketplace RamSen-IT/claude-code-pins
```

Answer `y` to add the marketplace, then pick the **user** scope so it loads in every session.

## Usage

| Command | What it does |
| --- | --- |
| `/pin` | Pin Claude's last reply. Typed while Claude is still writing, it pins the reply once it finishes. |
| `/pin <title>` | Pin the last reply under your own title, or rename it if it is already pinned. |
| `/pin clear 2` | Remove pin #2 (several at once: `/pin clear 2 3`). |
| `/pins` | Show or hide the pane with every pin. |
| `/pins clear` | Remove all pins of this folder. |
| `/pins bar` | Hide or show the band above the prompt. |

`/pin` and `/pins` run at once, even while Claude is writing.

### Keyboard

- `ctrl+x tab` focuses the band (or the pane), then `1`–`9` open or close a pin.
- In the pane: Tab / arrows walk the buttons, Enter presses one (`▶` toggles, `✕` removes), Esc closes.
- `ctrl+x ctrl+a` collapses the band.
- Mouse clicks work in Claude Code's fullscreen layout; on the main screen use the keys above.

## Where pins are kept

Per folder the session was started in, in Claude Code's plugin store
(`~/.claude/plugins/store/`). A session in `~/projects/app` sees only that folder's pins.
Nothing is sent anywhere.

## Compatibility

Built on Claude Code's function-hooks plugin API, which is in **early access** and may change
between releases. Tested with Claude Code **2.1.291**. If a new Claude Code version breaks it,
please open an issue.

## Development

```sh
git clone https://github.com/RamSen-IT/claude-code-pins
claude --plugin-dir ./claude-code-pins     # run it from the folder for one session
claude plugin validate ./claude-code-pins  # check the manifest and hooks module
claude plugin test ./claude-code-pins      # run tests/*.test.ts
```

| Path | Contents |
| --- | --- |
| `hooks/register.tsx` | The plugin: commands, the band, the pane |
| `types/index.d.ts` | Its state contract |
| `tests/pins.test.ts` | Tests, run against the engine on the terminal and desktop surfaces |

## Versioning

[Semantic Versioning](https://semver.org). The version lives in `.claude-plugin/plugin.json`;
each release is a `vX.Y.Z` tag with its notes in [CHANGELOG.md](CHANGELOG.md).
Installed copies pick up a new version with `claude plugin update pins@ramsen-mods`.

To release: bump `version` in `plugin.json`, move the `Unreleased` notes in `CHANGELOG.md`
under the new version, commit, then `git tag vX.Y.Z && git push --tags`.

## License

[MIT](LICENSE)
