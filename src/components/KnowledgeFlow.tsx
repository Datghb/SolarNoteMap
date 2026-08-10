import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Importance, KnowledgeMap } from '../utils/smartMap';
import { DEFAULT_MAP_THEME, MAP_THEMES, MAP_THEME_CHANGE_EVENT, MAP_THEME_STORAGE_KEY, isMapTheme, loadMapTheme, saveMapTheme, type MapTheme } from '../utils/mapTheme';
import {
  KNOWLEDGE_COLORS,
  KNOWLEDGE_LABELS,
  classifyKnowledgeEdges,
  createMindMapLayout,
  getConnectedNodeIds,
  getDescendantNodeIds,
  getKnowledgeKind,
  type KnowledgeKind,
} from '../utils/constellationLayout';

interface ConceptData extends Record<string, unknown> {
  title: string;
  note: string;
  importance: Importance;
  suggested: boolean;
  color: string;
  kind: KnowledgeKind;
  dimmed: boolean;
  childCount: number;
  collapsed: boolean;
  compact: boolean;
  onToggle: (id: string) => void;
  side: -1 | 0 | 1;
  slideNumbers: number[];
}

function ConceptNode({ id, data, selected }: NodeProps<Node<ConceptData>>) {
  return (
    <article
      className={`concept-node mind-map-node side-${data.side} ${data.importance === 'core' ? 'root' : ''} ${data.suggested ? 'suggested' : 'confirmed'} ${selected ? 'selected' : ''} ${data.dimmed ? 'dimmed' : ''}`}
      style={{ '--concept-color': data.color } as React.CSSProperties}
    >
      {data.side !== 0 && <Handle type="target" position={data.side === -1 ? Position.Right : Position.Left} />}
      {data.side === 0 && <>
        <Handle id="left" type="source" position={Position.Left} />
        <Handle id="right" type="source" position={Position.Right} />
        <Handle id="target-left" className="core-target-handle" type="target" position={Position.Left} />
        <Handle id="target-right" className="core-target-handle" type="target" position={Position.Right} />
      </>}
      <div className="concept-node-topline">
        <span><i />{KNOWLEDGE_LABELS[data.kind]}</span>
        {data.suggested && <small>AI</small>}
      </div>
      <strong>{data.title}</strong>
      {data.slideNumbers.length > 0 && <small className="concept-slide-source">Slide {data.slideNumbers.join(', ')}</small>}
      {!data.compact && <p>{selected ? data.note || 'Chưa có giải thích cho ý này.' : data.note}</p>}
      {data.childCount > 0 && !data.compact && (
        <button
          className="concept-collapse"
          onClick={(event) => { event.stopPropagation(); data.onToggle(id); }}
          aria-label={data.collapsed ? 'Mở nhánh' : 'Thu gọn nhánh'}
        >
          {data.collapsed ? `＋ ${data.childCount} ý` : '− Thu nhánh'}
        </button>
      )}
      {data.side !== 0 && <Handle type="source" position={data.side === -1 ? Position.Left : Position.Right} />}
    </article>
  );
}

const nodeTypes = { concept: ConceptNode };

const THEME_BACKGROUND: Record<MapTheme, { variant: BackgroundVariant; color: string; gap: number; size: number }> = {
  galaxy: { variant: BackgroundVariant.Dots, color: '#293248', gap: 28, size: 0.65 },
  classic: { variant: BackgroundVariant.Dots, color: '#b1b1b7', gap: 25, size: 1 },
  figma: { variant: BackgroundVariant.Cross, color: '#c7c8cc', gap: 32, size: 2 },
  neon: { variant: BackgroundVariant.Lines, color: '#17384a', gap: 32, size: 1 },
  minimal: { variant: BackgroundVariant.Dots, color: '#d7d7dc', gap: 24, size: 0.75 },
};

function relationColor(label: string) {
  const normalized = label.toLocaleLowerCase('vi');
  if (/đối lập|khác|nhưng|rủi ro|gây/.test(normalized)) return KNOWLEDGE_COLORS.question;
  if (/ví dụ|minh họa|ứng dụng/.test(normalized)) return KNOWLEDGE_COLORS.example;
  if (/dẫn|tạo|quá trình|trải qua|kết quả/.test(normalized)) return KNOWLEDGE_COLORS.process;
  return '#7698C8';
}

