import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Trash2, Save, Tag, Folder, FileText, Eye, Code, Split } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BacklinksPanel } from "@/components/BacklinksPanel";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file";
  parentId: string | null;
  depth: number;
  tags: string[];
}

interface Backlink {
  nodeId: string;
  nodeName: string;
  isWikilink: boolean;
}

interface NodePanelProps {
  node: Node | null;
  onClose: () => void;
  onUpdate: (node: Node) => void;
  onDelete: (nodeId: string) => void;
  backlinks?: Backlink[];
  onWikilinkClick?: (target: string) => void;
  onBacklinkClick?: (nodeId: string) => void;
  onTagClick?: (tag: string) => void;
}

export const NodePanel = ({ 
  node, 
  onClose, 
  onUpdate, 
  onDelete,
  backlinks = [],
  onWikilinkClick,
  onBacklinkClick,
  onTagClick,
}: NodePanelProps) => {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [editorMode, setEditorMode] = useState<"source" | "preview" | "split">("split");

  useEffect(() => {
    if (node) {
      setName(node.name);
      setContent(node.content);
      setTags(node.tags || []);
    }
  }, [node]);

  if (!node) return null;

  const handleSave = () => {
    onUpdate({
      ...node,
      name,
      content,
      tags,
    });
    toast.success("Node updated!");
  };

  const handleDelete = () => {
    onDelete(node.id);
    onClose();
    toast.success("Node deleted!");
  };

  const addTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="fixed top-4 right-4 w-[95vw] max-w-[800px] h-[calc(100vh-2rem)] bg-card border border-border rounded-lg shadow-2xl z-40 flex flex-col md:w-[600px] lg:w-[700px] xl:w-[800px]">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {node.type === "folder" ? (
            <Folder className="w-5 h-5 text-yellow-500" />
          ) : (
            <FileText className="w-5 h-5 text-primary" />
          )}
          <h2 className="text-lg font-semibold text-foreground">
            {node.type === "folder" ? "Edit Folder" : "Edit File"}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="hover:bg-secondary"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-8rem)]">
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">
            {node.type === "folder" ? "Folder Name" : "File Name"}
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={node.type === "folder" ? "Enter folder name..." : "Enter file name..."}
            className="bg-secondary border-border"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
          <div>
            <span className="text-xs text-muted-foreground">Type</span>
            <p className="text-sm font-medium">{node.type === "folder" ? "📁 Folder" : "📄 File"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Depth</span>
            <p className="text-sm font-medium">Level {node.depth}</p>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tags
          </Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="Add tag..."
              className="bg-secondary border-border"
            />
            <Button onClick={addTag} size="sm" variant="secondary">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={() => removeTag(tag)}
              >
                #{tag}
                <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground">No tags yet</p>
            )}
          </div>
        </div>

        {node.type === "file" && (
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium text-foreground">
                Content
              </Label>
              <div className="flex gap-1">
                <Button
                  variant={editorMode === "source" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setEditorMode("source")}
                >
                  <Code className="w-3 h-3 mr-1" />
                  Source
                </Button>
                <Button
                  variant={editorMode === "preview" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setEditorMode("preview")}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant={editorMode === "split" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setEditorMode("split")}
                >
                  <Split className="w-3 h-3 mr-1" />
                  Split
                </Button>
              </div>
            </div>

            {editorMode === "source" && (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your notes here (supports markdown, wikilinks [[Note Name]], tags #tag)..."
                className="min-h-[400px] bg-secondary border-border font-mono text-sm resize-none"
              />
            )}

            {editorMode === "preview" && (
              <ScrollArea className="h-[400px] bg-secondary border border-border rounded-md p-4">
                <MarkdownRenderer 
                  content={content} 
                  onWikilinkClick={onWikilinkClick}
                  onTagClick={onTagClick}
                />
              </ScrollArea>
            )}

            {editorMode === "split" && (
              <div className="grid grid-cols-2 gap-2 h-[400px]">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your notes here..."
                  className="bg-secondary border-border font-mono text-sm resize-none"
                />
                <ScrollArea className="bg-secondary border border-border rounded-md p-4">
                  <MarkdownRenderer 
                    content={content}
                    onWikilinkClick={onWikilinkClick}
                    onTagClick={onTagClick}
                  />
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {node.type === "folder" && (
          <div className="flex-1">
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Description
            </Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe this folder..."
              className="min-h-[200px] bg-secondary border-border text-sm resize-none"
            />
          </div>
        )}

        {node.type === "file" && backlinks && backlinks.length > 0 && (
          <div className="mt-4">
            <BacklinksPanel 
              backlinks={backlinks}
              onBacklinkClick={onBacklinkClick || (() => {})}
            />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border flex gap-2">
        <Button
          onClick={handleSave}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        <Button
          onClick={handleDelete}
          variant="destructive"
          className="flex-1"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </div>
    </div>
  );
};
