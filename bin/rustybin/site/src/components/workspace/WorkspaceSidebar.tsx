import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarGroupLabel,
  SidebarGroup,
  SidebarGroupContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { FileTreeItem } from "./FileTreeItem";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import type { WorkspaceNode, WorkspaceFile } from "@/lib/workspace-types";
import { countFiles } from "@/lib/workspace-types";
import { Badge } from "../ui/badge";

interface WorkspaceSidebarProps {
  tree: WorkspaceNode[];
  selectedIndex: number;
  editingIndex: number | null;
  isEditable: boolean;
  onSelectFile: (index: number) => void;
  onRenameFile: (index: number, newName: string) => void;
  onFileLanguageChange: (index: number, language: string) => void;
  onAddFile: () => void;
  onStartRename: (index: number) => void;
  onDeleteFile: (index: number) => void;
  onReorderFiles: (oldIndex: number, newIndex: number) => void;
}

export function WorkspaceSidebar({
  tree,
  selectedIndex,
  editingIndex,
  isEditable,
  onSelectFile,
  onRenameFile,
  onFileLanguageChange,
  onAddFile,
  onStartRename,
  onDeleteFile,
  onReorderFiles,
}: WorkspaceSidebarProps) {
  const fileCount = countFiles(tree);

  const files = tree.filter(
    (node): node is WorkspaceFile => node.type === "file",
  );

  // Stable sortable IDs
  const sortableIds = useMemo(
    () => files.map((_, i) => `file-${i}`),
    [files.length],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorderFiles(oldIndex, newIndex);
    }
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border group-data-[collapsible=icon]:border-b-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:hidden">
        <div className="flex items-center justify-between px-1">
          <Link
            to="/"
            className="text-[12px] uppercase tracking-wider font-bold truncate"
          >
            <span className="text-primary">foxy</span>
            <span className="text-white hover:text-white/50 transition-colors">
              bin
            </span>
          </Link>
          <div className="text-[10px] text-white/60 uppercase tracking-wider font-bold">
            Workspace
          </div>
        </div>
        <SidebarGroup className="p-0">
          {isEditable && (
            <SidebarGroupContent>
              <WorkspaceToolbar fileCount={fileCount} onAddFile={onAddFile} />
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="">
          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                <SidebarMenu>
                  {files.map((file, index) => (
                    <FileTreeItem
                      key={sortableIds[index]}
                      id={sortableIds[index]}
                      name={file.name}
                      language={file.language}
                      isActive={index === selectedIndex}
                      isEditing={index === editingIndex}
                      isEditable={isEditable}
                      canDelete={files.length > 1}
                      onSelect={() => onSelectFile(index)}
                      onRename={(newName) => onRenameFile(index, newName)}
                      onLanguageChange={(lang) =>
                        onFileLanguageChange(index, lang)
                      }
                      onStartRename={() => onStartRename(index)}
                      onDelete={() => onDeleteFile(index)}
                    />
                  ))}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:border-t-0">
        <div className="px-2 py-1 text-[10px] text-white/20 uppercase tracking-wider font-bold">
          {fileCount} file{fileCount !== 1 ? "s" : ""}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
