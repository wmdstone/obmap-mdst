import { useState, useRef } from "react";
import { Music, Play, Pause, Volume2, VolumeX, Maximize2,FileText, Download } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Slider } from "@/shared/ui/slider-number";

export interface NodeMediaItem {
  name: string;
  mediaType?: "image" | "audio" | "video" | "pdf";
  dataUrl?: string;
}

interface NodeMediaPreviewProps {
  node: NodeMediaItem;
}

export const NodeMediaPreview = ({ node }: NodeMediaPreviewProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const media =
      node.mediaType === "audio" ? audioRef.current : videoRef.current;
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
    const media =
      node.mediaType === "audio" ? audioRef.current : videoRef.current;
    if (media) {
      media.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    const media =
      node.mediaType === "audio" ? audioRef.current : videoRef.current;
    if (media) {
      setCurrentTime(media.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const media =
      node.mediaType === "audio" ? audioRef.current : videoRef.current;
    if (media) {
      setDuration(media.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    const media =
      node.mediaType === "audio" ? audioRef.current : videoRef.current;
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
      } else {
        document.exitFullscreen();
      }
    }
  };

  if (node.mediaType === "image") {
    return (
      <div className="rounded-lg overflow-hidden bg-muted/30">
        <img
          src={node.dataUrl}
          alt={node.name}
          className="w-full h-auto max-h-[50vh] object-contain"
        />
      </div>
    );
  }

  if (node.mediaType === "audio") {
    return (
      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-8">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
            <Music className="w-10 h-10 text-primary" />
          </div>
          <audio
            ref={audioRef}
            src={node.dataUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          <div className="w-full max-w-sm space-y-4">
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
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (node.mediaType === "video") {
    return (
      <div className="relative rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={node.dataUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          className="w-full max-h-[50vh]"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full mb-3"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </Button>
              <span className="text-xs text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
              onClick={handleFullscreen}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (node.mediaType === "pdf") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-medium leading-none">{node.name}</p>
              <p className="text-xs text-muted-foreground mt-1">PDF Document</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {node.dataUrl && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    const win = window.open();
                    win?.document.write(
                      `<iframe src="${node.dataUrl}" frameborder="0" style="border:0; position:fixed; top:0; left:0; width:100%; height:100%;" allowfullscreen></iframe>`
                    );
                  }}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Full Screen
                </Button>
                <a
                  href={node.dataUrl}
                  download={node.name}
                  className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              </>
            )}
          </div>
        </div>

        {/* Embedded PDF Viewer */}
        <div className="w-full h-[65vh] rounded-lg overflow-hidden border border-border/60 bg-muted/20">
          {node.dataUrl ? (
            <object
              data={node.dataUrl}
              type="application/pdf"
              className="w-full h-full"
            >
              <iframe
                src={node.dataUrl}
                title={node.name}
                className="w-full h-full border-none"
              />
            </object>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
              PDF data not available
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};