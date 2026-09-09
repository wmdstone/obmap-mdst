import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
// @ts-ignore - react-force-graph-2d types
import ForceGraph2D from 'react-force-graph-2d';
import { Button } from "@/shared/ui/button";
import {
	Plus,
	Search,
	Link2,
	FolderPlus,
	FilePlus,
	Filter,
	Download,
	Upload,
	Network,
	Sparkles,
} from 'lucide-react';
import { Input } from "@/shared/ui/input";
import { toast } from 'sonner';
import { LinkManager } from '@/features/graph/LinkManager';
import { DynamicLinkManager } from '@/features/graph/DynamicLinkManager';
import { GraphMiniMap } from '@/features/graph/GraphMiniMap';
import { useThemeStore } from "@/shared/stores/useThemeStore";
import { GraphConfigState } from "@/shared/stores/useGraphStore";
import { useVaultEvents, EventType } from "@/features/vault-dashboard/hooks/useVaultEvents";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/ui/popover";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/shared/ui/sheet";
import { Label } from "@/shared/ui/label";
import { Slider } from "@/shared/ui/slider";
import { Badge } from "@/shared/ui/badge";

import { resolveColor, colorWithOpacity } from '@/shared/lib/color-utils';

interface Node {
	id: string;
	name: string;
	content: string;
	type: 'folder' | 'file' | 'media';
	parentId: string | null;
	depth: number;
	tags: string[];
	x?: number;
	y?: number;
	vx?: number;
	vy?: number;
	mediaType?: 'image' | 'audio' | 'video';
}

interface Link {
	source: string | Node;
	target: string | Node;
	type?: 'hierarchy' | 'tag' | 'backlink' | 'semantic' | 'custom';
}

interface GraphData {
	nodes: Node[];
	links: Link[];
}

interface LinkStyle {
	color: string;
	lineStyle: 'solid' | 'dashed' | 'dotted';
	opacity: number;
	width: number;
}

interface LinkStyles {
	hierarchy: LinkStyle;
	backlink: LinkStyle;
	tag: LinkStyle;
	semantic: LinkStyle;
	custom?: LinkStyle;
}

interface NetworkGraphProps {
	onNodeSelect: (node: Node | null) => void;
	selectedNode: Node | null;
	graphData: GraphData;
	setGraphData: (data: GraphData) => void;
	linkStyles?: LinkStyles;
	graphConfig?: GraphConfigState;
	graphRef?: React.MutableRefObject<any>;
}

// Default config for when not provided
const defaultGraphConfig: GraphConfigState = {
	nodes: {
		relSize: 6,
		resolution: 8,
		shape: 'circle',
		visible: true,
		opacity: 1.0,
		autoColorBy: 'type',
		folderColor: 'hsl(48, 100%, 60%)',
		fileColor: 'hsl(270, 70%, 65%)',
		selectedColor: 'hsl(270, 80%, 70%)',
		labelField: 'name',
		showLabels: true,
		labelSize: 12,
		labelColor: 'hsl(0, 0%, 100%)',
		labelFontStyle: 'normal',
		labelBackground: true,
		labelBackgroundColor: 'hsl(0, 0%, 0%)',
	},
	links: {
		width: 2,
		curvature: 0,
		curveRotation: 0,
		color: 'hsl(var(--primary))',
		opacity: 0.6,
		dashArray: '',
		arrowLength: 0,
		arrowRelPos: 1,
		showArrows: false,
		particles: 0,
		particleSpeed: 0.01,
		particleWidth: 4,
		particleColor: 'hsl(var(--accent))',
		showParticles: false,
	},
	topology: {
		showHierarchy: true,
		showBacklinks: true,
		showTags: true,
		tagThreshold: 1,
		styles: {
			hierarchy: {
				color: 'hsl(var(--primary))',
				lineStyle: 'solid',
				opacity: 0.8,
				width: 2.5,
			},
			backlink: {
				color: 'hsl(var(--accent))',
				lineStyle: 'dashed',
				opacity: 0.6,
				width: 2,
			},
			tag: {
				color: 'hsl(var(--secondary))',
				lineStyle: 'dotted',
				opacity: 0.4,
				width: 1.5,
			},
			semantic: {
				color: 'hsl(var(--muted-foreground))',
				lineStyle: 'dotted',
				opacity: 0.3,
				width: 1,
			},
		},
	},
	forces: {
		dagMode: 'null',
		dagLevelDistance: 50,
		alphaDecay: 0.02,
		velocityDecay: 0.3,
		chargeStrength: -300,
		linkDistance: 100,
		centerStrength: 1,
		warmupTicks: 100,
		cooldownTicks: 100,
		cooldownTime: 15000,
	},
};