function buildFlow(
  map: KnowledgeMap,
  compact: boolean,
  collapsedIds: Set<string>,
  onToggle: (id: string) => void,
  selectedId?: string,
): { nodes: Node<ConceptData>[]; edges: Edge[] } {
  const hiddenIds = new Set<string>();
  collapsedIds.forEach((id) => getDescendantNodeIds(map, id).forEach((childId) => hiddenIds.add(childId)));
  const positions = createMindMapLayout(map, { compact });
  const positionById = new Map(positions.map((position) => [position.id, position]));
  const hierarchy = classifyKnowledgeEdges(map);
  const focusedIds = selectedId ? getConnectedNodeIds(map, selectedId) : null;
  const visibleNodes = map.nodes.filter((node) => !hiddenIds.has(node.id));

  return {
    nodes: visibleNodes.map((node) => {
      const position = positionById.get(node.id)!;
      const directChildren = [...hierarchy.parentById.values()].filter((parentId) => parentId === node.id).length;
      const kind = getKnowledgeKind(node);
      return {
        id: node.id,
        type: 'concept',
        position: { x: position.x, y: position.y },
        selected: node.id === selectedId,
        data: {
          title: node.title,
          note: node.note,
          importance: node.importance,
          suggested: node.status === 'suggested',
          color: KNOWLEDGE_COLORS[kind],
          kind,
          dimmed: Boolean(focusedIds && !focusedIds.has(node.id)),
          childCount: directChildren,
          collapsed: collapsedIds.has(node.id),
          compact,
          onToggle,
          side: position.side,
          slideNumbers: node.slideNumbers ?? [],
        },
      };
    }),
    edges: map.edges
      .filter((edge) => !hiddenIds.has(edge.from) && !hiddenIds.has(edge.to))
      .map((edge, index) => {
        const color = relationColor(edge.label);
        const dimmed = Boolean(focusedIds && (!focusedIds.has(edge.from) || !focusedIds.has(edge.to)));
        const isTreeEdge = hierarchy.treeEdgeIndexes.has(index);
        const isIncidentToSelection = Boolean(selectedId && (edge.from === selectedId || edge.to === selectedId));
        return {
          id: `${edge.from}-${edge.to}-${index}`,
          source: edge.from,
          target: edge.to,
          label: !compact && (isTreeEdge || isIncidentToSelection) ? edge.label : undefined,
          hidden: !isTreeEdge && !isIncidentToSelection,
          type: isTreeEdge ? 'smoothstep' : 'default',
          pathOptions: isTreeEdge ? { borderRadius: 18, offset: 30 } : undefined,
          sourceHandle: positionById.get(edge.from)?.side === 0
            ? (positionById.get(edge.to)?.side === -1 ? 'left' : 'right')
            : undefined,
          targetHandle: positionById.get(edge.to)?.side === 0
            ? (positionById.get(edge.from)?.side === -1 ? 'target-left' : 'target-right')
            : undefined,
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
          animated: false,
          style: {
            stroke: color,
            strokeWidth: selectedId && !dimmed ? 2.5 : (isTreeEdge ? 1.7 : 1.15),
            strokeDasharray: isTreeEdge ? undefined : '5 7',
            opacity: dimmed ? 0.08 : (isTreeEdge ? 0.76 : 0.34),
          },
          labelStyle: { fill: '#B7C0D3', fontSize: 9, fontWeight: 650 },
          labelBgStyle: { fill: '#080B14', fillOpacity: 0.94 },
          labelBgPadding: [7, 4] as [number, number],
          labelBgBorderRadius: 7,
        };
      }),
  };
}

