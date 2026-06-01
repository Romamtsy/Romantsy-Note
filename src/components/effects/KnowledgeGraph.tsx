import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useFileStore } from "@/stores/useFileStore";
import { useLocaleStore } from "@/stores/useLocaleStore";
import { useNoteIndexStore } from "@/stores/useNoteIndexStore";
import { readFile, saveFile } from "@/lib/host";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import {
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Plus,
  Trash2,
  X,
  FileText,
  Link as LinkIcon,
  MousePointer2,
  Settings,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getWikiPreview } from "@/lib/wikiLinks";
import {
  buildKnowledgeGraphData,
  type GraphEdge,
  type GraphNode,
  type KnowledgeGraphStatus,
} from "./knowledgeGraphData";

const KNOWLEDGE_GRAPH_ICON_BUTTON_CLASS =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-ui-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

// Extract [[wikilinks]] from content
export function extractWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return [...new Set(links)]; // Remove duplicates
}

// Physics Engine
const PhysicsEngine = {
  init: (nodes: GraphNode[], width: number, height: number): GraphNode[] => {
    return nodes.map((n, i) => ({
      ...n,
      x: width / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * 150 + (Math.random() - 0.5) * 50,
      y: height / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * 150 + (Math.random() - 0.5) * 50,
      vx: 0,
      vy: 0,
    }));
  },

  step: (
    nodes: GraphNode[],
    edges: GraphEdge[],
    params: {
      repulsion: number;
      springLength: number;
      springStrength: number;
      centerPull: number;
      friction: number;
      dt: number;
      width: number;
      height: number;
    }
  ): GraphNode[] => {
    const { repulsion, springLength, springStrength, centerPull, friction, dt, width, height } = params;
    const cx = width / 2;
    const cy = height / 2;

    // 构建节点索引 Map（O(1) 查找）
    const nodeMap = new Map<string, GraphNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      const u = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const v = nodes[j];
        const dx = u.x - v.x;
        const dy = u.y - v.y;
        let distSq = dx * dx + dy * dy;
        if (distSq === 0) distSq = 0.01;
        const dist = Math.sqrt(distSq);

        if (dist < 500) {
          const force = repulsion / (distSq + 100);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!u.isDragging) { u.vx += fx * dt; u.vy += fy * dt; }
          if (!v.isDragging) { v.vx -= fx * dt; v.vy -= fy * dt; }
        }
      }
    }

    // Spring forces (edges) - 使用 Map O(1) 查找
    edges.forEach((e) => {
      const u = nodeMap.get(e.source);
      const v = nodeMap.get(e.target);
      if (!u || !v) return;

      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return;

      const force = (dist - springLength) * springStrength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (!u.isDragging) { u.vx += fx * dt; u.vy += fy * dt; }
      if (!v.isDragging) { v.vx -= fx * dt; v.vy -= fy * dt; }
    });

    // Center pull and update positions
    nodes.forEach((n) => {
      if (n.isDragging) return;

      const dx = cx - n.x;
      const dy = cy - n.y;
      n.vx += dx * centerPull * dt;
      n.vy += dy * centerPull * dt;

      n.x += n.vx * dt;
      n.y += n.vy * dt;

      n.vx *= friction;
      n.vy *= friction;

      // Circular soft boundary constraint
      // 计算到中心的距离
      const distToCenter = Math.sqrt(dx * dx + dy * dy);
      // 圆形边界半径（取宽高最小值的一半，留一点边距）
      const boundaryRadius = Math.min(width, height) * 0.45;

      // 如果超出边界，施加一个柔和的向心力（力度随超出程度增加）
      if (distToCenter > boundaryRadius) {
        const overflow = distToCenter - boundaryRadius;
        // 柔和的弹性力，超出越多力越大
        const pullStrength = overflow * 0.05;
        const pullX = (dx / distToCenter) * pullStrength;
        const pullY = (dy / distToCenter) * pullStrength;
        n.vx += pullX * dt;
        n.vy += pullY * dt;
      }
    });

    return nodes;
  },
};

interface KnowledgeGraphProps {
  className?: string;
  isolatedNode?: {
    id: string;
    label: string;
    path: string;
    isFolder: boolean;
  };
}

// 右键菜单状态
interface ContextMenuState {
  x: number;
  y: number;
  node: GraphNode;
}

interface HoverPreviewState {
  nodeId: string;
}

function normalizeWikiTarget(value: string): string {
  return value.trim().toLowerCase();
}

function hasWikiLink(content: string, targetLabel: string): boolean {
  const target = normalizeWikiTarget(targetLabel);
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (normalizeWikiTarget(match[1]) === target) return true;
  }
  return false;
}

function appendWikiLink(content: string, targetLabel: string): string {
  if (hasWikiLink(content, targetLabel)) return content;
  const body = content.replace(/\s+$/g, "");
  const separator = body.length > 0 ? "\n\n" : "";
  return `${body}${separator}[[${targetLabel}]]\n`;
}

