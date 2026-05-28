/** @jsxImportSource @opentui/solid */
import { RGBA, TextAttributes, type BorderSides, type BoxRenderable, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions, useKeyboard } from "@opentui/solid"
import path from "path"
import { createEffect, createMemo, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"
import { useTheme, listThemeNames, setActiveTheme, getActiveThemeName } from "../theme"
import { DiffViewerFileTree } from "./file-tree"
import { Panel, PanelGroup, Separator } from "./layout"
import { Picker } from "./picker"
import { CustomSpeedScroll } from "./scroll-accel"
import {
  buildFileTree,
  fileTreeFileSelection,
  type FileTreeRow,
  flattenFileTree,
  moveFileTreeSelection,
  moveFileTreeSelectionToFirstChild,
  moveFileTreeSelectionToParent,
  movePatchFileIndex,
  orderedPatchFileIndexes,
  setFileTreeDirectoryExpanded,
  showDiffViewerFileTree,
  singlePatchFileIndex,
  toggleFileTreeDirectory,
} from "./file-tree-utils"
import type { DiffFile } from "../git"

const MIN_SPLIT_WIDTH = 100
const FILE_TREE_WIDTH = 32
const PLAIN_TEXT_FILETYPE = "opencode-plain-text"

type DiffViewerFocus = "patches" | "files"
type DiffView = "split" | "unified"

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ".abap": "abap",
  ".bat": "bat",
  ".bib": "bibtex",
  ".bibtex": "bibtex",
  ".clj": "clojure",
  ".cljs": "clojure",
  ".cljc": "clojure",
  ".edn": "clojure",
  ".coffee": "coffeescript",
  ".c": "c",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".cc": "cpp",
  ".c++": "cpp",
  ".cs": "csharp",
  ".csx": "csharp",
  ".css": "css",
  ".d": "d",
  ".pas": "pascal",
  ".pascal": "pascal",
  ".diff": "diff",
  ".patch": "diff",
  ".dart": "dart",
  ".dockerfile": "dockerfile",
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".ets": "typescript",
  ".hrl": "erlang",
  ".fs": "fsharp",
  ".fsi": "fsharp",
  ".fsx": "fsharp",
  ".fsscript": "fsharp",
  ".gitcommit": "git-commit",
  ".gitrebase": "git-rebase",
  ".go": "go",
  ".groovy": "groovy",
  ".gleam": "gleam",
  ".hbs": "handlebars",
  ".handlebars": "handlebars",
  ".hs": "haskell",
  ".lhs": "haskell",
  ".html": "html",
  ".htm": "html",
  ".ini": "ini",
  ".java": "java",
  ".jl": "julia",
  ".js": "javascript",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".jsx": "javascriptreact",
  ".json": "json",
  ".tex": "latex",
  ".latex": "latex",
  ".less": "less",
  ".lua": "lua",
  ".makefile": "makefile",
  makefile: "makefile",
  ".md": "markdown",
  ".markdown": "markdown",
  ".m": "objective-c",
  ".mm": "objective-cpp",
  ".pl": "perl",
  ".pm": "perl",
  ".pm6": "perl6",
  ".php": "php",
  ".ps1": "powershell",
  ".psm1": "powershell",
  ".pug": "jade",
  ".jade": "jade",
  ".py": "python",
  ".r": "r",
  ".cshtml": "razor",
  ".razor": "razor",
  ".rb": "ruby",
  ".rake": "ruby",
  ".gemspec": "ruby",
  ".ru": "ruby",
  ".erb": "erb",
  ".html.erb": "erb",
  ".js.erb": "erb",
  ".css.erb": "erb",
  ".json.erb": "erb",
  ".rs": "rust",
  ".scss": "scss",
  ".sass": "sass",
  ".scala": "scala",
  ".shader": "shaderlab",
  ".sh": "shellscript",
  ".bash": "shellscript",
  ".zsh": "shellscript",
  ".ksh": "shellscript",
  ".sql": "sql",
  ".svelte": "svelte",
  ".swift": "swift",
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".mts": "typescript",
  ".cts": "typescript",
  ".mtsx": "typescriptreact",
  ".ctsx": "typescriptreact",
  ".xml": "xml",
  ".xsl": "xsl",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".vue": "vue",
  ".zig": "zig",
  ".zon": "zig",
  ".astro": "astro",
  ".ml": "ocaml",
  ".mli": "ocaml",
  ".tf": "terraform",
  ".tfvars": "terraform-vars",
  ".hcl": "hcl",
  ".nix": "nix",
  ".typ": "typst",
  ".typc": "typst",
} as const

