import { useRef, useState, useCallback, useEffect } from 'react';
// @ts-ignore - react-force-graph-2d types
import ForceGraph2D from 'react-force-graph-2d';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LinkManager } from '@/components/LinkManager';
import { DynamicLinkManager } from '@/components/DynamicLinkManager';
import { GraphMiniMap } from '@/components/GraphMiniMap';
import { useTheme } from '@/hooks/useTheme';
import { GraphConfigState } from '@/hooks/useGraphConfig';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

// Resolve CSS variable colors to actual HSL values for canvas rendering
function resolveColor(color: string): string {
	// If it's already a resolved HSL/HSLA value (no CSS variables), return as-is
	if (!color.includes('var(')) {
		return color;
	}
	
	// Extract the CSS variable name
	const varMatch = color.match(/var\(--([^)]+)\)/);
	if (!varMatch) return color;
	
	const varName = varMatch[1];
	
	// Get the computed value from CSS
	const computedValue = getComputedStyle(document.documentElement)
		.getPropertyValue(`--${varName}`)
		.trim();
	
	if (!computedValue) return color;
	
	// Replace the var() with the actual value
	return color.replace(`var(--${varName})`, computedValue);
}

// Convert color to HSLA with opacity for canvas
function colorWithOpacity(color: string, opacity: number): string {
	const resolved = resolveColor(color);
	
	// If already hsla, adjust opacity
	if (resolved.startsWith('hsla(')) {
		return resolved.replace(/,\s*[\d.]+\)$/, `, ${opacity})`);
	}
	
	// If hsl, convert to hsla
	if (resolved.startsWith('hsl(')) {
		return resolved.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`);
	}
	
	// If it's just HSL values without the function wrapper (from CSS var)
	const hslMatch = resolved.match(/^([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?$/);
	if (hslMatch) {
		return `hsla(${hslMatch[1]}, ${hslMatch[2]}%, ${hslMatch[3]}%, ${opacity})`;
	}
	
	// Return as-is if we can't parse it
	return resolved;
}

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
	const { theme } = useTheme();
	const graphConfig = externalGraphConfig || defaultGraphConfig;

	const [searchQuery, setSearchQuery] = useState('');
	const [linkMode, setLinkMode] = useState(false);
	const [linkSource, setLinkSource] = useState<string | null>(null);
	const [maxDepth, setMaxDepth] = useState<number>(10);
	const [tagFilter, setTagFilter] = useState<string>('');
	const [contentFilter, setContentFilter] = useState<string>('');
	const [linkManagerOpen, setLinkManagerOpen] = useState(false);
	const [dynamicLinkManagerOpen, setDynamicLinkManagerOpen] = useState(false);
	const [graphKey, setGraphKey] = useState(0);

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
			} else {
				onNodeSelect(node);
			}
		},
		[linkMode, linkSource, graphData, setGraphData, onNodeSelect]
	);

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

	const handleAutoLink = () => {
		const newLinks: Link[] = [];
		const existingLinksSet = new Set(
			graphData.links.map((link) => {
				const sourceId =
					typeof link.source === 'string' ? link.source : link.source.id;
				const targetId =
					typeof link.target === 'string' ? link.target : link.target.id;
				return `${sourceId}-${targetId}`;
			})
		);

		// Create hierarchy links based on parent-child relationships
		graphData.nodes.forEach((node) => {
			if (node.parentId) {
				const linkKey = `${node.parentId}-${node.id}`;
				if (!existingLinksSet.has(linkKey)) {
					newLinks.push({
						source: node.parentId,
						target: node.id,
					});
				}
			}
		});

		if (newLinks.length > 0) {
			setGraphData({
				...graphData,
				links: [...graphData.links, ...newLinks],
			});
			toast.success(
				`Auto-linked ${newLinks.length} node(s) based on hierarchy`
			);
		} else {
			toast.info('All nodes are already properly linked');
		}
	};

	const handleUpdateLinks = (updatedLinks: Link[]) => {
		setGraphData({
			...graphData,
			links: updatedLinks,
		});
	};

	const filteredData = {
		nodes: graphData.nodes.filter((node) => {
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
			const sourceInFiltered = graphData.nodes.find(
				(n) => n.id === sourceId && n.depth <= maxDepth
			);
			const targetInFiltered = graphData.nodes.find(
				(n) => n.id === targetId && n.depth <= maxDepth
			);
			return sourceInFiltered && targetInFiltered;
		}),
	};

	const activeFilters = [
		maxDepth < 10 && `Depth ≤ ${maxDepth}`,
		contentFilter && `Content: "${contentFilter}"`,
		tagFilter && `Tag: "${tagFilter}"`,
	].filter(Boolean);

	return (
		<div className='relative w-full h-screen bg-graph-bg'>
			<div className='absolute top-4 left-4 z-10 flex flex-col gap-2'>
				<div className='flex gap-2 flex-wrap'>
					<Button
						onClick={() => addNode('folder')}
						className='bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg'>
						<FolderPlus className='w-4 h-4 mr-2' />
						Add Folder
					</Button>
					<Button
						onClick={() => addNode('file')}
						className='bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg'>
						<FilePlus className='w-4 h-4 mr-2' />
						Add File
					</Button>
					<Button
						onClick={() => {
							setLinkMode(!linkMode);
							setLinkSource(null);
						}}
						variant={linkMode ? 'default' : 'secondary'}
						className={linkMode ? 'bg-accent hover:bg-accent/90' : ''}>
						<Link2 className='w-4 h-4 mr-2' />
						{linkMode ? 'Cancel' : 'Link'}
					</Button>

					<Sheet
						open={linkManagerOpen}
						onOpenChange={setLinkManagerOpen}>
						<SheetTrigger asChild>
							<Button
								variant='secondary'
								className='shadow-lg relative'>
								<Network className='w-4 h-4 mr-2' />
								Links
								<Badge
									variant='default'
									className='ml-2 px-1.5 py-0 text-xs'>
									{graphData.links.length}
								</Badge>
							</Button>
						</SheetTrigger>
						<SheetContent
							side='right'
							className='w-[400px] sm:w-[540px] p-0'>
							<div className='h-full flex flex-col'>
								<SheetHeader className='p-6 pb-4'>
									<SheetTitle>Link Management</SheetTitle>
								</SheetHeader>
								<div className='flex-1 overflow-hidden px-6 pb-6'>
									<LinkManager
										nodes={graphData.nodes}
										links={graphData.links}
										onUpdateLinks={handleUpdateLinks}
										onAutoLink={handleAutoLink}
									/>
								</div>
							</div>
						</SheetContent>
					</Sheet>

					<Sheet
						open={dynamicLinkManagerOpen}
						onOpenChange={setDynamicLinkManagerOpen}>
						<SheetTrigger asChild>
							<Button
								variant='default'
								className='shadow-lg bg-gradient-to-r from-primary to-accent'>
								<Sparkles className='w-4 h-4 mr-2' />
								Dynamic Links
							</Button>
						</SheetTrigger>
						<SheetContent
							side='right'
							className='w-[400px] sm:w-[540px] overflow-y-auto'>
							<SheetHeader className='pb-4'>
								<SheetTitle>Dynamic Link Layers</SheetTitle>
							</SheetHeader>
							<DynamicLinkManager
								nodes={graphData.nodes}
								baseLinks={graphData.links}
								onLinksUpdate={handleUpdateLinks}
							/>
						</SheetContent>
					</Sheet>

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
					return colorWithOpacity(graphConfig.links.color, graphConfig.links.opacity);
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
				linkDirectionalParticleColor={() => resolveColor(graphConfig.links.particleColor)}
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
					const nodeSize = (isFolder ? 10 : 8) * (graphConfig.nodes.relSize / 6);
					
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
							ctx.rect(node.x - nodeSize, node.y - nodeSize, nodeSize * 2, nodeSize * 2);
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

					// Draw label if enabled
					if (graphConfig.nodes.showLabels) {
						// Draw label background if enabled
						if (graphConfig.nodes.labelBackground) {
							ctx.fillStyle = colorWithOpacity(resolveColor(graphConfig.nodes.labelBackgroundColor), 0.85);
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
