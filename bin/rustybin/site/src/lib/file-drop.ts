import { getLanguageFromExtension } from "@/utils/language-utils";

export interface DroppedFile {
  name: string;
  content: string;
  language: string;
  byteSize: number;
}

export interface FileDropResult {
  files: DroppedFile[];
  rejected: { name: string; reason: string }[];
}

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tiff", ".tif",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz", ".zst",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".mp3", ".mp4", ".avi", ".mov", ".mkv", ".flac", ".wav", ".ogg", ".webm",
  ".wasm", ".class", ".pyc", ".o", ".obj", ".a", ".lib",
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  ".sqlite", ".db",
]);

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) return "";
  return filename.slice(lastDot).toLowerCase();
}

function hasBinaryExtension(filename: string): boolean {
  return BINARY_EXTENSIONS.has(getExtension(filename));
}

async function containsNullBytes(file: File): Promise<boolean> {
  const sliceSize = Math.min(file.size, 8192);
  const slice = file.slice(0, sliceSize);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

export async function isBinaryFile(file: File): Promise<boolean> {
  if (hasBinaryExtension(file.name)) return true;
  if (file.size === 0) return false;
  return containsNullBytes(file);
}

export async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file, "utf-8");
  });
}

export function getLanguageForFile(filename: string): string {
  return getLanguageFromExtension(filename) ?? "none";
}

export async function processDroppedFiles(files: File[]): Promise<FileDropResult> {
  const result: FileDropResult = { files: [], rejected: [] };

  for (const file of files) {
    try {
      if (await isBinaryFile(file)) {
        result.rejected.push({ name: file.name, reason: "Binary file" });
        continue;
      }

      const content = await readTextFile(file);
      const byteSize = new TextEncoder().encode(content).length;
      const language = getLanguageForFile(file.name);

      result.files.push({ name: file.name, content, language, byteSize });
    } catch {
      result.rejected.push({ name: file.name, reason: "Failed to read file" });
    }
  }

  return result;
}
