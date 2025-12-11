import { Cloud, HardDrive, Laptop } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StorageStrategy, STORAGE_STRATEGY_LABELS, STORAGE_STRATEGY_DESCRIPTIONS } from "@/services/vault/types";

interface StorageStrategySelectorProps {
  value: StorageStrategy;
  onChange: (strategy: StorageStrategy) => void;
  disabled?: boolean;
  isAuthenticated?: boolean;
}

const strategyIcons: Record<StorageStrategy, React.ReactNode> = {
  memory: <Laptop className="w-4 h-4" />,
  cloud: <Cloud className="w-4 h-4" />,
  filesystem: <HardDrive className="w-4 h-4" />,
};

const strategyColors: Record<StorageStrategy, string> = {
  memory: 'text-amber-500',
  cloud: 'text-blue-500',
  filesystem: 'text-green-500',
};

export function StorageStrategySelector({ 
  value, 
  onChange, 
  disabled,
  isAuthenticated = true 
}: StorageStrategySelectorProps) {
  return (
    <Select 
      value={value} 
      onValueChange={(v) => onChange(v as StorageStrategy)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          <div className="flex items-center gap-2">
            <span className={strategyColors[value]}>{strategyIcons[value]}</span>
            <span>{STORAGE_STRATEGY_LABELS[value]}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="memory">
          <div className="flex items-center gap-2">
            <span className={strategyColors.memory}>{strategyIcons.memory}</span>
            <div>
              <div className="font-medium">{STORAGE_STRATEGY_LABELS.memory}</div>
              <div className="text-xs text-muted-foreground">{STORAGE_STRATEGY_DESCRIPTIONS.memory}</div>
            </div>
          </div>
        </SelectItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <SelectItem value="cloud" disabled={!isAuthenticated}>
                <div className="flex items-center gap-2">
                  <span className={strategyColors.cloud}>{strategyIcons.cloud}</span>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {STORAGE_STRATEGY_LABELS.cloud}
                      {!isAuthenticated && <Badge variant="outline" className="text-xs">Sign in required</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{STORAGE_STRATEGY_DESCRIPTIONS.cloud}</div>
                  </div>
                </div>
              </SelectItem>
            </div>
          </TooltipTrigger>
          {!isAuthenticated && (
            <TooltipContent>
              <p>Sign in to enable cloud sync</p>
            </TooltipContent>
          )}
        </Tooltip>
        <SelectItem value="filesystem" disabled>
          <div className="flex items-center gap-2 opacity-50">
            <span className={strategyColors.filesystem}>{strategyIcons.filesystem}</span>
            <div>
              <div className="font-medium">{STORAGE_STRATEGY_LABELS.filesystem}</div>
              <div className="text-xs text-muted-foreground">Use "Open Local Folder" to create</div>
            </div>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

export function StorageStrategyBadge({ strategy }: { strategy: StorageStrategy }) {
  return (
    <Badge 
      variant="outline" 
      className={`text-xs gap-1 ${strategyColors[strategy]}`}
    >
      {strategyIcons[strategy]}
      {STORAGE_STRATEGY_LABELS[strategy]}
    </Badge>
  );
}
