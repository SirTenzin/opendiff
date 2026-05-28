import fs from "node:fs"
import path from "node:path"

// Debounce window: coalesce a burst of filesystem events (e.g. an agent writing
// several files in quick succession) into a single refresh.
const DEBOUNCE_MS = 150

// Returns true if a filesystem change at `relativePath` should be ignored
// (i.e. it does not affect `git diff HEAD`).
function shouldIgnore(relativePath: string): boolean {
  if (!relativePath) return true
  const segments = relativePath.split(path.sep).filter(Boolean)
  if (segments.includes("node_modules")) return true

  // Inside .git, almost everything is noise (object writes, lock files, logs).
  // Only a handful of paths signal a change to `git diff HEAD`: the current
  // commit/branch moving (HEAD, ORIG_HEAD, MERGE_HEAD), the staging index, and
  // anything under refs/ (commits, branch switches, stashes, tags).
  const gitIndex = segments.indexOf(".git")
  if (gitIndex !== -1) {
    const inner = segments.slice(gitIndex + 1)
    if (inner.length === 0) return true
    const first = inner[0]!
    const allowedFiles = new Set(["HEAD", "ORIG_HEAD", "MERGE_HEAD", "index"])
    if (allowedFiles.has(first)) return false
    if (first === "refs") return false
    return true
  }

  return false
}

// Watch the working tree (including .git) for changes that affect `git diff HEAD`
// and invoke `onChange` (debounced) when one occurs. Returns a cleanup function.
export function watchRepo(root: string, onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let watcher: fs.FSWatcher | undefined

  const fire = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      onChange()
    }, DEBOUNCE_MS)
  }

  try {
    watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
      // filename may be null on some platforms; treat as a generic change.
      const relative = filename == null ? "" : filename.toString()
      if (relative && shouldIgnore(relative)) return
      fire()
    })
  } catch {
    // Recursive watch is not supported on every platform/filesystem. Degrade
    // gracefully to a no-op rather than crashing the app.
    return () => {}
  }

  return () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    watcher?.close()
  }
}
