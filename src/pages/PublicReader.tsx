// src/pages/PublicReader.tsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  PublicReaderService,
  type PublicVaultInfo,
} from "@/domains/public-reader/services/PublicReaderService";
import { PublicMarkdownReader } from "@/domains/public-reader/components/PublicMarkdownReader";
import { PublicInteractiveGraph } from "@/domains/public-reader/components/PublicInteractiveGraph";
import { PublicFileTree } from "@/domains/public-reader/components/PublicFileTree";
import { PublicBreadcrumbs } from "@/domains/public-reader/components/PublicBreadcrumbs";
import { PublicFolderOverview } from "@/domains/public-reader/components/PublicFolderOverview";
import type { NoteRecord } from "@/types/collaboration";
import type { GraphData } from "@/shared/stores/types";
import { Button } from "@/global/ui/button";
import { Input } from "@/global/ui/input";
import { Badge } from "@/global/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/global/ui/avatar";
import {
  BookOpen,
  Network,
  Search,
  Calendar,
  Share2,
  ExternalLink,
  Menu,
  X,
  Compass,
  User,
} from "lucide-react";
import { toast } from "sonner";

export const PublicReader: React.FC = () => {
  const { username, vaultSlug, noteSlug } = useParams<{
    username?: string;
    vaultSlug?: string;
    noteSlug?: string;
  }>();

  const navigate = useNavigate();

  // State Utama
  const [vaultInfo, setVaultInfo] = useState<PublicVaultInfo | null>(null);
  const [publishedNotes, setPublishedNotes] = useState<NoteRecord[]>([]);
  const [activeNote, setActiveNote] = useState<NoteRecord | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [activeView, setActiveView] = useState<"content" | "graph">("content");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load Data Publik
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const param1 = username || vaultSlug;
      const param2 = username ? vaultSlug : noteSlug;
      const param3 = username ? noteSlug : undefined;

      if (!param1) {
        setIsLoading(false);
        setErrorMessage("Format URL tidak valid.");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await PublicReaderService.resolvePublicRoute(param1, param2, param3);

        if (!isMounted) return;

        if (result.status === "redirect" && result.redirectUrl) {
          toast.info("Mengalihkan ke alamat kanonikal...");
          navigate(result.redirectUrl, { replace: true });
          return;
        }

        if (result.status === "not_found" || !result.vault) {
          setVaultInfo(null);
          setErrorMessage(result.errorReason || "Dokumen tidak ditemukan.");
          setIsLoading(false);
          return;
        }

        setVaultInfo(result.vault);
        setPublishedNotes(result.notes || []);
        setGraphData(result.graph || { nodes: [], links: [] });

        if (result.activeNote) {
          setActiveNote(result.activeNote);

          // Sinkronkan URL jika membuka root vault
          if (!noteSlug && result.activeNote.slug) {
            navigate(
              `/p/${result.vault.owner.username}/${result.vault.slug}/${result.activeNote.slug}`,
              { replace: true },
            );
          }
        } else {
          setActiveNote(null);
        }
      } catch (err: any) {
        console.error("Gagal memuat portal publik:", err);
        if (isMounted) {
          setErrorMessage("Terjadi kesalahan teknis saat memuat catatan publik.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [username, vaultSlug, noteSlug, navigate]);

  // Map slug -> title untuk pendeteksi ghost link wikilink
  const publishedSlugMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const note of publishedNotes) {
      map.set(note.slug, note.title);
    }
    return map;
  }, [publishedNotes]);

  // Map note.id -> slug untuk interaksi graf
  const noteIdToSlugMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const note of publishedNotes) {
      map.set(note.id, note.slug);
    }
    return map;
  }, [publishedNotes]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Tautan dokumen disalin ke clipboard!");
    }
  };

  const currentUsername = vaultInfo?.owner.username || "";
  const currentVaultSlug = vaultInfo?.slug || "";

  // Pemilihan Node (Folder atau Catatan)
  const handleSelectNode = (note: NoteRecord) => {
    setActiveNote(note);
    setActiveView("content");
    setIsSidebarOpen(false);
    navigate(`/p/${currentUsername}/${currentVaultSlug}/${note.slug}`);
  };

  const handleNavigateHome = () => {
    if (publishedNotes.length > 0) {
      handleSelectNode(publishedNotes[0]);
    }
  };

  // Cek apakah item aktif merupakan folder
  const isActiveFolder = useMemo(() => {
    if (!activeNote) return false;
    const fm = (activeNote.frontmatter as Record<string, any>) || {};
    return fm.type === "folder" || fm.is_folder === true;
  }, [activeNote]);

  // Loading State
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">Memuat dokumen publik...</p>
        </div>
      </div>
    );
  }

  // Not Found State
  if (!vaultInfo) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background px-4 text-center select-none">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Compass className="w-6 h-6 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Halaman Tidak Ditemukan</h1>
        <p className="text-muted-foreground max-w-md mb-6 text-xs">
          {errorMessage ||
            "Vault atau catatan yang Anda tuju tidak tersedia atau belum dipublikasikan."}
        </p>
        <Link to="/">
          <Button variant="outline" size="sm">
            Kembali ke Beranda
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* 1. TOP HEADER (Fixed h-14) */}
      <header className="h-14 shrink-0 border-b border-border/80 bg-background/90 backdrop-blur-md px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle Menu"
          >
            {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>

          {/* Breadcrumb Penulis & Vault */}
          <div className="flex items-center gap-2 text-xs md:text-sm font-semibold min-w-0">
            <Link
              to={`/p/${currentUsername}/${currentVaultSlug}`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
            >
              <Avatar className="w-6 h-6 border border-border">
                {vaultInfo.owner.avatarUrl && <AvatarImage src={vaultInfo.owner.avatarUrl} />}
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                  {currentUsername.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground font-normal">@{currentUsername}</span>
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-semibold text-foreground truncate max-w-[120px] sm:max-w-xs">
              {vaultInfo.name}
            </span>
          </div>

          <Badge
            variant="secondary"
            className="hidden sm:inline-flex text-[10px] h-4 font-normal px-1.5"
          >
            Publik
          </Badge>
        </div>

        {/* View Switcher & Action Tools */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center p-0.5 rounded-lg border border-border bg-muted/40">
            <Button
              variant={activeView === "content" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveView("content")}
              className="h-7 px-2.5 text-xs gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dokumen</span>
            </Button>
            <Button
              variant={activeView === "graph" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveView("graph")}
              className="h-7 px-2.5 text-xs gap-1.5"
            >
              <Network className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Visual Graph</span>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Bagikan Tautan Halaman Ini"
          >
            <Share2 className="w-4 h-4" />
          </Button>

          <Link to="/auth" target="_blank">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 hidden md:flex">
              <span>Buka di ObMap</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Button>
          </Link>
        </div>
      </header>

      {/* 2. BODY LAYOUT (Fit 100vh Sisa Tinggi Layar) */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* Mobile Backdrop (Menutupi seluruh layar saat drawer terbuka) */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR EXPLORER TREE (Full-height Drawer di Mobile, Static di Desktop) */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 h-dvh w-[85vw] max-w-[320px] md:static md:z-auto md:h-auto md:w-64 border-r border-border bg-card flex flex-col shrink-0 transition-transform duration-200 overflow-hidden shadow-2xl md:shadow-none ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          {/* Header Khusus Drawer Mobile (Hanya Tampil di <md) */}
          <div className="p-3 px-4 border-b border-border/80 bg-muted/30 flex items-center justify-between shrink-0 md:hidden">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="w-5 h-5 border border-border shrink-0">
                {vaultInfo.owner.avatarUrl && <AvatarImage src={vaultInfo.owner.avatarUrl} />}
                <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                  {currentUsername.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold text-foreground truncate">
                {vaultInfo.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Tutup Menu"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Search Box Header */}
          <div className="p-2.5 border-b border-border/80 bg-card shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari di direktori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/60"
              />
            </div>
          </div>

          {/* Scrollable Tree Area (Scroll internal mandiri) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-1.5 scrollbar-thin">
            <PublicFileTree
              notes={publishedNotes}
              activeNoteId={activeNote?.id || null}
              onSelectNode={handleSelectNode}
              searchQuery={searchQuery}
            />
          </div>

          {/* Pinned Minimalist Footer */}
          <div className="p-2.5 px-3 border-t border-border/70 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0 select-none">
            <div className="flex items-center gap-1.5 font-medium text-[11px]">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>{publishedNotes.length} Dokumen Terbit</span>
            </div>
            <Badge variant="secondary" className="text-[10px] h-4 font-mono px-1.5">
              ObMap
            </Badge>
          </div>
        </aside>

        {/* 3. MAIN CONTENT CANVAS (Mandiri & Terintegrasi Dynamic Breadcrumbs) */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
          {/* Dynamic Breadcrumbs Sub-Header */}
          <PublicBreadcrumbs
            vaultName={vaultInfo.name}
            notes={publishedNotes}
            activeNote={activeNote}
            onNavigateHome={handleNavigateHome}
            onSelectNode={handleSelectNode}
          />

          {/* Area Konten Utama */}
          {activeView === "graph" ? (
            /* Mode Graf: Full Bleed Edge-to-Edge tanpa Scrollbar Ganda */
            <div className="flex-1 min-h-0 w-full h-full relative overflow-hidden">
              <PublicInteractiveGraph
                graphData={graphData}
                publishedNotes={publishedNotes}
                vaultName={vaultInfo.name}
                onOpenArticle={(note) => {
                  handleSelectNode(note);
                }}
              />
            </div>
          ) : (
            /* Mode Dokumen / Folder: Tetap Scrollable dengan Padding Nyaman */
            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8">
              {activeNote ? (
                isActiveFolder ? (
                  /* Tampilan Folder Overview Read-Only */
                  <PublicFolderOverview
                    folderNote={activeNote}
                    allNotes={publishedNotes}
                    onSelectNode={handleSelectNode}
                  />
                ) : (
                  /* Tampilan Artikel Markdown */
                  <article className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
                  <div className="space-y-3 pb-6 border-b border-border">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                      {activeNote.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      {activeNote.published_at && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Diterbitkan:{" "}
                            {new Date(activeNote.published_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        v{activeNote.version}
                      </Badge>
                    </div>
                  </div>

                  <PublicMarkdownReader
                    content={activeNote.content}
                    username={currentUsername}
                    vaultSlug={currentVaultSlug}
                    publishedSlugMap={publishedSlugMap}
                  />
                </article>
              )
            ) : (
              <div className="text-center py-20 text-muted-foreground text-xs">
                Pilih dokumen dari menu samping untuk mulai membaca.
              </div>
            )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PublicReader;
