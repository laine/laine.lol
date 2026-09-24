import Prism from "prismjs";
import { getStoredPrismTheme, loadPrismTheme } from "./prism-theme-utils";

// Import our CSS overrides (must be imported after the Prism theme is loaded)
import "../styles/prism-overrides.css";

// Initialize theme from localStorage (will be called when this module is imported)
if (typeof window !== "undefined") {
  const initialTheme = getStoredPrismTheme();
  loadPrismTheme(initialTheme);
}

import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-c";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-regex";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-php";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-java";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-scala";
import "prismjs/components/prism-go";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-lua";
import "prismjs/components/prism-haskell";
import "prismjs/components/prism-elixir";
import "prismjs/components/prism-erlang";
import "prismjs/components/prism-lisp";
import "prismjs/components/prism-pascal";
import "prismjs/components/prism-perl";
import "prismjs/components/prism-powershell";

export const highlightWithPrism = (code: string, language: string): string => {
  if (!code) return "";

  try {
    // Check if the language grammar exists
    if (Prism.languages[language]) {
      return Prism.highlight(code, Prism.languages[language], language);
    }

    return Prism.highlight(code, Prism.languages.javascript, "javascript");
  } catch (error) {
    console.error("Prism highlighting error:", error);
    return `<span>${code}</span>`;
  }
};

export default Prism;
