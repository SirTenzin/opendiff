import { RGBA, SyntaxStyle } from "@opentui/core"
import { createSignal, createMemo, createRoot } from "solid-js"
import { homedir } from "node:os"
import { join } from "node:path"

// Theme JSON imports - all 33 themes from opencode
import aura from "./themes/aura.json" with { type: "json" }
import ayu from "./themes/ayu.json" with { type: "json" }
import carbonfox from "./themes/carbonfox.json" with { type: "json" }
import catppuccin from "./themes/catppuccin.json" with { type: "json" }
import catppuccinFrappe from "./themes/catppuccin-frappe.json" with { type: "json" }
import catppuccinMacchiato from "./themes/catppuccin-macchiato.json" with { type: "json" }
import cobalt2 from "./themes/cobalt2.json" with { type: "json" }
import cursor from "./themes/cursor.json" with { type: "json" }
import dracula from "./themes/dracula.json" with { type: "json" }
import everforest from "./themes/everforest.json" with { type: "json" }
import flexoki from "./themes/flexoki.json" with { type: "json" }
import github from "./themes/github.json" with { type: "json" }
import gruvbox from "./themes/gruvbox.json" with { type: "json" }
import kanagawa from "./themes/kanagawa.json" with { type: "json" }
import lucentOrng from "./themes/lucent-orng.json" with { type: "json" }
import material from "./themes/material.json" with { type: "json" }
import matrix from "./themes/matrix.json" with { type: "json" }
import mercury from "./themes/mercury.json" with { type: "json" }
import monokai from "./themes/monokai.json" with { type: "json" }
import nightowl from "./themes/nightowl.json" with { type: "json" }
import nord from "./themes/nord.json" with { type: "json" }
import onedark from "./themes/one-dark.json" with { type: "json" }
import opencode from "./themes/opencode.json" with { type: "json" }
import orng from "./themes/orng.json" with { type: "json" }
import osakaJade from "./themes/osaka-jade.json" with { type: "json" }
import palenight from "./themes/palenight.json" with { type: "json" }
import rosepine from "./themes/rosepine.json" with { type: "json" }
import solarized from "./themes/solarized.json" with { type: "json" }
import synthwave84 from "./themes/synthwave84.json" with { type: "json" }
import tokyonight from "./themes/tokyonight.json" with { type: "json" }
import vercel from "./themes/vercel.json" with { type: "json" }
import vesper from "./themes/vesper.json" with { type: "json" }
import zenburn from "./themes/zenburn.json" with { type: "json" }

type HexColor = `#${string}`
type Variant = { dark: HexColor | string; light: HexColor | string }
type ColorValue = HexColor | string | Variant
type ThemeJson = {
  defs?: Record<string, string>
  theme: Record<string, ColorValue | number>
}

export const THEMES: Record<string, ThemeJson> = {
  aura,
  ayu,
  catppuccin,
  "catppuccin-frappe": catppuccinFrappe,
  "catppuccin-macchiato": catppuccinMacchiato,
  cobalt2,
  cursor,
  dracula,
  everforest,
  flexoki,
  github,
  gruvbox,
  kanagawa,
  material,
  matrix,
  mercury,
  monokai,
  nightowl,
  nord,
  "one-dark": onedark,
  "osaka-jade": osakaJade,
  opencode,
  orng,
  "lucent-orng": lucentOrng,
  palenight,
  rosepine,
  solarized,
  synthwave84,
  tokyonight,
  vesper,
  vercel,
  zenburn,
  carbonfox,
} as Record<string, ThemeJson>

