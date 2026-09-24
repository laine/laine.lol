export type InsertResult = {
  newText: string;
  newSelStart: number;
  newSelEnd: number;
};

export function applyInlineFormat(
  text: string,
  selStart: number,
  selEnd: number,
  prefix: string,
  suffix: string,
): InsertResult {
  const before = text.substring(0, selStart);
  const selected = text.substring(selStart, selEnd);
  const after = text.substring(selEnd);

  if (selected) {
    const newText = before + prefix + selected + suffix + after;
    return {
      newText,
      newSelStart: selStart + prefix.length,
      newSelEnd: selEnd + prefix.length,
    };
  }

  const placeholder = "text";
  const newText = before + prefix + placeholder + suffix + after;
  return {
    newText,
    newSelStart: selStart + prefix.length,
    newSelEnd: selStart + prefix.length + placeholder.length,
  };
}

export function applyLineFormat(
  text: string,
  selStart: number,
  prefix: string,
): InsertResult {
  const lineStart = text.lastIndexOf("\n", selStart - 1) + 1;
  const lineEnd = text.indexOf("\n", selStart);
  const end = lineEnd === -1 ? text.length : lineEnd;
  const line = text.substring(lineStart, end);

  if (line.startsWith(prefix)) {
    const newText = text.substring(0, lineStart) + line.substring(prefix.length) + text.substring(end);
    return {
      newText,
      newSelStart: Math.max(lineStart, selStart - prefix.length),
      newSelEnd: Math.max(lineStart, selStart - prefix.length),
    };
  }

  const newText = text.substring(0, lineStart) + prefix + line + text.substring(end);
  return {
    newText,
    newSelStart: selStart + prefix.length,
    newSelEnd: selStart + prefix.length,
  };
}

export function applyBlockFormat(
  text: string,
  selStart: number,
  selEnd: number,
  before: string,
  after: string,
): InsertResult {
  const prefix = text.substring(0, selStart);
  const selected = text.substring(selStart, selEnd);
  const suffix = text.substring(selEnd);

  const needsNewlineBefore = prefix.length > 0 && !prefix.endsWith("\n");
  const needsNewlineAfter = suffix.length > 0 && !suffix.startsWith("\n");

  const nl1 = needsNewlineBefore ? "\n" : "";
  const nl2 = needsNewlineAfter ? "\n" : "";

  const content = selected || "text";
  const newText = prefix + nl1 + before + content + after + nl2 + suffix;

  const contentStart = prefix.length + nl1.length + before.length;
  return {
    newText,
    newSelStart: contentStart,
    newSelEnd: contentStart + content.length,
  };
}

const HEADING_LEVELS = ["# ", "## ", "### ", "#### "];

export function cycleHeading(
  text: string,
  selStart: number,
): InsertResult {
  const lineStart = text.lastIndexOf("\n", selStart - 1) + 1;
  const lineEnd = text.indexOf("\n", selStart);
  const end = lineEnd === -1 ? text.length : lineEnd;
  const line = text.substring(lineStart, end);

  let currentLevel = -1;
  for (let i = HEADING_LEVELS.length - 1; i >= 0; i--) {
    if (line.startsWith(HEADING_LEVELS[i])) {
      currentLevel = i;
      break;
    }
  }

  const before = text.substring(0, lineStart);
  const after = text.substring(end);

  if (currentLevel === -1) {
    // No heading → add h1
    const newLine = HEADING_LEVELS[0] + line;
    const newText = before + newLine + after;
    return {
      newText,
      newSelStart: selStart + HEADING_LEVELS[0].length,
      newSelEnd: selStart + HEADING_LEVELS[0].length,
    };
  }

  const strippedLine = line.substring(HEADING_LEVELS[currentLevel].length);

  if (currentLevel >= HEADING_LEVELS.length - 1) {
    // h4 → remove heading
    const newText = before + strippedLine + after;
    return {
      newText,
      newSelStart: lineStart + Math.min(selStart - lineStart, strippedLine.length),
      newSelEnd: lineStart + Math.min(selStart - lineStart, strippedLine.length),
    };
  }

  // Cycle to next level
  const nextPrefix = HEADING_LEVELS[currentLevel + 1];
  const newLine = nextPrefix + strippedLine;
  const newText = before + newLine + after;
  const offset = nextPrefix.length - HEADING_LEVELS[currentLevel].length;
  return {
    newText,
    newSelStart: selStart + offset,
    newSelEnd: selStart + offset,
  };
}

export type ToolbarAction = {
  id: string;
  label: string;
  icon: string;
  prefix: string;
  suffix: string;
  lineLevel: boolean;
  block: boolean;
  isHeading?: boolean;
};

export const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { id: "bold", label: "Bold", icon: "Bold", prefix: "**", suffix: "**", lineLevel: false, block: false },
  { id: "italic", label: "Italic", icon: "Italic", prefix: "*", suffix: "*", lineLevel: false, block: false },
  { id: "strikethrough", label: "Strikethrough", icon: "Strikethrough", prefix: "~~", suffix: "~~", lineLevel: false, block: false },
  { id: "heading", label: "Heading", icon: "Heading", prefix: "", suffix: "", lineLevel: true, block: false, isHeading: true },
  { id: "link", label: "Link", icon: "Link", prefix: "[", suffix: "](url)", lineLevel: false, block: false },
  { id: "image", label: "Image", icon: "Image", prefix: "![", suffix: "](url)", lineLevel: false, block: false },
  { id: "inline-code", label: "Inline Code", icon: "Code", prefix: "`", suffix: "`", lineLevel: false, block: false },
  { id: "code-block", label: "Code Block", icon: "FileCode", prefix: "```\n", suffix: "\n```", lineLevel: false, block: true },
  { id: "bullet-list", label: "Bullet List", icon: "List", prefix: "- ", suffix: "", lineLevel: true, block: false },
  { id: "numbered-list", label: "Numbered List", icon: "ListOrdered", prefix: "1. ", suffix: "", lineLevel: true, block: false },
  { id: "quote", label: "Quote", icon: "Quote", prefix: "> ", suffix: "", lineLevel: true, block: false },
  { id: "horizontal-rule", label: "Horizontal Rule", icon: "Minus", prefix: "\n---\n", suffix: "", lineLevel: false, block: false },
  { id: "task-list", label: "Task List", icon: "ListTodo", prefix: "- [ ] ", suffix: "", lineLevel: true, block: false },
];