export function KnowledgeFlow({ map, onSelect, compact = false, selectedId }: { map: KnowledgeMap; accent: string; onSelect: (id: string) => void; compact?: boolean; selectedId?: string | null }) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [theme, setTheme] = useState<MapTheme>(() => loadMapTheme());
  const flowInstance = useRef<ReactFlowInstance<Node<ConceptData>, Edge> | null>(null);
  const topologyKey = useMemo(
    () => `${compact ? 'compact' : 'full'}::${map.nodes.map((node) => `${node.id}:${node.importance}`).sort().join('|')}::${map.edges.map((edge) => `${edge.from}>${edge.to}`).sort().join('|')}`,
    [compact, map.edges, map.nodes],
  );
  const previousTopologyKey = useRef(topologyKey);
  const toggleBranch = useMemo(() => (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const layout = useMemo(
    () => buildFlow(map, compact, collapsedIds, toggleBranch, selectedId ?? undefined),
    [map, compact, collapsedIds, selectedId, toggleBranch],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  useEffect(() => {
    const syncTheme = (event: Event) => {
      const nextTheme = event instanceof CustomEvent ? event.detail : loadMapTheme();
      if (isMapTheme(nextTheme)) setTheme(nextTheme);
    };
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key === MAP_THEME_STORAGE_KEY) setTheme(isMapTheme(event.newValue) ? event.newValue : DEFAULT_MAP_THEME);
    };
    window.addEventListener(MAP_THEME_CHANGE_EVENT, syncTheme);
    window.addEventListener('storage', syncStoredTheme);
    return () => {
      window.removeEventListener(MAP_THEME_CHANGE_EVENT, syncTheme);
      window.removeEventListener('storage', syncStoredTheme);
    };
  }, []);

  useEffect(() => {
    const topologyChanged = previousTopologyKey.current !== topologyKey;
    previousTopologyKey.current = topologyKey;
    setNodes((current) => layout.nodes.map((nextNode) => {
      const previous = current.find((node) => node.id === nextNode.id);
      return previous && !topologyChanged ? { ...nextNode, position: previous.position } : nextNode;
    }));
    setEdges(layout.edges);
    if (topologyChanged) window.requestAnimationFrame(() => void flowInstance.current?.fitView({ padding: compact ? 0.18 : 0.3, duration: 500 }));
  }, [compact, layout, setEdges, setNodes, topologyKey]);

  const resetLayout = () => {
    setNodes(layout.nodes);
    window.requestAnimationFrame(() => void flowInstance.current?.fitView({ padding: 0.3, duration: 500 }));
  };
  const background = THEME_BACKGROUND[theme];
  const isLightTheme = theme === 'classic' || theme === 'figma' || theme === 'minimal';

  const changeTheme = (nextTheme: MapTheme) => {
    setTheme(nextTheme);
    saveMapTheme(nextTheme);
    window.dispatchEvent(new CustomEvent(MAP_THEME_CHANGE_EVENT, { detail: nextTheme }));
  };

  return (
    <div className={`concept-flow-shell flow-shell-${theme}`}>
      {!compact && <div className="concept-legend" aria-label="Chú thích màu sắc">
        {(Object.keys(KNOWLEDGE_LABELS) as KnowledgeKind[]).map((kind) => (
          <span key={kind} style={{ '--legend-color': KNOWLEDGE_COLORS[kind] } as React.CSSProperties}><i />{KNOWLEDGE_LABELS[kind]}</span>
        ))}
      </div>}
      <ReactFlow
        className={`knowledge-flow-theme flow-theme-${theme}`}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => { flowInstance.current = instance; }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_event, node) => onSelect(node.id)}
        onPaneClick={() => !compact && onSelect('')}
        fitView
        fitViewOptions={{ padding: compact ? 0.18 : 0.3, duration: 650 }}
        minZoom={0.25}
        maxZoom={1.8}
        nodesDraggable={!compact}
        nodesConnectable={false}
        zoomOnScroll={!compact}
        panOnDrag={!compact}
        elementsSelectable={!compact}
        selectNodesOnDrag={false}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        colorMode={isLightTheme ? 'light' : 'dark'}
      >
        <Background variant={background.variant} color={background.color} gap={background.gap} size={background.size} />
        {!compact && <>
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => theme === 'classic' || theme === 'minimal' ? '#ffffff' : (node.data as ConceptData).color}
            nodeStrokeWidth={2}
            maskColor={isLightTheme ? 'rgba(225, 228, 235, 0.72)' : 'rgba(3, 5, 13, 0.72)'}
          />
          <Controls showInteractive={false} />
          <Panel position="top-right" className="advanced-flow-tools">
            <label>
              <span>Giao diện</span>
              <select value={theme} onChange={(event) => changeTheme(event.target.value as MapTheme)} aria-label="Chọn giao diện sơ đồ">
                {MAP_THEMES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <button onClick={() => void flowInstance.current?.fitView({ padding: 0.3, duration: 500 })}>Toàn cảnh</button>
            <button onClick={resetLayout}>Sắp xếp lại</button>
          </Panel>
        </>}
      </ReactFlow>
    </div>
  );
}
