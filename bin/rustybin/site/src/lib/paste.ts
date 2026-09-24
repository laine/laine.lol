import {
  decryptData, encryptData, generateEncryptionKey,
  generateQuantumEncryptionKey, quantumEncryptData, quantumDecryptData,
} from "./enc";
import { z } from "zod";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3000/v1";

// Zod schemas for validation
const PasteSchema = z.object({
  id: z.string().min(1),
  data: z.string(),
  language: z.string().default("plaintext"),
  createdAt: z.number().default(() => Date.now()),
  editKey: z.string().optional(),
});

// API response schema
const ApiPasteResponseSchema = z.object({
  id: z.string().min(1),
  data: z.string(),
  language: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => val || "plaintext"),
  created_at: z
    .union([
      z.number(),
      z.string().transform((val) => {
        const date = new Date(val);
        if (!isNaN(date.getTime())) return date.getTime();
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? Date.now() : parsed;
      }),
      z.null(),
      z.undefined(),
    ])
    .default(() => Date.now()),
  encryption_version: z.any().optional(),
  edit_key: z.string().optional(),
});

// TypeScript types derived from Zod schemas
type Paste = z.infer<typeof PasteSchema>;
type PartialPaste = Omit<Paste, "id" | "createdAt">;

// Key extraction result type
export interface KeyInfo {
  encryptionKey: string;
  editKey?: string;
  version?: 1 | 2;
}

// Error types for better UX
export class PasteError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "INVALID_KEY"
      | "NETWORK_ERROR"
      | "DECRYPTION_FAILED"
      | "VALIDATION_ERROR"
      | "FORBIDDEN"
      | "SERVER_ERROR"
  ) {
    super(message);
    this.name = "PasteError";
  }
}

function apiResponseToPaste(response: unknown): Paste {
  if (!response || typeof response !== "object") {
    throw new PasteError("Invalid API response", "SERVER_ERROR");
  }

  const validated = ApiPasteResponseSchema.parse(response);

  return {
    id: validated.id,
    data: validated.data,
    language: validated.language,
    createdAt: validated.created_at,
    editKey: validated.edit_key,
  };
}

export interface CreatePasteOptions {
  includeEditKey?: boolean;
  burnAfterRead?: boolean;
  expiresInMinutes?: number | null;
  quantumResistant?: boolean;
}

