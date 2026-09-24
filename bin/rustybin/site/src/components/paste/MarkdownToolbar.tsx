import React, { useCallback } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading,
  Link,
  Image,
  Code,
  FileCode,
  List,
  ListOrdered,
  Quote,
  Minus,
  ListTodo,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PasteTextAreaHandle } from "@/components/paste/PasteTextArea";
import {
  TOOLBAR_ACTIONS,
  applyInlineFormat,
  applyLineFormat,
  applyBlockFormat,
  cycleHeading,
} from "@/lib/markdown-toolbar";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Bold,
  Italic,
  Strikethrough,
  Heading,
  Link,
  Image,
  Code,
  FileCode,
  List,
  ListOrdered,
  Quote,
  Minus,
  ListTodo,
};

type MarkdownToolbarProps = {
  editorRef: React.RefObject<PasteTextAreaHandle | null>;
  text: string;
  setText: (text: string) => void;
};

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ editorRef, text, setText }) => {
  const handleAction = useCallback(
    (actionId: string) => {
      const textarea = editorRef.current?.getTextarea();
      if (!textarea) return;

      const { selectionStart, selectionEnd } = textarea;
      const action = TOOLBAR_ACTIONS.find((a) => a.id === actionId);
      if (!action) return;

      let result;
      if (action.isHeading) {
        result = cycleHeading(text, selectionStart);
      } else if (action.block) {
        result = applyBlockFormat(text, selectionStart, selectionEnd, action.prefix, action.suffix);
      } else if (action.lineLevel) {
        result = applyLineFormat(text, selectionStart, action.prefix);
      } else {
        result = applyInlineFormat(text, selectionStart, selectionEnd, action.prefix, action.suffix);
      }

      setText(result.newText);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(result.newSelStart, result.newSelEnd);
      });
    },
    [editorRef, text, setText],
  );

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
      {TOOLBAR_ACTIONS.map((action) => {
        const Icon = ICON_MAP[action.icon];
        if (!Icon) return null;
        return (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleAction(action.id)}
                className="p-1 text-white/40 hover:text-primary transition-colors rounded hover:bg-white/5 flex-shrink-0"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="rounded border border-white/10 bg-black/90 backdrop-blur-sm text-[10px] uppercase tracking-wider font-bold text-white/70">
              <p>{action.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

export default MarkdownToolbar;
