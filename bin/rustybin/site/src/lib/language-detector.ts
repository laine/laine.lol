import hljs from "highlight.js";

/**
 * Maps highlight.js language names to our internal language names
 */
const languageMapping: Record<string, string> = {
  xml: "html",
  javascript: "javascript",
  typescript: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  python: "python",
  java: "java",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  csharp: "csharp",
  "c#": "csharp",
  rust: "rust",
  go: "go",
  bash: "bash",
  shell: "bash",
  sql: "sql",
  json: "json",
  yaml: "yaml",
  markdown: "markdown",
  css: "css",
};

/**
 * Available languages for syntax highlighting
 */
export const availableLanguages = {
  html: "HTML/XML",
  css: "CSS",
  javascript: "JavaScript",
  jsx: "JSX",
  typescript: "TypeScript",
  tsx: "TSX",
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  rust: "Rust",
  go: "Go",
  bash: "Bash",
  sql: "SQL",
  json: "JSON",
  yaml: "YAML",
  markdown: "Markdown",
};

/**
 * Interface for language suggestion with relevance score
 */
export interface LanguageSuggestion {
  language: string;
  displayName: string;
  relevance: number;
}

/**
 * Language-specific patterns to help with detection
 */
const languagePatterns = {
  markdown: [
    /^#{1,6}\s+\S/m, // headings: # Title, ## Subtitle, etc.
    /\[.+?\]\(.+?\)/, // links: [text](url)
    /^\s*[-*+]\s+\S/m, // unordered lists: - item, * item
    /^\s*\d+\.\s+\S/m, // ordered lists: 1. item
    /\*\*.+?\*\*/, // bold: **text**
    /^\s*>/m, // blockquotes: > text
    /```\w*\n[\s\S]*?```/, // fenced code blocks
    /^\|.+\|$/m, // tables: | col | col |
  ],
  rust: [
    /fn\s+\w+\s*\([^)]*\)\s*(\{|->)/, // fn keyword with function definition
    /impl\s+\w+/, // impl keyword
    /use\s+std::/, // use std:: imports
    /let\s+mut\s+\w+/, // let mut variable declarations
    /pub\s+(fn|struct|enum|trait)/, // pub keyword with rust types
    /match\s+\w+\s*\{/, // match expressions
  ],
  go: [
    /func\s+\w+\s*\([^)]*\)\s*(\{|[^{]*\{)/, // func keyword
    /package\s+\w+/, // package declaration
    /import\s+\(/, // import block
  ],
  typescript: [
    /interface\s+\w+/, // interface keyword
    /type\s+\w+\s*=/, // type alias
    /const\s+\w+:\s*\w+/, // typed constants
  ],
};

/**
 * Checks if code matches language-specific patterns
 * @param code The code to analyze
 * @param language The language to check patterns for
 * @returns True if the code matches patterns for the language
 */
function matchesLanguagePatterns(code: string, language: string): number {
  const patterns = languagePatterns[language as keyof typeof languagePatterns];
  if (!patterns) return 0;

  return patterns.filter((pattern) => pattern.test(code)).length;
}

/**
 * Gets top language suggestions based on highlight.js detection
 * @param code The code to analyze
 * @param maxSuggestions Maximum number of suggestions to return
 * @returns Array of language suggestions with relevance scores
 */
export function getLanguageSuggestions(
  code: string,
  maxSuggestions: number = 3
): LanguageSuggestion[] {
  if (!code || typeof code !== "string") {
    return [];
  }

  try {
    const languages = Object.keys(languageMapping);
    const result = hljs.highlightAuto(code, languages);

    // Create a list to store all detected languages with their relevance
    const suggestions: LanguageSuggestion[] = [];

    // Add pattern-matched languages with relevance scaled by match count
    for (const language of Object.keys(languagePatterns)) {
      const matchCount = matchesLanguagePatterns(code, language);
      if (matchCount > 0) {
        const mappedLanguage = language;
        const displayName =
          availableLanguages[
            mappedLanguage as keyof typeof availableLanguages
          ] || mappedLanguage;

        suggestions.push({
          language: mappedLanguage,
          displayName,
          relevance: 100 + matchCount * 50, // More matches = higher confidence
        });
      }
    }

    // Add the primary detected language if it exists
    if (result.language) {
      const mappedLanguage =
        languageMapping[result.language] || result.language;
      const displayName =
        availableLanguages[mappedLanguage as keyof typeof availableLanguages] ||
        mappedLanguage;

      // Check if this language is already in suggestions (from pattern matching)
      const existingIndex = suggestions.findIndex(
        (s) => s.language === mappedLanguage
      );

      if (existingIndex >= 0) {
        // Update relevance if it's higher
        if (result.relevance > suggestions[existingIndex].relevance) {
          suggestions[existingIndex].relevance = result.relevance;
        }
      } else {
        suggestions.push({
          language: mappedLanguage,
          displayName,
          relevance: result.relevance,
        });
      }
    }

    // Add second best language if it exists
    if (result.secondBest?.language) {
      const mappedLanguage =
        languageMapping[result.secondBest.language] ||
        result.secondBest.language;
      const displayName =
        availableLanguages[mappedLanguage as keyof typeof availableLanguages] ||
        mappedLanguage;

      // Check if this language is already in suggestions
      const existingIndex = suggestions.findIndex(
        (s) => s.language === mappedLanguage
      );

      if (existingIndex >= 0) {
        // Update relevance if it's higher
        if (
          result.secondBest.relevance > suggestions[existingIndex].relevance
        ) {
          suggestions[existingIndex].relevance = result.secondBest.relevance;
        }
      } else {
        suggestions.push({
          language: mappedLanguage,
          displayName,
          relevance: result.secondBest.relevance,
        });
      }
    }

    // Sort by relevance (highest first) and limit to maxSuggestions
    const sortedSuggestions = suggestions
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxSuggestions);

    return sortedSuggestions;
  } catch (error) {
    console.error("Error getting language suggestions:", error);
    return [];
  }
}

/**
 * Detects the programming language from code using highlight.js
 * and additional pattern matching
 * @param code The code to analyze
 * @returns The detected language key or 'unknown' if can't determine
 */
export function detectLanguage(code: string): string {
  if (!code || typeof code !== "string") {
    return "unknown";
  }

  // Get language suggestions
  const suggestions = getLanguageSuggestions(code);

  // Return the top suggestion if available
  if (suggestions.length > 0) {
    return suggestions[0].language;
  }

  return "unknown";
}

/**
 * Gets alternative language suggestions, excluding the primary detected language
 * @param code The code to analyze
 * @param maxAlternatives Maximum number of alternative suggestions to return
 * @returns Array of alternative language suggestions with relevance scores
 */
export function getAlternativeLanguageSuggestions(
  code: string,
  maxAlternatives: number = 2
): LanguageSuggestion[] {
  // Get all language suggestions
  const allSuggestions = getLanguageSuggestions(code, maxAlternatives + 1);

  // Remove the top suggestion (which is the primary detected language)
  if (allSuggestions.length > 1) {
    return allSuggestions.slice(1);
  }

  return [];
}

/**
 * Gets all available languages as options for manual selection
 * @returns Array of language options with language code and display name
 */
export function getAvailableLanguageOptions(): {
  value: string;
  label: string;
}[] {
  return Object.entries(availableLanguages).map(([language, displayName]) => ({
    value: language,
    label: displayName,
  }));
}