function removeWikiLink(content: string, targetLabel: string): string {
  const target = normalizeWikiTarget(targetLabel);
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const nextLines: string[] = [];

  for (const line of content.split("\n")) {
    let removedFromLine = false;
    const nextLine = line
      .replace(wikiLinkRegex, (match, linkName) => {
        if (normalizeWikiTarget(linkName) !== target) return match;
        removedFromLine = true;
        return "";
      })
      .replace(/[ \t]{2,}/g, " ")
      .trimEnd();

    if (removedFromLine && nextLine.trim() === "") continue;
    nextLines.push(nextLine);
  }

  return nextLines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function distanceToSegment(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
  const projection = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function KnowledgeGraph({ className = "", isolatedNode }: KnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchPanAnimationRef = useRef<number | null>(null);
  const emphasisRef = useRef<Map<string, number>>(new Map());
  const focusBlendRef = useRef(0);

  const {
    vaultPath,
    currentFile,
    currentContent,
    tabs,
    activeTabIndex,
    openFile,
    openIsolatedGraphTab,
    updateContent,
    save,
    reloadFileIfOpen,
  } = useFileStore(
    useShallow((state) => ({
      vaultPath: state.vaultPath,
      currentFile: state.currentFile,
      currentContent: state.currentContent,
      tabs: state.tabs,
      activeTabIndex: state.activeTabIndex,
      openFile: state.openFile,
      openIsolatedGraphTab: state.openIsolatedGraphTab,
      updateContent: state.updateContent,
      save: state.save,
      reloadFileIfOpen: state.reloadFileIfOpen,
    }))
  );
  const {
    noteIndex,
    isIndexing,
    totalNotes,
    indexedCount,
    truncated: indexTruncated,
    buildIndex,
    getBacklinks,
  } = useNoteIndexStore(
    useShallow((state) => ({
      noteIndex: state.noteIndex,
      isIndexing: state.isIndexing,
      totalNotes: state.totalNotes,
      indexedCount: state.indexedCount,
      truncated: state.truncated,
      buildIndex: state.buildIndex,
      getBacklinks: state.getBacklinks,
    })),
  );
  const { t } = useLocaleStore();

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<GraphNode | null>(null);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
  const [displayCounts, setDisplayCounts] = useState({ nodes: 0, edges: 0, isolated: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [graphStatus, setGraphStatus] = useState<KnowledgeGraphStatus>({
    totalNotes: 0,
    displayedNotes: 0,
    hiddenNotes: 0,
    cappedByDisplayLimit: false,
  });

  const isDraggingCanvas = useRef(false);
  const isDraggingNode = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedNodeId = useRef<string | null>(null);
  const hasDragged = useRef(false); // 是否发生了拖拽
  const clickedNodeRef = useRef<GraphNode | null>(null); // 点击的节点
  const frameTickRef = useRef(0);

  const [params, setParams] = useState({
    repulsion: 3000,
    springLength: 100,
    springStrength: 0.08,
    centerPull: 0.015,
    friction: 0.88,
    dt: 0.15,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [nodeSize, setNodeSize] = useState(1.0);
  const [showLabels, setShowLabels] = useState(true);
  const [showFolders, setShowFolders] = useState(true); // 是否显示文件夹节点

  const [onlyIsolated, setOnlyIsolated] = useState(false);
  const [onlyConnected, setOnlyConnected] = useState(false);
  const [showIsolatedList, setShowIsolatedList] = useState(false);
  const nodeById = useCallback((id: string) => {
    return nodesRef.current.find((node) => node.id === id) ?? null;
  }, []);

  const getContentForLinkEdit = useCallback(
    async (path: string) => {
      const activeTab = activeTabIndex >= 0 ? tabs[activeTabIndex] : null;
      if (currentFile === path && activeTab?.path === path) return currentContent;
      const openTab = tabs.find((tab) => tab.type === "file" && tab.path === path);
      if (openTab) return openTab.content;
      return readFile(path);
    },
    [activeTabIndex, currentContent, currentFile, tabs],
  );

  const persistLinkEdit = useCallback(
    async (path: string, nextContent: string, description: string) => {
      const activeTab = activeTabIndex >= 0 ? tabs[activeTabIndex] : null;
      if (currentFile === path && activeTab?.path === path) {
        updateContent(nextContent, "user", description);
        await save();
      } else {
        await saveFile(path, nextContent);
        await reloadFileIfOpen(path, { skipIfDirty: false });
      }
      if (vaultPath) void buildIndex(vaultPath);
    },
    [
      activeTabIndex,
      buildIndex,
      currentFile,
      reloadFileIfOpen,
      save,
      tabs,
      updateContent,
      vaultPath,
    ],
  );

  const createLink = useCallback(
    async (source: GraphNode, target: GraphNode) => {
      if (source.isFolder || target.isFolder || source.path === target.path) return;
      setIsEditingLink(true);
      try {
        const content = await getContentForLinkEdit(source.path);
        const nextContent = appendWikiLink(content, target.label);
        if (nextContent === content) {
          toast.info(`已存在连接：${source.label} -> ${target.label}`);
          return;
        }
        await persistLinkEdit(source.path, nextContent, `Add graph link to ${target.label}`);
        toast.success(`已连接：${source.label} -> ${target.label}`);
      } catch (error) {
        toast.error(`连接失败：${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsEditingLink(false);
        setLinkingFrom(null);
      }
    },
    [getContentForLinkEdit, persistLinkEdit],
  );

  const deleteLink = useCallback(
    async (edge: GraphEdge) => {
      if (edge.type !== "link") return;
      const source = nodeById(edge.source);
      const target = nodeById(edge.target);
      if (!source || !target || source.isFolder || target.isFolder) return;
      setIsEditingLink(true);
      try {
        const content = await getContentForLinkEdit(source.path);
        const nextContent = removeWikiLink(content, target.label);
        if (nextContent === content) {
          toast.info(`未找到连接：${source.label} -> ${target.label}`);
          return;
        }
        await persistLinkEdit(source.path, nextContent, `Remove graph link to ${target.label}`);
        setSelectedEdge(null);
        toast.success(`已删除连接：${source.label} -> ${target.label}`);
      } catch (error) {
        toast.error(`删除连接失败：${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsEditingLink(false);
      }
    },
    [getContentForLinkEdit, nodeById, persistLinkEdit],
  );

  const getNodeBaseRadius = useCallback((node: GraphNode) => {
    const baseRadius = node.isFolder
      ? Math.max(8, 10 + Math.log((node.connections || 1) + 1) * 3)
      : Math.max(4, 5 + Math.log(node.connections + 1) * 4);
    return Math.min(baseRadius * nodeSize, node.isFolder ? 30 : 25);
  }, [nodeSize]);

  const graphData = useMemo(
    () =>
      buildKnowledgeGraphData(Array.from(noteIndex.values()), {
        vaultPath,
        currentFile,
      }),
    [noteIndex, vaultPath, currentFile],
  );

  // 应用图数据（支持孤立视图过滤和文件夹过滤）- 必须在 buildGraph 之前定义
  const applyGraphData = useCallback((nodes: GraphNode[], edges: GraphEdge[], includeFolders: boolean) => {
    let displayNodes = nodes;
    let displayEdges = edges;

    // 如果不显示文件夹，过滤掉文件夹节点和层级边
    if (!includeFolders) {
      displayNodes = nodes.filter(n => !n.isFolder);
      displayEdges = edges.filter(e => e.type === 'link'); // 只保留双链边
    }

    if (isolatedNode) {
      // 找到目标节点的所有直接相连节点
      const connectedIds = new Set<string>();
      connectedIds.add(isolatedNode.id);

      for (const edge of displayEdges) {
        if (edge.source === isolatedNode.id) {
          connectedIds.add(edge.target);
        }
        if (edge.target === isolatedNode.id) {
          connectedIds.add(edge.source);
        }
      }

      displayNodes = displayNodes.filter(n => connectedIds.has(n.id));
      displayEdges = displayEdges.filter(e =>
        connectedIds.has(e.source) && connectedIds.has(e.target)
      );
    }

    if (onlyIsolated) {
      displayNodes = displayNodes.filter((n) => !n.isFolder && n.connections === 0);
    } else if (onlyConnected) {
      displayNodes = displayNodes.filter((n) => n.isFolder || n.connections > 0);
    }

    const activeNodeIds = new Set(displayNodes.map((n) => n.id));
    displayEdges = displayEdges.filter(
      (e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target),
    );

    // Initialize positions
    const width = containerRef.current?.offsetWidth || 400;
    const height = containerRef.current?.offsetHeight || 400;
    nodesRef.current = PhysicsEngine.init(displayNodes, width, height);
    edgesRef.current = displayEdges;

    setDimensions({ width, height });
    setDisplayCounts({
      nodes: displayNodes.length,
      edges: displayEdges.length,
      isolated: displayNodes.filter((n) => !n.isFolder && n.connections === 0).length,
    });
  }, [isolatedNode, onlyConnected, onlyIsolated]);

  // Build graph from the vault note index, not the lazy sidebar tree.
  useEffect(() => {
    applyGraphData(graphData.nodes, graphData.edges, showFolders);
    setGraphStatus(graphData.status);
  }, [graphData, showFolders, applyGraphData]);

  const rebuildGraph = useCallback(() => {
    applyGraphData(graphData.nodes, graphData.edges, showFolders);
    setGraphStatus(graphData.status);
  }, [applyGraphData, graphData, showFolders]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (searchPanAnimationRef.current) {
        cancelAnimationFrame(searchPanAnimationRef.current);
        searchPanAnimationRef.current = null;
      }
      if (hoverPreviewTimerRef.current) {
        clearTimeout(hoverPreviewTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hoverPreviewTimerRef.current) {
      clearTimeout(hoverPreviewTimerRef.current);
      hoverPreviewTimerRef.current = null;
    }

    if (!hoverNode || isDraggingCanvas.current || isDraggingNode.current) {
      setHoverPreview(null);
      return;
    }

    hoverPreviewTimerRef.current = setTimeout(() => {
      setHoverPreview((prev) => (prev?.nodeId === hoverNode ? prev : { nodeId: hoverNode }));
    }, 120);

    return () => {
      if (hoverPreviewTimerRef.current) {
        clearTimeout(hoverPreviewTimerRef.current);
        hoverPreviewTimerRef.current = null;
      }
    };
  }, [hoverNode]);

  useEffect(() => {
    if (selectedNode) {
      setHoverPreview(null);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (!hoverNode && !selectedNode) {
      emphasisRef.current.clear();
      focusBlendRef.current = 0;
    }
  }, [hoverNode, selectedNode]);

  // Render loop with high DPI support
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size for high DPI
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    frameTickRef.current += 1;
    const nodeCount = nodesRef.current.length;
    const physicsInterval = nodeCount > 600 ? 3 : nodeCount > 300 ? 2 : 1;
    if (!document.hidden && frameTickRef.current % physicsInterval === 0) {
      PhysicsEngine.step(nodesRef.current, edgesRef.current, { ...params, width, height });
    }

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

    const hasSelection = selectedNode !== null || hoverNode !== null;
    const nodeById = new Map(nodesRef.current.map((node) => [node.id, node]));
    const focusNodeId = hoverNode || selectedNode?.id || null;
    const connectedToFocus = new Set<string>();
    const emphasis = emphasisRef.current;
    const focusBlendTarget = hasSelection ? 1 : 0;
    focusBlendRef.current += (focusBlendTarget - focusBlendRef.current) * 0.16;
    const focusBlend = focusBlendRef.current;
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const isSearchMatch = (node: GraphNode) =>
      !normalizedSearchQuery ||
      node.label.toLowerCase().includes(normalizedSearchQuery) ||
      node.path.toLowerCase().includes(normalizedSearchQuery);

    const secondDegreeNeighbors = new Set<string>();
    if (focusNodeId) {
      edgesRef.current.forEach((edge) => {
        if (edge.source === focusNodeId) connectedToFocus.add(edge.target);
        if (edge.target === focusNodeId) connectedToFocus.add(edge.source);
      });
      connectedToFocus.forEach((neighborId) => {
        edgesRef.current.forEach((edge) => {
          if (edge.source === neighborId && edge.target !== focusNodeId && !connectedToFocus.has(edge.target)) {
            secondDegreeNeighbors.add(edge.target);
          }
          if (edge.target === neighborId && edge.source !== focusNodeId && !connectedToFocus.has(edge.source)) {
            secondDegreeNeighbors.add(edge.source);
          }
        });
      });
    }

    for (const node of nodesRef.current) {
      const isHovered = node.id === hoverNode;
      const isSelected = selectedNode?.id === node.id;
      const isFirstDegree = focusNodeId ? connectedToFocus.has(node.id) : false;
      const isSecondDegree = focusNodeId ? secondDegreeNeighbors.has(node.id) : false;
      const isCurrent = !node.isFolder && currentFile === node.path;
      const target = isHovered || isSelected ? 1.0 : isFirstDegree ? 0.7 : isSecondDegree ? 0.35 : isCurrent && !hasSelection ? 0.2 : 0;
      const next = (emphasis.get(node.id) ?? 0) + (target - (emphasis.get(node.id) ?? 0)) * 0.18;
      emphasis.set(node.id, next);
    }

    // Draw edges
    edgesRef.current.forEach((edge) => {
      const u = nodeById.get(edge.source);
      const v = nodeById.get(edge.target);
      if (!u || !v) return;

      const isHierarchy = edge.type === 'hierarchy';
      const edgeEmphasis = Math.max(emphasis.get(u.id) ?? 0, emphasis.get(v.id) ?? 0);
      const isSelectedEdge =
        selectedEdge?.source === edge.source &&
        selectedEdge?.target === edge.target &&
        selectedEdge?.type === edge.type;
      const isSearchEdgeHit = !normalizedSearchQuery || isSearchMatch(u) || isSearchMatch(v);

      // Tiered edge styling based on neighbor degree
      let effectiveAlpha: number;
      let lineWidth: number;
      if (edgeEmphasis > 0.5) {
        // Focus ↔ first-degree: high highlight
        effectiveAlpha = 0.88;
        lineWidth = 2 / zoom;
      } else if (isSelectedEdge) {
        effectiveAlpha = 0.95;
        lineWidth = 2.4 / zoom;
      } else if (edgeEmphasis > 0.2) {
        // First-degree ↔ second-degree: medium
        effectiveAlpha = 0.45;
        lineWidth = 1.2 / zoom;
      } else if (hasSelection) {
        // Background edges: heavily dimmed when focused
        effectiveAlpha = 0.08;
        lineWidth = (isHierarchy ? 1.5 : 1) / zoom;
      } else {
        // No focus active: normal idle state
        const baseAlpha = isHierarchy ? 0.5 : 0.4;
        effectiveAlpha = baseAlpha;
        lineWidth = (isHierarchy ? 1.5 : 1) / zoom;
      }
      if (!isSearchEdgeHit) {
        effectiveAlpha = 0.05;
      }

      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);

      ctx.strokeStyle = edgeEmphasis > 0.2
        ? (isHierarchy ? (u.color || "hsl(var(--primary))") : "hsl(var(--primary))")
        : isSelectedEdge
          ? "hsl(var(--destructive))"
        : isHierarchy
          ? (u.color || "hsl(var(--muted-foreground))")
          : "hsl(var(--muted-foreground))";
      ctx.globalAlpha = effectiveAlpha;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // 绘制箭头（仅层级边）
      if (isHierarchy) {
        const angle = Math.atan2(v.y - u.y, v.x - u.x);
        const arrowLen = 8 / zoom;
        const targetRadius = v.isFolder ? 12 : 8;
        const arrowX = v.x - Math.cos(angle) * (targetRadius + 2);
        const arrowY = v.y - Math.sin(angle) * (targetRadius + 2);

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLen * Math.cos(angle - Math.PI / 6),
          arrowY - arrowLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLen * Math.cos(angle + Math.PI / 6),
          arrowY - arrowLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
    });

    // Draw nodes
    nodesRef.current.forEach((node) => {
      const isCurrent = !node.isFolder && currentFile === node.path;
      const isSearchHit = isSearchMatch(node);
      const nodeEmphasis = emphasis.get(node.id) ?? 0;
      // Tiered radius: hover 1.18x, first-degree 1.10x, second-degree 1.0x
      const radiusScale = nodeEmphasis > 0.85 ? 1.18
        : nodeEmphasis > 0.5 ? 1.10
        : 1.0;
      const radius = getNodeBaseRadius(node) * radiusScale;
      const idleAlpha = hasSelection ? 1 - 0.82 * focusBlend : 1;
      const isHighlighted = nodeEmphasis > 0.16 || isCurrent;

      // Tiered node opacity: hover 1.0, first 0.92, second 0.55, bg dimmed
      const nodeAlpha = normalizedSearchQuery && !isSearchHit ? 0.05
        : nodeEmphasis > 0.85 ? 1.0
        : nodeEmphasis > 0.5 ? 0.92
        : nodeEmphasis > 0.2 ? 0.55
        : idleAlpha + (1 - idleAlpha) * nodeEmphasis;
      ctx.globalAlpha = nodeAlpha;

      // 确定节点颜色
      let nodeColor = node.color || "hsl(var(--muted-foreground))";
      if (isCurrent) {
        nodeColor = "hsl(var(--primary))";
      } else if (nodeEmphasis > 0.2 && !node.isFolder) {
        // 高亮时稍微调亮
        nodeColor = node.color || "hsl(var(--primary) / 0.8)";
      }

      if (!node.isFolder && node.connections === 0 && (!normalizedSearchQuery || isSearchHit)) {
        nodeColor = "hsl(35, 85%, 55%)";
      } else if (!node.isFolder && node.connections === 1 && !normalizedSearchQuery && !hasSelection) {
        nodeColor = "hsl(190, 75%, 60%)";
      }

      if (node.isFolder) {
        // 绘制带刺圆球（星形/太阳形）
        const spikes = 8;
        const outerRadius = radius;
        const innerRadius = radius * 0.6;

        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / spikes - Math.PI / 2;
          const x = node.x + Math.cos(angle) * r;
          const y = node.y + Math.sin(angle) * r;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.fillStyle = nodeColor;
        ctx.fill();

        // 文件夹节点边框 — tiered: hover 2.5, first-degree 1.8, second-degree none
        if (nodeEmphasis > 0.5 || isCurrent) {
          ctx.strokeStyle = "hsl(var(--foreground))";
          ctx.lineWidth = nodeEmphasis > 0.85 ? 2.5 / zoom : 1.8 / zoom;
          ctx.stroke();
        } else if (nodeEmphasis <= 0.2) {
          ctx.strokeStyle = nodeColor;
          ctx.lineWidth = 1.5 / zoom;
          ctx.stroke();
        }

        // 中心小圆
        ctx.beginPath();
        ctx.arc(node.x, node.y, innerRadius * 0.5, 0, 2 * Math.PI);
        ctx.fillStyle = "hsl(var(--popover))";
        ctx.fill();
      } else {
        // 普通文件节点 - 圆形
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = nodeColor;
        ctx.fill();

        // Node border — tiered: hover 2.5, first-degree 1.8, second-degree none
        if (nodeEmphasis > 0.5 || isCurrent) {
          ctx.strokeStyle = "hsl(var(--foreground))";
          ctx.lineWidth = nodeEmphasis > 0.85 ? 2.5 / zoom : 1.8 / zoom;
          ctx.stroke();
        }
      }

      // Label
      if (showLabels && (isHighlighted || zoom > 0.8)) {
        const isHoveredOrSelected = nodeEmphasis > 0.85;
        const baseLabelAlpha = hasSelection ? 0.12 + 0.3 * (1 - focusBlend) : 0.72;
        const labelAlpha = normalizedSearchQuery && !isSearchHit ? 0.05
          : isHoveredOrSelected ? 1.0
          : nodeEmphasis > 0.5 ? 0.85
          : nodeEmphasis > 0.2 ? 0.45
          : baseLabelAlpha;
        ctx.globalAlpha = Math.min(1, labelAlpha);
        ctx.fillStyle = "hsl(var(--foreground))";
        const fontSize = isHoveredOrSelected
          ? (node.isFolder ? Math.max(14, 16 / zoom) : Math.max(13, 15 / zoom))
          : (node.isFolder ? Math.max(11, 13 / zoom) : Math.max(10, 12 / zoom));
        const fontWeight = isHoveredOrSelected ? 'bold' : (node.isFolder ? 'bold' : 'normal');
        ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = "center";
        const labelY = node.y + radius + 14 / zoom;

        // Translucent background for hovered/selected node label
        if (isHoveredOrSelected) {
          const metrics = ctx.measureText(node.label);
          const padX = 4 / zoom;
          const padY = 2 / zoom;
          const bgX = node.x - metrics.width / 2 - padX;
          const bgY = labelY - fontSize + padY;
          const bgW = metrics.width + padX * 2;
          const bgH = fontSize + padY * 2;
          const savedAlpha = ctx.globalAlpha;
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = "hsl(var(--popover))";
          const r = 3 / zoom;
          ctx.beginPath();
          ctx.moveTo(bgX + r, bgY);
          ctx.lineTo(bgX + bgW - r, bgY);
          ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + r);
          ctx.lineTo(bgX + bgW, bgY + bgH - r);
          ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - r, bgY + bgH);
          ctx.lineTo(bgX + r, bgY + bgH);
          ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - r);
          ctx.lineTo(bgX, bgY + r);
          ctx.quadraticCurveTo(bgX, bgY, bgX + r, bgY);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = savedAlpha;
          ctx.fillStyle = "hsl(var(--foreground))";
        }

        ctx.fillText(node.label, node.x, labelY);
      }
    });

    ctx.restore();
    animationRef.current = requestAnimationFrame(render);
  }, [params, zoom, pan, hoverNode, selectedNode, selectedEdge, currentFile, dimensions, getNodeBaseRadius, showLabels, searchQuery]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(render);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  // Interaction handlers
  const getScreenPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getWorldPos = (screenX: number, screenY: number) => {
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    return {
      x: (screenX - cx - pan.x) / zoom + cx,
      y: (screenY - cy - pan.y) / zoom + cy,
    };
  };

  const focusGraphNode = useCallback((node: GraphNode) => {
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const targetPanX = -zoom * (node.x - cx);
    const targetPanY = -zoom * (node.y - cy);

    setSelectedNode(node);
    setSelectedEdge(null);
    setHoverPreview(null);

    if (searchPanAnimationRef.current) {
      cancelAnimationFrame(searchPanAnimationRef.current);
      searchPanAnimationRef.current = null;
    }

    const animatePan = (targetX: number, targetY: number) => {
      setPan((current) => {
        const dx = targetX - current.x;
        const dy = targetY - current.y;

        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          searchPanAnimationRef.current = null;
          return { x: targetX, y: targetY };
        }

        searchPanAnimationRef.current = requestAnimationFrame(() =>
          animatePan(targetX, targetY),
        );
        return {
          x: current.x + dx * 0.16,
          y: current.y + dy * 0.16,
        };
      });
    };

    animatePan(targetPanX, targetPanY);
  }, [dimensions, zoom]);

  const handleSearchFocus = useCallback(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const matchedNode = nodesRef.current.find(
      (node) =>
        !node.isFolder &&
        (node.label.toLowerCase().includes(query) ||
          node.path.toLowerCase().includes(query)),
    );

    if (!matchedNode) return;

    focusGraphNode(matchedNode);
  }, [focusGraphNode, searchQuery]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 右键点击不处理拖拽和节点点击（由 contextMenu 处理）
    if (e.button === 2) return;

    const { x, y } = getScreenPos(e);
    const worldPos = getWorldPos(x, y);

    hasDragged.current = false; // 重置拖拽状态
    dragStart.current = { x, y };

    const clickedNode = nodesRef.current.find((n) => {
      const r = getNodeBaseRadius(n) + 8;
      return Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < r;
    });

    if (clickedNode) {
      isDraggingNode.current = true;
      draggedNodeId.current = clickedNode.id;
      clickedNodeRef.current = clickedNode;
      clickedNode.isDragging = true;
      setHoverPreview(null);
      setSelectedNode(clickedNode);
      setSelectedEdge(null);
    } else {
      const nodeMap = new Map(nodesRef.current.map((node) => [node.id, node]));
      const clickedEdge = edgesRef.current.find((edge) => {
        if (edge.type !== "link") return false;
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return false;
        return distanceToSegment(worldPos, source, target) <= 8 / zoom;
      });
      if (clickedEdge) {
        setSelectedEdge(clickedEdge);
        setSelectedNode(null);
        clickedNodeRef.current = null;
        return;
      }

      isDraggingCanvas.current = true;
      clickedNodeRef.current = null;
      setHoverPreview(null);
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getScreenPos(e);
    const worldPos = getWorldPos(x, y);

    if (!isDraggingNode.current && !isDraggingCanvas.current) {
      const hovered = nodesRef.current.find((n) => {
        const r = getNodeBaseRadius(n) + 8;
        return Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < r;
      });
      setHoverNode(hovered ? hovered.id : null);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = hovered ? "pointer" : "crosshair";
      }
    }

    if (isDraggingNode.current && draggedNodeId.current) {
      const node = nodesRef.current.find((n) => n.id === draggedNodeId.current);
      if (node) {
        // 检测是否真的在拖拽（移动超过 3 像素）
        const dx = x - dragStart.current.x;
        const dy = y - dragStart.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          hasDragged.current = true;
        }

        node.x = worldPos.x;
        node.y = worldPos.y;
        node.vx = 0;
        node.vy = 0;
      }
    }

    if (isDraggingCanvas.current) {
      const dx = x - dragStart.current.x;
      const dy = y - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDragged.current = true;
      }
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      dragStart.current = { x, y };
    }
  };

  const handleMouseUp = () => {
    // 如果点击了节点且没有拖拽，则打开笔记（文件夹节点不打开）
    if (clickedNodeRef.current && !hasDragged.current && !clickedNodeRef.current.isFolder) {
      if (linkingFrom) {
        void createLink(linkingFrom, clickedNodeRef.current);
        const node = draggedNodeId.current
          ? nodesRef.current.find((n) => n.id === draggedNodeId.current)
          : null;
        if (node) node.isDragging = false;
        clickedNodeRef.current = null;
        isDraggingNode.current = false;
        isDraggingCanvas.current = false;
        draggedNodeId.current = null;
        return;
      }
      openFile(clickedNodeRef.current.path, { preview: true });
    }

    if (isDraggingNode.current && draggedNodeId.current) {
      const node = nodesRef.current.find((n) => n.id === draggedNodeId.current);
      if (node) node.isDragging = false;
    }
    isDraggingNode.current = false;
    isDraggingCanvas.current = false;
    draggedNodeId.current = null;
    clickedNodeRef.current = null;
  };

  // 右键菜单处理
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    // 如果已经是孤立视图，不显示右键菜单
    if (isolatedNode) return;

    const { x, y } = getScreenPos(e);
    const worldPos = getWorldPos(x, y);

    // 查找右键点击的节点
    const clickedNode = nodesRef.current.find((n) => {
      const r = getNodeBaseRadius(n) + 8;
      return Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < r;
    });

    if (clickedNode) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        node: clickedNode,
      });
    } else {
      setContextMenu(null);
    }
  };

  // 处理孤立查看
  const handleIsolateView = () => {
    if (!contextMenu) return;

    const node = contextMenu.node;
    openIsolatedGraphTab({
      id: node.id,
      label: node.label,
      path: node.path,
      isFolder: node.isFolder || false,
    });

    setContextMenu(null);
  };

  // 使用原生事件监听器处理 wheel 事件（需要 passive: false 才能 preventDefault）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.min(Math.max(z * delta, 0.3), 3));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const handleNodeClick = (node: GraphNode) => {
    if (!node.isFolder) {
      openFile(node.path, { preview: true });
    }
  };

  // Get connected nodes for selected node
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return [];
    const nodeById = new Map(nodesRef.current.map((node) => [node.id, node]));
    return edgesRef.current
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .map((e) => {
        const targetId = e.source === selectedNode.id ? e.target : e.source;
        return nodeById.get(targetId);
      })
      .filter(Boolean) as GraphNode[];
  }, [selectedNode]);

  const currentIsolatedNotes = useMemo(() => {
    return nodesRef.current.filter((node) => !node.isFolder && node.connections === 0);
  }, [displayCounts.isolated, displayCounts.nodes, graphData]);

  const selectedNodeInfo = useMemo(() => {
    if (!selectedNode) return null;
    const noteMeta = !selectedNode.isFolder ? noteIndex.get(selectedNode.id) ?? null : null;
    const nodeBacklinks = noteMeta ? getBacklinks(noteMeta.name) : [];
    const path = selectedNode.path;
    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const parentFolderPath = selectedNode.isFolder
      ? path
      : lastSlash >= 0
        ? path.slice(0, lastSlash)
        : "";
    const lastModifiedLabel = noteMeta?.lastModified
      ? `${new Date(noteMeta.lastModified).toLocaleDateString()} ${new Date(
          noteMeta.lastModified,
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : null;

    return {
      noteMeta,
      nodeBacklinks,
      parentFolderPath,
      lastModifiedLabel,
    };
  }, [getBacklinks, noteIndex, selectedNode]);

  const missingLinkSuggestions = useMemo(() => {
    const noteMeta = selectedNodeInfo?.noteMeta ?? null;
    if (!selectedNode || selectedNode.isFolder || !noteMeta) return [];

    const suggestions: Array<{ node: GraphNode; reason: string }> = [];
    const connectedIds = new Set(connectedNodes.map((node) => node.id));
    connectedIds.add(selectedNode.id);
    const graphNodeMap = new Map(graphData.nodes.map((node) => [node.id, node]));
    const currentLastSlash = Math.max(
      selectedNode.path.lastIndexOf("/"),
      selectedNode.path.lastIndexOf("\\"),
    );
    const currentFileParent =
      currentLastSlash >= 0 ? selectedNode.path.slice(0, currentLastSlash) : "";
    const currentName = noteMeta.name.toLowerCase();

    for (const [path, note] of noteIndex.entries()) {
      if (connectedIds.has(path)) continue;

      const targetGraphNode = graphNodeMap.get(path);
      if (!targetGraphNode || targetGraphNode.isFolder) continue;

      const hasCommonTag = note.tags.some((tag) => noteMeta.tags.includes(tag));
      const targetLastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
      const targetParent = targetLastSlash >= 0 ? path.slice(0, targetLastSlash) : "";
      const isSameFolder = currentFileParent !== "" && currentFileParent === targetParent;
      const targetName = note.name.toLowerCase();
      const isTitleOverlap =
        isSameFolder &&
        ((targetName.length > 1 && currentName.includes(targetName)) ||
          (currentName.length > 1 && targetName.includes(currentName)));

      if (hasCommonTag) {
        suggestions.push({
          node: targetGraphNode,
          reason: t.knowledgeGraph.reasonCommonTag,
        });
      } else if (isTitleOverlap) {
        suggestions.push({
          node: targetGraphNode,
          reason: t.knowledgeGraph.reasonTitleOverlap,
        });
      }

      if (suggestions.length >= 3) break;
    }

    return suggestions;
  }, [connectedNodes, graphData.nodes, noteIndex, selectedNode, selectedNodeInfo, t]);

  const selectedEdgeNodes = useMemo(() => {
    if (!selectedEdge) return null;
    const source = nodesRef.current.find((node) => node.id === selectedEdge.source);
    const target = nodesRef.current.find((node) => node.id === selectedEdge.target);
    if (!source || !target) return null;
    return { source, target };
  }, [selectedEdge]);

  const hoverPreviewNode = hoverPreview
    ? nodesRef.current.find((node) => node.id === hoverPreview.nodeId) ?? null
    : null;

  // Rendered-content preview for the hovered note. Reuses the FIFO cache
  // built in iter 13's wikiLinks lib — every wiki-link hover already
  // populates the same cache, so popular notes return instantly here.
  const [previewHtml, setPreviewHtml] = useState<{ path: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRequestRef = useRef(0);
  useEffect(() => {
    if (!hoverPreviewNode || hoverPreviewNode.isFolder) {
      setPreviewHtml(null);
      setPreviewLoading(false);
      return;
    }
    const myId = ++previewRequestRef.current;
    const path = hoverPreviewNode.path;
    setPreviewLoading(true);
    getWikiPreview(path)
      .then((html) => {
        if (previewRequestRef.current !== myId) return;
        setPreviewHtml({ path, html });
        setPreviewLoading(false);
      })
      .catch(() => {
        if (previewRequestRef.current !== myId) return;
        setPreviewHtml(null);
        setPreviewLoading(false);
      });
  }, [hoverPreviewNode]);

  return (
    <div className={`flex h-full bg-popover dark:bg-background ${className}`}>
      {/* Settings Panel */}
      <div className={cn(
        "w-64 border-r border-border/60 bg-popover dark:bg-background flex-shrink-0 overflow-y-auto transition-[width,opacity] duration-200 ease-out",
        showSettings ? "opacity-100" : "w-0 opacity-0 overflow-hidden"
      )}>
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t.knowledgeGraph.settings}</h3>
            <button
              onClick={() => setShowSettings(false)}
              className={KNOWLEDGE_GRAPH_ICON_BUTTON_CLASS}
            >
              <ChevronUp size={14} />
            </button>
          </div>

          {/* Physics */}
          <div className="space-y-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.knowledgeGraph.physics}</h4>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>{t.knowledgeGraph.nodeRepulsion}</span>
                <span className="text-muted-foreground">{params.repulsion}</span>
              </div>
              <input
                type="range"
                min="500"
                max="10000"
                step="100"
                value={params.repulsion}
                onChange={(e) => setParams({ ...params, repulsion: Number(e.target.value) })}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>{t.knowledgeGraph.linkLength}</span>
                <span className="text-muted-foreground">{params.springLength}</span>
              </div>
              <input
                type="range"
                min="30"
                max="300"
                step="10"
                value={params.springLength}
                onChange={(e) => setParams({ ...params, springLength: Number(e.target.value) })}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>{t.knowledgeGraph.centerPull}</span>
                <span className="text-muted-foreground">{params.centerPull.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.05"
                step="0.001"
                value={params.centerPull}
                onChange={(e) => setParams({ ...params, centerPull: Number(e.target.value) })}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>

          {/* Visual */}
          <div className="space-y-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.knowledgeGraph.visual}</h4>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>{t.knowledgeGraph.nodeSize}</span>
                <span className="text-muted-foreground">{nodeSize.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={nodeSize}
                onChange={(e) => setNodeSize(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="rounded border-border/60"
              />
              <span>{t.knowledgeGraph.showLabels}</span>
            </label>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showFolders}
                onChange={(e) => setShowFolders(e.target.checked)}
                className="rounded border-border/60"
              />
              <span>{t.knowledgeGraph.showFolders}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Graph Area */}
      <div className="flex-1 flex flex-col">
        {/* Controls */}
        <div className="py-2 px-1.5 border-b border-border/60 flex items-center justify-between bg-popover dark:bg-background">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                KNOWLEDGE_GRAPH_ICON_BUTTON_CLASS,
                showSettings && "bg-primary/10 text-primary hover:text-primary"
              )}
              title={t.knowledgeGraph.settings}
            >
              <Settings size={16} />
            </button>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchFocus();
                }
              }}
              placeholder={t.knowledgeGraph.searchPlaceholder}
              className="mr-2 h-7 w-36 rounded-ui-sm border border-border/60 bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            />
            <div className="ml-2 flex h-7 items-center gap-3 border-l border-border/40 pl-3">
              <label className="flex cursor-pointer select-none items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showFolders}
                  onChange={(e) => setShowFolders(e.target.checked)}
                  disabled={onlyIsolated}
                  className="h-3 w-3 cursor-pointer rounded border-border/60 bg-background text-primary focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span>{t.knowledgeGraph.filterShowFolders}</span>
              </label>
              <label className="flex cursor-pointer select-none items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={onlyIsolated}
                  onChange={(e) => {
                    setOnlyIsolated(e.target.checked);
                    if (e.target.checked) setOnlyConnected(false);
                  }}
                  className="h-3 w-3 cursor-pointer rounded border-border/60 bg-background text-primary focus:ring-0"
                />
                <span>{t.knowledgeGraph.filterOnlyIsolated}</span>
              </label>
              <label className="flex cursor-pointer select-none items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={onlyConnected}
                  onChange={(e) => {
                    setOnlyConnected(e.target.checked);
                    if (e.target.checked) setOnlyIsolated(false);
                  }}
                  className="h-3 w-3 cursor-pointer rounded border-border/60 bg-background text-primary focus:ring-0"
                />
                <span>{t.knowledgeGraph.filterOnlyConnected}</span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>
                {displayCounts.nodes} {t.graph.nodes} · {displayCounts.edges} {t.graph.edges}
              </span>
              <button
                type="button"
                onClick={() => setShowIsolatedList((prev) => !prev)}
                className={cn(
                  "inline-flex cursor-pointer select-none items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                  showIsolatedList
                    ? "border-amber-500/30 bg-amber-500/20 text-amber-500"
                    : "border-amber-500/10 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400",
                )}
                title={t.knowledgeGraph.panelIsolatedTooltip}
              >
                <span>
                  {t.knowledgeGraph.isolatedNotesCount.replace(
                    "{count}",
                    String(currentIsolatedNotes.length),
                  )}
                </span>
                <ChevronDown
                  size={12}
                  className={cn(
                    "transition-transform duration-150",
                    showIsolatedList && "rotate-180",
                  )}
                />
              </button>
              {isIndexing && (
                <span>
                  {t.knowledgeGraph.indexingStatus
                    .replace("{indexed}", String(indexedCount))
                    .replace("{total}", String(totalNotes))}
                </span>
              )}
              {graphStatus.cappedByDisplayLimit && (
                <span>
                  {t.knowledgeGraph.cappedStatus
                    .replace("{shown}", String(graphStatus.displayedNotes))
                    .replace("{total}", String(graphStatus.totalNotes))
                    .replace("{hidden}", String(graphStatus.hiddenNotes))}
                </span>
              )}
              {indexTruncated && (
                <span>
                  {t.knowledgeGraph.truncatedStatus.replace(
                    "{total}",
                    String(graphStatus.totalNotes),
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}
              className={KNOWLEDGE_GRAPH_ICON_BUTTON_CLASS}
            >
              <ZoomIn size={14} />
            </button>
            <span className="flex h-7 w-10 items-center justify-center text-xs text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(z * 0.8, 0.3))}
              className={KNOWLEDGE_GRAPH_ICON_BUTTON_CLASS}
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={rebuildGraph}
              className={cn(KNOWLEDGE_GRAPH_ICON_BUTTON_CLASS, "ml-2")}
              title={t.sidebar.refresh}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative bg-popover dark:bg-background overflow-hidden">
          {showIsolatedList && (
            <div
              className="pointer-events-auto absolute left-3 top-3 z-30 flex max-h-72 w-64 flex-col rounded-xl border border-border/80 bg-popover/95 p-3 shadow-elev-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150"
              onWheel={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border/40 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  {t.knowledgeGraph.panelIsolatedListTitle}
                </span>
                <button
                  onClick={() => setShowIsolatedList(false)}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  title={t.common.close}
                >
                  <X size={13} />
                </button>
              </div>

              <div className="flex-1 space-y-0.5 overflow-y-auto pt-1.5 pr-0.5">
                {currentIsolatedNotes.length === 0 ? (
                  <div className="py-4 text-center text-[11px] text-muted-foreground">
                    {t.knowledgeGraph.panelIsolatedListEmpty}
                  </div>
                ) : (
                  currentIsolatedNotes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => {
                        setSearchQuery(node.label);
                        setShowIsolatedList(false);
                        focusGraphNode(node);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={node.path}
                    >
                      <span className="h-1 w-1 shrink-0 rounded-full bg-amber-500/60" />
                      <span className="truncate">{node.label}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          {linkingFrom && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-elev-2">
              <Plus size={13} className="text-primary" />
              <span>
                从 <span className="font-medium text-foreground">{linkingFrom.label}</span> 连接到...
              </span>
              <button
                onClick={() => setLinkingFrom(null)}
                className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                title={t.common.cancel}
              >
                <X size={13} />
              </button>
            </div>
          )}
          {isEditingLink && (
            <div className="absolute bottom-3 left-3 z-20 rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-muted-foreground shadow-elev-2">
              正在写入 Markdown 连接...
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            onMouseDown={(e) => {
              setContextMenu(null); // 点击时关闭右键菜单
              handleMouseDown(e);
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setHoverNode(null);
              setHoverPreview(null);
              handleMouseUp();
            }}
            onContextMenu={handleContextMenu}
            onDoubleClick={() => {
              if (selectedNode) {
                handleNodeClick(selectedNode);
              }
            }}
            className="block w-full h-full cursor-crosshair active:cursor-move"
          />

          <div
            className={cn(
              "absolute top-3 right-3 z-10 w-72 rounded-xl border border-border bg-popover shadow-elev-2 pointer-events-none transition-[opacity,transform] duration-150 ease-out",
              hoverPreviewNode
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-2 scale-[0.98]"
            )}
          >
            {hoverPreviewNode && (
              <div className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  {hoverPreviewNode.isFolder ? (
                    <MousePointer2 size={14} className="mt-0.5 text-muted-foreground" />
                  ) : (
                    <FileText size={14} className="mt-0.5 text-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">
                      {hoverPreviewNode.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {hoverPreviewNode.path}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                    <LinkIcon size={10} />
                    {hoverPreviewNode.connections}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                    {hoverPreviewNode.isFolder ? "Folder" : "Note"}
                  </span>
                </div>
                {/* Rendered preview — only for notes, fed by the same
                    cache iter 13's wiki-link hover preview uses. Cap
                    height so very long intros don't push the card off-
                    screen; the prose-sm reset gives Reading-View-
                    compatible typography in a smaller package. */}
                {!hoverPreviewNode.isFolder && (
                  <>
                    {previewLoading && !previewHtml && (
                      <div className="flex items-center gap-2 pt-1.5 border-t border-border/50 text-xs text-muted-foreground">
                        <Loader2 size={11} className="animate-spin" />
                        <span>{t.knowledgeGraph.loadingPreview}</span>
                      </div>
                    )}
                    {previewHtml && previewHtml.path === hoverPreviewNode.path && (
                      <div
                        className="pt-1.5 border-t border-border/50 prose prose-xs dark:prose-invert max-w-none text-xs leading-relaxed wiki-preview-body max-h-32 overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: previewHtml.html }}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 右键菜单 */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-popover border border-border/60 rounded-md shadow-elev-2 py-1 min-w-[140px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border/60 mb-1">
                {contextMenu.node.label}
              </div>
              <button
                onClick={handleIsolateView}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
                </svg>
                {t.knowledgeGraph.isolateView}
              </button>
              {!contextMenu.node.isFolder && (
                <>
                  <button
                    onClick={() => {
                      setLinkingFrom(contextMenu.node);
                      setSelectedNode(contextMenu.node);
                      setSelectedEdge(null);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    从此笔记创建连接
                  </button>
                  <button
                    onClick={() => {
                      openFile(contextMenu.node.path, { preview: true });
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    {t.knowledgeGraph.openNote}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Edge details */}
        {selectedEdge && selectedEdgeNodes && (
          <div className="p-3 border-t border-border/60 bg-popover dark:bg-background space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <LinkIcon size={10} />
                  WikiLink 连接
                </div>
                <div className="mt-1 text-sm text-foreground truncate">
                  {selectedEdgeNodes.source.label} {"->"} {selectedEdgeNodes.target.label}
                </div>
              </div>
              <button
                onClick={() => void deleteLink(selectedEdge)}
                disabled={isEditingLink}
                className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-ui-sm px-2 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={13} />
                删除连接
              </button>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              将从 {selectedEdgeNodes.source.label} 中移除 [[{selectedEdgeNodes.target.label}]]
            </div>
          </div>
        )}

        {/* Node details */}
        {selectedNode && selectedNodeInfo && (
          <div className="max-h-56 space-y-3 overflow-y-auto border-t border-border/60 bg-popover p-3 dark:bg-background">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText
                  size={14}
                  className={selectedNode.isFolder ? "text-muted-foreground" : "text-primary"}
                />
                <span
                  className="cursor-pointer truncate text-sm font-medium text-foreground hover:text-primary"
                  onClick={() => handleNodeClick(selectedNode)}
                >
                  {selectedNode.label}
                </span>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <span className="rounded-ui bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {selectedNode.isFolder ? t.knowledgeGraph.typeFolder : t.knowledgeGraph.typeNote}
                </span>
                {!selectedNode.isFolder && selectedNode.connections === 0 ? (
                  <span className="animate-pulse rounded-ui border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    {t.knowledgeGraph.statusIsolated}
                  </span>
                ) : (
                  !selectedNode.isFolder && (
                    <span className="rounded-ui border border-primary/10 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {t.knowledgeGraph.statusConnected}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="my-1 grid grid-cols-2 gap-x-4 gap-y-2 rounded-ui-sm border-y border-border/40 bg-muted/20 px-2 py-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t.knowledgeGraph.panelOutbound}</span>
                <span className="font-mono font-medium text-foreground">
                  {selectedNodeInfo.noteMeta?.outgoingLinks.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t.knowledgeGraph.panelInbound}</span>
                <span className="font-mono font-medium text-foreground">
                  {selectedNodeInfo.nodeBacklinks.length}
                </span>
              </div>
              <div className="col-span-2 flex min-w-0 items-center justify-between gap-3">
                <span className="shrink-0 text-muted-foreground">
                  {t.knowledgeGraph.panelFolder}
                </span>
                <span
                  className="truncate pl-4 text-right font-mono text-[11px] text-foreground"
                  title={selectedNodeInfo.parentFolderPath}
                >
                  {selectedNodeInfo.parentFolderPath || "/"}
                </span>
              </div>
              <div className="col-span-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t.knowledgeGraph.panelStatus}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {selectedNode.isFolder
                    ? t.knowledgeGraph.typeFolder
                    : selectedNode.connections === 0
                      ? t.knowledgeGraph.statusIsolated
                      : t.knowledgeGraph.statusConnected}
                </span>
              </div>
              {!selectedNode.isFolder && selectedNodeInfo.lastModifiedLabel && (
                <div className="col-span-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t.knowledgeGraph.panelLastModified}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {selectedNodeInfo.lastModifiedLabel}
                  </span>
                </div>
              )}
            </div>

            {!selectedNode.isFolder &&
              selectedNodeInfo.noteMeta?.tags &&
              selectedNodeInfo.noteMeta.tags.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t.knowledgeGraph.panelTags}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedNodeInfo.noteMeta.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-primary/10 bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {!selectedNode.isFolder && selectedNode.connections <= 1 && (
              <div className="flex items-start gap-2 rounded-ui-sm border border-amber-500/15 bg-amber-500/5 p-2.5 text-xs leading-relaxed animate-fade-in">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="space-y-0.5">
                  <div className="font-medium text-amber-500/90 dark:text-amber-400/90">
                    {t.knowledgeGraph.panelSuggestions}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedNode.connections === 0
                      ? t.knowledgeGraph.suggestIsolated
                      : t.knowledgeGraph.suggestWeaklyConnected}
                  </p>
                  {missingLinkSuggestions.length > 0 && (
                    <div className="pointer-events-auto mt-1.5 space-y-1 border-t border-amber-500/10 pt-2">
                      <div className="text-[10px] font-medium tracking-wider text-amber-500/80">
                        {t.knowledgeGraph.panelMissingLinks}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {missingLinkSuggestions.map(({ node, reason }) => (
                          <button
                            key={node.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void createLink(selectedNode, node);
                            }}
                            className="flex cursor-pointer items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
                            title={`${node.label} (${reason})`}
                          >
                            <span>{node.label}</span>
                            <span className="text-[9px] font-normal text-muted-foreground/60">
                              ({reason})
                            </span>
                            <span className="ml-0.5 font-bold text-amber-500/80">+</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {connectedNodes.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <LinkIcon size={10} />
                  {t.knowledgeGraph.linkedNotes} ({connectedNodes.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {connectedNodes.slice(0, 8).map((node) => (
                    <button
                      key={node.id}
                      onClick={() => {
                        setSelectedNode(node);
                        openFile(node.path, { preview: true });
                      }}
                      className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/20 hover:text-primary"
                    >
                      {node.label}
                    </button>
                  ))}
                  {connectedNodes.length > 8 && (
                    <span className="self-center pl-1 font-mono text-xs text-muted-foreground">
                      +{connectedNodes.length - 8}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {nodesRef.current.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MousePointer2 size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t.knowledgeGraph.noLinkedNotes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
