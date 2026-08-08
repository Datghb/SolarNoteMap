import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Importance, KnowledgeMap } from '../utils/smartMap';
import {
  KNOWLEDGE_COLORS,
  KNOWLEDGE_LABELS,
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
      {data.side === 0 && <><Handle id="left" type="source" position={Position.Left} /><Handle id="right" type="source" position={Position.Right} /></>}
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
  const positions = createMindMapLayout(map);
  const focusedIds = selectedId ? getConnectedNodeIds(map, selectedId) : null;
  const visibleNodes = map.nodes.filter((node) => !hiddenIds.has(node.id));

  return {
    nodes: visibleNodes.map((node) => {
      const position = positions.find((item) => item.id === node.id)!;
      const directChildren = map.edges.filter((edge) => edge.from === node.id).length;
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
        return {
          id: `${edge.from}-${edge.to}-${index}`,
          source: edge.from,
          target: edge.to,
          label: compact ? undefined : edge.label,
          type: 'default',
          sourceHandle: positions.find((position) => position.id === edge.from)?.side === 0
            ? (positions.find((position) => position.id === edge.to)?.side === -1 ? 'left' : 'right')
            : undefined,
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
          animated: !compact && !dimmed,
          style: { stroke: color, strokeWidth: selectedId && !dimmed ? 2.5 : 1.5, opacity: dimmed ? 0.1 : 0.72 },
          labelStyle: { fill: '#B7C0D3', fontSize: 9, fontWeight: 650 },
          labelBgStyle: { fill: '#080B14', fillOpacity: 0.94 },
          labelBgPadding: [7, 4],
          labelBgBorderRadius: 7,
        };
      }),
  };
}

export function KnowledgeFlow({ map, onSelect, compact = false, selectedId }: { map: KnowledgeMap; accent: string; onSelect: (id: string) => void; compact?: boolean; selectedId?: string | null }) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
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
    setNodes((current) => layout.nodes.map((nextNode) => {
      const previous = current.find((node) => node.id === nextNode.id);
      return previous ? { ...nextNode, position: previous.position } : nextNode;
    }));
    setEdges(layout.edges);
  }, [layout, setEdges, setNodes]);

  return (
    <div className="concept-flow-shell">
      {!compact && <div className="concept-legend" aria-label="Chú thích màu sắc">
        {(Object.keys(KNOWLEDGE_LABELS) as KnowledgeKind[]).map((kind) => (
          <span key={kind} style={{ '--legend-color': KNOWLEDGE_COLORS[kind] } as React.CSSProperties}><i />{KNOWLEDGE_LABELS[kind]}</span>
        ))}
      </div>}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background color="#293248" gap={28} size={0.65} />
        {!compact && <Controls showInteractive={false} />}
      </ReactFlow>
    </div>
  );
}
