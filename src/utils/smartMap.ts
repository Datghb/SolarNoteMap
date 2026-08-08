export type Importance = 'minor' | 'detail' | 'support' | 'important' | 'core';
export type NodeStatus = 'suggested' | 'confirmed';

export interface KnowledgeNode {
  id: string;
  title: string;
  note: string;
  importance: Importance;
  status: NodeStatus;
  x: number;
  y: number;
  slideNumbers?: number[];
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  label: string;
}

export interface KnowledgeMap {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  sourceNote?: string;
  sourceSummary?: string;
  sourceVersion?: string;
}

interface DraftIdea {
  title: string;
  note: string;
  importance: Importance;
  x: number;
  y: number;
  relation?: string;
}

const DRAFTS: Record<string, DraftIdea[]> = {
  'ai-foundations': [
    { title: 'Trí tuệ nhân tạo', note: 'Hệ thống thực hiện những nhiệm vụ thường cần trí thông minh của con người.', importance: 'core', x: 50, y: 48 },
    { title: 'Dữ liệu', note: 'Nguồn ví dụ giúp hệ thống nhận ra mẫu và quy luật.', importance: 'important', x: 25, y: 24, relation: 'học từ' },
    { title: 'Mô hình', note: 'Cấu trúc đã học được dùng để xử lý đầu vào mới.', importance: 'important', x: 76, y: 25, relation: 'được biểu diễn bởi' },
    { title: 'Dự đoán', note: 'Kết quả hệ thống tạo ra từ dữ liệu đầu vào.', importance: 'support', x: 79, y: 70, relation: 'tạo ra' },
    { title: 'Hỗ trợ con người', note: 'AI nên tăng năng lực ra quyết định, không mặc định thay thế con người.', importance: 'support', x: 23, y: 72, relation: 'hướng tới' },
    { title: 'Rủi ro sai lệch', note: 'Dữ liệu thiếu đại diện có thể tạo ra kết quả thiếu công bằng.', importance: 'detail', x: 50, y: 83, relation: 'cần kiểm soát' },
  ],
  'machine-learning': [
    { title: 'Máy học', note: 'Máy tìm quy luật từ ví dụ thay vì chỉ làm theo quy tắc viết sẵn.', importance: 'core', x: 50, y: 48 },
    { title: 'Dữ liệu huấn luyện', note: 'Các ví dụ được dùng trong quá trình học.', importance: 'important', x: 23, y: 25, relation: 'học từ' },
    { title: 'Huấn luyện', note: 'Quá trình điều chỉnh mô hình để giảm sai số.', importance: 'important', x: 76, y: 25, relation: 'trải qua' },
    { title: 'Mô hình', note: 'Kết quả được lưu lại sau quá trình học.', importance: 'support', x: 78, y: 70, relation: 'tạo ra' },
    { title: 'Dự đoán', note: 'Mô hình áp dụng điều đã học cho dữ liệu mới.', importance: 'support', x: 24, y: 70, relation: 'dùng để' },
    { title: 'Đánh giá', note: 'Kiểm tra khả năng hoạt động trên dữ liệu chưa từng thấy.', importance: 'detail', x: 50, y: 84, relation: 'được kiểm chứng bằng' },
  ],
};

const FALLBACK_DRAFT: DraftIdea[] = [
  { title: 'Ý tưởng trung tâm', note: 'Điều quan trọng nhất bạn đang muốn giải thích.', importance: 'core', x: 50, y: 48 },
  { title: 'Đầu vào', note: 'Thông tin hoặc điều kiện bắt đầu.', importance: 'important', x: 24, y: 25, relation: 'bắt đầu từ' },
  { title: 'Quá trình', note: 'Cách đầu vào được biến đổi.', importance: 'important', x: 76, y: 25, relation: 'vận hành qua' },
  { title: 'Kết quả', note: 'Điều nhận được sau quá trình.', importance: 'support', x: 77, y: 72, relation: 'tạo ra' },
  { title: 'Ví dụ thực tế', note: 'Một tình huống giúp kiểm chứng cách hiểu.', importance: 'support', x: 23, y: 72, relation: 'được minh họa bởi' },
];

const STOP_WORDS = new Set(['và', 'là', 'của', 'được', 'một', 'các', 'cho', 'trong', 'từ', 'với']);

