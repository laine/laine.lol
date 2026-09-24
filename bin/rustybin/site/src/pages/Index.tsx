import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";

import Layout from "@/components/layout/Layout";
import PasteTextArea, {
  type ByteStats,
} from "@/components/paste/PasteTextArea";
import { detectLanguage } from "@/lib/language-detector";
import { debounce } from "@/lib/debounce";
import { processDroppedFiles } from "@/lib/file-drop";
import type { ShareDialogData } from "@/lib/types";

import { toast } from "sonner";
import {
  extractKeyFromUrl,
  getPaste,
  createPaste,
  updatePaste,
  deletePaste,
  PasteError,
  KeyInfo,
} from "@/lib/paste";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownViewer } from "@/components/paste/MarkdownViewer";
import {
  Copy,
  Check,
  Flame,
  Clock,
  Eye,
  Code,
  FolderOpen,
  Pencil,
  Columns,
  Shield,
  ShieldCheck,
  Settings2,
} from "lucide-react";
import { getLanguageLabel } from "@/utils/language-utils";
import type { PasteTextAreaHandle } from "@/components/paste/PasteTextArea";
import MarkdownToolbar from "@/components/paste/MarkdownToolbar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EXPIRATION_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "720", label: "12 hours" },
  { value: "1440", label: "24 hours" },
  { value: "4320", label: "3 days" },
  { value: "10080", label: "1 week" },
];

