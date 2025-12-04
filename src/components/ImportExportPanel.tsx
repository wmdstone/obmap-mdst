import { useState, useRef } from "react";
import {
  Upload,
  Download,
  FileArchive,
  Folder,
  FileText,
  Image,
  Music,
  Video,
  Check,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { importExportService, ImportResult, ExportOptions, GraphNode } from "@/services/import-export/ImportExportService";

interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file" | "media";
  parentId: string | null;
  depth: number;
  tags: string[];
  mediaType?: "image" | "audio" | "video";
  mimeType?: string;
  dataUrl?: string;
  wikilinks?: string[];
}

interface ImportExportPanelProps {
  nodes: Node[];
  onImportComplete: (importedNodes: Node[]) => void;
}

export const ImportExportPanel = ({ nodes, onImportComplete }: ImportExportPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [selectedExportNodes, setSelectedExportNodes] = useState<Set<string>>(new Set());
  const [includeMedia, setIncludeMedia] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = async (files: FileList | null, type: string) => {
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setImportProgress(10);

    try {
      setImportProgress(30);
      const result = await importExportService.importFiles(files, nodes as GraphNode[]);
      setImportProgress(100);
      setLastResult(result);

      if (result.nodes.length > 0) {
        // Merge imported nodes with existing nodes
        onImportComplete(result.nodes as Node[]);
        toast.success(
          `Imported ${result.folders} folders, ${result.files} files, ${result.media} media`
        );
      } else if (result.errors.length > 0) {
        toast.warning(`Import completed with ${result.errors.length} errors`);
      } else {
        toast.info('No supported files found to import');
      }
    } catch (error) {
      toast.error(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      // Reset file inputs
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
      if (zipInputRef.current) zipInputRef.current.value = '';
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const handleExport = async (type: ExportOptions["type"]) => {
    const options: ExportOptions = {
      type,
      includeMedia,
      nodeIds: type === "folder" || type === "files" ? Array.from(selectedExportNodes) : undefined,
    };

    if ((type === "folder" || type === "files") && selectedExportNodes.size === 0) {
      toast.error("Please select items to export");
      return;
    }

    try {
      const blob = await importExportService.exportData(nodes as GraphNode[], options);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().split("T")[0];
      a.download = `export_${type}_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported successfully`);
    } catch (error) {
      toast.error(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const toggleNodeSelection = (nodeId: string) => {
    const newSelection = new Set(selectedExportNodes);
    if (newSelection.has(nodeId)) {
      newSelection.delete(nodeId);
    } else {
      newSelection.add(nodeId);
    }
    setSelectedExportNodes(newSelection);
  };

  const folders = nodes.filter((n) => n.type === "folder");
  const files = nodes.filter((n) => n.type === "file");
  const media = nodes.filter((n) => n.type === "media" || n.mediaType);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-full">
          <FileArchive className="w-4 h-4" />
          Import/Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Import / Export</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="gap-2">
              <Upload className="w-4 h-4" />
              Import
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4 mt-4">
            {isImporting && (
              <div className="space-y-2">
                <Progress value={importProgress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  Importing files...
                </p>
              </div>
            )}

            {lastResult && (
              <div
                className={`p-3 rounded-lg border ${
                  lastResult.success
                    ? "border-green-500/30 bg-green-500/10"
                    : "border-yellow-500/30 bg-yellow-500/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {lastResult.success ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-sm font-medium">
                    {lastResult.success ? "Import Complete" : "Import Completed with Warnings"}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{lastResult.folders} folders</span>
                  <span>{lastResult.files} files</span>
                  <span>{lastResult.media} media</span>
                </div>
                {lastResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-destructive">
                    {lastResult.errors.slice(0, 3).map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                    {lastResult.errors.length > 3 && (
                      <p>...and {lastResult.errors.length - 3} more errors</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Files */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md,.markdown,.txt"
                className="hidden"
                onChange={(e) => handleFileImport(e.target.files, "files")}
              />
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <FileText className="w-6 h-6" />
                <span className="text-sm">Files</span>
                <span className="text-xs text-muted-foreground">.md, .txt</span>
              </Button>

              {/* Folder */}
              <input
                ref={folderInputRef}
                type="file"
                multiple
                {...{ webkitdirectory: "", directory: "" } as any}
                className="hidden"
                onChange={(e) => handleFileImport(e.target.files, "folder")}
              />
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => folderInputRef.current?.click()}
                disabled={isImporting}
              >
                <Folder className="w-6 h-6" />
                <span className="text-sm">Folder</span>
                <span className="text-xs text-muted-foreground">With structure</span>
              </Button>

              {/* ZIP */}
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => handleFileImport(e.target.files, "zip")}
              />
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => zipInputRef.current?.click()}
                disabled={isImporting}
              >
                <FileArchive className="w-6 h-6" />
                <span className="text-sm">ZIP Archive</span>
                <span className="text-xs text-muted-foreground">.zip</span>
              </Button>

              {/* Media */}
              <input
                ref={mediaInputRef}
                type="file"
                multiple
                accept="image/*,audio/*,video/*"
                className="hidden"
                onChange={(e) => handleFileImport(e.target.files, "media")}
              />
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => mediaInputRef.current?.click()}
                disabled={isImporting}
              >
                <div className="flex gap-1">
                  <Image className="w-5 h-5" />
                  <Music className="w-5 h-5" />
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-sm">Media</span>
                <span className="text-xs text-muted-foreground">Image, Audio, Video</span>
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Supported formats:</strong>
              </p>
              <p>• Markdown: .md, .markdown, .txt</p>
              <p>• Images: .png, .jpg, .gif, .webp, .svg</p>
              <p>• Audio: .mp3, .wav, .ogg, .m4a</p>
              <p>• Video: .mp4, .webm, .mov</p>
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Quick Export</span>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeMedia"
                    checked={includeMedia}
                    onCheckedChange={(checked) => setIncludeMedia(!!checked)}
                  />
                  <label htmlFor="includeMedia" className="text-sm text-muted-foreground">
                    Include media
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => handleExport("vault")}
                >
                  <FileArchive className="w-5 h-5" />
                  <span className="text-sm">Entire Vault</span>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-20 flex-col gap-2">
                      <Download className="w-5 h-5" />
                      <span className="text-sm">Export Selected</span>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExport("folder")}>
                      <Folder className="w-4 h-4 mr-2" />
                      Selected Folders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("files")}>
                      <FileText className="w-4 h-4 mr-2" />
                      Selected Files
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExport("media")}>
                      <Image className="w-4 h-4 mr-2" />
                      All Media Only
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Select Items to Export</span>
                <Badge variant="secondary">{selectedExportNodes.size} selected</Badge>
              </div>

              <ScrollArea className="h-[200px] border rounded-lg p-2">
                <div className="space-y-1">
                  {folders.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Folders</p>
                      {folders.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer"
                          onClick={() => toggleNodeSelection(node.id)}
                        >
                          <Checkbox checked={selectedExportNodes.has(node.id)} />
                          <Folder className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm truncate">{node.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Files</p>
                      {files.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer"
                          onClick={() => toggleNodeSelection(node.id)}
                        >
                          <Checkbox checked={selectedExportNodes.has(node.id)} />
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm truncate">{node.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {media.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Media</p>
                      {media.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer"
                          onClick={() => toggleNodeSelection(node.id)}
                        >
                          <Checkbox checked={selectedExportNodes.has(node.id)} />
                          {node.mediaType === "image" && (
                            <Image className="w-4 h-4 text-green-500" />
                          )}
                          {node.mediaType === "audio" && (
                            <Music className="w-4 h-4 text-purple-500" />
                          )}
                          {node.mediaType === "video" && (
                            <Video className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-sm truncate">{node.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {nodes.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No items to export
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