// Resolved theme shape used throughout the viewer
export type ResolvedTheme = {
  primary: RGBA
  secondary: RGBA
  accent: RGBA
  error: RGBA
  warning: RGBA
  success: RGBA
  info: RGBA
  text: RGBA
  textMuted: RGBA
  background: RGBA
  backgroundPanel: RGBA
  backgroundElement: RGBA
  border: RGBA
  borderActive: RGBA
  borderSubtle: RGBA
  diffAdded: RGBA
  diffRemoved: RGBA
  diffContext: RGBA
  diffHunkHeader: RGBA
  diffHighlightAdded: RGBA
  diffHighlightRemoved: RGBA
  diffAddedBg: RGBA
  diffRemovedBg: RGBA
  diffContextBg: RGBA
  diffLineNumber: RGBA
  diffAddedLineNumberBg: RGBA
  diffRemovedLineNumberBg: RGBA
  selectedListItemText: RGBA
  backgroundMenu: RGBA
  syntaxComment: RGBA
  syntaxKeyword: RGBA
  syntaxFunction: RGBA
  syntaxVariable: RGBA
  syntaxString: RGBA
  syntaxNumber: RGBA
  syntaxType: RGBA
  syntaxOperator: RGBA
  syntaxPunctuation: RGBA
  // Markdown token colors — resolved from the theme JSON (every bundled theme
  // defines these) and consumed by getSyntaxRules() for markdown highlighting.
  markdownHeading: RGBA
  markdownStrong: RGBA
  markdownEmph: RGBA
  markdownListItem: RGBA
  markdownBlockQuote: RGBA
  markdownCode: RGBA
  markdownLink: RGBA
  markdownLinkText: RGBA
}

// Ported from opencode's resolveTheme (dark mode only — we don't try to detect light)
function resolveTheme(json: ThemeJson, mode: "dark" | "light" = "dark"): ResolvedTheme {
  const defs = json.defs ?? {}

  function resolveColor(c: unknown, chain: string[] = []): RGBA {
    if (c instanceof RGBA) return c
    if (typeof c === "string") {
      if (c === "transparent" || c === "none") return RGBA.fromInts(0, 0, 0, 0)
      if (c.startsWith("#")) return RGBA.fromHex(c)
      if (chain.includes(c)) throw new Error(`Circular color reference: ${[...chain, c].join(" -> ")}`)
      const next = defs[c] ?? (json.theme as Record<string, unknown>)[c]
      if (next === undefined) throw new Error(`Color reference "${c}" not found`)
      return resolveColor(next, [...chain, c])
    }
    if (typeof c === "number") return RGBA.fromInts(0, 0, 0) // ANSI codes unsupported for v1
    if (c && typeof c === "object" && (mode in (c as object))) {
      return resolveColor((c as Variant)[mode], chain)
    }
    return RGBA.fromInts(0, 0, 0)
  }

  const resolved: Partial<ResolvedTheme> = {}
  for (const [key, value] of Object.entries(json.theme)) {
    if (key === "thinkingOpacity") continue
    if (key === "selectedListItemText" || key === "backgroundMenu") continue
    ;(resolved as Record<string, RGBA>)[key] = resolveColor(value)
  }

  resolved.selectedListItemText =
    json.theme.selectedListItemText !== undefined
      ? resolveColor(json.theme.selectedListItemText)
      : (resolved.background ?? RGBA.fromInts(0, 0, 0))
  resolved.backgroundMenu =
    json.theme.backgroundMenu !== undefined
      ? resolveColor(json.theme.backgroundMenu)
      : (resolved.backgroundElement ?? RGBA.fromInts(0, 0, 0))

  return resolved as ResolvedTheme
}

// Load custom themes from opencode's config locations:
//   - $XDG_CONFIG_HOME/opencode/themes/*.json (global)
//   - walks up from cwd for .opencode/themes/*.json (project)
// Mirrors opencode's getCustomThemes() lookup, sync version.
function loadCustomThemes(): Record<string, ThemeJson> {
  const fs = require("node:fs") as typeof import("node:fs")
  const path = require("node:path") as typeof import("node:path")
  const result: Record<string, ThemeJson> = {}
  const dirs: string[] = []

  const configDir = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  dirs.push(path.join(configDir, "opencode"))

  // Walk up from cwd looking for .opencode/
  let cur = process.cwd()
  while (true) {
    dirs.push(path.join(cur, ".opencode"))
    const parent = path.dirname(cur)
    if (parent === cur) break
    cur = parent
  }

  for (const dir of dirs) {
    const themesDir = path.join(dir, "themes")
    if (!fs.existsSync(themesDir)) continue
    for (const entry of fs.readdirSync(themesDir)) {
      if (!entry.endsWith(".json")) continue
      const name = entry.slice(0, -5)
      const raw = (() => {
        try {
          return fs.readFileSync(path.join(themesDir, entry), "utf-8")
        } catch {
          return null
        }
      })()
      if (!raw) continue
      const parsed = (() => {
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      })()
      if (parsed && typeof parsed === "object" && "theme" in parsed) {
        result[name] = parsed as ThemeJson
      }
    }
  }
  return result
}