function filetype(input?: string) {
  if (!input) return "none"
  const language = LANGUAGE_EXTENSIONS[path.extname(input)]
  if (["typescriptreact", "javascriptreact", "javascript"].includes(language)) return "typescript"
  return language
}

// All ancestor directory paths of a file/dir path, e.g. "a/b/c" → ["a", "a/b"].
function ancestorDirPaths(nodePath: string): string[] {
  const segments = nodePath.split("/").filter(Boolean)
  const result: string[] = []
  for (let i = 1; i < segments.length; i++) {
    result.push(segments.slice(0, i).join("/"))
  }
  return result
}

export function DiffViewer(props: { diffs: DiffFile[]; onExit: () => void; onReload: () => void }) {
  const dimensions = useTerminalDimensions()
  const themeState = useTheme()
  const theme = () => themeState.theme
  const files = () => props.diffs
  const [focus, setFocus] = createSignal<DiffViewerFocus>("patches")
  const [fileTreeEnabled, setFileTreeEnabled] = createSignal(true)
  const showFileTree = createMemo(() => showDiffViewerFileTree(fileTreeEnabled(), files().length))
  const [singlePatch, setSinglePatch] = createSignal(false)
  const patchPaneWidth = createMemo(() => dimensions().width - (showFileTree() ? 33 : 0) - 4)
  const patchLeftBorder = createMemo<BorderSides[]>(() => (showFileTree() ? ["left"] : []))
  const splitAvailable = createMemo(() => patchPaneWidth() >= MIN_SPLIT_WIDTH)
  const defaultView = createMemo(() => (splitAvailable() ? "split" : "unified"))
  const [viewOverride, setViewOverride] = createSignal<DiffView | undefined>()
  const view = createMemo(() => (splitAvailable() ? (viewOverride() ?? defaultView()) : "unified"))
  const fileTree = createMemo(() => buildFileTree(files()))
  // Persisted tree/selection state is keyed by stable string paths (not row
  // indices) so it survives an auto-refresh that adds/removes/reorders files.
  // collapsedDirPaths holds directories the user explicitly collapsed; an empty
  // set means everything is expanded (so new folders appear open by default).
  const [collapsedDirPaths, setCollapsedDirPaths] = createSignal<ReadonlySet<string>>(new Set())
  const [highlightedPath, setHighlightedPath] = createSignal<string | undefined>()
  const [lastHighlightedPath, setLastHighlightedPath] = createSignal<string | undefined>()
  const [activePatchPath, setActivePatchPath] = createSignal<string | undefined>()
  const [reviewedFileNames, setReviewedFileNames] = createSignal<ReadonlySet<string>>(new Set())
  const fileRows = createMemo(() => flattenFileTree(fileTree(), collapsedDirPaths()))
  const patchFileIndexes = createMemo(() => orderedPatchFileIndexes(flattenFileTree(fileTree())))

  // Help dialog visibility (opened by `?`).
  const [helpOpen, setHelpOpen] = createSignal(false)

  // Mouse wheel / trackpad scroll speed for the patches scrollbox.
  // Matches opencode's main session view: CustomSpeedScroll(3) → 3 lines per tick.
  const patchScrollAccel = new CustomSpeedScroll(3)

  // Command palette + theme picker state.
  // paletteMode: null = closed, "commands" = Ctrl+P palette, "themes" = theme switcher.
  // The actual selection/filter UI lives inside <Picker> so this component just
  // tracks which one is open and what the user's theme was when they opened it
  // (so cancel can restore it).
  type PaletteMode = null | "commands" | "themes"
  const [paletteMode, setPaletteMode] = createSignal<PaletteMode>(null)
  const [themeAtOpen, setThemeAtOpen] = createSignal(getActiveThemeName())
  const commandList = [{ id: "theme.switch", title: "Switch theme" }]

  function openPalette() {
    setThemeAtOpen(getActiveThemeName())
    setPaletteMode("commands")
  }
  function openThemes() {
    setPaletteMode("themes")
  }
  function closePalette(restore: boolean) {
    if (restore && paletteMode() === "themes") setActiveTheme(themeAtOpen())
    setPaletteMode(null)
  }
  const focusRunner = (input: Record<DiffViewerFocus, () => void>) => () => input[focus()]()
  let scroll: ScrollBoxRenderable | undefined
  const patchNodeByFileIndex = new Map<number, BoxRenderable>()
  const [pendingPatchScrollFileIndex, setPendingPatchScrollFileIndex] = createSignal<number | undefined>()
  const [patchFillerHeight, setPatchFillerHeight] = createSignal(0)

  // No reset-on-data-change effect: because all persisted state is keyed by
  // path, it simply survives a refresh (manual `r` or auto-refresh) instead of
  // being wiped. Stale paths are resolved away lazily (see ensureHighlightedFileNode
  // and currentPatchFileIndex).

  const ensureHighlightedFileNode = () => {
    const highlighted = highlightedPath()
    if (highlighted !== undefined && fileRows().some((row) => row.path === highlighted)) return
    const lastHighlighted = lastHighlightedPath()
    const next =
      lastHighlighted !== undefined && fileRows().some((row) => row.path === lastHighlighted)
        ? lastHighlighted
        : fileRows().find((row) => row.fileIndex !== undefined)?.path
    setHighlightedPath(next)
  }

  const setHighlighted = (path: string | undefined) => {
    setHighlightedPath(path)
    if (path !== undefined) setLastHighlightedPath(path)
  }

  const moveFileSelection = (offset: number) =>
    setHighlighted(moveFileTreeSelection(fileRows(), highlightedPath(), offset))

  const clearFileTreePatchState = () => {
    setHighlightedPath(undefined)
    setActivePatchPath(undefined)
  }

  // Resolve the persisted active-patch path to a fresh index each render so it
  // stays correct after a refresh reshuffles the diffs array. Undefined if the
  // file no longer exists in the current diff.
  const activePatchFileIndex = () => {
    const activePath = activePatchPath()
    if (activePath === undefined) return undefined
    const index = files().findIndex((file) => file.file === activePath)
    return index === -1 ? undefined : index
  }

  // The currently-selected patch file (the one shown in single-patch mode and
  // used as the navigation anchor). Derived from the path-keyed activePatchPath
  // rather than persisted as an index, so it can never point at the wrong file
  // after an auto-refresh reshuffles the diffs array.
  const selectedFileIndex = activePatchFileIndex

  const scrollPatchNodeToTop = (patchNode: BoxRenderable) => {
    requestAnimationFrame(() => {
      if (!scroll) return
      const scrollDelta = patchNode.y - scroll.viewport.y
      const contentY = scroll.scrollTop + scrollDelta
      const offset = contentY === 0 ? 0 : 1
      scroll.scrollBy(scrollDelta + offset)
    })
  }

  const revealFileTreeFile = (fileIndex: number) => {
    const selection = fileTreeFileSelection(fileTree(), fileIndex)
    if (!selection) return
    // Ensure every ancestor directory of the revealed file is expanded
    // (un-collapsed) so the file row is actually visible.
    const ancestors = ancestorDirPaths(selection.path)
    if (ancestors.length > 0) {
      setCollapsedDirPaths((collapsed) => {
        const next = new Set(collapsed)
        ancestors.forEach((dir) => next.delete(dir))
        return next
      })
    }
    setHighlighted(selection.path)
  }

  const selectPatchFile = (fileIndex: number) => {
    revealFileTreeFile(fileIndex)
    setActivePatchPath(files()[fileIndex]?.file)
  }

  const scrollToFileIndex = (fileIndex: number | undefined) => {
    if (fileIndex === undefined) return
    selectPatchFile(fileIndex)
    const patchNode = patchNodeByFileIndex.get(fileIndex)
    if (patchNode) scrollPatchNodeToTop(patchNode)
  }

  const jumpToFileIndex = (fileIndex: number | undefined) => {
    if (fileIndex === undefined) return
    scrollToFileIndex(fileIndex)
  }

  const currentPatchFileIndex = () => {
    if (!scroll) return undefined
    const viewportContentY = scroll.scrollTop + 1
    const entries = patchFileIndexes()
      .map((fileIndex) => ({
        fileIndex,
        node: patchNodeByFileIndex.get(fileIndex),
      }))
      .filter((entry): entry is { fileIndex: number; node: BoxRenderable } => Boolean(entry.node))
      .map((entry) => ({
        ...entry,
        contentY: scroll!.scrollTop + entry.node.y - scroll!.viewport.y,
      }))
      .sort((left, right) => left.contentY - right.contentY)
    return entries.findLast((entry) => entry.contentY <= viewportContentY)?.fileIndex ?? entries[0]?.fileIndex
  }

  const jumpRelativePatchFile = (offset: number) => {
    const next = movePatchFileIndex(patchFileIndexes(), selectedFileIndex() ?? activePatchFileIndex(), offset)
    if (singlePatch()) {
      if (next === undefined) return
      selectPatchFile(next)
      scrollSinglePatchToTop()
      return
    }
    scrollToFileIndex(next)
  }

  const firstPatchFileIndex = () => fileRows().find((row) => row.fileIndex !== undefined)?.fileIndex
  const visiblePatchFiles = createMemo(() => {
    if (!singlePatch()) {
      return patchFileIndexes().flatMap((fileIndex) => {
        const file = files()[fileIndex]
        return file ? [{ file, fileIndex }] : []
      })
    }
    const fileIndex = singlePatchFileIndex(
      selectedFileIndex(),
      activePatchFileIndex(),
      currentPatchFileIndex(),
      firstPatchFileIndex(),
    )
    const file = fileIndex === undefined ? undefined : files()[fileIndex]
    return file && fileIndex !== undefined ? [{ file, fileIndex }] : []
  })

  const ensureHighlightedPatchFile = () => {
    const fileIndex = currentPatchFileIndex() ?? activePatchFileIndex() ?? firstPatchFileIndex()
    if (fileIndex === undefined) return
    selectPatchFile(fileIndex)
  }

  const scrollToPatchFileIndexAfterRender = (fileIndex: number) => {
    setPendingPatchScrollFileIndex(fileIndex)
    requestAnimationFrame(() => {
      const patchNode = patchNodeByFileIndex.get(fileIndex)
      if (patchNode) scrollPatchNodeToTop(patchNode)
      requestAnimationFrame(() => {
        const patchNode = patchNodeByFileIndex.get(fileIndex)
        if (patchNode) scrollPatchNodeToTop(patchNode)
        setPendingPatchScrollFileIndex(undefined)
      })
    })
  }

  const scrollSinglePatchToTop = () => {
    requestAnimationFrame(() => {
      scroll?.scrollTo(0)
      requestAnimationFrame(() => scroll?.scrollTo(0))
    })
  }

  const measurePatchFiller = () => {
    requestAnimationFrame(() => {
      if (!scroll) return
      const entries = visiblePatchFiles()
        .map((entry) => patchNodeByFileIndex.get(entry.fileIndex))
        .filter((node): node is BoxRenderable => Boolean(node))
      if (entries.length === 0) {
        setPatchFillerHeight(0)
        return
      }
      const contentHeight = Math.max(
        ...entries.map((node) => scroll!.scrollTop + node.y - scroll!.viewport.y + node.height),
      )
      setPatchFillerHeight(Math.max(0, scroll.viewport.height - contentHeight))
    })
  }

  const registerPatchNode = (fileIndex: number, element: BoxRenderable) => {
    patchNodeByFileIndex.set(fileIndex, element)
    measurePatchFiller()
    if (pendingPatchScrollFileIndex() !== fileIndex) return
    requestAnimationFrame(() => {
      scrollPatchNodeToTop(element)
      requestAnimationFrame(() => {
        scrollPatchNodeToTop(element)
        setPendingPatchScrollFileIndex(undefined)
      })
    })
  }

  createEffect(() => {
    visiblePatchFiles()
    dimensions()
    view()
    measurePatchFiller()
  })

  const toggleSelectedFileTreeRow = () => {
    const highlighted = fileRows().find((row) => row.path === highlightedPath())
    if (!highlighted) return
    if (highlighted.fileIndex !== undefined) {
      jumpToFileIndex(highlighted.fileIndex)
      return
    }
    setCollapsedDirPaths((collapsed) => toggleFileTreeDirectory(collapsed, highlighted.path))
  }

  const clickFileTreeRow = (row: FileTreeRow) => {
    setFocus("files")
    setHighlighted(row.path)
    if (row.fileIndex !== undefined) {
      jumpToFileIndex(row.fileIndex)
      return
    }
    setCollapsedDirPaths((collapsed) => toggleFileTreeDirectory(collapsed, row.path))
  }

  const toggleSelectedFileReviewed = () => {
    const fileIndex =
      focus() === "files"
        ? fileRows().find((row) => row.path === highlightedPath())?.fileIndex
        : (selectedFileIndex() ?? activePatchFileIndex() ?? currentPatchFileIndex())
    const file = fileIndex === undefined ? undefined : files()[fileIndex]?.file
    if (!file) return
    setReviewedFileNames((reviewed) => {
      const next = new Set(reviewed)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }

  useKeyboard((event) => {
    const key = event.name

    // Help dialog takes priority when open; close on esc or enter.
    if (helpOpen()) {
      if (key === "escape" || key === "return") setHelpOpen(false)
      return
    }

    // Picker handles its own keyboard via useKeyboard inside the component; just
    // bail so we don't double-handle (e.g. our `q` exits while the picker is open).
    if (paletteMode() !== null) return

    if (key === "p" && event.ctrl) {
      openPalette()
      return
    }
    if (key === "q") {
      props.onExit()
      return
    }
    if (key === "?") {
      setHelpOpen(true)
      return
    }
    if (key === "tab" || key === "t") {
      if (!showFileTree()) return
      setFocus((current) => {
        if (current === "files") return "patches"
        ensureHighlightedFileNode()
        return "files"
      })
      return
    }
    if (key === "n") {
      jumpRelativePatchFile(1)
      return
    }
    if (key === "p") {
      jumpRelativePatchFile(-1)
      return
    }
    if (key === "m") {
      toggleSelectedFileReviewed()
      return
    }
    if (key === "r") {
      props.onReload()
      return
    }
    if (key === "v") {
      if (!splitAvailable()) return
      const next = view() === "split" ? "unified" : "split"
      setViewOverride(next)
      return
    }
    if (key === "s") {
      if (!singlePatch()) {
        ensureHighlightedPatchFile()
        setSinglePatch(true)
        scrollSinglePatchToTop()
        return
      }
      const fileIndex =
        visiblePatchFiles()[0]?.fileIndex ??
        singlePatchFileIndex(
          selectedFileIndex(),
          activePatchFileIndex(),
          currentPatchFileIndex(),
          firstPatchFileIndex(),
        )
      if (fileIndex !== undefined) selectPatchFile(fileIndex)
      setSinglePatch(false)
      if (fileIndex !== undefined) scrollToPatchFileIndexAfterRender(fileIndex)
      return
    }
    if (key === "e") {
      setCollapsedDirPaths(new Set<string>())
      return
    }
    if (key === "j" || key === "down") {
      if (focus() === "files") {
        moveFileSelection(1)
      } else {
        clearFileTreePatchState()
        scroll?.scrollBy(1)
      }
      return
    }
    if (key === "k" || key === "up") {
      if (focus() === "files") {
        moveFileSelection(-1)
      } else {
        clearFileTreePatchState()
        scroll?.scrollBy(-1)
      }
      return
    }
    // Page up/down scroll speed mirrors opencode's main session view: half viewport per page key,
    // and a separate quarter-viewport half-page jump on ctrl+d / ctrl+u.
    if (key === "pagedown" || (key === "f" && event.ctrl)) {
      if (focus() === "files") {
        moveFileSelection(8)
      } else {
        clearFileTreePatchState()
        if (scroll) scroll.scrollBy(scroll.height / 2)
      }
      return
    }
    if (key === "pageup" || (key === "b" && event.ctrl)) {
      if (focus() === "files") {
        moveFileSelection(-8)
      } else {
        clearFileTreePatchState()
        if (scroll) scroll.scrollBy(-scroll.height / 2)
      }
      return
    }
    if (key === "d" && event.ctrl) {
      if (focus() === "files") {
        moveFileSelection(4)
      } else {
        clearFileTreePatchState()
        if (scroll) scroll.scrollBy(scroll.height / 4)
      }
      return
    }
    if (key === "u" && event.ctrl) {
      if (focus() === "files") {
        moveFileSelection(-4)
      } else {
        clearFileTreePatchState()
        if (scroll) scroll.scrollBy(-scroll.height / 4)
      }
      return
    }
    if (key === "return" || key === "space") {
      if (focus() === "files") {
        toggleSelectedFileTreeRow()
      }
      return
    }
    if (key === "right" || key === "l") {
      if (focus() === "files") {
        const highlighted = highlightedPath()
        const row = highlighted === undefined ? undefined : fileRows().find((item) => item.path === highlighted)
        // If on an expanded directory, descend into its first child; otherwise expand it.
        if (row?.kind === "directory" && !collapsedDirPaths().has(row.path)) {
          setHighlighted(moveFileTreeSelectionToFirstChild(fileRows(), highlighted))
          return
        }
        if (row?.kind === "directory") {
          setCollapsedDirPaths((collapsed) => setFileTreeDirectoryExpanded(collapsed, row.path, true))
        }
      }
      return
    }
    if (key === "left" || key === "h") {
      if (focus() === "files") {
        const highlighted = highlightedPath()
        const row = highlighted === undefined ? undefined : fileRows().find((item) => item.path === highlighted)
        // If on an expanded directory, collapse it; otherwise move to the parent.
        if (row?.kind !== "directory" || collapsedDirPaths().has(row.path)) {
          setHighlighted(moveFileTreeSelectionToParent(fileRows(), highlighted))
          return
        }
        setCollapsedDirPaths((collapsed) => setFileTreeDirectoryExpanded(collapsed, row.path, false))
      }
      return
    }
  })

  return (
    <box position="absolute" zIndex={2500} left={0} top={0} width={dimensions().width} height={dimensions().height}>
      <PanelGroup axis="y" width="100%" height="100%">
        <Panel border="none" flexShrink={0} padding={0} paddingLeft={1}>
          <text fg={theme().text}>Diff </text>
          <text fg={theme().textMuted}>working tree</text>
          <box flexGrow={1} />
          <text fg={theme().textMuted}>
            {files().length} {files().length === 1 ? "file" : "files"}
          </text>
        </Panel>

        <box flexGrow={1} minHeight={0}>
          <Show when={files().length === 0} fallback={null}>
            <Separator axis="x" />
            <box flexGrow={1} paddingLeft={1}>
              <text fg={theme().textMuted}>No diff!</text>
            </box>
          </Show>
          <Show when={files().length > 0}>
            <PanelGroup axis="x">
              <Show when={showFileTree()}>
                <DiffViewerFileTree
                  files={files()}
                  loading={false}
                  error={undefined}
                  theme={theme()}
                  focused={focus() === "files"}
                  width={FILE_TREE_WIDTH}
                  highlightedPath={highlightedPath()}
                  selectedFileIndex={selectedFileIndex()}
                  reviewedFileNames={reviewedFileNames()}
                  collapsedDirPaths={collapsedDirPaths()}
                  onRowClick={clickFileTreeRow}
                />
              </Show>

              <Panel flexGrow={1} minHeight={0} border="none">
                <Separator axis="x" start={showFileTree() ? "edge-out" : undefined} />
                <scrollbox
                  ref={(element: ScrollBoxRenderable) => (scroll = element)}
                  flexGrow={1}
                  minHeight={0}
                  verticalScrollbarOptions={{ visible: false }}
                  horizontalScrollbarOptions={{ visible: false }}
                  scrollAcceleration={patchScrollAccel}
                >
                  <For each={visiblePatchFiles()}>
                    {(entry, index) => {
                      const reviewed = () => reviewedFileNames().has(entry.file.file)
                      return (
                        <box ref={(element: BoxRenderable) => registerPatchNode(entry.fileIndex, element)}>
                          {index() !== 0 ? <Separator axis="x" start={showFileTree() ? "edge" : undefined} /> : null}
                          <box
                            flexDirection="row"
                            gap={1}
                            flexShrink={0}
                            paddingLeft={1}
                            paddingRight={1}
                            border={patchLeftBorder()}
                            borderColor={theme().border}
                          >
                            <text fg={reviewed() ? theme().textMuted : theme().text}>{entry.file.file}</text>
                            <box flexGrow={1} />
                            <text fg={reviewed() ? theme().textMuted : theme().diffAdded}>
                              +{entry.file.additions}
                            </text>
                            <text fg={reviewed() ? theme().textMuted : theme().diffRemoved}>
                              -{entry.file.deletions}
                            </text>
                          </box>
                          <Separator axis="x" start={showFileTree() ? "edge" : undefined} />
                          <Show
                            when={entry.file.patch}
                            fallback={<text fg={theme().textMuted}>No patch available for this file.</text>}
                          >
                            {(patch) => (
                              <box border={patchLeftBorder()} borderColor={theme().border}>
                                <diff
                                  diff={patch()}
                                  view={view()}
                                  filetype={reviewed() ? PLAIN_TEXT_FILETYPE : filetype(entry.file.file)}
                                  syntaxStyle={themeState.syntax}
                                  showLineNumbers={true}
                                  width="100%"
                                  wrapMode="char"
                                  fg={reviewed() ? theme().textMuted : theme().text}
                                  addedBg={reviewed() ? theme().backgroundElement : theme().diffAddedBg}
                                  removedBg={reviewed() ? theme().backgroundElement : theme().diffRemovedBg}
                                  addedSignColor={reviewed() ? theme().textMuted : theme().diffHighlightAdded}
                                  removedSignColor={reviewed() ? theme().textMuted : theme().diffHighlightRemoved}
                                  lineNumberFg={theme().diffLineNumber}
                                  addedLineNumberBg={
                                    reviewed() ? theme().backgroundElement : theme().diffAddedLineNumberBg
                                  }
                                  removedLineNumberBg={
                                    reviewed() ? theme().backgroundElement : theme().diffRemovedLineNumberBg
                                  }
                                />
                              </box>
                            )}
                          </Show>
                        </box>
                      )
                    }}
                  </For>
                  <Show when={patchFillerHeight() > 0}>
                    <box height={patchFillerHeight()} border={patchLeftBorder()} borderColor={theme().border} />
                  </Show>
                </scrollbox>
                <Separator axis="x" start={showFileTree() ? "edge-in" : undefined} />
              </Panel>
            </PanelGroup>
          </Show>
        </box>

        <Panel flexShrink={0} gap={2} paddingLeft={1} border="none">
          <text fg={theme().text}>
            tab <span style={{ fg: theme().textMuted }}>focus file tree</span>
          </text>
          <text fg={theme().text}>
            n <span style={{ fg: theme().textMuted }}>next file</span>
          </text>
          <text fg={theme().text}>
            p <span style={{ fg: theme().textMuted }}>previous file</span>
          </text>
          <text fg={theme().text}>
            m <span style={{ fg: theme().textMuted }}>mark reviewed</span>
          </text>
          <text fg={theme().text}>
            ctrl+p <span style={{ fg: theme().textMuted }}>commands</span>
          </text>
          <text fg={theme().text}>
            ? <span style={{ fg: theme().textMuted }}>all</span>
          </text>
        </Panel>
      </PanelGroup>

      <Show when={paletteMode() === "commands"}>
        <Picker
          title="Commands"
          options={commandList.map((c) => ({ title: c.title, value: c.id }))}
          onSelect={(opt) => {
            if (opt.value === "theme.switch") openThemes()
          }}
          onClose={() => closePalette(true)}
        />
      </Show>
      <Show when={paletteMode() === "themes"}>
        <Picker
          title="Themes"
          options={listThemeNames().map((n) => ({ title: n, value: n }))}
          current={themeAtOpen()}
          onMove={(opt) => setActiveTheme(opt.value)}
          onSelect={(opt) => {
            setActiveTheme(opt.value)
            setPaletteMode(null)
          }}
          onClose={() => closePalette(true)}
        />
      </Show>

      <Show when={helpOpen()}>
        <box
          position="absolute"
          zIndex={3000}
          left={0}
          top={0}
          width={dimensions().width}
          height={dimensions().height}
          alignItems="center"
          paddingTop={Math.floor(dimensions().height / 4)}
          backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
          onMouseUp={() => setHelpOpen(false)}
        >
          <box
            width={Math.min(88, Math.max(50, dimensions().width - 4))}
            backgroundColor={theme().backgroundPanel}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={4}
            paddingRight={4}
            gap={1}
            onMouseUp={(e: { stopPropagation(): void }) => e.stopPropagation()}
          >
            <box flexDirection="row" justifyContent="space-between">
              <text attributes={TextAttributes.BOLD} fg={theme().text}>
                Diff shortcuts
              </text>
              <text fg={theme().textMuted} onMouseUp={() => setHelpOpen(false)}>
                esc
              </text>
            </box>
            <box flexDirection="row">
              <text fg={theme().textMuted} width={10} wrapMode="none">
                Key
              </text>
              <text fg={theme().textMuted} width={22} wrapMode="none">
                Action
              </text>
              <text fg={theme().textMuted}>Description</text>
            </box>
            <For each={HELP_ROWS}>
              {(row) => (
                <box flexDirection="row">
                  <text fg={theme().text} width={10} wrapMode="none">
                    {row.shortcut}
                  </text>
                  <text fg={theme().text} width={22} wrapMode="none">
                    {row.action}
                  </text>
                  <text fg={theme().textMuted}>{row.description}</text>
                </box>
              )}
            </For>
          </box>
        </box>
      </Show>
    </box>
  )
}

// Help dialog rows. Mirrors opencode's DiffViewerHelpDialog table — same columns,
// same descriptions — minus diff.switch_source (we don't have last-turn mode),
// plus our additions: r (reload), ctrl+p (commands), v (toggle view).
const HELP_ROWS = [
  { shortcut: "q", action: "Close viewer", description: "Quit the diff viewer" },
  {
    shortcut: "tab / t",
    action: "Focus file tree",
    description: "Move keyboard focus between the file tree and patch pane",
  },
  { shortcut: "n", action: "Next file", description: "Select the next changed file in file-tree order" },
  { shortcut: "p", action: "Previous file", description: "Select the previous changed file in file-tree order" },
  { shortcut: "t", action: "Toggle file tree", description: "Show or hide the file tree sidebar" },
  { shortcut: "s", action: "Toggle patches", description: "Switch between one selected patch and all patches" },
  { shortcut: "v", action: "Toggle view", description: "Switch between split and unified diff layout" },
  { shortcut: "e", action: "Expand all folders", description: "Open every folder in the file tree" },
  { shortcut: "m", action: "Mark reviewed", description: "Toggle reviewed state for the selected file" },
  { shortcut: "r", action: "Reload diff", description: "Re-run git diff to pick up changes" },
  { shortcut: "ctrl+p", action: "Commands", description: "Open the command palette" },
] as const
