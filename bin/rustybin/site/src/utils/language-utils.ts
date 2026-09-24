import { z } from "zod";

/** Zod schema for a language option */
const LanguageOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export type LanguageOption = z.infer<typeof LanguageOptionSchema>;

export const unsortedLanguageOptions: LanguageOption[] = [
  { value: "rust", label: "rust" },
  { value: "javascript", label: "javascript" },
  { value: "jsx", label: "jsx" },
  { value: "typescript", label: "typescript" },
  { value: "tsx", label: "tsx" },
  { value: "python", label: "python" },
  { value: "html", label: "html" },
  { value: "css", label: "css" },
  { value: "json", label: "json" },
  { value: "c", label: "c" },
  { value: "cpp", label: "c++" },
  { value: "csharp", label: "c#" },
  { value: "regex", label: "regex" },
  { value: "bash", label: "bash" },
  { value: "elixir", label: "elixir" },
  { value: "erlang", label: "erlang" },
  { value: "haskell", label: "haskell" },
  { value: "graphql", label: "graphql" },
  { value: "kotlin", label: "kotlin" },
  { value: "lua", label: "lua" },
  { value: "markdown", label: "markdown" },
  { value: "php", label: "php" },
  { value: "ruby", label: "ruby" },
  { value: "scala", label: "scala" },
  { value: "sql", label: "sql" },
  { value: "swift", label: "swift" },
  { value: "yaml", label: "yaml" },
  { value: "java", label: "java" },
  { value: "lisp", label: "lisp" },
  { value: "odin", label: "odin" },
  { value: "pascal", label: "pascal" },
  { value: "perl", label: "perl" },
  { value: "powershell", label: "powershell" },
];

export const languageOptions = [...unsortedLanguageOptions].sort((a, b) =>
  a.label.localeCompare(b.label)
);

// Map language to Prism language identifier
export const getPrismLanguage = (lang: string): string => {
  const languageMap: Record<string, string> = {
    rust: "rust",
    cpp: "cpp",
    c: "c",
    js: "javascript",
    javascript: "javascript",
    jsx: "jsx",
    ts: "typescript",
    typescript: "typescript",
    tsx: "tsx",
    html: "markup",
    xml: "markup",
    css: "css",
    py: "python",
    python: "python",
    json: "json",
    regex: "regex",
    bash: "bash",
    elixir: "elixir",
    erlang: "erlang",
    haskell: "haskell",
    graphql: "graphql",
    kotlin: "kotlin",
    csharp: "csharp",
    lua: "lua",
    markdown: "markdown",
    php: "php",
    ruby: "ruby",
    scala: "scala",
    sql: "sql",
    swift: "swift",
    yaml: "yaml",
    java: "java",
    lisp: "lisp",
    odin: "odin",
    pascal: "pascal",
    perl: "perl",
    powershell: "powershell",
  };

  return languageMap[lang.toLowerCase()] || "none";
};

/** Map file extension to language identifier for auto-detection */
const extensionToLanguage: Record<string, string> = {
  ".rs": "rust",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".py": "python",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c": "c",
  ".h": "c",
  ".hpp": "cpp",
  ".go": "go",
  ".java": "java",
  ".md": "markdown",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".html": "html",
  ".css": "css",
  ".sql": "sql",
  ".sh": "bash",
  ".bash": "bash",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".cs": "csharp",
  ".lua": "lua",
  ".scala": "scala",
  ".hs": "haskell",
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".pl": "perl",
  ".ps1": "powershell",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".xml": "html",
  ".toml": "yaml",
  ".ini": "yaml",
  ".txt": "none",
};

/**
 * Detect language from a file name's extension.
 * Returns the language identifier or null if no match.
 */
export const getLanguageFromExtension = (filename: string): string | null => {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) return null;
  const ext = filename.slice(lastDot).toLowerCase();
  return extensionToLanguage[ext] ?? null;
};

export const getLanguageLabel = (lang: string): string => {
  const option = languageOptions.find(
    (opt) => opt.value === getPrismLanguage(lang).replace("markup", "html")
  );

  return option?.label || "none";
};