const CUSTOM_THEMES = loadCustomThemes()
// Merge custom themes into the registry. Custom themes override defaults if names collide.
Object.assign(THEMES, CUSTOM_THEMES)

// Synchronous KV read at startup. Returns whatever opencode stored in `theme`
// (including "system"). Falls back to "opencode" if missing/invalid.
function readOpencodeThemeSync(): string {
  try {
    const stateDir = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state")
    const kvPath = join(stateDir, "opencode", "kv.json")
    const fs = require("node:fs") as typeof import("node:fs")
    if (!fs.existsSync(kvPath)) return "opencode"
    const raw = fs.readFileSync(kvPath, "utf-8")
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const value = parsed.theme
    if (typeof value !== "string") return "opencode"
    // Keep "system" as-is even though the generated theme is loaded async.
    if (value === "system") return "system"
    return value in THEMES ? value : "opencode"
  } catch {
    return "opencode"
  }
}

// Active theme name signal — drives reactivity throughout the app.
// Wrapped in createRoot because we create these at module scope (outside the render tree)
// and they live for the lifetime of the process. createRoot prevents Solid's warning.
// `systemTheme` is null until the renderer queries the terminal palette and calls setSystemTheme().
const { activeName, setActiveName, systemTheme, setSystemTheme, resolved, syntax } = createRoot(() => {
  const [activeName, setActiveName] = createSignal(readOpencodeThemeSync())
  const [systemTheme, setSystemTheme] = createSignal<ThemeJson | null>(null)
  const resolved = createMemo(() => {
    const name = activeName()
    if (name === "system") {
      const sys = systemTheme()
      if (sys) return resolveTheme(sys, "dark")
      return resolveTheme(THEMES.opencode!, "dark") // fall back until palette resolves
    }
    const json = THEMES[name] ?? THEMES.opencode
    return resolveTheme(json!, "dark")
  })
  // Regenerate the tree-sitter SyntaxStyle whenever the active theme changes so
  // syntax highlighting tracks the selected palette (mirrors opencode).
  const syntax = createMemo(() => generateSyntax(resolved()))
  return { activeName, setActiveName, systemTheme, setSystemTheme, resolved, syntax }
})

export function getActiveThemeName() {
  return activeName()
}

export function setActiveTheme(name: string) {
  // Allow "system" even though it isn't in THEMES.
  if (name !== "system" && !(name in THEMES)) return false
  if (name === "system" && systemTheme() === null) {
    // No palette yet — accept and persist anyway; the renderer hook will populate later.
  }
  setActiveName(name)
  persistTheme(name)
  return true
}

// Called from app startup after createCliRenderer resolves a palette.
// Generates a system theme from the terminal's actual palette so a "system"
// selection respects the user's shell/terminal colors.
export function loadSystemThemeFromColors(colors: {
  palette: string[]
  defaultForeground?: string
  defaultBackground?: string
}, mode: "dark" | "light" = "dark") {
  if (!colors.palette[0]) return
  const json = generateSystem(colors, mode)
  setSystemTheme(json)
}

export function listThemeNames(): string[] {
  // Include "system" if a palette has been resolved (mirrors opencode behavior).
  const names = Object.keys(THEMES)
  if (systemTheme() !== null) names.push("system")
  return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}

