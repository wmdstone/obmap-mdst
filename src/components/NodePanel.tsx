import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Trash2, Save, Tag, Folder, FileText, Eye, Code, Split, Image, Music, Video, Link2, Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BacklinksPanel } from "@/components/BacklinksPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";

interface Node {
  id: string;
  name: string;
  content: string;
  type: "folder" | "file" | "media";
  parentId: string | null;
  depth: number;
  tags: string[];
  mediaType?: "image" | "audio" | "video";
  dataUrl?: string;
  mimeType?: string;
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

// Media Preview Component
const MediaPreview = ({ node, onUpdate }: { node: Node; onUpdate: (node: Node) => void }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const togglePlay = () => {
    const media = node.mediaType === "audio" ? audioRef.current : videoRef.current;
    if (media) {
      if (isPlaying) {
        media.pause();
      } else {
        media.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    const media = node.mediaType === "audio" ? audioRef.current : videoRef.current;
    if (media) {
      media.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    const media = node.mediaType === "audio" ? audioRef.current : videoRef.current;
    if (media) {
      setCurrentTime(media.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const media = node.mediaType === "audio" ? audioRef.current : videoRef.current;
    if (media) {
      setDuration(media.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    const media = node.mediaType === "audio" ? audioRef.current : videoRef.current;
    if (media) {
      media.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (container) {
      if (!document.fullscreenElement) {
        container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  if (node.mediaType === "image") {
    return (
      <div className="space-y-4">
        <div className="relative bg-muted rounded-lg overflow-hidden">
          <img
            src={node.dataUrl}
            alt={node.name}
            className="w-full h-auto max-h-[400px] object-contain"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          <p>Type: {node.mimeType || "image"}</p>
        </div>
      </div>
    );
  }

  if (node.mediaType === "audio") {
    return (
      <div className="space-y-4">
        <div className="bg-muted rounded-lg p-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center">
              <Music className="w-12 h-12 text-primary" />
            </div>
          </div>
          <audio
            ref={audioRef}
            src={node.dataUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          <div className="space-y-3">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button variant="ghost" size="icon" onClick={toggleMute}>
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              <Button variant="default" size="icon" className="w-12 h-12 rounded-full" onClick={togglePlay}>
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </Button>
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          <p>Type: {node.mimeType || "audio"}</p>
        </div>
      </div>
    );
  }

  if (node.mediaType === "video") {
    return (
      <div className="space-y-4">
        <div className="relative bg-muted rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={node.dataUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            className="w-full max-h-[400px]"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="space-y-2">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="w-full"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-white hover:text-white" onClick={togglePlay}>
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white hover:text-white" onClick={toggleMute}>
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                  <span className="text-xs text-white">{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>
                <Button variant="ghost" size="icon" className="text-white hover:text-white" onClick={handleFullscreen}>
                  <Maximize2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          <p>Type: {node.mimeType || "video"}</p>
        </div>
      </div>
    );
  }

  return null;
};

// Get icon for node type
const getNodeIcon = (node: Node) => {
  if (node.type === "folder") return <Folder className="w-5 h-5 text-yellow-500" />;
  if (node.type === "media") {
    switch (node.mediaType) {
      case "image": return <Image className="w-5 h-5 text-green-500" />;
      case "audio": return <Music className="w-5 h-5 text-purple-500" />;
      case "video": return <Video className="w-5 h-5 text-red-500" />;
    }
  }
  return <FileText className="w-5 h-5 text-primary" />;
};

const getNodeTitle = (node: Node) => {
  if (node.type === "folder") return "Edit Folder";
  if (node.type === "media") {
    switch (node.mediaType) {
      case "image": return "Edit Image";
      case "audio": return "Edit Audio";
      case "video": return "Edit Video";
    }
  }
  return "Edit File";
};

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

  const copyEmbedLink = () => {
    const embedSyntax = node.mediaType === "image" 
      ? `![[${node.name}]]`
      : `[[${node.name}]]`;
    navigator.clipboard.writeText(embedSyntax);
    toast.success("Embed link copied!");
  };

  return (
    <div className="fixed top-4 right-4 w-[95vw] max-w-[800px] h-[calc(100vh-2rem)] bg-card border border-border rounded-lg shadow-2xl z-40 flex flex-col md:w-[600px] lg:w-[700px] xl:w-[800px]">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {getNodeIcon(node)}
          <h2 className="text-lg font-semibold text-foreground">
            {getNodeTitle(node)}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {node.type === "media" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={copyEmbedLink}
              className="hover:bg-secondary"
            >
              <Link2 className="w-4 h-4 mr-1" />
              Copy Link
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-8rem)]">
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">
            {node.type === "folder" ? "Folder Name" : node.type === "media" ? "Media Name" : "File Name"}
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              node.type === "folder" 
                ? "Enter folder name..." 
                : node.type === "media" 
                  ? "Enter media name..." 
                  : "Enter file name..."
            }
            className="bg-secondary border-border"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
          <div>
            <span className="text-xs text-muted-foreground">Type</span>
            <p className="text-sm font-medium flex items-center gap-1">
              {node.type === "folder" && "📁 Folder"}
              {node.type === "file" && "📄 File"}
              {node.type === "media" && node.mediaType === "image" && "🖼️ Image"}
              {node.type === "media" && node.mediaType === "audio" && "🎵 Audio"}
              {node.type === "media" && node.mediaType === "video" && "🎬 Video"}
            </p>
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

        {/* Media Preview */}
        {node.type === "media" && node.dataUrl && (
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Preview
            </Label>
            <MediaPreview node={node} onUpdate={onUpdate} />
          </div>
        )}

        {/* Media Description */}
        {node.type === "media" && (
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Description / Notes
            </Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add notes or description for this media..."
              className="min-h-[100px] bg-secondary border-border text-sm resize-none"
            />
          </div>
        )}

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

        {(node.type === "file" || node.type === "media") && backlinks && backlinks.length > 0 && (
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
