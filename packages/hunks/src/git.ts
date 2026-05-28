import { spawn } from "node:child_process"

export interface DiffFile {
  file: string
  patch?: string
  additions: number
  deletions: number
  status: "added" | "deleted" | "modified"
}

function git(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { cwd })
    let stdout = ""
    let stderr = ""
    proc.stdout.on("data", (data) => {
      stdout += data
    })
    proc.stderr.on("data", (data) => {
      stderr += data
    })
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `git ${args.join(" ")} exited with code ${code}`))
        return
      }
      resolve(stdout)
    })
  })
}

export async function getRepoRoot(cwd: string): Promise<string | null> {
  try {
    return (await git(["rev-parse", "--show-toplevel"], cwd)).trim()
  } catch {
    return null
  }
}

export async function getGitDiffs(cwd: string): Promise<DiffFile[]> {
  const root = await getRepoRoot(cwd)
  if (root === null) return []

  const numstat = await git(["diff", "HEAD", "--numstat"], root)
  const nameStatus = await git(["diff", "HEAD", "--name-status"], root)

  const numstatMap = new Map<string, { additions: number; deletions: number }>()
  for (const line of numstat.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split("\t")
    if (parts.length < 3) continue
    const adds = parts[0] === "-" ? 0 : parseInt(parts[0], 10)
    const dels = parts[1] === "-" ? 0 : parseInt(parts[1], 10)
    const filePath = parts[2]
    numstatMap.set(filePath, { additions: isNaN(adds) ? 0 : adds, deletions: isNaN(dels) ? 0 : dels })
  }

  const statusMap = new Map<string, "added" | "deleted" | "modified">()
  for (const line of nameStatus.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split("\t")
    if (parts.length < 2) continue
    const statusCode = parts[0]
    const filePath = parts[1]
    const status: "added" | "deleted" | "modified" =
      statusCode === "A" ? "added" : statusCode === "D" ? "deleted" : "modified"
    statusMap.set(filePath, status)
  }

  const files = Array.from(statusMap.keys())
  const patches = new Map<string, string>()

  await Promise.all(
    files.map(async (file) => {
      try {
        const patch = await git(["diff", "HEAD", "-U12", "--", file], root)
        patches.set(file, patch)
      } catch {
        // Binary or no patch
      }
    }),
  )

  return files.map((file) => {
    const stat = numstatMap.get(file) ?? { additions: 0, deletions: 0 }
    return {
      file,
      patch: patches.get(file),
      additions: stat.additions,
      deletions: stat.deletions,
      status: statusMap.get(file) ?? "modified",
    }
  })
}