const Index: React.FC = () => {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("markdown");
  const [isLanguageManuallySelected, setIsLanguageManuallySelected] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [quantumResistant, setQuantumResistant] = useState(false);
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isDetectingLanguage, setIsDetectingLanguage] = useState(false);
  const [shareData, setShareData] = useState<ShareDialogData | null>(null);
  const [copiedView, setCopiedView] = useState(false);
  const [copiedEdit, setCopiedEdit] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [markdownView, setMarkdownView] = useState(true);
  const [previewMode, setPreviewMode] = useState<"write" | "preview" | "split">(
    "write",
  );
  const editorRef = useRef<PasteTextAreaHandle>(null);
  const [byteStats, setByteStats] = useState<ByteStats>({
    lines: 0,
    bytes: 0,
    encryptedBytes: 0,
    remaining: 125000,
  });
  const textRef = useRef("");

  const { id } = useParams<{ id: string }>();
  const currentPath = useLocation().pathname;
  const navigate = useNavigate();

  // Handle paste success messages from localStorage
  useEffect(() => {
    const pasteSuccess = localStorage.getItem("pasteSuccess");
    const clipboardSuccess =
      localStorage.getItem("clipboardSuccess") === "true";

    if (pasteSuccess && !localStorage.getItem("showShareDialog")) {
      if (clipboardSuccess) {
        toast.success(
          "Paste created! A shareable URL was copied to your clipboard",
        );
      } else {
        toast.success("Paste created! You are viewing your new paste");
      }
    }

    localStorage.removeItem("pasteSuccess");
    localStorage.removeItem("clipboardSuccess");
    localStorage.removeItem("showShareDialog");
  }, [currentPath]);

  // Fetch paste when navigating to a paste URL
  useEffect(() => {
    if (currentPath === "/") {
      setText("");
      setIsViewMode(false);
      setCanEdit(false);
      setKeyInfo(null);
      return;
    }

    const fetchPaste = async () => {
      if (!id) {
        toast.error("Invalid paste ID");
        return;
      }

      setIsLoading(true);

      const keys = extractKeyFromUrl();

      if (!keys) {
        toast.error(
          "No decryption key found in URL. Make sure to use the full link.",
        );
        setIsLoading(false);
        return;
      }

      setKeyInfo(keys);
      setIsViewMode(true);
      setCanEdit(!!keys.editKey);

      try {
        const paste = await getPaste(id, keys.encryptionKey, keys.version);
        setText(paste.data);
        setLanguage(paste.language || "javascript");
      } catch (error) {
        if (error instanceof PasteError) {
          switch (error.code) {
            case "NOT_FOUND":
              toast.error("Paste not found. It may have been deleted.");
              break;
            case "INVALID_KEY":
              toast.error("Invalid decryption key format.");
              break;
            case "DECRYPTION_FAILED":
              toast.error(
                "Failed to decrypt. The key may be incorrect or the data is corrupted.",
              );
              break;
            default:
              toast.error(`Error: ${error.message}`);
          }
        } else {
          toast.error("Failed to load paste. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaste();
  }, [currentPath, id]);

  // Keep textRef in sync with text
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Auto-detect language while typing (only for new pastes)
  useEffect(() => {
    // Only auto-detect when creating a new paste, not when viewing
    if (currentPath !== "/" || isViewMode) {
      return;
    }

    // Skip auto-detect if the user manually selected a language
    if (isLanguageManuallySelected) {
      return;
    }

    // Don't detect if text is too short (need enough content for accurate detection)
    if (text.length < 20) {
      return;
    }

    setIsDetectingLanguage(true);

    // Debounce the detection to run ~1 second after user stops typing
    const timeoutId = setTimeout(() => {
      const detected = detectLanguage(text);
      // If detection returns something valid (not "unknown"), use it
      // Otherwise fallback to javascript
      const newLanguage = detected !== "unknown" ? detected : "javascript";

      // Only update if the language actually changed
      if (newLanguage !== language) {
        setLanguage(newLanguage);
      }
      setIsDetectingLanguage(false);
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      setIsDetectingLanguage(false);
    };
  }, [text, currentPath, isViewMode, language, isLanguageManuallySelected]);

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    setIsLanguageManuallySelected(true);
  };

  const clearContent = useCallback(() => {
    setText("");
    setAdvancedMode(false);
    setBurnAfterRead(false);
    setExpiresInMinutes(null);
    setQuantumResistant(false);
    setIsLanguageManuallySelected(false);
  }, []);

  const handleFileDrop = useCallback(async (files: File[]) => {
    const result = await processDroppedFiles(files);

    for (const rejected of result.rejected) {
      toast.error(`${rejected.name}: ${rejected.reason}`);
    }

    if (result.files.length === 0) return;

    if (files.length > 1 && result.files.length >= 1) {
      toast.warning(
        "Only the first file was imported. Use a Workspace for multiple files.",
      );
    }

    const file = result.files[0];
    const MAX_BYTES = 125000;
    if (file.byteSize > MAX_BYTES) {
      toast.error(
        `${file.name} exceeds the size limit (${Math.round(file.byteSize / 1000)}KB / ${MAX_BYTES / 1000}KB)`,
      );
      return;
    }

    setText(file.content);
    setLanguage(file.language);
    setIsLanguageManuallySelected(true);
    toast.success(`${file.name} imported`);
  }, []);

  const copyToClipboard = async (text: string, type: "view" | "edit") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "view") {
        setCopiedView(true);
        setTimeout(() => setCopiedView(false), 2000);
      } else {
        setCopiedEdit(true);
        setTimeout(() => setCopiedEdit(false), 2000);
      }
      return true;
    } catch {
      return false;
    }
  };

  const saveContent = useCallback(async () => {
    const content = textRef.current.trim();

    if (!content) {
      toast.error("Cannot save an empty paste");
      return;
    }

    // If we're in edit mode (have an ID and edit key), update the paste
    if (id && keyInfo?.editKey) {
      const loadingToast = toast.loading("Updating paste...");
      setIsLoading(true);

      try {
        await updatePaste(
          id,
          { data: content, language },
          keyInfo.encryptionKey,
          keyInfo.editKey,
        );
        toast.dismiss(loadingToast);
        toast.success("Paste updated successfully!");
      } catch (error) {
        toast.dismiss(loadingToast);
        if (error instanceof PasteError) {
          toast.error(error.message);
        } else {
          toast.error("Failed to update paste");
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // If we have an ID but no edit key, can't save
    if (id) {
      toast.error("Cannot save a paste that already exists");
      return;
    }

    // Create new paste
    const loadingToast = toast.loading("Saving paste...");
    setIsLoading(true);

    try {
      const result = await createPaste(
        { data: content, language },
        {
          includeEditKey: advancedMode,
          burnAfterRead: advancedMode ? burnAfterRead : false,
          expiresInMinutes: advancedMode ? expiresInMinutes : null,
          quantumResistant: advancedMode ? quantumResistant : false,
        },
      );

      toast.dismiss(loadingToast);

      if (!result) {
        toast.error("Failed to create paste");
        return;
      }

      // Build URLs
      const origin = window.location.origin;

      // Parse the result URL to extract parts
      const [pasteIdWithKey] = result.url.split("#");
      const hashPart = result.url.includes("#") ? result.url.split("#")[1] : "";

      // Handle quantum prefix: q:<key>:<editKey> vs <key>:<editKey>
      let viewOnlyHash: string;
      let editKey: string | undefined;

      if (hashPart.startsWith("q:")) {
        const afterPrefix = hashPart.substring(2);
        const colonIdx = afterPrefix.indexOf(":");
        if (colonIdx !== -1) {
          viewOnlyHash = "q:" + afterPrefix.substring(0, colonIdx);
          editKey = afterPrefix.substring(colonIdx + 1);
        } else {
          viewOnlyHash = "q:" + afterPrefix;
        }
      } else {
        const parts = hashPart.split(":");
        viewOnlyHash = parts[0];
        editKey = parts[1];
      }

      // Build view-only URL (just encryption key, no edit key)
      const viewOnlyUrl = `${origin}/${pasteIdWithKey}#${viewOnlyHash}`;

      // Build editable URL (full URL with edit key)
      const editableUrl = editKey ? `${origin}/${result.url}` : viewOnlyUrl;

      // If editing was enabled, show the dialog
      if (advancedMode) {
        setShareData({
          viewOnlyUrl,
          editableUrl,
          burnAfterRead,
          expiresInMinutes,
          quantumResistant,
        });
        setShareDialogOpen(true);

        // Copy view-only URL by default
        await navigator.clipboard.writeText(viewOnlyUrl).catch(() => {});

        // If burn-after-read is enabled, DON'T navigate to the paste
        // This would consume the one-time view before the user can share it
        if (burnAfterRead) {
          toast.success(
            "Paste created! URL copied to clipboard. Share it - the paste will be deleted after first view.",
          );
          // Clear the editor for a fresh start
          setText("");
          setAdvancedMode(false);
          setBurnAfterRead(false);
          setExpiresInMinutes(null);
        } else {
          // Navigate to the editable URL (so user can still edit)
          const pastePath = "/" + result.url;
          navigate(pastePath);
        }
      } else {
        // No edit key, just copy and navigate
        const pastePath = "/" + result.url;
        const absoluteUrl = `${origin}${pastePath}`;

        try {
          await navigator.clipboard.writeText(absoluteUrl);
          localStorage.setItem("pasteSuccess", "true");
          localStorage.setItem("clipboardSuccess", "true");
        } catch {
          localStorage.setItem("pasteSuccess", "true");
          localStorage.setItem("clipboardSuccess", "false");
        }

        navigate(pastePath);
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      if (error instanceof PasteError) {
        toast.error(error.message);
      } else if (error instanceof Error) {
        toast.error(`Failed to create paste: ${error.message}`);
      } else {
        toast.error("Failed to create paste");
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    id,
    keyInfo,
    language,
    navigate,
    advancedMode,
    burnAfterRead,
    expiresInMinutes,
    quantumResistant,
  ]);

  const deleteContent = useCallback(async () => {
    if (!id || !keyInfo?.editKey) {
      toast.error("Cannot delete this paste");
      return;
    }

    const loadingToast = toast.loading("Deleting paste...");
    setIsLoading(true);

    try {
      await deletePaste(id, keyInfo.editKey);
      toast.dismiss(loadingToast);
      toast.success("Paste deleted successfully!");
      setDeleteDialogOpen(false);
      navigate("/");
    } catch (error) {
      toast.dismiss(loadingToast);
      if (error instanceof PasteError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to delete paste");
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, keyInfo, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const saveContentDebounced = debounce(() => {
      if (currentPath !== "/" && !canEdit) return;
      if (!textRef.current.trim()) {
        toast.error("Cannot save an empty paste");
        return;
      }
      saveContent();
    }, 1000);

    const clearContentDebounced = debounce(() => {
      setAdvancedMode(false);
      setBurnAfterRead(false);
      setExpiresInMinutes(null);
      navigate("/");
    }, 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        saveContentDebounced();
      }

      if (e.key === "o" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        clearContentDebounced();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saveContent, clearContent, navigate, currentPath, canEdit]);

  // Determine if we should show save button (new paste or editable existing paste)
  const showSaveButton = !isViewMode || canEdit;

  // Only show advanced toggle when creating a new paste (not viewing)
  const showAdvancedToggle = currentPath === "/" && !isViewMode;

  // Markdown rendering logic
  const isMarkdown = language === "markdown";
  const showMarkdownRendered =
    isMarkdown && isViewMode && !canEdit && markdownView;
  // Whether the user is actively editing (new paste or editing with key)
  const isEditing = !isViewMode || canEdit;
  // Whether to show the create/edit preview mode controls
  const showPreviewControls = isMarkdown && isEditing;

  const advancedControls = showAdvancedToggle ? (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center">
            <Label
              htmlFor="advanced-mode-mobile"
              className="text-white cursor-pointer flex items-center mr-2 text-sm text-foreground font-medium"
            >
              <span className="inline text-[10px] uppercase tracking-wider font-bold text-white hover:text-primary transition-colors">
                advanced
              </span>
            </Label>
            <Switch
              id="advanced-mode-mobile"
              checked={advancedMode}
              onCheckedChange={setAdvancedMode}
              className="h-[21px]"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="rounded border border-white/10 hover:border-primary/50 bg-black/20 backdrop-blur-sm text-white text-[10px] uppercase tracking-wider font-bold text-white/50 hover:text-primary transition-colors"
        >
          <p>Enable advanced options when saving a paste</p>
        </TooltipContent>
      </Tooltip>

      {advancedMode && (
        <div className="flex items-center gap-2 border-l border-white/10 pl-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Flame
                  className={`h-3.5 w-3.5 ${burnAfterRead ? "text-primary" : "text-white/50"}`}
                />
                <Switch
                  id="burn-after-read-mobile"
                  checked={burnAfterRead}
                  onCheckedChange={setBurnAfterRead}
                  className="h-[21px]"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="rounded border border-white/10 hover:border-primary/50 bg-black/20 backdrop-blur-sm text-white text-[10px] uppercase tracking-wider font-bold text-white/50 hover:text-primary transition-colors"
            >
              <p>Burn after read</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Clock
                  className={`h-3.5 w-3.5 ${expiresInMinutes ? "text-primary" : "text-white/50"}`}
                />
                <Select
                  value={expiresInMinutes?.toString() || "never"}
                  onValueChange={(value) =>
                    setExpiresInMinutes(
                      value === "never" ? null : parseInt(value),
                    )
                  }
                >
                  <SelectTrigger className="h-[21px] w-[120px] text-[10px] uppercase tracking-wider font-bold bg-[#0F1014]/0 border-[#20222a] rounded">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0F1014] border-[#20222a] rounded">
                    {EXPIRATION_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-[10px] uppercase tracking-wider font-bold"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="rounded border border-white/10 hover:border-primary/50 bg-black/20 backdrop-blur-sm text-white text-[10px] uppercase tracking-wider font-bold text-white/50 hover:text-primary transition-colors"
            >
              <p>Delete after</p>
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Shield
                    className={`h-3.5 w-3.5 ${quantumResistant ? "text-primary" : "text-white/50"}`}
                  />
                  <Switch
                    id="quantum-resistant"
                    checked={quantumResistant}
                    onCheckedChange={async (checked) => {
                      if (checked) {
                        try {
                          await import("crystals-kyber-js");
                          setQuantumResistant(true);
                        } catch {
                          toast.error("Quantum encryption unavailable");
                          setQuantumResistant(false);
                        }
                      } else {
                        setQuantumResistant(false);
                      }
                    }}
                    className="h-[21px]"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="rounded border border-white/10 hover:border-primary/50 bg-black/20 backdrop-blur-sm text-white text-[10px] uppercase tracking-wider font-bold text-white/50 hover:text-primary transition-colors"
              >
                <p>
                  <span className="text-rainbow">Quantum-resistant</span>{" "}
                  encryption (ML-KEM-1024)
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* {quantumResistant && (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 text-[10px] bg-amber-500/10 border border-amber-500/20 rounded text-amber-200/80">
              URLs will be ~4300 characters long
            </div>
          )} */}
        </div>
      )}
    </>
  ) : null;

  return (
    <>
      <Layout
        language={language}
        setLanguage={handleLanguageChange}
        showLanguageSelector={true}
        clearContent={clearContent}
        saveContent={saveContent}
        isLoading={isLoading}
        isDetectingLanguage={isDetectingLanguage}
        canSave={showSaveButton}
        canDelete={canEdit}
        onDelete={() => setDeleteDialogOpen(true)}
        byteCount={byteStats.encryptedBytes}
        maxBytes={125000}
        isOverLimit={byteStats.remaining < 0}
        showByteCounter={true}
        headerExtra={
          advancedControls && (
            <div className="flex sm:hidden items-center gap-2 ml-2">
              {advancedControls}
            </div>
          )
        }
      >
        {/* Secondary bar: markdown toolbar, preview toggle, advanced controls, new workspace */}
        {((isMarkdown && isViewMode && !canEdit) ||
          showPreviewControls ||
          showAdvancedToggle ||
          currentPath === "/") && (
          <div className="flex items-center gap-2 px-1 py-1 border-b border-white/10 bg-[#1a1b20] sticky top-[35px] z-40">
            {/* View-mode markdown toggle (read-only pastes) */}
            {isMarkdown && isViewMode && !canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-[10px] uppercase rounded tracking-wider font-bold text-white/50 hover:text-primary"
                onClick={() => setMarkdownView(!markdownView)}
              >
                {markdownView ? (
                  <>
                    <Code className="h-3.5 w-3.5" /> Source
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </>
                )}
              </Button>
            )}

            {/* Markdown toolbar (create/edit mode) */}
            {showPreviewControls && (
              <>
                <MarkdownToolbar
                  editorRef={editorRef}
                  text={text}
                  setText={setText}
                />
                <div className="flex items-center gap-0.5 border-l border-white/10 pl-2">
                  {(["write", "preview", "split"] as const).map((mode) => {
                    const icons = {
                      write: Pencil,
                      preview: Eye,
                      split: Columns,
                    };
                    const labels = {
                      write: "Write",
                      preview: "Preview",
                      split: "Split",
                    };
                    const Icon = icons[mode];
                    return (
                      <Button
                        key={mode}
                        variant="ghost"
                        size="sm"
                        className={`h-6 gap-1 text-[10px] uppercase rounded tracking-wider font-bold transition-colors ${
                          previewMode === mode
                            ? "text-primary"
                            : "text-white/40 hover:text-primary"
                        }`}
                        onClick={() => setPreviewMode(mode)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden lg:inline">{labels[mode]}</span>
                      </Button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {advancedControls && (
                <div className="hidden sm:flex lg:hidden items-center gap-2">
                  {advancedControls}
                </div>
              )}

              {currentPath === "/" && !isViewMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-[10px] uppercase tracking-wider hover:rounded font-bold text-white/50 hover:text-primary"
                  onClick={() => navigate("/w/new")}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  New Workspace
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          <div className="flex flex-1 flex-col min-h-0">
            {showMarkdownRendered ? (
              <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto">
                <MarkdownViewer content={text} />
              </div>
            ) : showPreviewControls && previewMode === "preview" ? (
              <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto">
                <MarkdownViewer content={text} />
              </div>
            ) : showPreviewControls && previewMode === "split" ? (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
                <div className="flex flex-col min-h-0 overflow-hidden border-r border-white/10">
                  <PasteTextArea
                    ref={editorRef}
                    text={text}
                    setText={setText}
                    language={language}
                    isLoading={isLoading}
                    readOnly={isViewMode && !canEdit}
                    onByteStatsChange={setByteStats}
                    onFileDrop={handleFileDrop}
                    dropDisabled={isViewMode && !canEdit}
                  />
                </div>
                <div className="flex-1 overflow-auto p-6 max-w-none hidden md:block">
                  <MarkdownViewer content={text} />
                </div>
              </div>
            ) : (
              <PasteTextArea
                ref={editorRef}
                text={text}
                setText={setText}
                language={language}
                isLoading={isLoading}
                readOnly={isViewMode && !canEdit}
                onByteStatsChange={setByteStats}
                onFileDrop={handleFileDrop}
                dropDisabled={isViewMode && !canEdit}
              />
            )}
          </div>

          {/* Options side-panel (desktop, create mode) */}
          {showAdvancedToggle && (
            <aside className="hidden lg:flex w-64 shrink-0 flex-col border-l border-border bg-card overflow-y-auto">
              <div className="flex items-center gap-2 h-[37px] px-3 border-b border-border text-[13px] font-semibold text-white">
                <span className="icon-tile h-6 w-6">
                  <Settings2 className="h-3.5 w-3.5" />
                </span>
                Options
              </div>

              <div className="flex items-center justify-between px-3 py-3 border-b border-border text-sm">
                <Label
                  htmlFor="advanced-panel"
                  className="cursor-pointer text-white/80"
                >
                  Advanced
                </Label>
                <Switch
                  id="advanced-panel"
                  checked={advancedMode}
                  onCheckedChange={setAdvancedMode}
                  className="h-[21px]"
                />
              </div>

              <div
                className={`flex items-center justify-between px-3 py-3 border-b border-border text-sm transition-opacity ${advancedMode ? "" : "opacity-40 pointer-events-none"}`}
              >
                <span className="flex items-center gap-2 text-white/80">
                  <Clock className="h-3.5 w-3.5" /> Expiration
                </span>
                <Select
                  value={expiresInMinutes?.toString() || "never"}
                  onValueChange={(value) =>
                    setExpiresInMinutes(
                      value === "never" ? null : parseInt(value),
                    )
                  }
                >
                  <SelectTrigger className="h-[24px] w-[104px] text-[11px] bg-[#1a1b20] border-border rounded">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0F1014] border-border rounded">
                    {EXPIRATION_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-[11px]"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div
                className={`flex items-center justify-between px-3 py-3 border-b border-border text-sm transition-opacity ${advancedMode ? "" : "opacity-40 pointer-events-none"}`}
              >
                <span className="flex items-center gap-2 text-white/80">
                  <Flame className="h-3.5 w-3.5" /> Burn after read
                </span>
                <Switch
                  checked={burnAfterRead}
                  onCheckedChange={setBurnAfterRead}
                  className="h-[21px]"
                />
              </div>

              <div
                className={`flex items-center justify-between px-3 py-3 border-b border-border text-sm transition-opacity ${advancedMode ? "" : "opacity-40 pointer-events-none"}`}
              >
                <span className="flex items-center gap-2 text-white/80">
                  <Shield className="h-3.5 w-3.5" /> Quantum
                </span>
                <Switch
                  checked={quantumResistant}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      try {
                        await import("crystals-kyber-js");
                        setQuantumResistant(true);
                      } catch {
                        toast.error("Quantum encryption unavailable");
                        setQuantumResistant(false);
                      }
                    } else {
                      setQuantumResistant(false);
                    }
                  }}
                  className="h-[21px]"
                />
              </div>

              <button
                onClick={() => !isLoading && saveContent()}
                disabled={isLoading}
                className="btn-shine mt-auto bg-primary text-primary-foreground font-bold text-sm py-3 border-t border-primary/55 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? "Creating…" : "Create paste"}
              </button>
            </aside>
          )}
        </div>

        {/* Editor status bar */}
        <div className="flex items-center border-t border-border bg-[#0d0e11] text-[10px] uppercase tracking-wider font-bold text-muted-foreground shrink-0">
          <span className="px-3 py-1.5 border-r border-border">
            {getLanguageLabel(language)}
          </span>
          <span className="hidden sm:inline px-3 py-1.5 border-r border-border">
            UTF-8
          </span>
          <span className="px-3 py-1.5 border-r border-border">
            {byteStats.lines} {byteStats.lines === 1 ? "line" : "lines"}
          </span>
          <span className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-success">
            <ShieldCheck className="h-3 w-3" /> Encrypted
          </span>
        </div>
      </Layout>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0F1014] border-[1px] border-[#20222a] rounded">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Paste created with advanced options
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Choose a URL to share.
            </DialogDescription>
          </DialogHeader>

          {(shareData?.burnAfterRead ||
            shareData?.expiresInMinutes ||
            shareData?.quantumResistant) && (
            <div className="flex flex-wrap gap-2 pb-2">
              {shareData?.quantumResistant && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-white/5 border border-white/10">
                  <Shield className="h-3.5 w-3.5 icon-rainbow" />
                  <span className="text-rainbow">Quantum-resistant</span>{" "}
                  <span className="text-white/50">(long URL)</span>
                </div>
              )}
              {shareData?.burnAfterRead && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-orange-500/10 border border-orange-500/20 text-orange-300">
                  <Flame className="h-3.5 w-3.5" />
                  Burns after first read
                </div>
              )}
              {shareData?.expiresInMinutes && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
                  <Clock className="h-3.5 w-3.5" />
                  Expires in{" "}
                  {shareData.expiresInMinutes < 60
                    ? `${shareData.expiresInMinutes} min`
                    : shareData.expiresInMinutes < 1440
                      ? `${shareData.expiresInMinutes / 60} hr`
                      : `${shareData.expiresInMinutes / 1440} days`}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-white text-sm font-medium flex items-center gap-2">
                Read-only URL
                <span className="text-xs text-white/50">
                  (recommended for sharing)
                </span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareData?.viewOnlyUrl ?? ""}
                  className="flex-1 bg-[#0F1014] border-[#20222a] text-xs font-mono text-white"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  variant="default"
                  onClick={() =>
                    shareData && copyToClipboard(shareData.viewOnlyUrl, "view")
                  }
                  className="h-10 w-10 bg-[#0F1014] border-[1px] border-[#20222a] rounded hover:bg-[#0F1014] hover:text-primary"
                >
                  {copiedView ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-white text-sm font-medium flex items-center gap-2">
                Editable URL{" "}
                <span className="text-xs text-amber-300">
                  (people with this link can edit or delete the paste)
                </span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareData?.editableUrl ?? ""}
                  className="flex-1 bg-[#0F1014] border-[#20222a] text-xs font-mono text-white"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  variant="default"
                  onClick={() =>
                    shareData && copyToClipboard(shareData.editableUrl, "edit")
                  }
                  className="h-10 w-10 bg-[#0F1014] border-[1px] border-[#20222a] rounded hover:bg-[#0F1014] hover:text-primary"
                >
                  {copiedEdit ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200/80 italic">
              <strong>Important:</strong> Since we don't save your decryption
              key, we cannot recover your data if you lose the link. Please keep
              your URLs safe.
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0F1014] border-[1px] border-[#20222a] rounded">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Delete paste
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Are you sure you want to delete this paste? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="bg-[#0F1014] border-[1px] border-[#20222a] rounded hover:bg-[#0F1014] hover:text-primary"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteContent}
              disabled={isLoading}
              className="rounded"
            >
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Index;
