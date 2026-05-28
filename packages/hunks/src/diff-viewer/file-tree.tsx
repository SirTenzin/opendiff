/** @jsxImportSource @opentui/solid */
import type { ColorInput, RGBA, ScrollBoxRenderable } from "@opentui/core"
import { tint } from "../theme"
import { createEffect, createMemo, For, Match, Switch } from "solid-js"
import { buildFileTree, flattenFileTree, type FileTreeItem, type FileTreeRow } from "./file-tree-utils"
import { Panel } from "./layout"

const FILE_TREE_STATUS_WIDTH = 2

export type DiffViewerFileTreeTheme = {
  readonly background: RGBA
  readonly backgroundPanel: ColorInput
  readonly backgroundElement: ColorInput
  readonly primary: ColorInput
  readonly secondary: ColorInput
  readonly selectedListItemText: ColorInput
  readonly text: RGBA
  readonly textMuted: RGBA
  readonly error: ColorInput
}

export type DiffViewerFileTreeProps = {
  readonly width: number
  readonly files: readonly FileTreeItem[]
  readonly loading: boolean
  readonly error: unknown
  readonly theme: DiffViewerFileTreeTheme
  readonly focused?: boolean
  readonly highlightedPath?: string
  readonly selectedFileIndex?: number
  readonly reviewedFileNames?: ReadonlySet<string>
  readonly collapsedDirPaths?: ReadonlySet<string>
  readonly onRowClick?: (row: FileTreeRow) => void
}

export function DiffViewerFileTree(props: DiffViewerFileTreeProps) {
  const tree = createMemo(() => buildFileTree(props.files))
  const rows = createMemo(() => flattenFileTree(tree(), props.collapsedDirPaths))
  let scroll: ScrollBoxRenderable | undefined

  createEffect(() => {
    const path = props.highlightedPath
    if (path === undefined) return
    const selectedIndex = rows().findIndex((row) => row.path === path)
    if (selectedIndex === -1) return
    const scrollSelectedIntoView = () => scrollFileTreeRowIntoView(scroll, selectedIndex)
    scrollSelectedIntoView()
    requestAnimationFrame(scrollSelectedIntoView)
  })

  const fadedColor = () => tint(props.theme.text, props.theme.background, 0.75)

  return (
    <Panel border="both" width={props.width}>
      <scrollbox
        ref={(element: ScrollBoxRenderable) => (scroll = element)}
        verticalScrollbarOptions={{ visible: false }}
        horizontalScrollbarOptions={{ visible: false }}
      >
        <Switch>
          <Match when={props.loading || props.error}>
            <text />
          </Match>
          <Match when={props.files.length === 0}>
            <text fg={props.theme.text}>No files</text>
          </Match>
          <Match when={props.files.length > 0}>
            <For each={rows()}>
              {(row, index) => {
                const highlighted = () => props.focused && props.highlightedPath === row.path
                const selected = () => row.fileIndex !== undefined && props.selectedFileIndex === row.fileIndex
                const reviewed = () => {
                  const file = row.fileIndex === undefined ? undefined : props.files[row.fileIndex]?.file
                  return file !== undefined && (props.reviewedFileNames?.has(file) ?? false)
                }
                const prefix = () => fileTreeRowPrefix(rows(), index(), row, props.collapsedDirPaths)
                const status = () => fileTreeRowStatus(row, props.files, reviewed())
                const name = () =>
                  truncate(row.name, Math.max(1, props.width - FILE_TREE_STATUS_WIDTH - prefix().length))
                return (
                  <box
                    flexDirection="row"
                    width="100%"
                    backgroundColor={highlighted() ? props.theme.primary : undefined}
                    onMouseUp={() => props.onRowClick?.(row)}
                  >
                    <text fg={highlighted() ? props.theme.background : fadedColor()} wrapMode="none" flexShrink={0}>
                      {prefix()}
                    </text>
                    <box flexGrow={1} minWidth={0}>
                      <text
                        fg={
                          highlighted()
                            ? props.theme.background
                            : selected()
                              ? props.theme.primary
                              : reviewed() || row.kind === "directory"
                                ? props.theme.textMuted
                                : props.theme.text
                        }
                        wrapMode="none"
                      >
                        {name()}
                      </text>
                    </box>
                    <text
                      fg={highlighted() ? props.theme.background : props.theme.textMuted}
                      wrapMode="none"
                      flexShrink={0}
                    >
                      {status()}
                    </text>
                  </box>
                )
              }}
            </For>
          </Match>
        </Switch>
      </scrollbox>
    </Panel>
  )
}

function scrollFileTreeRowIntoView(scroll: ScrollBoxRenderable | undefined, index: number) {
  if (!scroll) return
  if (index < scroll.scrollTop) {
    scroll.scrollTo(index)
    return
  }
  if (index >= scroll.scrollTop + scroll.viewport.height) {
    scroll.scrollTo(index - scroll.viewport.height + 1)
  }
}

function fileTreeRowPrefix(
  rows: readonly FileTreeRow[],
  index: number,
  row: FileTreeRow,
  collapsedDirPaths: ReadonlySet<string> | undefined,
) {
  const indentation = Array.from({ length: row.depth }, (_, depth) => {
    if (depth === 0 && !hasLaterSibling(rows, 0, 0)) return " "
    return hasLaterSibling(rows, index, depth) ? "│  " : "   "
  }).join("")
  const topRoot = index === 0 && row.depth === 0
  const branch = topRoot ? " " : hasLaterSibling(rows, index, row.depth) ? "├─ " : "└─ "
  const marker = row.kind === "directory" ? (collapsedDirPaths?.has(row.path) ? "▸ " : "▾ ") : ""

  return `${indentation}${branch}${marker}`
}

function hasLaterSibling(rows: readonly FileTreeRow[], index: number, depth: number) {
  return rows.slice(index + 1).find((row) => row.depth <= depth)?.depth === depth
}

function fileTreeRowStatus(row: FileTreeRow, files: readonly FileTreeItem[], reviewed: boolean) {
  if (row.fileIndex === undefined) return ""
  const status = files[row.fileIndex]?.status
  const marker = status === "modified" ? "M" : status === "added" ? "A" : status === "deleted" ? "D" : "?"
  return `${reviewed ? "✓" : " "}${marker}`.padStart(FILE_TREE_STATUS_WIDTH)
}

function truncate(input: string, maxLength: number) {
  if (input.length <= maxLength) return input
  if (maxLength <= 3) return input.slice(0, maxLength)
  return input.slice(0, maxLength - 3) + "..."
}
