import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Copy, Check, Flame, Clock, Save, Trash2, Eye, Code,
  Plus, Loader2, Pencil, Columns,
} from "lucide-react";

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import PasteTextArea, { type PasteTextAreaHandle } from "@/components/paste/PasteTextArea";
import MarkdownToolbar from "@/components/paste/MarkdownToolbar";
import { MarkdownViewer } from "@/components/paste/MarkdownViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { arrayMove } from "@dnd-kit/sortable";
import type { WorkspaceBundle, WorkspaceFile, WorkspaceNode } from "@/lib/workspace-types";
import { createEmptyBundle, countFiles, validateBundle, MAX_WORKSPACE_FILES, MAX_BUNDLE_SIZE } from "@/lib/workspace-types";
import { processDroppedFiles } from "@/lib/file-drop";
import {
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  extractWorkspaceKeyFromUrl,
} from "@/lib/workspace";
import { PasteError } from "@/lib/paste";
import { languageOptions, getLanguageLabel } from "@/utils/language-utils";

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

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [bundle, setBundle] = useState<WorkspaceBundle>(createEmptyBundle());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [markdownView, setMarkdownView] = useState(true);
  const [previewMode, setPreviewMode] = useState<"write" | "preview" | "split">("write");
  const editorRef = useRef<PasteTextAreaHandle>(null);

  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [expiresInMinutes, setExpiresInMinutes] = useState<string>("never");

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareUrls, setShareUrls] = useState<{ readOnly: string; editable: string } | null>(null);
  const [copiedView, setCopiedView] = useState(false);
  const [copiedEdit, setCopiedEdit] = useState(false);

  const isNewWorkspace = !id;
  const isEditable = isNewWorkspace || !!editKey;

  const files: WorkspaceFile[] = bundle.tree.filter(
    (n): n is WorkspaceFile => n.type === "file"
  );
  const selectedFile = files[selectedIndex];
  const isMarkdown = selectedFile?.language === "markdown";

  // Load existing workspace
  useEffect(() => {
    if (!id) return;
    const loadWorkspace = async () => {
      setIsLoading(true);
      const keys = extractWorkspaceKeyFromUrl();
      if (!keys) {
        toast.error("No decryption key found in URL");
        setIsLoading(false);
        return;
      }
      setEncryptionKey(keys.encryptionKey);
      if (keys.editKey) setEditKey(keys.editKey);
      try {
        const result = await getWorkspace(id, keys.encryptionKey);
        setBundle(result.bundle);
        setIsSaved(true);
        setSelectedIndex(0);
      } catch (error) {
        if (error instanceof PasteError) {
          toast.error(error.code === "NOT_FOUND"
            ? "Workspace not found or has expired"
            : error.code === "DECRYPTION_FAILED"
              ? "Failed to decrypt workspace"
              : error.message);
        } else {
          toast.error("Failed to load workspace");
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadWorkspace();
  }, [id]);

  const handleContentChange = useCallback((content: string) => {
    setBundle((prev) => {
      const fileNodes = prev.tree.filter((n): n is WorkspaceFile => n.type === "file");
      if (fileNodes[selectedIndex]) {
        fileNodes[selectedIndex] = { ...fileNodes[selectedIndex], content };
      }
      let fileIdx = 0;
      const updatedTree: WorkspaceNode[] = prev.tree.map((node) =>
        node.type === "file" ? fileNodes[fileIdx++] : node
      );
      return { ...prev, tree: updatedTree };
    });
  }, [selectedIndex]);

  const handleAddFile = useCallback(() => {
    const fileCount = countFiles(bundle.tree);
    const newFile: WorkspaceFile = {
      type: "file",
      name: `file${fileCount + 1}.txt`,
      language: "none",
      content: "",
    };
    setBundle((prev) => ({ ...prev, tree: [...prev.tree, newFile] }));
    setSelectedIndex(files.length);
    setEditingIndex(files.length);
  }, [bundle.tree, files.length]);

  const handleRenameFile = useCallback((index: number, newName: string) => {
    setBundle((prev) => {
      const fileNodes = prev.tree.filter((n): n is WorkspaceFile => n.type === "file");
      if (fileNodes[index]) {
        fileNodes[index] = { ...fileNodes[index], name: newName };
      }
      let fileIdx = 0;
      const updatedTree: WorkspaceNode[] = prev.tree.map((node) =>
        node.type === "file" ? fileNodes[fileIdx++] : node
      );
      return { ...prev, tree: updatedTree };
    });
    setEditingIndex(null);
  }, []);

  const handleFileLanguageChange = useCallback((index: number, language: string) => {
    setBundle((prev) => {
      const fileNodes = prev.tree.filter((n): n is WorkspaceFile => n.type === "file");
      if (fileNodes[index]) {
        fileNodes[index] = { ...fileNodes[index], language };
      }
      let fileIdx = 0;
      const updatedTree: WorkspaceNode[] = prev.tree.map((node) =>
        node.type === "file" ? fileNodes[fileIdx++] : node
      );
      return { ...prev, tree: updatedTree };
    });
  }, []);

  const handleDeleteFile = useCallback((index: number) => {
    if (files.length <= 1) {
      toast.error("Cannot delete the last file");
      return;
    }
    setBundle((prev) => {
      const fileNodes = prev.tree.filter((n): n is WorkspaceFile => n.type === "file");
      fileNodes.splice(index, 1);
      // Rebuild tree keeping only remaining files (and any folders)
      let fileIdx = 0;
      const updatedTree: WorkspaceNode[] = [];
      for (const node of prev.tree) {
        if (node.type === "file") {
          if (fileIdx < fileNodes.length) {
            updatedTree.push(fileNodes[fileIdx++]);
          }
        } else {
          updatedTree.push(node);
        }
      }
      return { ...prev, tree: updatedTree };
    });
    // Adjust selection
    if (selectedIndex >= files.length - 1) {
      setSelectedIndex(Math.max(0, files.length - 2));
    }
    toast.success("File removed");
  }, [files.length, selectedIndex]);

  const handleReorderFiles = useCallback((oldIndex: number, newIndex: number) => {
    setBundle((prev) => {
      const fileNodes = prev.tree.filter((n): n is WorkspaceFile => n.type === "file");
      const reordered = arrayMove(fileNodes, oldIndex, newIndex);
      let fileIdx = 0;
      const updatedTree: WorkspaceNode[] = prev.tree.map((node) =>
        node.type === "file" ? reordered[fileIdx++] : node
      );
      return { ...prev, tree: updatedTree };
    });
    // Update selected index to follow the selected file
    if (selectedIndex === oldIndex) {
      setSelectedIndex(newIndex);
    } else if (selectedIndex > oldIndex && selectedIndex <= newIndex) {
      setSelectedIndex(selectedIndex - 1);
    } else if (selectedIndex < oldIndex && selectedIndex >= newIndex) {
      setSelectedIndex(selectedIndex + 1);
    }
  }, [selectedIndex]);

  const handleFileDrop = useCallback(async (droppedFiles: File[]) => {
    const result = await processDroppedFiles(droppedFiles);

    for (const rejected of result.rejected) {
      toast.error(`${rejected.name}: ${rejected.reason}`);
    }

    if (result.files.length === 0) return;

    const currentFileCount = countFiles(bundle.tree);
    const remainingSlots = MAX_WORKSPACE_FILES - currentFileCount;

    if (remainingSlots <= 0) {
      toast.error(`Workspace is full (${MAX_WORKSPACE_FILES} files maximum)`);
      return;
    }

    let filesToAdd = result.files;
    if (filesToAdd.length > remainingSlots) {
      toast.warning(`Only ${remainingSlots} of ${filesToAdd.length} files were added (workspace limit: ${MAX_WORKSPACE_FILES} files)`);
      filesToAdd = filesToAdd.slice(0, remainingSlots);
    }

    const currentBundleSize = new TextEncoder().encode(JSON.stringify(bundle)).length;
    const accepted: WorkspaceFile[] = [];
    let runningSize = currentBundleSize;

    for (const file of filesToAdd) {
      const entrySize = new TextEncoder().encode(
        JSON.stringify({ type: "file", name: file.name, language: file.language, content: file.content })
      ).length;
      if (runningSize + entrySize > MAX_BUNDLE_SIZE) {
        toast.error(`${file.name} skipped — would exceed workspace size limit`);
        continue;
      }
      runningSize += entrySize;
      accepted.push({ type: "file", name: file.name, language: file.language, content: file.content });
    }

    if (accepted.length === 0) return;

    const prevFileCount = files.length;
    setBundle((prev) => ({ ...prev, tree: [...prev.tree, ...accepted] }));
    setSelectedIndex(prevFileCount);
    toast.success(`${accepted.length} file(s) imported`);
  }, [bundle, files.length]);

  const handleSave = useCallback(async () => {
    const validation = validateBundle(bundle);
    if (!validation.valid) {
      toast.error(validation.error ?? "Invalid workspace");
      return;
    }
    setIsLoading(true);
    const loadingToast = toast.loading(isSaved ? "Updating workspace..." : "Saving workspace...");
    try {
      if (isSaved && id && encryptionKey && editKey) {
        await updateWorkspace(id, bundle, encryptionKey, editKey);
        toast.dismiss(loadingToast);
        toast.success("Workspace updated!");
      } else {
        const expMinutes = expiresInMinutes !== "never" ? parseInt(expiresInMinutes) : null;
        const result = await createWorkspace(bundle, { burnAfterRead, expiresInMinutes: expMinutes });
        toast.dismiss(loadingToast);
        const origin = window.location.origin;
        setShareUrls({ readOnly: `${origin}${result.readOnlyUrl}`, editable: `${origin}${result.url}` });
        setShareDialogOpen(true);
        await navigator.clipboard.writeText(`${origin}${result.readOnlyUrl}`).catch(() => {});
        if (!burnAfterRead) {
          navigate(result.url, { replace: true });
          setIsSaved(true);
          setEditKey(result.editKey);
        } else {
          toast.success("Workspace created! URL copied. It will be deleted after first view.");
        }
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error instanceof PasteError ? error.message : "Failed to save workspace");
    } finally {
      setIsLoading(false);
    }
  }, [bundle, isSaved, id, encryptionKey, editKey, burnAfterRead, expiresInMinutes, navigate]);

  const handleDelete = useCallback(async () => {
    if (!id || !editKey) return;
    setIsLoading(true);
    const loadingToast = toast.loading("Deleting workspace...");
    try {
      await deleteWorkspace(id, editKey);
      toast.dismiss(loadingToast);
      toast.success("Workspace deleted");
      setDeleteDialogOpen(false);
      navigate("/");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error instanceof PasteError ? error.message : "Failed to delete workspace");
    } finally {
      setIsLoading(false);
    }
  }, [id, editKey, navigate]);

  const copyUrl = async (url: string, type: "view" | "edit") => {
    try {
      await navigator.clipboard.writeText(url);
      if (type === "view") { setCopiedView(true); setTimeout(() => setCopiedView(false), 2000); }
      else { setCopiedEdit(true); setTimeout(() => setCopiedEdit(false), 2000); }
    } catch { toast.error("Failed to copy to clipboard"); }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (isEditable) handleSave(); }
      if (e.key === "o" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); navigate("/"); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, isEditable, navigate]);

  if (isLoading && !isSaved && id) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0F1014] text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
        <span className="text-[10px] uppercase tracking-wider font-bold text-white/70">Loading workspace...</span>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <WorkspaceSidebar
        tree={bundle.tree}
        selectedIndex={selectedIndex}
        editingIndex={editingIndex}
        isEditable={isEditable}
        onSelectFile={setSelectedIndex}
        onRenameFile={handleRenameFile}
        onFileLanguageChange={handleFileLanguageChange}
        onAddFile={handleAddFile}
        onStartRename={setEditingIndex}
        onDeleteFile={handleDeleteFile}
        onReorderFiles={handleReorderFiles}
      />

      <SidebarInset>
        {/* Top bar */}
        <header className="sticky top-0 z-50 border-b bg-[#0d0e11]">
          {/* Primary row: trigger, logo, filename, actions */}
          <div className="flex min-h-[35px] items-center px-2 py-1 gap-2">
            <SidebarTrigger className="h-6 w-6 shrink-0 text-white/50 hover:text-primary" />

            {/* Logo */}
            <Link
              to="/"
              className="items-center shrink-0 -ml-1 text-lg font-semibold transition-opacity flex md:hidden"
            >
              <span className="group text-[12px] uppercase tracking-wider font-bold transition-colors">
                <span className="brand-gradient">laine</span>
                <span className="text-[12px] uppercase tracking-wider font-bold text-white group-hover:text-white/50 transition-colors">bin</span>
              </span>
            </Link>

            {isLoading && (
              <div className="hidden sm:flex items-center text-xs text-muted-foreground bg-[#0F1014] border-[1px] border-[#20222a] px-2 py-0.5 shrink-0">
                <Loader2 className="h-3 w-3 animate-spin mr-1.5 text-primary" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-white/70">saving...</span>
              </div>
            )}

            {/* Current file name */}
            {selectedFile && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-white/50 hidden lg:inline truncate">
                {selectedFile.name}
              </span>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Language selector */}
            {selectedFile && isEditable && (
              <Select
                value={selectedFile.language}
                onValueChange={(lang) => handleFileLanguageChange(selectedIndex, lang)}
              >
                <SelectTrigger className="h-[21px] w-[90px] sm:w-[120px] text-[10px] uppercase tracking-wider font-bold bg-[#0F1014]/0 border-[#20222a] rounded shrink-0">
                  <SelectValue>{getLanguageLabel(selectedFile.language)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-[#0F1014] border-[#20222a] rounded max-h-[400px]">
                  <SelectItem value="none" className="text-[10px] uppercase tracking-wider font-bold">plain text</SelectItem>
                  {languageOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-[10px] uppercase tracking-wider font-bold">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Markdown toggle */}
            {isMarkdown && !isEditable && (
              <button
                onClick={() => setMarkdownView(!markdownView)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/50 hover:text-primary transition-colors shrink-0"
              >
                {markdownView ? <><Code className="h-3.5 w-3.5" /> <span className="hidden sm:inline">source</span></> : <><Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">preview</span></>}
              </button>
            )}

            {/* Save */}
            {isEditable && (
              <button
                onClick={() => !isLoading && handleSave()}
                disabled={isLoading}
                className="flex items-center gap-1 shrink-0 text-sm font-medium transition-colors !text-green-400 hover:!text-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-xs text-foreground bg-[#0F1014]/0 border rounded border-[#20222a] px-1 py-[2px] font-mono hidden md:inline">
                  ctrl+s
                </span>
                <span className="px-1 py-1 text-[10px] uppercase tracking-wider font-bold transition-colors">
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 sm:hidden" />
                  )}
                  <span className="hidden sm:inline">{isSaved ? "update" : "save"}</span>
                </span>
              </button>
            )}

            {/* Delete workspace */}
            {isSaved && editKey && (
              <button
                onClick={() => !isLoading && setDeleteDialogOpen(true)}
                disabled={isLoading}
                className="flex items-center shrink-0 text-sm font-medium transition-colors !text-red-400 hover:!text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3.5 w-3.5 sm:hidden" />
                <span className="hidden sm:inline py-1 text-[10px] uppercase tracking-wider font-bold transition-colors">
                  delete
                </span>
              </button>
            )}
          </div>

          {/* Secondary row: markdown toolbar, preview toggle, advanced options */}
          {(isNewWorkspace || (isMarkdown && isEditable)) && (
            <div className="flex items-center gap-2 px-2 py-1 border-t border-white/5 bg-[#1a1b20] overflow-x-auto scrollbar-none">
              {/* Markdown toolbar + preview toggle */}
              {isMarkdown && isEditable && selectedFile && (
                <>
                  <MarkdownToolbar editorRef={editorRef} text={selectedFile.content} setText={handleContentChange} />
                  <div className="flex items-center gap-0.5 border-l border-white/10 pl-2 flex-shrink-0">
                    {(["write", "preview", "split"] as const).map((mode) => {
                      const icons = { write: Pencil, preview: Eye, split: Columns };
                      const labels = { write: "Write", preview: "Preview", split: "Split" };
                      const Icon = icons[mode];
                      return (
                        <Button
                          key={mode}
                          variant="ghost"
                          size="sm"
                          className={`h-6 gap-1 text-[10px] uppercase rounded tracking-wider font-bold transition-colors flex-shrink-0 ${
                            previewMode === mode ? "text-primary" : "text-white/40 hover:text-primary"
                          }`}
                          onClick={() => setPreviewMode(mode)}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{labels[mode]}</span>
                        </Button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                {isNewWorkspace && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Flame className={`h-3.5 w-3.5 ${burnAfterRead ? "text-primary" : "text-white/50"}`} />
                          <Switch
                            id="burn"
                            checked={burnAfterRead}
                            onCheckedChange={setBurnAfterRead}
                            className="h-[21px]"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="rounded border border-white/10 bg-black/20 backdrop-blur-sm text-[10px] uppercase tracking-wider font-bold text-white/50">
                        Burn after read
                      </TooltipContent>
                    </Tooltip>

                    <div className="flex items-center gap-1">
                      <Clock className={`h-3.5 w-3.5 ${expiresInMinutes !== "never" ? "text-primary" : "text-white/50"}`} />
                      <Select value={expiresInMinutes} onValueChange={setExpiresInMinutes}>
                        <SelectTrigger className="h-[21px] w-[100px] sm:w-[120px] text-[10px] uppercase tracking-wider font-bold bg-[#0F1014]/0 border-[#20222a] rounded">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0F1014] border-[#20222a] rounded">
                          {EXPIRATION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-[10px] uppercase tracking-wider font-bold">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Editor / Viewer */}
        <main className="flex-1 animate-fade-in flex flex-col min-h-0 overflow-auto">
          {selectedFile ? (
            // Read-only markdown view
            isMarkdown && !isEditable && markdownView ? (
              <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto">
                <MarkdownViewer content={selectedFile.content} />
              </div>
            ) : // Editable markdown - preview only
            isMarkdown && isEditable && previewMode === "preview" ? (
              <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto">
                <MarkdownViewer content={selectedFile.content} />
              </div>
            ) : // Editable markdown - split view
            isMarkdown && isEditable && previewMode === "split" ? (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
                <div className="flex flex-col min-h-0 overflow-hidden border-r border-white/10">
                  <PasteTextArea
                    ref={editorRef}
                    text={selectedFile.content}
                    setText={handleContentChange}
                    language={selectedFile.language}
                    isLoading={isLoading}
                    readOnly={!isEditable}
                    placeholder=""
                    onFileDrop={handleFileDrop}
                    dropDisabled={!isEditable}
                    dropOverlayText="Drop file(s) to add"
                  />
                </div>
                <div className="flex-1 overflow-auto p-6 max-w-none hidden md:block">
                  <MarkdownViewer content={selectedFile.content} />
                </div>
              </div>
            ) : (
              // Default: editor only (write mode or non-markdown)
              <PasteTextArea
                ref={editorRef}
                text={selectedFile.content}
                setText={handleContentChange}
                language={selectedFile.language}
                isLoading={isLoading}
                readOnly={!isEditable}
                placeholder=""
                onFileDrop={handleFileDrop}
                dropDisabled={!isEditable}
                dropOverlayText="Drop file(s) to add"
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-[10px] uppercase tracking-wider font-bold">
              Select a file or add a new one
            </div>
          )}
        </main>
      </SidebarInset>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0F1014] border-[1px] border-[#20222a] rounded">
          <DialogHeader>
            <DialogTitle>Workspace created</DialogTitle>
            <DialogDescription className="text-white/50">Choose a URL to share.</DialogDescription>
          </DialogHeader>

          {(burnAfterRead || expiresInMinutes !== "never") && (
            <div className="flex flex-wrap gap-2 pb-2">
              {burnAfterRead && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-orange-500/10 border border-orange-500/20 text-orange-300">
                  <Flame className="h-3.5 w-3.5" /> Burns after first read
                </div>
              )}
              {expiresInMinutes !== "never" && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
                  <Clock className="h-3.5 w-3.5" /> Expires
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-white text-sm font-medium flex items-center gap-2">
                Read-only URL <span className="text-xs text-white/50">(recommended for sharing)</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareUrls?.readOnly ?? ""}
                  className="flex-1 bg-[#0F1014] border-[#20222a] text-xs font-mono text-white"
                  onFocus={(e) => e.target.select()}
                />
                <Button variant="default" onClick={() => shareUrls && copyUrl(shareUrls.readOnly, "view")}
                  className="h-10 w-10 bg-[#0F1014] border-[1px] border-[#20222a] rounded hover:bg-[#0F1014] hover:text-primary">
                  {copiedView ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-white text-sm font-medium flex items-center gap-2">
                Editable URL <span className="text-xs text-amber-300">(people with this link can edit the workspace)</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareUrls?.editable ?? ""}
                  className="flex-1 bg-[#0F1014] border-[#20222a] text-xs font-mono text-white"
                  onFocus={(e) => e.target.select()}
                />
                <Button variant="default" onClick={() => shareUrls && copyUrl(shareUrls.editable, "edit")}
                  className="h-10 w-10 bg-[#0F1014] border-[1px] border-[#20222a] rounded hover:bg-[#0F1014] hover:text-primary">
                  {copiedEdit ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200/80 italic">
              <strong>Important:</strong> Since we don't save your decryption key, we cannot recover your data if you lose the link. Please keep your URLs safe.
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Workspace Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0F1014] border-[1px] border-[#20222a] rounded">
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription className="text-white/50">
              Are you sure you want to delete this workspace? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}
              className="bg-[#0F1014] border-[1px] border-[#20222a] rounded hover:bg-[#0F1014] hover:text-primary">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading} className="rounded">
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
