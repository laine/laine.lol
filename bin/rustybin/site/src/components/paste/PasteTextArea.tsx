import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Editor from "react-simple-code-editor";
import { getPrismLanguage } from "@/utils/language-utils";
import { highlightWithPrism } from "@/utils/prism-utils";
import { usePrismTheme } from "@/utils/prism-theme-utils";
import { Loader2, Upload } from "lucide-react";

export interface PasteTextAreaHandle {
  getTextarea: () => HTMLTextAreaElement | null;
}

export type ByteStats = {
  lines: number;
  bytes: number;
  encryptedBytes: number;
  remaining: number;
};

type PasteTextAreaProps = {
  text: string;
  setText: (text: string) => void;
  language: string;
  readOnly?: boolean;
  isLoading?: boolean;
  showLineNumbers?: boolean;
  autoFocus?: boolean;
  maxCharacters?: number;
  onLimitExceeded?: (isExceeded: boolean) => void;
  onByteStatsChange?: (stats: ByteStats) => void;
  placeholder?: string;
  onFileDrop?: (files: File[]) => void;
  dropDisabled?: boolean;
  dropOverlayText?: string;
};

/**
 * Calculates the byte length of a string in UTF-8 encoding
 * This exactly matches Rust's String.as_bytes().len() behavior
 */
function getUtf8ByteLength(str: string): number {
  // The TextEncoder uses UTF-8 by default
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return bytes.length;
}

/**
 * Estimate encrypted size after AES encryption and base64 encoding
 * The actual size may vary slightly but this gives a close approximation
 */
function getEstimatedEncryptedSize(byteLength: number): number {
  // AES-GCM adds 16 bytes for the auth tag + 12 bytes for IV
  const encryptedSize = byteLength + 28;
  // Base64 encoding increases size by approximately 4/3
  return Math.ceil(encryptedSize * 1.34);
}

