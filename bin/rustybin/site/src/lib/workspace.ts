import { decryptData, encryptData, generateEncryptionKey } from "./enc";
import { z } from "zod";
import {
  WorkspaceBundle,
  WorkspaceBundleSchema,
  validateBundle,
} from "./workspace-types";
import { PasteError } from "./paste";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:3000/v1";

/** API response schema for workspace creation */
const CreateWorkspaceResponseSchema = z.object({
  id: z.string().min(1),
  edit_key: z.string(),
  created_at: z.string(),
  burn_after_read: z.boolean(),
  expires_at: z.string().nullable(),
});

/** API response schema for workspace retrieval */
const GetWorkspaceResponseSchema = z.object({
  id: z.string().min(1),
  data: z.string(),
  created_at: z.string(),
  encryption_version: z.number(),
  burn_after_read: z.boolean(),
  expires_at: z.string().nullable(),
});

export interface CreateWorkspaceOptions {
  burnAfterRead?: boolean;
  expiresInMinutes?: number | null;
}

export interface WorkspaceResult {
  url: string;
  readOnlyUrl: string;
  editKey: string;
}

/** Encode a workspace bundle: serialize to JSON then encrypt */
export async function encodeBundle(
  bundle: WorkspaceBundle,
  encryptionKey: string
): Promise<string> {
  const validation = validateBundle(bundle);
  if (!validation.valid) {
    throw new PasteError(
      validation.error ?? "Invalid bundle",
      "VALIDATION_ERROR"
    );
  }
  const json = JSON.stringify(bundle);
  return encryptData(json, encryptionKey);
}

/** Decode a workspace bundle: decrypt then parse and validate JSON */
export async function decodeBundle(
  encryptedData: string,
  encryptionKey: string
): Promise<WorkspaceBundle> {
  let json: string;
  try {
    json = await decryptData(encryptedData, encryptionKey);
  } catch {
    throw new PasteError(
      "Failed to decrypt workspace. The key may be invalid.",
      "DECRYPTION_FAILED"
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new PasteError("Corrupted workspace data", "SERVER_ERROR");
  }

  const result = WorkspaceBundleSchema.safeParse(parsed);
  if (!result.success) {
    throw new PasteError("Invalid workspace bundle format", "VALIDATION_ERROR");
  }

  return result.data;
}

/** Create a new encrypted workspace */
export async function createWorkspace(
  bundle: WorkspaceBundle,
  options: CreateWorkspaceOptions = {}
): Promise<WorkspaceResult> {
  const { burnAfterRead = false, expiresInMinutes = null } = options;

  const encryptionKey = await generateEncryptionKey();
  const encryptedData = await encodeBundle(bundle, encryptionKey);

  const requestBody: Record<string, unknown> = { data: encryptedData };
  if (burnAfterRead) requestBody.burn_after_read = true;
  if (expiresInMinutes !== null && expiresInMinutes > 0) {
    requestBody.expires_in_minutes = expiresInMinutes;
  }

  const response = await fetch(`${API_BASE_URL}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new PasteError(
      (errorData as Record<string, string>).error ??
        `Server error: ${response.status}`,
      response.status >= 500 ? "SERVER_ERROR" : "VALIDATION_ERROR"
    );
  }

  const data = await response.json();
  const validated = CreateWorkspaceResponseSchema.parse(data);

  const base64urlKey = encryptionKey
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const encodedKey = encodeURIComponent(base64urlKey);
  const encodedEditKey = encodeURIComponent(validated.edit_key);

  return {
    url: `/w/${validated.id}#${encodedKey}:${encodedEditKey}`,
    readOnlyUrl: `/w/${validated.id}#${encodedKey}`,
    editKey: validated.edit_key,
  };
}

/** Retrieve and decrypt a workspace */
export async function getWorkspace(
  id: string,
  encryptionKey: string
): Promise<{
  bundle: WorkspaceBundle;
  burnAfterRead: boolean;
  expiresAt: string | null;
}> {
  const response = await fetch(`${API_BASE_URL}/workspaces/${id}`);

  if (response.status === 404) {
    throw new PasteError(
      "Workspace not found or has expired",
      "NOT_FOUND"
    );
  }

  if (!response.ok) {
    throw new PasteError(
      `Server error: ${response.status}`,
      "SERVER_ERROR"
    );
  }

  const data = await response.json();
  const validated = GetWorkspaceResponseSchema.parse(data);

  const bundle = await decodeBundle(validated.data, encryptionKey);

  return {
    bundle,
    burnAfterRead: validated.burn_after_read,
    expiresAt: validated.expires_at,
  };
}

/** Update a workspace (atomic replace) */
export async function updateWorkspace(
  id: string,
  bundle: WorkspaceBundle,
  encryptionKey: string,
  editKey: string
): Promise<boolean> {
  const encryptedData = await encodeBundle(bundle, encryptionKey);

  const response = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: encryptedData, edit_key: editKey }),
  });

  if (response.status === 404) {
    throw new PasteError("Workspace not found", "NOT_FOUND");
  }
  if (response.status === 403) {
    throw new PasteError("Invalid edit key", "FORBIDDEN");
  }
  if (!response.ok) {
    throw new PasteError(
      `Server error: ${response.status}`,
      "SERVER_ERROR"
    );
  }

  return true;
}

/** Delete a workspace */
export async function deleteWorkspace(
  id: string,
  editKey: string
): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edit_key: editKey }),
  });

  if (response.status === 404) {
    throw new PasteError("Workspace not found", "NOT_FOUND");
  }
  if (response.status === 403) {
    throw new PasteError("Invalid edit key", "FORBIDDEN");
  }
  if (!response.ok) {
    throw new PasteError(
      `Server error: ${response.status}`,
      "SERVER_ERROR"
    );
  }

  return true;
}

/** Extract workspace encryption key and optional edit key from URL fragment */
export function extractWorkspaceKeyFromUrl(): {
  encryptionKey: string;
  editKey?: string;
} | null {
  try {
    const hash = window.location.hash;
    if (!hash || hash === "#") return null;

    const content = hash.substring(1);
    if (!content.trim()) return null;

    const parts = content.split(":");
    const decodedKey = decodeURIComponent(parts[0]);

    if (decodedKey.length < 10) return null;

    // Convert base64url to standard base64
    let key = decodedKey.replace(/-/g, "+").replace(/_/g, "/");
    const padding = key.length % 4;
    if (padding > 0) key += "=".repeat(4 - padding);

    if (!/^[A-Za-z0-9+/=]+$/.test(key)) return null;

    const result: { encryptionKey: string; editKey?: string } = {
      encryptionKey: key,
    };

    if (parts[1]) {
      result.editKey = decodeURIComponent(parts[1]);
    }

    return result;
  } catch {
    return null;
  }
}
