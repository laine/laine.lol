import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2, GripVertical } from "lucide-react";
import { LanguageIcon } from "./LanguageIcon";
import {
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getLanguageFromExtension } from "@/utils/language-utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FileTreeItemProps {
  id: string;
  name: string;
  language: string;
  isActive: boolean;
  isEditing: boolean;
  isEditable: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onLanguageChange: (language: string) => void;
  onStartRename: () => void;
  onDelete: () => void;
}

export function FileTreeItem({
  id,
  name,
  language,
  isActive,
  isEditing,
  isEditable,
  canDelete,
  onSelect,
  onRename,
  onLanguageChange,
  onStartRename,
  onDelete,
}: FileTreeItemProps) {
  const [editValue, setEditValue] = useState(name);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditable || isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  useEffect(() => {
    if (deleteConfirm) {
      deleteTimerRef.current = setTimeout(() => setDeleteConfirm(false), 2000);
      return () => {
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      };
    }
  }, [deleteConfirm]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm) {
      onDelete();
      setDeleteConfirm(false);
    } else {
      setDeleteConfirm(true);
    }
  };

  const handleRenameSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
      const detectedLang = getLanguageFromExtension(trimmed);
      if (detectedLang) {
        onLanguageChange(detectedLang);
      }
    } else {
      onRename(name);
    }
  };

  if (isEditing) {
    return (
      <SidebarMenuItem ref={setNodeRef} style={style}>
        <div className="px-2 py-0.5">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") onRename(name);
            }}
            autoFocus
            className="h-6 text-xs bg-transparent border-primary/50 focus-visible:ring-primary/30 rounded px-1"
          />
        </div>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onSelect}
        tooltip={name}
        size="sm"
        className="text-[11px] font-mono pr-14 rounded"
      >
        {/* Drag handle — hidden when sidebar collapsed */}
        {isEditable && (
          <button
            className="shrink-0 cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 -ml-1 touch-none group-data-[collapsible=icon]:hidden"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        <LanguageIcon language={language} />
        <span className="truncate">{name}</span>
      </SidebarMenuButton>

      {isEditable && (
        <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 group-hover/menu-item:opacity-100 transition-opacity group-data-[collapsible=icon]:hidden">
          {canDelete && (
            <button
              onClick={handleDeleteClick}
              className={`flex items-center justify-center h-5 w-5 rounded transition-colors ${
                deleteConfirm
                  ? "text-red-400 bg-red-500/20 rounded"
                  : "text-sidebar-foreground/50 hover:text-red-400 rounded"
              }`}
              title={deleteConfirm ? "Click again to confirm delete" : "Delete file"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center h-5 w-5 rounded-sm text-sidebar-foreground/50 hover:text-primary transition-colors">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              className="w-36 bg-[#0F1014] border-[#20222a] rounded z-[9999]"
            >
              <DropdownMenuItem
                onClick={onStartRename}
                className="text-xs gap-2 rounded cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </SidebarMenuItem>
  );
}
