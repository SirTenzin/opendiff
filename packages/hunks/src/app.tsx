/** @jsxImportSource @opentui/solid */
import { createResource, onCleanup, onMount, Show } from "solid-js"
import { DiffViewer } from "./diff-viewer/diff-viewer"
import { getGitDiffs, getRepoRoot } from "./git"
import { watchRepo } from "./watch"

export function App(props: { onExit: () => void }) {
  const [diffs, { refetch }] = createResource(() => getGitDiffs(process.cwd()))

  onMount(async () => {
    const root = await getRepoRoot(process.cwd())
    if (!root) return
    const stop = watchRepo(root, () => void refetch())
    onCleanup(stop)
  })

  // Use diffs.latest (not diffs()) so a refetch keeps showing the previous
  // resolved diff instead of flickering back to the loading fallback. latest is
  // undefined only until the very first resolve, so initial load still shows it.
  return (
    <Show when={diffs.latest} fallback={<text>Loading diff...</text>}>
      {(resolved) => <DiffViewer diffs={resolved()} onExit={props.onExit} onReload={refetch} />}
    </Show>
  )
}