function normalizedTokens(value: string) {
  return value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function titleFromClause(clause: string) {
  const cleaned = clause.trim().replace(/^(sau đó|theo mình|mình hiểu|vì vậy|ngoài ra)[,:\s]*/i, '');
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : '');
}

export function createRealtimeMap(lessonId: string, sourceNote: string): KnowledgeMap {
  const cleanNote = sourceNote.trim();
  if (!cleanNote) return { nodes: [], edges: [], sourceNote: '' };

  const ideas = DRAFTS[lessonId] ?? FALLBACK_DRAFT;
  const noteTokens = new Set(normalizedTokens(cleanNote));
  const matchedIdeas = ideas.filter((idea, index) => {
    if (index === 0) return true;
    const conceptTokens = normalizedTokens(idea.title);
    return conceptTokens.some((token) => noteTokens.has(token));
  });
  const clauses = cleanNote
    .split(/[.!?;\n]+|,\s+(?=(?:sau đó|vì|nên|nhưng|ngoài ra))/i)
    .map(titleFromClause)
    .filter((title) => title.split(/\s+/).length >= 3);

  const dynamicIdeas: DraftIdea[] = clauses
    .filter((title) => !matchedIdeas.some((idea) => normalizedTokens(title).some((token) => normalizedTokens(idea.title).includes(token))))
    .slice(0, Math.max(0, 6 - matchedIdeas.length))
    .map((title, index) => ({
      title,
      note: 'Ý được nhận diện trực tiếp từ ghi chú của bạn.',
      importance: index === 0 && matchedIdeas.length === 0 ? 'core' : 'support',
      x: [25, 76, 78, 23, 50][index % 5],
      y: [25, 25, 70, 70, 84][index % 5],
      relation: 'được nhắc cùng',
    }));
  const selectedIdeas = [...matchedIdeas, ...dynamicIdeas].slice(0, 7);
  const nodes = selectedIdeas.map((idea, index) => ({
    ...idea,
    id: `live-${lessonId}-${index}-${normalizedTokens(idea.title).slice(0, 2).join('-')}`,
    status: 'suggested' as const,
  }));
  const core = nodes[0];
  const edges = nodes.slice(1).map((node, index) => ({
    from: core.id,
    to: node.id,
    label: selectedIdeas[index + 1].relation ?? 'liên quan đến',
  }));

  return { nodes, edges, sourceNote };
}

export function createSummaryFallbackMap(lessonId: string, sourceSummary: string): KnowledgeMap {
  const map = createRealtimeMap(lessonId, sourceSummary);
  const { sourceNote: _sourceNote, ...graph } = map;
  return { ...graph, sourceSummary };
}

export function createSmartDraft(lessonId: string, sourceNote: string): KnowledgeMap {
  const ideas = DRAFTS[lessonId] ?? FALLBACK_DRAFT;
  const nodes = ideas.map((idea, index) => ({
    ...idea,
    id: `ai-${lessonId}-${index}`,
    status: 'suggested' as const,
  }));
  const core = nodes[0];
  const edges = nodes.slice(1).map((node, index) => ({
    from: index % 3 === 2 ? nodes[index].id : core.id,
    to: node.id,
    label: ideas[index + 1].relation ?? 'liên quan đến',
  }));

  return { nodes, edges, sourceNote: sourceNote.trim() };
}

export function reviewKnowledgeMap(map: KnowledgeMap) {
  const confirmed = map.nodes.filter((node) => node.status === 'confirmed').length;
  const coverage = Math.round((map.nodes.length / Math.max(6, map.nodes.length)) * 100);
  return {
    coverage,
    confirmed,
    strengths: [
      `Đã xác định ${map.nodes.filter((node) => ['core', 'important'].includes(node.importance)).length} ý trọng tâm.`,
      `${map.edges.length} mối quan hệ đã có ý nghĩa rõ ràng.`,
    ],
    question: map.nodes.some((node) => node.title.toLowerCase().includes('rủi ro'))
      ? 'Bạn có thể đưa ra một ví dụ cho thấy dữ liệu sai lệch làm kết quả AI thay đổi như thế nào?'
      : 'Nếu dữ liệu đầu vào thay đổi, kết quả của hệ thống sẽ thay đổi như thế nào?',
  };
}