export const NetworkGraph = ({
	onNodeSelect,
	selectedNode,
	graphData,
	setGraphData,
	linkStyles,
	graphConfig: externalGraphConfig,
	graphRef: externalGraphRef,
}: NetworkGraphProps) => {
	const internalGraphRef = useRef<any>();
	const graphRef = externalGraphRef || internalGraphRef;
	const containerRef = useRef<HTMLDivElement>(null);
	const theme = useThemeStore((state) => state.theme);
	const graphConfig = externalGraphConfig || defaultGraphConfig;

	const [searchQuery, setSearchQuery] = useState('');
	const [linkMode, setLinkMode] = useState(false);
	const [linkSource, setLinkSource] = useState<string | null>(null);
	const [maxDepth, setMaxDepth] = useState<number>(10);
	const [tagFilter, setTagFilter] = useState<string>('');
	const [contentFilter, setContentFilter] = useState<string>('');
	const [graphKey, setGraphKey] = useState(0);
	const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

	// Subscribe to vault events for auto-refresh
	useVaultEvents({
		onNodeCreated: () => setGraphKey((prev) => prev + 1),
		onNodeUpdated: () => setGraphKey((prev) => prev + 1),
		onNodeDeleted: () => setGraphKey((prev) => prev + 1),
		onNodeMoved: () => setGraphKey((prev) => prev + 1),
		onGraphUpdated: () => setGraphKey((prev) => prev + 1),
		onUndoPerformed: () => setGraphKey((prev) => prev + 1),
		onRedoPerformed: () => setGraphKey((prev) => prev + 1),
	});

	// Track container size for responsive graph
	useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				const { width, height } = containerRef.current.getBoundingClientRect();
				setDimensions({ width: width || 800, height: height || 600 });
			}
		};

		updateDimensions();
		const resizeObserver = new ResizeObserver(updateDimensions);
		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}
		window.addEventListener('resize', updateDimensions);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateDimensions);
		};
	}, []);

	// Force graph re-render when theme or graph config changes
	useEffect(() => {
		setGraphKey((prev) => prev + 1);
	}, [
		theme.colors.canvasBackground,
		theme.colors.folderNodeColor,
		theme.colors.fileNodeColor,
		theme.colors.linkColor,
		theme.colors.nodeGlow,
		theme.colors.accent,
		graphConfig.nodes,
		graphConfig.links,
	]);

	// Apply physics settings to the graph from graphConfig
	useEffect(() => {
		if (graphRef.current) {
			const fg = graphRef.current;

			// Access the d3 simulation and update forces dynamically
			if (fg.d3Force) {
				fg.d3Force('charge')?.strength(graphConfig.forces.chargeStrength);
				fg.d3Force('link')?.distance(graphConfig.forces.linkDistance);
				fg.d3Force('center')?.strength(graphConfig.forces.centerStrength);
			}

			// Reheat the simulation when physics change
			if (fg.d3ReheatSimulation) {
				fg.d3ReheatSimulation();
			}
		}
	}, [
		graphConfig.forces.chargeStrength,
		graphConfig.forces.linkDistance,
		graphConfig.forces.centerStrength,
		graphConfig.forces.velocityDecay,
		graphConfig.forces.alphaDecay,
	]);

	// Track collapsed nodes for expand/collapse on single click
	const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
	const lastClickRef = useRef<{ nodeId: string; time: number } | null>(null);
	const DOUBLE_CLICK_THRESHOLD = 300; // ms

	const handleNodeClick = useCallback(
		(node: Node) => {
			if (linkMode) {
				if (!linkSource) {
					setLinkSource(node.id);
					toast.info(`Select target node to link with "${node.name}"`);
				} else if (linkSource !== node.id) {
					const newLink: Link = {
						source: linkSource,
						target: node.id,
					};
					setGraphData({
						...graphData,
						links: [...graphData.links, newLink],
					});
					toast.success('Nodes linked!');
					setLinkMode(false);
					setLinkSource(null);
				}
				return;
			}

			const now = Date.now();
			const lastClick = lastClickRef.current;

			// Check for double click
			if (lastClick && lastClick.nodeId === node.id && (now - lastClick.time) < DOUBLE_CLICK_THRESHOLD) {
				// Double click - open in editor
				onNodeSelect(node);
				lastClickRef.current = null;
				return;
			}

			// Single click - toggle expand/collapse for folders
			lastClickRef.current = { nodeId: node.id, time: now };

			// Check if this node has children
			const hasChildren = graphData.nodes.some(n => n.parentId === node.id);
			
			if (hasChildren) {
				setCollapsedNodes(prev => {
					const next = new Set(prev);
					if (next.has(node.id)) {
						next.delete(node.id);
					} else {
						next.add(node.id);
					}
					return next;
				});
			}
		},
		[linkMode, linkSource, graphData, setGraphData, onNodeSelect]
	);

	// Get all descendants of collapsed nodes to hide them
	const getDescendants = useCallback((nodeId: string, nodes: Node[]): Set<string> => {
		const descendants = new Set<string>();
		const children = nodes.filter(n => n.parentId === nodeId);
		children.forEach(child => {
			descendants.add(child.id);
			const childDescendants = getDescendants(child.id, nodes);
			childDescendants.forEach(id => descendants.add(id));
		});
		return descendants;
	}, []);

	// Calculate hidden nodes based on collapsed state
	const hiddenNodes = useMemo(() => {
		const hidden = new Set<string>();
		collapsedNodes.forEach(collapsedId => {
			const descendants = getDescendants(collapsedId, graphData.nodes);
			descendants.forEach(id => hidden.add(id));
		});
		return hidden;
	}, [collapsedNodes, graphData.nodes, getDescendants]);

	const calculateDepth = (nodeId: string, nodes: Node[]): number => {
		const node = nodes.find((n) => n.id === nodeId);
		if (!node || !node.parentId) return 0;
		return 1 + calculateDepth(node.parentId, nodes);
	};

	const addNode = (type: 'folder' | 'file') => {
		// Only folders can have children - enforce this rule
		const parentNode =
			selectedNode && selectedNode.type === 'folder' ? selectedNode : null;

		if (selectedNode && selectedNode.type === 'file') {
			toast.error(
				'Files cannot contain children. Please select a folder or create at root level.'
			);
			return;
		}

		const depth = parentNode ? parentNode.depth + 1 : 0;

		const newNode: Node = {
			id: `node-${Date.now()}`,
			name:
				type === 'folder'
					? `New Folder ${
							graphData.nodes.filter((n) => n.type === 'folder').length + 1
					  }`
					: `New File ${
							graphData.nodes.filter((n) => n.type === 'file').length + 1
					  }`,
			content: '',
			type,
			parentId: parentNode?.id || null,
			depth,
			tags: [],
		};

		const newLinks = parentNode
			? [{ source: parentNode.id, target: newNode.id }]
			: [];

		setGraphData({
			nodes: [...graphData.nodes, newNode],
			links: [...graphData.links, ...newLinks],
		});
		toast.success(`${type === 'folder' ? 'Folder' : 'File'} created!`);
		onNodeSelect(newNode);
	};

	const filteredData = useMemo(() => ({
		nodes: graphData.nodes.filter((node) => {
			// Hide collapsed descendants
			if (hiddenNodes.has(node.id)) return false;

			// Depth filter
			if (node.depth > maxDepth) return false;

			// Search query (name)
			if (
				searchQuery &&
				!node.name.toLowerCase().includes(searchQuery.toLowerCase())
			) {
				return false;
			}

			// Content filter
			if (
				contentFilter &&
				!node.content.toLowerCase().includes(contentFilter.toLowerCase())
			) {
				return false;
			}

			// Tag filter
			if (
				tagFilter &&
				!node.tags.some((tag) =>
					tag.toLowerCase().includes(tagFilter.toLowerCase())
				)
			) {
				return false;
			}

			return true;
		}),
		links: graphData.links.filter((link) => {
			const sourceId =
				typeof link.source === 'string' ? link.source : link.source.id;
			const targetId =
				typeof link.target === 'string' ? link.target : link.target.id;
			
			// Hide links to/from hidden nodes
			if (hiddenNodes.has(sourceId) || hiddenNodes.has(targetId)) return false;

			const sourceInFiltered = graphData.nodes.find(
				(n) => n.id === sourceId && n.depth <= maxDepth && !hiddenNodes.has(n.id)
			);
			const targetInFiltered = graphData.nodes.find(
				(n) => n.id === targetId && n.depth <= maxDepth && !hiddenNodes.has(n.id)
			);
			return sourceInFiltered && targetInFiltered;
		}),
	}), [graphData, hiddenNodes, maxDepth, searchQuery, contentFilter, tagFilter]);

	const activeFilters = [
		maxDepth < 10 && `Depth ≤ ${maxDepth}`,
		contentFilter && `Content: "${contentFilter}"`,
		tagFilter && `Tag: "${tagFilter}"`,
	].filter(Boolean);

	return (
		<div
			ref={containerRef}
			className='relative w-full h-full flex-1 bg-graph-bg'>
			<div className='absolute top-4 left-4 z-10 flex flex-col gap-2'>
				<div className='flex gap-2 flex-wrap'>
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant='secondary'
								className='relative'>
								<Filter className='w-4 h-4 mr-2' />
								Filters
								{activeFilters.length > 0 && (
									<Badge
										variant='destructive'
										className='ml-2 px-1.5 py-0 text-xs'>
										{activeFilters.length}
									</Badge>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent
							className='w-80 bg-card border-border'
							align='start'>
							<div className='space-y-4'>
								<div>
									<Label className='text-sm font-medium'>Max Depth Level</Label>
									<div className='flex items-center gap-3 mt-2'>
										<Slider
											value={[maxDepth]}
											onValueChange={(value) => setMaxDepth(value[0])}
											max={10}
											min={0}
											step={1}
											className='flex-1'
										/>
										<span className='text-sm font-mono w-8 text-center'>
											{maxDepth}
										</span>
									</div>
								</div>

								<div>
									<Label className='text-sm font-medium'>
										Filter by Content
									</Label>
									<Input
										placeholder='Search in content...'
										value={contentFilter}
										onChange={(e) => setContentFilter(e.target.value)}
										className='mt-2 bg-secondary border-border'
									/>
								</div>

								<div>
									<Label className='text-sm font-medium'>Filter by Tags</Label>
									<Input
										placeholder='Search tags...'
										value={tagFilter}
										onChange={(e) => setTagFilter(e.target.value)}
										className='mt-2 bg-secondary border-border'
									/>
								</div>

								{activeFilters.length > 0 && (
									<Button
										variant='outline'
										size='sm'
										onClick={() => {
											setMaxDepth(10);
											setContentFilter('');
											setTagFilter('');
										}}
										className='w-full'>
										Clear All Filters
									</Button>
								)}
							</div>
						</PopoverContent>
					</Popover>
				</div>

				<div className='relative'>
					<Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
					<Input
						placeholder='Search by name...'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className='pl-10 bg-card border-border'
					/>
				</div>

				{activeFilters.length > 0 && (
					<div className='flex flex-wrap gap-1'>
						{activeFilters.map((filter, idx) => (
							<Badge
								key={idx}
								variant='secondary'
								className='text-xs'>
								{filter}
							</Badge>
						))}
					</div>
				)}
			</div>

			{linkMode && (
				<div className='absolute top-4 right-4 z-10 bg-accent/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-border'>
					<p className='text-sm text-accent-foreground'>
						{linkSource ? 'Click target node' : 'Click source node'}
					</p>
				</div>
			)}

			<ForceGraph2D
				key={graphKey}
				ref={graphRef}
				width={dimensions.width}
				height={dimensions.height}
				graphData={filteredData}
				nodeLabel={(node: any) => {
					if (graphConfig.nodes.labelField === 'id') return node.id;
					return `${node.type === 'folder' ? '📁' : '📄'} ${
						node.name
					} (depth: ${node.depth})`;
				}}
				nodeColor={(node: any) => {
					if (!graphConfig.nodes.visible) return 'transparent';
					if (selectedNode?.id === node.id)
						return resolveColor(graphConfig.nodes.selectedColor);

					// Auto-color based on config
					switch (graphConfig.nodes.autoColorBy) {
						case 'type':
							return node.type === 'folder'
								? resolveColor(graphConfig.nodes.folderColor)
								: resolveColor(graphConfig.nodes.fileColor);
						case 'depth':
							const hue = (node.depth * 40) % 360;
							return `hsl(${hue}, 70%, 55%)`;
						case 'tags':
							if (node.tags && node.tags.length > 0) {
								const tagHash = node.tags[0]
									.split('')
									.reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
								return `hsl(${tagHash % 360}, 70%, 55%)`;
							}
							return resolveColor(graphConfig.nodes.fileColor);
						default:
							return node.type === 'folder'
								? resolveColor(graphConfig.nodes.folderColor)
								: resolveColor(graphConfig.nodes.fileColor);
					}
				}}
				nodeRelSize={graphConfig.nodes.relSize}
				nodeVal={(node: any) => (node.type === 'folder' ? 1.5 : 1)}
				nodeVisibility={graphConfig.nodes.visible}
				linkColor={(link: any) => {
					const linkType = link.type as keyof typeof linkStyles | undefined;
					if (linkStyles && linkType && linkStyles[linkType]) {
						const style = linkStyles[linkType];
						return colorWithOpacity(style.color, style.opacity);
					}
					// Use graphConfig link settings as fallback
					return colorWithOpacity(
						graphConfig.links.color,
						graphConfig.links.opacity
					);
				}}
				linkWidth={(link: any) => {
					const linkType = link.type as keyof typeof linkStyles | undefined;
					if (linkStyles && linkType && linkStyles[linkType]) {
						return linkStyles[linkType].width;
					}
					return graphConfig.links.width;
				}}
				linkLineDash={(link: any) => {
					const linkType = link.type as keyof typeof linkStyles | undefined;
					if (linkStyles && linkType && linkStyles[linkType]) {
						const style = linkStyles[linkType];
						switch (style.lineStyle) {
							case 'dashed':
								return [8, 4];
							case 'dotted':
								return [2, 3];
							default:
								return [];
						}
					}
					// Use graphConfig dashArray
					if (graphConfig.links.dashArray) {
						return graphConfig.links.dashArray.split(',').map(Number);
					}
					return [];
				}}
				linkCurvature={graphConfig.links.curvature}
				linkDirectionalArrowLength={
					graphConfig.links.showArrows ? graphConfig.links.arrowLength : 0
				}
				linkDirectionalArrowRelPos={graphConfig.links.arrowRelPos}
				linkDirectionalParticles={
					graphConfig.links.showParticles ? graphConfig.links.particles : 0
				}
				linkDirectionalParticleSpeed={graphConfig.links.particleSpeed}
				linkDirectionalParticleWidth={graphConfig.links.particleWidth}
				linkDirectionalParticleColor={() =>
					resolveColor(graphConfig.links.particleColor)
				}
				onNodeClick={handleNodeClick}
				nodeCanvasObject={(
					node: any,
					ctx: CanvasRenderingContext2D,
					globalScale: number
				) => {
					if (!graphConfig.nodes.visible) return;

					const label = node.name;
					const fontSize = graphConfig.nodes.labelSize / globalScale;
					const iconSize = (graphConfig.nodes.labelSize + 2) / globalScale;
					const isFolder = node.type === 'folder';
					const hasChildren = graphData.nodes.some(n => n.parentId === node.id);
					const isCollapsed = collapsedNodes.has(node.id);

					// Build font string based on style
					let fontStyle = '';
					switch (graphConfig.nodes.labelFontStyle) {
						case 'bold':
							fontStyle = 'bold ';
							break;
						case 'italic':
							fontStyle = 'italic ';
							break;
						case 'bold-italic':
							fontStyle = 'bold italic ';
							break;
						default:
							fontStyle = '';
					}

					ctx.font = `${fontStyle}${fontSize}px Inter, sans-serif`;
					const textWidth = ctx.measureText(label).width;
					const bckgDimensions = [textWidth + iconSize + 6, fontSize + 4];

					// Draw node shape with glow
					const nodeSize =
						(isFolder ? 10 : 8) * (graphConfig.nodes.relSize / 6);

					// Set fill color with opacity
					let fillColor = resolveColor(graphConfig.nodes.fileColor);
					if (selectedNode?.id === node.id) {
						fillColor = resolveColor(graphConfig.nodes.selectedColor);
					} else if (isFolder) {
						fillColor = resolveColor(graphConfig.nodes.folderColor);
					}

					ctx.globalAlpha = graphConfig.nodes.opacity;
					ctx.fillStyle = fillColor;
					ctx.shadowBlur = 10;
					ctx.shadowColor = colorWithOpacity(fillColor, 0.8);

					// Draw shape based on config
					ctx.beginPath();
					switch (graphConfig.nodes.shape) {
						case 'square':
							ctx.rect(
								node.x - nodeSize,
								node.y - nodeSize,
								nodeSize * 2,
								nodeSize * 2
							);
							break;
						case 'diamond':
							ctx.moveTo(node.x, node.y - nodeSize);
							ctx.lineTo(node.x + nodeSize, node.y);
							ctx.lineTo(node.x, node.y + nodeSize);
							ctx.lineTo(node.x - nodeSize, node.y);
							ctx.closePath();
							break;
						case 'triangle':
							ctx.moveTo(node.x, node.y - nodeSize);
							ctx.lineTo(node.x + nodeSize, node.y + nodeSize * 0.8);
							ctx.lineTo(node.x - nodeSize, node.y + nodeSize * 0.8);
							ctx.closePath();
							break;
						case 'hexagon':
							const hexRadius = nodeSize;
							for (let i = 0; i < 6; i++) {
								const angle = (Math.PI / 3) * i - Math.PI / 6;
								const hx = node.x + hexRadius * Math.cos(angle);
								const hy = node.y + hexRadius * Math.sin(angle);
								if (i === 0) ctx.moveTo(hx, hy);
								else ctx.lineTo(hx, hy);
							}
							ctx.closePath();
							break;
						case 'circle':
						default:
							ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
							break;
					}

					ctx.fill();
					ctx.shadowBlur = 0;
					ctx.globalAlpha = 1;

					// Draw collapsed indicator (outer ring) for nodes with hidden children
					if (hasChildren && isCollapsed) {
						ctx.strokeStyle = colorWithOpacity(fillColor, 0.6);
						ctx.lineWidth = 2 / globalScale;
						ctx.setLineDash([3 / globalScale, 2 / globalScale]);
						ctx.beginPath();
						ctx.arc(node.x, node.y, nodeSize + 4 / globalScale, 0, 2 * Math.PI);
						ctx.stroke();
						ctx.setLineDash([]);

						// Draw child count badge
						const childCount = graphData.nodes.filter(n => n.parentId === node.id).length;
						const badgeSize = 6 / globalScale;
						const badgeX = node.x + nodeSize * 0.7;
						const badgeY = node.y - nodeSize * 0.7;

						// Badge background
						ctx.fillStyle = 'hsl(270, 80%, 60%)';
						ctx.beginPath();
						ctx.arc(badgeX, badgeY, badgeSize, 0, 2 * Math.PI);
						ctx.fill();

						// Badge text
						ctx.font = `bold ${8 / globalScale}px Inter, sans-serif`;
						ctx.fillStyle = '#fff';
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillText(childCount.toString(), badgeX, badgeY);
					}

					// Draw label if enabled
					if (graphConfig.nodes.showLabels) {
						// Draw label background if enabled
						if (graphConfig.nodes.labelBackground) {
							ctx.fillStyle = colorWithOpacity(
								resolveColor(graphConfig.nodes.labelBackgroundColor),
								0.85
							);
							ctx.fillRect(
								node.x - bckgDimensions[0] / 2,
								node.y + 14,
								bckgDimensions[0],
								bckgDimensions[1]
							);
						}

						ctx.textAlign = 'left';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = resolveColor(graphConfig.nodes.labelColor);

						const icon = isFolder ? '📁' : '📄';
						ctx.fillText(
							icon,
							node.x - bckgDimensions[0] / 2 + 2,
							node.y + 15 + fontSize / 2
						);
						ctx.fillText(
							label,
							node.x - bckgDimensions[0] / 2 + iconSize + 4,
							node.y + 15 + fontSize / 2
						);
					}
				}}
				backgroundColor={`hsl(${theme.colors.canvasBackground})`}
				enableNodeDrag={true}
				enableZoomInteraction={true}
				enablePanInteraction={true}
				dagMode={
					graphConfig.forces.dagMode === 'null'
						? null
						: graphConfig.forces.dagMode
				}
				dagLevelDistance={graphConfig.forces.dagLevelDistance}
				cooldownTicks={graphConfig.forces.cooldownTicks}
				cooldownTime={graphConfig.forces.cooldownTime}
				d3AlphaDecay={graphConfig.forces.alphaDecay}
				d3VelocityDecay={graphConfig.forces.velocityDecay}
				warmupTicks={graphConfig.forces.warmupTicks}
			/>

			{/* Mini-Map */}
			<GraphMiniMap
				nodes={filteredData.nodes}
				links={filteredData.links}
				graphRef={graphRef}
				folderColor={graphConfig.nodes.folderColor}
				fileColor={graphConfig.nodes.fileColor}
				selectedNodeId={selectedNode?.id}
			/>
		</div>
	);
};