const PasteTextArea = forwardRef<PasteTextAreaHandle, PasteTextAreaProps>(
  (
    {
      text,
      setText,
      language,
      readOnly = false,
      isLoading = false,
      showLineNumbers = true,
      autoFocus = true,
      maxCharacters = 125000,
      onLimitExceeded,
      onByteStatsChange,
      placeholder = "Paste away! Your pastes are securely encrypted by your browser before they're saved to our server.",
      onFileDrop,
      dropDisabled = false,
      dropOverlayText = "Drop file here",
    },
    ref,
  ) => {
    const { background, textColor } = usePrismTheme();
    const editorRef = useRef<HTMLDivElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    const dropEnabled = !!onFileDrop && !dropDisabled;

    const handleDragEnter = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        if (!dropEnabled) return;
        dragCounterRef.current++;
        setIsDragOver(true);
      },
      [dropEnabled],
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
    }, []);

    const handleDragLeave = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        if (!dropEnabled) return;
        dragCounterRef.current--;
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0;
          setIsDragOver(false);
        }
      },
      [dropEnabled],
    );

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDragOver(false);
        if (!dropEnabled || !onFileDrop) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) onFileDrop(files);
      },
      [dropEnabled, onFileDrop],
    );

    useImperativeHandle(ref, () => ({
      getTextarea: () => editorRef.current?.querySelector("textarea") ?? null,
    }));
    const [charStats, setCharStats] = useState({
      lines: 0,
      bytes: 0,
      encryptedBytes: 0,
      remaining: maxCharacters,
    });

    // Calculate if theme is light based on background luminance
    const isLightTheme = (() => {
      // Parse hex color to RGB
      const hex = background.replace("#", "");
      if (hex.length !== 6) return false;

      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      // Calculate relative luminance (sRGB)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    })();

    // Auto-focus the editor when the component mounts
    useEffect(() => {
      if (autoFocus && editorRef.current && !readOnly && !isLoading) {
        const textarea = editorRef.current.querySelector("textarea");
        if (textarea) {
          setTimeout(() => {
            textarea.focus();
          }, 0);
        }
      }
    }, [autoFocus, readOnly, isLoading]);

    // Ensure styles are applied properly when theme changes
    useEffect(() => {
      if (editorRef.current) {
        // Apply styles directly to ensure they're respected
        const elements = editorRef.current.querySelectorAll(
          "pre, code, textarea",
        );
        elements.forEach((el) => {
          const elem = el as HTMLElement;
          elem.style.backgroundColor = background;
          elem.style.color = textColor;
        });
      }
    }, [background, textColor]);

    // Update character stats whenever text changes
    useEffect(() => {
      const calculateStats = () => {
        if (!text)
          return {
            lines: 0,
            bytes: 0,
            encryptedBytes: 0,
            remaining: maxCharacters,
          };

        // Count lines
        const lines = text.split("\n").length;

        // Get exact byte count using UTF-8 encoding
        const bytes = getUtf8ByteLength(text);

        // Calculate estimated encrypted size
        const encryptedBytes = getEstimatedEncryptedSize(bytes);

        // Calculate remaining space based on encrypted size
        const remaining = maxCharacters - encryptedBytes;

        return {
          lines,
          bytes,
          encryptedBytes,
          remaining,
        };
      };

      const stats = calculateStats();
      setCharStats(stats);

      // Notify parent component of byte stats
      if (onByteStatsChange) {
        onByteStatsChange(stats);
      }

      // Notify parent component if limit is exceeded
      if (onLimitExceeded) {
        onLimitExceeded(stats.remaining < 0);
      }
    }, [text, maxCharacters, onLimitExceeded, onByteStatsChange]);

    const highlightCode = useCallback(
      (code: string) => {
        if (!code) return "";

        try {
          const prismLanguage = getPrismLanguage(language);
          return highlightWithPrism(code, prismLanguage);
        } catch (error) {
          console.error("Error in highlight function:", error);
          return code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        }
      },
      [language],
    );

    // Generate line numbers if needed
    const renderLineNumbers = () => {
      if (!showLineNumbers) return null;

      const lineCount = text.split("\n").length;

      // Calculate appropriate colors for line numbers
      const lineNumberColor = isLightTheme
        ? `rgba(0, 0, 0, 0.1)` // Dark color with opacity for light themes
        : `rgba(255, 255, 255, 0.4)`; // Light color with opacity for dark themes

      const lineNumberBgColor = isLightTheme
        ? `rgba(0, 0, 0, 0.05)` // Dark bg with opacity for light themes
        : `rgba(255, 255, 255, 0.02)`; // Light bg with opacity for dark themes

      return (
        <div
          data-testid="line-numbers"
          className="absolute left-0 top-0 bottom-0 w-12 text-sm pt-3 select-none overflow-hidden pointer-events-none z-[1]"
          style={{
            backgroundColor: lineNumberBgColor,
            color: lineNumberColor,
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="px-2 text-right h-[21px] leading-[21px]">
              {i + 1}
            </div>
          ))}
        </div>
      );
    };

    const isOverLimit = charStats.remaining < 0;

    return (
      <div
        className="flex-1 text-card-foreground flex flex-col relative w-full h-full min-h-0 min-w-0"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && dropEnabled && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-primary/5 backdrop-blur-sm border-2 border-dashed border-primary rounded pointer-events-none">
            <Upload className="h-8 w-8 text-primary mb-2" />
            <span className="text-primary text-sm font-medium">
              {dropOverlayText}
            </span>
          </div>
        )}
        <div
          ref={editorRef}
          className="editor-scroll-container absolute inset-0 overflow-auto font-mono flex flex-col"
          style={{ backgroundColor: background }}
        >
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Processing...</p>
              </div>
            </div>
          )}
          {renderLineNumbers()}
          <Editor
            value={text}
            onValueChange={readOnly || isLoading ? () => {} : setText}
            highlight={highlightCode}
            disabled={readOnly || isLoading}
            padding={12}
            className="editor-container min-h-full shrink-0"
            style={{
              background: `${background} !important`,
              color: `${textColor} !important`,
              transition:
                "background-color 0.2s ease-in-out, color 0.2s ease-in-out",
              fontFamily: "inherit",
              marginLeft: showLineNumbers ? "3.5rem" : "0",
              whiteSpace: "pre",
              minWidth: "fit-content",
            }}
            textareaClassName="outline-none relative z-[2] text-white/50"
            placeholder={placeholder}
          />
        </div>
      </div>
    );
  },
);

PasteTextArea.displayName = "PasteTextArea";

export default PasteTextArea;
