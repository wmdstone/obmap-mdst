import { HardDrive, Zap, Trash2, Clock, Network, FileText, Tag, Link2, AlertTriangle, FolderOpen } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

interface VaultCardProps {
  id: string;
  name: string;
  type: 'in-memory' | 'local-folder';
  nodeCount: number;
  linkCount: number;
  lastModified: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  stats?: {
    fileCount: number;
    folderCount: number;
    tagCount: number;
    orphanedNodes: number;
    avgConnections: number;
  };
}

export const VaultCard = ({
  name,
  type,
  nodeCount,
  linkCount,
  lastModified,
  isActive,
  onSelect,
  onDelete,
  stats,
}: VaultCardProps) => {
  return (
    <Card className={`cursor-pointer transition-all hover:shadow-lg ${isActive ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {type === 'in-memory' ? (
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-primary/10">
                <HardDrive className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant={type === 'in-memory' ? 'outline' : 'secondary'} 
                  className="text-xs"
                >
                  {type === 'in-memory' ? 'In-Memory' : 'Local Native'}
                </Badge>
                {type === 'in-memory' && (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Data may be lost if browser cache is cleared</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
          {isActive && (
            <Badge variant="default" className="text-xs">Active</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Network className="w-4 h-4 text-primary" />
            <div>
              <div className="font-medium text-foreground">{nodeCount}</div>
              <div className="text-xs text-muted-foreground">Total Nodes</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link2 className="w-4 h-4 text-primary" />
            <div>
              <div className="font-medium text-foreground">{linkCount}</div>
              <div className="text-xs text-muted-foreground">Connections</div>
            </div>
          </div>
        </div>

        {stats && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{stats.fileCount}</span> files
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{stats.folderCount}</span> folders
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{stats.tagCount}</span> tags
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Network className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{stats.avgConnections.toFixed(1)}</span> avg
                </span>
              </div>
            </div>
            {stats.orphanedNodes > 0 && (
              <Badge variant="outline" className="text-xs w-fit">
                {stats.orphanedNodes} orphaned node{stats.orphanedNodes > 1 ? 's' : ''}
              </Badge>
            )}
          </>
        )}
        
        <Separator />
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Modified {formatDistanceToNow(lastModified, { addSuffix: true })}</span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button 
          onClick={onSelect} 
          variant={isActive ? "secondary" : "default"}
          className="flex-1"
          disabled={isActive}
        >
          {isActive ? 'Current Vault' : 'Open Vault'}
        </Button>
        <Button 
          onClick={onDelete} 
          variant="ghost" 
          size="icon"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};
