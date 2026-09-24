import { Plus, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_WORKSPACE_FILES } from "@/lib/workspace-types";
import { toast } from "sonner";
import { Badge } from "../ui/badge";

interface WorkspaceToolbarProps {
  fileCount: number;
  onAddFile: () => void;
  onAddFolder?: () => void;
  showFolderButton?: boolean;
  disabled?: boolean;
}

export function WorkspaceToolbar({
  fileCount,
  onAddFile,
  onAddFolder,
  showFolderButton = false,
  disabled = false,
}: WorkspaceToolbarProps) {
  const handleAddFile = () => {
    if (fileCount >= MAX_WORKSPACE_FILES) {
      toast.error(`Maximum ${MAX_WORKSPACE_FILES} files per workspace`);
      return;
    }
    onAddFile();
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded"
        onClick={handleAddFile}
        disabled={disabled}
        title="Add file"
      >
        <Plus className="h-4 w-4" />
      </Button>
      {showFolderButton && onAddFolder && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded"
          onClick={onAddFolder}
          disabled={disabled}
          title="Add folder"
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      )}
      <Badge className={`text-xs ml-auto ${fileCount === MAX_WORKSPACE_FILES ? "text-destructive bg-red-500/10 border-red-500/10 hover:bg-red-500/10 hover:text-destructive" : "bg-white/5 hover:bg-white/5"}`}>
        You can add {MAX_WORKSPACE_FILES - fileCount} more files
      </Badge>
    </div>
  );
}