export async function createPaste(
  paste: Omit<PartialPaste, "editKey">,
  options: CreatePasteOptions = {}
): Promise<{ url: string; editKey?: string } | null> {
  const { includeEditKey = false, burnAfterRead = false, expiresInMinutes = null, quantumResistant = false } = options;

  try {
    // Validate input
    const validatedPaste = z
      .object({
        data: z.string().min(1, "Paste content cannot be empty"),
        language: z.string().default("plaintext"),
      })
      .parse(paste);

    let encryptionKey: string;
    let encryptedPaste: Omit<PartialPaste, "editKey">;

    if (quantumResistant) {
      const keyPair = await generateQuantumEncryptionKey();
      const result = await quantumEncryptData(validatedPaste.data, keyPair.encapsulationKey);
      encryptionKey = keyPair.decapsulationKey;
      encryptedPaste = { data: result.encryptedData, language: validatedPaste.language };
    } else {
      encryptionKey = await generateEncryptionKey();
      encryptedPaste = await encryptPaste(validatedPaste, encryptionKey);
    }

    // Build request body with optional advanced options
    const requestBody: Record<string, unknown> = {
      data: encryptedPaste.data,
      language: encryptedPaste.language,
    };

    // Only include advanced options if they're enabled
    if (burnAfterRead) {
      requestBody.burn_after_read = true;
    }
    if (expiresInMinutes !== null && expiresInMinutes > 0) {
      requestBody.expires_in_minutes = expiresInMinutes;
    }

    const response = await fetch(`${API_BASE_URL}/pastes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new PasteError(
        errorData.error || `Server error: ${response.status}`,
        response.status >= 500 ? "SERVER_ERROR" : "VALIDATION_ERROR"
      );
    }

    const data = await response.json();
    const convertedPaste = apiResponseToPaste(data);

    // Generate URL - only include edit key if requested
    const editKeyToInclude = includeEditKey ? convertedPaste.editKey : undefined;
    const url = generateUrlWithKey(convertedPaste.id, encryptionKey, editKeyToInclude, quantumResistant);

    return { url, editKey: convertedPaste.editKey };
  } catch (error) {
    if (error instanceof PasteError) throw error;
    console.error("Error creating paste:", error);
    throw new PasteError(
      error instanceof Error ? error.message : "Failed to create paste",
      "SERVER_ERROR"
    );
  }
}


export async function getPaste(id: string, key: string, version: 1 | 2 = 1): Promise<Paste> {
  // Validate inputs
  const validatedInputs = z
    .object({
      id: z.string().min(1, "Paste ID is required"),
      key: z.string().min(10, "Decryption key is too short"),
    })
    .safeParse({ id, key });

  if (!validatedInputs.success) {
    throw new PasteError("Invalid key format", "INVALID_KEY");
  }

  const response = await fetch(`${API_BASE_URL}/pastes/${id}`);

  if (response.status === 404) {
    throw new PasteError("Paste not found", "NOT_FOUND");
  }

  if (!response.ok) {
    throw new PasteError(`Server error: ${response.status}`, "SERVER_ERROR");
  }

  const data = await response.json();

  if (!data?.id || typeof data.data !== "string") {
    throw new PasteError("Invalid paste data from server", "SERVER_ERROR");
  }

  const paste = apiResponseToPaste(data);

  try {
    let decrypted: PartialPaste;
    if (version === 2) {
      const data = await quantumDecryptData(paste.data, key);
      decrypted = { data, language: paste.language };
    } else {
      decrypted = await decryptPaste(paste, key);
    }
    return {
      ...decrypted,
      id: paste.id,
      createdAt: paste.createdAt,
    };
  } catch {
    throw new PasteError(
      "Failed to decrypt. The key may be invalid or corrupted.",
      "DECRYPTION_FAILED"
    );
  }
}

export async function updatePaste(
  id: string,
  paste: Omit<PartialPaste, "editKey">,
  encryptionKey: string,
  editKey: string
): Promise<boolean> {
  // Validate inputs
  const validatedData = z
    .object({
      id: z.string().min(6),
      data: z.string().min(1),
      language: z.string().default("plaintext"),
      encryptionKey: z.string().min(10),
      editKey: z.string().min(1),
    })
    .safeParse({ id, ...paste, encryptionKey, editKey });

  if (!validatedData.success) {
    throw new PasteError("Invalid update data", "VALIDATION_ERROR");
  }

  // Encrypt the new content
  const encryptedPaste = await encryptPaste(paste, encryptionKey);

  const response = await fetch(`${API_BASE_URL}/pastes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: encryptedPaste.data,
      language: encryptedPaste.language,
      edit_key: editKey,
    }),
  });

  if (response.status === 404) {
    throw new PasteError("Paste not found", "NOT_FOUND");
  }

  if (response.status === 403) {
    throw new PasteError("Invalid edit key", "FORBIDDEN");
  }

  if (!response.ok) {
    throw new PasteError(`Server error: ${response.status}`, "SERVER_ERROR");
  }

  return true;
}

