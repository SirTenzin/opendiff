// Paths branch softly through the screen,
// A quiet tree of changed designs;
// Each leaf remembers what has been,
// And waits where careful light aligns.

export type FileTreeItem = {
  readonly file: string
  readonly status?: "added" | "deleted" | "modified"
}

export type FileTreeNode = {
  readonly id: number
  readonly name: string
  readonly path: string
  readonly parent: number | undefined
  readonly children: number[]
  readonly depth: number
  readonly kind: "directory" | "file"
  readonly fileIndex?: number
}

export type FileTree = {
  readonly roots: number[]
  readonly nodes: FileTreeNode[]
}

export type FileTreeRow = {
  readonly id: number
  readonly path: string
  readonly depth: number
  readonly kind: "directory" | "file"
  readonly name: string
  readonly fileIndex?: number
}

export function buildFileTree(files: readonly FileTreeItem[]): FileTree {
  const roots: number[] = []
  const nodes: FileTreeNode[] = []
  const directoryByPath = new Map<string, number>()

  files.forEach((file, fileIndex) => {
    const segments = file.file.split("/").filter(Boolean)
    if (segments.length === 0) return

    const parent = segments.slice(0, -1).reduce(
      (state, segment) => {
        const directoryPath = state.path ? `${state.path}/${segment}` : segment
        const existing = directoryByPath.get(directoryPath)
        if (existing !== undefined) return { id: existing, path: directoryPath, depth: state.depth + 1 }

        const id = addFileTreeNode(nodes, roots, {
          name: segment,
          path: directoryPath,
          parent: state.id,
          depth: state.depth,
          kind: "directory",
        })
        directoryByPath.set(directoryPath, id)
        return { id, path: directoryPath, depth: state.depth + 1 }
      },
      { id: undefined as number | undefined, path: "", depth: 0 },
    )

    const fileName = segments[segments.length - 1]!
    addFileTreeNode(nodes, roots, {
      name: fileName,
      path: parent.path ? `${parent.path}/${fileName}` : fileName,
      parent: parent.id,
      depth: parent.depth,
      kind: "file",
      fileIndex,
    })
  })

  const tree = { roots, nodes }
  tree.roots.sort((left, right) => compareFileTreeNodes(tree, left, right))
  tree.nodes.forEach((node) => node.children.sort((left, right) => compareFileTreeNodes(tree, left, right)))
  return tree
}

export function flattenFileTree(tree: FileTree, collapsed?: ReadonlySet<string>): FileTreeRow[] {
  const rows: FileTreeRow[] = []
  const visit = (id: number, depth: number) => {
    const node = tree.nodes[id]!
    if (node.kind === "file") {
      rows.push({
        id: node.id,
        path: node.path,
        depth,
        kind: node.kind,
        name: node.name,
        fileIndex: node.fileIndex,
      })
      return
    }

    const chain = collapsedFileTreeDirectoryChain(tree, node.id)
    const last = chain[chain.length - 1]!
    rows.push({
      id: node.id,
      path: node.path,
      depth,
      kind: node.kind,
      name: chain.map((item) => item.name).join("/"),
      fileIndex: node.fileIndex,
    })
    // Expanded unless explicitly collapsed: an empty set = everything expanded,
    // so directories an agent newly creates appear open by default.
    if (!collapsed || !collapsed.has(node.path)) last.children.forEach((child) => visit(child, depth + 1))
  }
  tree.roots.forEach((root) => visit(root, 0))
  return rows
}

function collapsedFileTreeDirectoryChain(tree: FileTree, id: number): FileTreeNode[] {
  const node = tree.nodes[id]!
  const child = node.children.length === 1 ? tree.nodes[node.children[0]!] : undefined
  if (child?.kind !== "directory") return [node]
  return [node, ...collapsedFileTreeDirectoryChain(tree, child.id)]
}

export function compareFileTreeNodes(tree: FileTree, left: number, right: number) {
  const leftNode = tree.nodes[left]!
  const rightNode = tree.nodes[right]!
  if (leftNode.kind !== rightNode.kind) return leftNode.kind === "directory" ? -1 : 1
  if (leftNode.name < rightNode.name) return -1
  if (leftNode.name > rightNode.name) return 1
  return left - right
}

export function moveFileTreeSelection(rows: readonly FileTreeRow[], currentPath: string | undefined, offset: number) {
  if (rows.length === 0) return undefined
  const index = currentPath === undefined ? -1 : rows.findIndex((row) => row.path === currentPath)
  if (index === -1) return rows[0]!.path
  return rows[Math.max(0, Math.min(rows.length - 1, index + offset))]!.path
}

export function moveFileTreeSelectionToFirstChild(rows: readonly FileTreeRow[], currentPath: string | undefined) {
  const index = currentPath === undefined ? -1 : rows.findIndex((row) => row.path === currentPath)
  const row = index === -1 ? undefined : rows[index]
  if (row?.kind !== "directory") return currentPath
  const child = rows[index + 1]
  return child && child.depth > row.depth ? child.path : currentPath
}

export function moveFileTreeSelectionToParent(rows: readonly FileTreeRow[], currentPath: string | undefined) {
  const index = currentPath === undefined ? -1 : rows.findIndex((row) => row.path === currentPath)
  const row = index === -1 ? undefined : rows[index]
  if (!row || row.depth === 0) return currentPath
  return rows.findLast((item, itemIndex) => itemIndex < index && item.depth < row.depth)?.path ?? currentPath
}

export function fileTreeFileSelection(tree: FileTree, fileIndex: number) {
  const node = tree.nodes.find((item) => item.kind === "file" && item.fileIndex === fileIndex)
  if (!node) return undefined
  return { path: node.path }
}

export function singlePatchFileIndex(
  selected: number | undefined,
  active: number | undefined,
  current: number | undefined,
  first: number | undefined,
) {
  return selected ?? active ?? current ?? first
}

export function orderedPatchFileIndexes(rows: readonly FileTreeRow[]) {
  return rows.flatMap((row) => (row.fileIndex === undefined ? [] : [row.fileIndex]))
}

export function showDiffViewerFileTree(showFileTree: boolean, fileCount: number) {
  return showFileTree && fileCount > 0
}

export function movePatchFileIndex(fileIndexes: readonly number[], current: number | undefined, offset: number) {
  if (fileIndexes.length === 0) return undefined
  const index = current === undefined ? -1 : fileIndexes.indexOf(current)
  if (index === -1) return fileIndexes[0]
  return fileIndexes[Math.max(0, Math.min(fileIndexes.length - 1, index + offset))]
}

export function toggleFileTreeDirectory(collapsed: ReadonlySet<string>, path: string | undefined) {
  if (path === undefined) return collapsed
  const next = new Set(collapsed)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  return next
}

export function setFileTreeDirectoryExpanded(
  collapsed: ReadonlySet<string>,
  path: string | undefined,
  shouldExpand: boolean,
) {
  if (path === undefined) return collapsed
  const next = new Set(collapsed)
  if (shouldExpand) next.delete(path)
  else next.add(path)
  return next
}

function addFileTreeNode(nodes: FileTreeNode[], roots: number[], input: Omit<FileTreeNode, "id" | "children">) {
  const id = nodes.length
  nodes.push({ ...input, id, children: [] })
  if (input.parent === undefined) roots.push(id)
  else nodes[input.parent]!.children.push(id)
  return id
}
