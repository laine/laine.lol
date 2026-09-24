import { z } from "zod";

/** Schema for a workspace file node */
const WorkspaceFileSchema = z.object({
  type: z.literal("file"),
  name: z.string().min(1).max(255),
  language: z.string(),
  content: z.string(),
});

/** Recursive schema for workspace tree nodes (files and folders) */
const WorkspaceNodeSchema: z.ZodType<WorkspaceNode> = z.lazy(() =>
  z.union([
    WorkspaceFileSchema,
    z.object({
      type: z.literal("folder"),
      name: z.string().min(1).max(255),
      children: z.array(WorkspaceNodeSchema),
    }),
  ])
);

/** Schema for the complete workspace bundle */
export const WorkspaceBundleSchema = z.object({
  version: z.literal(1),
  tree: z.array(WorkspaceNodeSchema).min(1),
});

/** A single file in the workspace */
export interface WorkspaceFile {
  type: "file";
  name: string;
  language: string;
  content: string;
}

/** A folder containing files and sub-folders */
export interface WorkspaceFolder {
  type: "folder";
  name: string;
  children: WorkspaceNode[];
}

/** Any node in the workspace tree */
export type WorkspaceNode = WorkspaceFile | WorkspaceFolder;

/** The complete workspace bundle (plaintext, before encryption) */
export interface WorkspaceBundle {
  version: 1;
  tree: WorkspaceNode[];
}

/** Max files allowed in a workspace */
export const MAX_WORKSPACE_FILES = 20;

/** Max folder nesting depth */
export const MAX_FOLDER_DEPTH = 3;

/** Max bundle size in bytes (before encryption) */
export const MAX_BUNDLE_SIZE = 200_000;

/** Count total files in a tree (folders don't count) */
export function countFiles(nodes: WorkspaceNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "file") {
      count++;
    } else {
      count += countFiles(node.children);
    }
  }
  return count;
}

/** Get max folder depth in a tree */
export function getMaxDepth(nodes: WorkspaceNode[], current: number = 0): number {
  let max = current;
  for (const node of nodes) {
    if (node.type === "folder") {
      const depth = getMaxDepth(node.children, current + 1);
      if (depth > max) max = depth;
    }
  }
  return max;
}

/** Validate a workspace bundle against all constraints */
export function validateBundle(bundle: WorkspaceBundle): { valid: boolean; error?: string } {
  const parseResult = WorkspaceBundleSchema.safeParse(bundle);
  if (!parseResult.success) {
    return { valid: false, error: "Invalid bundle structure" };
  }

  const fileCount = countFiles(bundle.tree);
  if (fileCount > MAX_WORKSPACE_FILES) {
    return { valid: false, error: `Too many files: ${fileCount} (maximum: ${MAX_WORKSPACE_FILES})` };
  }

  const depth = getMaxDepth(bundle.tree);
  if (depth > MAX_FOLDER_DEPTH) {
    return { valid: false, error: `Folder nesting too deep: ${depth} levels (maximum: ${MAX_FOLDER_DEPTH})` };
  }

  const serialized = JSON.stringify(bundle);
  const byteSize = new TextEncoder().encode(serialized).length;
  if (byteSize > MAX_BUNDLE_SIZE) {
    return { valid: false, error: `Bundle too large: ${byteSize} bytes (maximum: ${MAX_BUNDLE_SIZE})` };
  }

  return { valid: true };
}

/** Create an empty workspace bundle with one untitled file */
export function createEmptyBundle(): WorkspaceBundle {
  return {
    version: 1,
    tree: [
      {
        type: "file",
        name: "untitled.txt",
        language: "none",
        content: "",
      },
    ],
  };
}