export async function deletePaste(
  id: string,
  editKey: string
): Promise<boolean> {
  // Validate inputs
  const validatedData = z
    .object({
      id: z.string().min(6),
      editKey: z.string().min(1),
    })
    .safeParse({ id, editKey });

  if (!validatedData.success) {
    throw new PasteError("Invalid delete data", "VALIDATION_ERROR");
  }

  const response = await fetch(`${API_BASE_URL}/pastes/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      edit_key: editKey,
    }),
  });

  if (response.status === 404) {
    throw new PasteError("Paste not found", "NOT_FOUND");
  }

  if (response.status === 403) {
    throw new PasteError("Invalid edit key", "FORBIDDEN");
  }

  if (!response.ok) {
    throw new PasteError(`Server error: ${response.status}`, "SERVER_ERROR");
  }

  return true;
}

export async function encryptPaste(
  paste: Omit<PartialPaste, "editKey">,
  keyString: string
): Promise<Omit<PartialPaste, "editKey">> {
  const validatedData = z
    .object({
      paste: z.object({
        data: z.string().min(1),
        language: z.string().default("plaintext"),
      }),
      key: z.string().min(10),
    })
    .parse({ paste, key: keyString });

  const encryptedData = await encryptData(validatedData.paste.data, validatedData.key);

  return {
    data: encryptedData,
    language: validatedData.paste.language,
  };
}

export async function decryptPaste(
  encryptedPaste: PartialPaste,
  keyString: string
): Promise<PartialPaste> {
  const validatedData = z
    .object({
      paste: z.object({
        data: z.string().min(1),
        language: z.string().default("plaintext"),
      }),
      key: z
        .string()
        .min(10)
        .regex(/^[A-Za-z0-9+/=]+$/, "Invalid key format"),
    })
    .parse({
      paste: { data: encryptedPaste.data, language: encryptedPaste.language },
      key: keyString,
    });

  const data = await decryptData(validatedData.paste.data, validatedData.key);

  return {
    data,
    language: validatedData.paste.language,
  };
}

/**
 * Generates a shareable URL with the encryption key in the fragment (#).
 * 
 * SECURITY NOTE: Browsers never send the fragment part of a URL to the server
 * during HTTP requests. By storing the encryption key here, we ensure that
 * the Rustybin server never sees the plaintext decryption key, maintaining
 * a zero-knowledge architecture.
 */
export function generateUrlWithKey(pasteId: string, encryptionKey: string, editKey?: string, quantum?: boolean): string {
  // Convert to base64url format
  const base64urlKey = encryptionKey
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Build the hash with combined keys if edit key is provided
  const prefix = quantum ? "q:" : "";
  let hash = prefix + encodeURIComponent(base64urlKey);

  if (editKey) {
    hash += ":" + encodeURIComponent(editKey);
  }

  return `${pasteId}#${hash}`;
}

export function extractKeyFromUrl(): KeyInfo | null {
  try {
    const url = new URL(window.location.href);

    if (!url.hash || url.hash === "#") {
      return null;
    }

    let hashContent = url.hash.substring(1);

    if (!hashContent.trim()) {
      return null;
    }

    // Detect quantum prefix
    let version: 1 | 2 = 1;
    if (hashContent.startsWith("q:")) {
      version = 2;
      hashContent = hashContent.substring(2);
    }

    // Split by colon to get encryption key and optional edit key
    const parts = hashContent.split(":");
    const encodedEncryptionKey = parts[0];
    const encodedEditKey = parts[1];

    // Decode encryption key
    const decodedKey = decodeURIComponent(encodedEncryptionKey);

    if (decodedKey.length < 10) {
      return null;
    }

    // Convert from base64url to standard base64
    let standardBase64 = decodedKey.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if needed
    const paddingNeeded = standardBase64.length % 4;
    if (paddingNeeded > 0) {
      standardBase64 += "=".repeat(4 - paddingNeeded);
    }

    // Validate base64 format
    if (!/^[A-Za-z0-9+/=]+$/.test(standardBase64)) {
      return null;
    }

    const result: KeyInfo = { encryptionKey: standardBase64, version };

    // Decode edit key if present
    if (encodedEditKey) {
      result.editKey = decodeURIComponent(encodedEditKey);
    }

    return result;
  } catch {
    return null;
  }
}