function persistTheme(name: string) {
  try {
    const fs = require("node:fs") as typeof import("node:fs")
    const path = require("node:path") as typeof import("node:path")
    const stateDir = process.env.XDG_STATE_HOME ?? path.join(homedir(), ".local", "state")
    const dir = path.join(stateDir, "opencode")
    const kvPath = path.join(dir, "kv.json")
    fs.mkdirSync(dir, { recursive: true })
    let current: Record<string, unknown> = {}
    if (fs.existsSync(kvPath)) {
      const raw = fs.readFileSync(kvPath, "utf-8")
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object") current = parsed as Record<string, unknown>
    }
    current.theme = name
    const tmp = `${kvPath}.${process.pid}.${Date.now()}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(current, null, 2))
    fs.renameSync(tmp, kvPath)
  } catch {
    // Best effort — failing to persist shouldn't break the viewer.
  }
}

// Reactive SyntaxStyle accessor — recomputed whenever the active theme changes.
export { syntax }

// Compatibility shim matching the prior API ({ theme, syntax }).
// `theme` is a Proxy so consumers like `theme()` work without breaking.
// `syntax` is an accessor (call it: `themeState.syntax()`) so the diff renderable
// picks up palette changes.
export function useTheme() {
  return {
    theme: new Proxy({} as ResolvedTheme, {
      get(_target, prop) {
        return (resolved() as unknown as Record<string, unknown>)[prop as string]
      },
    }),
    syntax,
  }
}

// Build a tree-sitter SyntaxStyle from a resolved theme. Scope names match the
// tree-sitter highlight capture groups produced by @opentui/core's grammars.
export function generateSyntax(theme: ResolvedTheme): SyntaxStyle {
  return SyntaxStyle.fromTheme(getSyntaxRules(theme))
}

function getSyntaxRules(theme: ResolvedTheme) {
  return [
    { scope: ["default"], style: { foreground: theme.text } },
    { scope: ["comment"], style: { foreground: theme.syntaxComment, italic: true } },
    { scope: ["comment.documentation"], style: { foreground: theme.syntaxComment, italic: true } },
    { scope: ["string", "symbol"], style: { foreground: theme.syntaxString } },
    { scope: ["number", "boolean"], style: { foreground: theme.syntaxNumber } },
    { scope: ["character.special"], style: { foreground: theme.syntaxString } },
    {
      scope: ["keyword.return", "keyword.conditional", "keyword.repeat", "keyword.coroutine"],
      style: { foreground: theme.syntaxKeyword, italic: true },
    },
    { scope: ["keyword.type"], style: { foreground: theme.syntaxType, bold: true, italic: true } },
    { scope: ["keyword.function", "function.method"], style: { foreground: theme.syntaxFunction } },
    { scope: ["keyword"], style: { foreground: theme.syntaxKeyword, italic: true } },
    { scope: ["keyword.import"], style: { foreground: theme.syntaxKeyword } },
    {
      scope: ["operator", "keyword.operator", "punctuation.delimiter"],
      style: { foreground: theme.syntaxOperator },
    },
    { scope: ["keyword.conditional.ternary"], style: { foreground: theme.syntaxOperator } },
    {
      scope: ["variable", "variable.parameter", "function.method.call", "function.call"],
      style: { foreground: theme.syntaxVariable },
    },
    { scope: ["variable.member", "function", "constructor"], style: { foreground: theme.syntaxFunction } },
    { scope: ["type", "module"], style: { foreground: theme.syntaxType } },
    { scope: ["constant"], style: { foreground: theme.syntaxNumber } },
    { scope: ["property"], style: { foreground: theme.syntaxVariable } },
    { scope: ["class"], style: { foreground: theme.syntaxType } },
    { scope: ["parameter"], style: { foreground: theme.syntaxVariable } },
    { scope: ["punctuation", "punctuation.bracket"], style: { foreground: theme.syntaxPunctuation } },
    {
      scope: ["variable.builtin", "type.builtin", "function.builtin", "module.builtin", "constant.builtin"],
      style: { foreground: theme.error },
    },
    { scope: ["variable.super"], style: { foreground: theme.error } },
    { scope: ["string.escape", "string.regexp"], style: { foreground: theme.syntaxKeyword } },
    { scope: ["keyword.directive"], style: { foreground: theme.syntaxKeyword, italic: true } },
    { scope: ["punctuation.special"], style: { foreground: theme.syntaxOperator } },
    { scope: ["keyword.modifier"], style: { foreground: theme.syntaxKeyword, italic: true } },
    { scope: ["keyword.exception"], style: { foreground: theme.syntaxKeyword, italic: true } },
    // Markdown
    { scope: ["markup.heading"], style: { foreground: theme.markdownHeading, bold: true } },
    { scope: ["markup.heading.1"], style: { foreground: theme.markdownHeading, bold: true, underline: true } },
    { scope: ["markup.heading.2"], style: { foreground: theme.markdownHeading, bold: true } },
    { scope: ["markup.heading.3"], style: { foreground: theme.markdownHeading, bold: true } },
    { scope: ["markup.heading.4"], style: { foreground: theme.markdownHeading, bold: true } },
    { scope: ["markup.heading.5"], style: { foreground: theme.markdownHeading, bold: true } },
    { scope: ["markup.heading.6"], style: { foreground: theme.markdownHeading, bold: true } },
    { scope: ["markup.bold", "markup.strong"], style: { foreground: theme.markdownStrong, bold: true } },
    { scope: ["markup.italic"], style: { foreground: theme.markdownEmph, italic: true } },
    { scope: ["markup.list"], style: { foreground: theme.markdownListItem } },
    { scope: ["markup.quote"], style: { foreground: theme.markdownBlockQuote, italic: true } },
    { scope: ["markup.raw", "markup.raw.block"], style: { foreground: theme.markdownCode } },
    { scope: ["markup.raw.inline"], style: { foreground: theme.markdownCode, background: theme.background } },
    { scope: ["markup.link"], style: { foreground: theme.markdownLink, underline: true } },
    { scope: ["markup.link.label"], style: { foreground: theme.markdownLinkText, underline: true } },
    { scope: ["markup.link.url"], style: { foreground: theme.markdownLink, underline: true } },
    { scope: ["label"], style: { foreground: theme.markdownLinkText } },
    { scope: ["spell", "nospell"], style: { foreground: theme.text } },
    { scope: ["conceal"], style: { foreground: theme.textMuted } },
    // Additional common highlight groups
    { scope: ["string.special", "string.special.url"], style: { foreground: theme.markdownLink, underline: true } },
    { scope: ["character"], style: { foreground: theme.syntaxString } },
    { scope: ["float"], style: { foreground: theme.syntaxNumber } },
    { scope: ["comment.error"], style: { foreground: theme.error, italic: true, bold: true } },
    { scope: ["comment.warning"], style: { foreground: theme.warning, italic: true, bold: true } },
    { scope: ["comment.todo", "comment.note"], style: { foreground: theme.info, italic: true, bold: true } },
    { scope: ["namespace"], style: { foreground: theme.syntaxType } },
    { scope: ["field"], style: { foreground: theme.syntaxVariable } },
    { scope: ["type.definition"], style: { foreground: theme.syntaxType, bold: true } },
    { scope: ["keyword.export"], style: { foreground: theme.syntaxKeyword } },
    { scope: ["attribute", "annotation"], style: { foreground: theme.warning } },
    { scope: ["tag"], style: { foreground: theme.error } },
    { scope: ["tag.attribute"], style: { foreground: theme.syntaxKeyword } },
    { scope: ["tag.delimiter"], style: { foreground: theme.syntaxOperator } },
    { scope: ["markup.strikethrough"], style: { foreground: theme.textMuted } },
    { scope: ["markup.underline"], style: { foreground: theme.text, underline: true } },
    { scope: ["markup.list.checked"], style: { foreground: theme.success } },
    { scope: ["markup.list.unchecked"], style: { foreground: theme.textMuted } },
    { scope: ["diff.plus"], style: { foreground: theme.diffAdded, background: theme.diffAddedBg } },
    { scope: ["diff.minus"], style: { foreground: theme.diffRemoved, background: theme.diffRemovedBg } },
    { scope: ["diff.delta"], style: { foreground: theme.diffContext, background: theme.diffContextBg } },
    { scope: ["error"], style: { foreground: theme.error, bold: true } },
    { scope: ["warning"], style: { foreground: theme.warning, bold: true } },
    { scope: ["info"], style: { foreground: theme.info } },
    { scope: ["debug"], style: { foreground: theme.textMuted } },
  ]
}

export function tint(fg: RGBA, bg: RGBA, alpha: number): RGBA {
  const r = Math.round(bg.r * 255 * (1 - alpha) + fg.r * 255 * alpha)
  const g = Math.round(bg.g * 255 * (1 - alpha) + fg.g * 255 * alpha)
  const b = Math.round(bg.b * 255 * (1 - alpha) + fg.b * 255 * alpha)
  return RGBA.fromInts(r, g, b)
}

// Re-export for direct access if needed.
export const theme = new Proxy({} as ResolvedTheme, {
  get(_target, prop) {
    return (resolved() as unknown as Record<string, unknown>)[prop as string]
  },
})

// ---------------------------------------------------------------------------
// System theme generation — ported from opencode (context/theme.tsx).
// Builds a ThemeJson out of the terminal's reported palette + bg/fg.
// ---------------------------------------------------------------------------

// opencode's tint: base + (overlay - base) * alpha. Used inside generateSystem;
// kept local to avoid collision with the (fg, bg, alpha) variant exported above.
function tintBaseOverlay(base: RGBA, overlay: RGBA, alpha: number): RGBA {
  const r = base.r + (overlay.r - base.r) * alpha
  const g = base.g + (overlay.g - base.g) * alpha
  const b = base.b + (overlay.b - base.b) * alpha
  return RGBA.fromInts(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255))
}

function ansiToRgba(code: number): RGBA {
  if (code < 16) {
    const ansiColors = [
      "#000000", "#800000", "#008000", "#808000", "#000080", "#800080",
      "#008080", "#c0c0c0", "#808080", "#ff0000", "#00ff00", "#ffff00",
      "#0000ff", "#ff00ff", "#00ffff", "#ffffff",
    ]
    return RGBA.fromHex(ansiColors[code] ?? "#000000")
  }
  if (code < 232) {
    const index = code - 16
    const b = index % 6
    const g = Math.floor(index / 6) % 6
    const r = Math.floor(index / 36)
    const val = (x: number) => (x === 0 ? 0 : x * 40 + 55)
    return RGBA.fromInts(val(r), val(g), val(b))
  }
  if (code < 256) {
    const gray = (code - 232) * 10 + 8
    return RGBA.fromInts(gray, gray, gray)
  }
  return RGBA.fromInts(0, 0, 0)
}

function generateGrayScale(bg: RGBA, isDark: boolean): Record<number, RGBA> {
  const grays: Record<number, RGBA> = {}
  const bgR = bg.r * 255
  const bgG = bg.g * 255
  const bgB = bg.b * 255
  const luminance = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB
  for (let i = 1; i <= 12; i++) {
    const factor = i / 12.0
    let newR: number, newG: number, newB: number
    if (isDark) {
      if (luminance < 10) {
        const grayValue = Math.floor(factor * 0.4 * 255)
        newR = grayValue; newG = grayValue; newB = grayValue
      } else {
        const newLum = luminance + (255 - luminance) * factor * 0.4
        const ratio = newLum / luminance
        newR = Math.min(bgR * ratio, 255)
        newG = Math.min(bgG * ratio, 255)
        newB = Math.min(bgB * ratio, 255)
      }
    } else {
      if (luminance > 245) {
        const grayValue = Math.floor(255 - factor * 0.4 * 255)
        newR = grayValue; newG = grayValue; newB = grayValue
      } else {
        const newLum = luminance * (1 - factor * 0.4)
        const ratio = newLum / luminance
        newR = Math.max(bgR * ratio, 0)
        newG = Math.max(bgG * ratio, 0)
        newB = Math.max(bgB * ratio, 0)
      }
    }
    grays[i] = RGBA.fromInts(Math.floor(newR), Math.floor(newG), Math.floor(newB))
  }
  return grays
}

function generateMutedTextColor(bg: RGBA, isDark: boolean): RGBA {
  const bgR = bg.r * 255
  const bgG = bg.g * 255
  const bgB = bg.b * 255
  const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB
  let grayValue: number
  if (isDark) {
    grayValue = bgLum < 10 ? 180 : Math.min(Math.floor(160 + bgLum * 0.3), 200)
  } else {
    grayValue = bgLum > 245 ? 75 : Math.max(Math.floor(100 - (255 - bgLum) * 0.2), 60)
  }
  return RGBA.fromInts(grayValue, grayValue, grayValue)
}

// generateSystem: pulled almost verbatim from opencode context/theme.tsx.
// Takes the terminal's reported palette and produces a ThemeJson whose colors
// reference RGBA instances directly. The "background" is intentionally transparent
// so the user's terminal background bleeds through.
function generateSystem(
  colors: { palette: string[]; defaultForeground?: string; defaultBackground?: string },
  mode: "dark" | "light",
): ThemeJson {
  const bg = RGBA.fromHex(colors.defaultBackground ?? colors.palette[0]!)
  const fg = RGBA.fromHex(colors.defaultForeground ?? colors.palette[7]!)
  const transparent = RGBA.fromValues(bg.r, bg.g, bg.b, 0)
  const isDark = mode === "dark"

  const col = (i: number) => {
    const value = colors.palette[i]
    return value ? RGBA.fromHex(value) : ansiToRgba(i)
  }

  const grays = generateGrayScale(bg, isDark)
  const textMuted = generateMutedTextColor(bg, isDark)
  const ansiColors = {
    black: col(0), red: col(1), green: col(2), yellow: col(3),
    blue: col(4), magenta: col(5), cyan: col(6), white: col(7),
    redBright: col(9), greenBright: col(10),
  }

  const diffAlpha = isDark ? 0.22 : 0.14
  const diffAddedBg = tintBaseOverlay(bg, ansiColors.green, diffAlpha)
  const diffRemovedBg = tintBaseOverlay(bg, ansiColors.red, diffAlpha)
  const diffContextBg = grays[2]!
  const diffAddedLineNumberBg = tintBaseOverlay(diffContextBg, ansiColors.green, diffAlpha)
  const diffRemovedLineNumberBg = tintBaseOverlay(diffContextBg, ansiColors.red, diffAlpha)

  return {
    theme: {
      primary: ansiColors.cyan,
      secondary: ansiColors.magenta,
      accent: ansiColors.cyan,
      error: ansiColors.red,
      warning: ansiColors.yellow,
      success: ansiColors.green,
      info: ansiColors.cyan,
      text: fg,
      textMuted,
      selectedListItemText: bg,
      background: transparent,
      backgroundPanel: grays[2]!,
      backgroundElement: grays[3]!,
      backgroundMenu: grays[3]!,
      borderSubtle: grays[6]!,
      border: grays[7]!,
      borderActive: grays[8]!,
      diffAdded: ansiColors.green,
      diffRemoved: ansiColors.red,
      diffContext: grays[7]!,
      diffHunkHeader: grays[7]!,
      diffHighlightAdded: ansiColors.greenBright,
      diffHighlightRemoved: ansiColors.redBright,
      diffAddedBg,
      diffRemovedBg,
      diffContextBg,
      diffLineNumber: textMuted,
      diffAddedLineNumberBg,
      diffRemovedLineNumberBg,
      markdownText: fg,
      markdownHeading: fg,
      markdownLink: ansiColors.blue,
      markdownLinkText: ansiColors.cyan,
      markdownCode: ansiColors.green,
      markdownBlockQuote: ansiColors.yellow,
      markdownEmph: ansiColors.yellow,
      markdownStrong: fg,
      markdownHorizontalRule: grays[7]!,
      markdownListItem: ansiColors.blue,
      markdownListEnumeration: ansiColors.cyan,
      markdownImage: ansiColors.blue,
      markdownImageText: ansiColors.cyan,
      markdownCodeBlock: fg,
      syntaxComment: textMuted,
      syntaxKeyword: ansiColors.magenta,
      syntaxFunction: ansiColors.blue,
      syntaxVariable: fg,
      syntaxString: ansiColors.green,
      syntaxNumber: ansiColors.yellow,
      syntaxType: ansiColors.cyan,
      syntaxOperator: ansiColors.cyan,
      syntaxPunctuation: fg,
    } as unknown as ThemeJson["theme"],
  }
}
