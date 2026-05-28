import { addDefaultParsers, createCliRenderer } from "@opentui/core"
import { render } from "@opentui/solid"
import { App } from "./app"
import parsers from "./parsers-config"
import { loadSystemThemeFromColors } from "./theme"

// Register tree-sitter grammars beyond the ones bundled in @opentui/core
// (js/ts/markdown/zig). These download on first use and cache under
// ~/.local/share/opentui. Must run before the diff renderable mounts.
addDefaultParsers(parsers.parsers)

const renderer = await createCliRenderer({
  externalOutputMode: "passthrough",
  targetFps: 60,
  exitOnCtrlC: true,
  useMouse: true,
  clearOnShutdown: true,
})

// Query the terminal's palette so a "system" theme selection picks up the user's
// actual terminal colors. Mirrors opencode's resolveSystemTheme flow.
void renderer
  .getPalette({ size: 16 })
  .then((colors) => {
    const mode = renderer.themeMode === "light" ? "light" : "dark"
    loadSystemThemeFromColors(colors as { palette: string[]; defaultForeground?: string; defaultBackground?: string }, mode)
  })
  .catch(() => undefined)

function exit() {
  renderer.destroy()
  process.exit(0)
}

process.on("SIGTERM", exit)
process.on("SIGINT", exit)

// render() resolves as soon as the Solid root mounts; the renderer keeps the
// event loop alive via its own listeners/timers. We must not call exit() here
// or the process tears down before paint and the terminal is left in a broken
// state.
await render(() => <App onExit={exit} />, renderer)
