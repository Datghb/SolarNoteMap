import { useMemo, useEffect, useRef, useState, Suspense, lazy, useCallback } from 'react';
import type { Lesson } from '../data/lessons';
import { getLessonSlides, getPdfPageSlides } from '../data/slides';
import type { KnowledgeMap, KnowledgeNode } from '../utils/smartMap';
import { requestAiMap } from '../utils/aiMap';
import { fetchLessonKnowledgeMap, generateLessonKnowledgeMap, KnowledgeMapApiError } from '../utils/lessonKnowledgeMap';
import { KnowledgeFlow } from './KnowledgeFlow';
import { SlideLearningWorkspace } from './SlideLearningWorkspace';
import { updateSlideNote } from '../utils/slideNotes';
import { CommunityQuestions } from './CommunityQuestions';
import { LessonSummary } from './LessonSummary';
import { fetchLessonSummary, isExtractiveFallbackSummary } from '../utils/lessonSummary';
import { persistCloudMap, persistCloudNote, recordStudentActivity } from '../utils/courseStore';
import { builtInSlidePdfUrl } from './pdfUrls';
import { loadCloudLearningState } from '../utils/cloudClassroom';
import { useActiveSlideDwell } from '../hooks/useActiveSlideDwell';
import { addQuizDwell, addQuizKeyword, addQuizWrongKeywords, createQuizBehaviorState, deriveAdaptiveQuizContext, markQuizSlideUnclear } from '../utils/quizBehavior';
import { AdaptiveQuizApiError, canRenderAdaptiveQuizAttempt, dismissAdaptiveQuiz, loadAdaptiveQuizHistory, loadAdaptiveQuizRecommendation, prepareAdaptiveQuiz, reportAdaptiveQuizQuestion, saveAdaptiveQuizProgress, startAdaptiveQuiz, submitAdaptiveQuiz, type AdaptiveQuizHistoryItem, type AdaptiveQuizMode, type AdaptiveQuizRecommendation, type AdaptiveQuizResult, type QuizSlotId } from '../utils/adaptiveQuiz';
import { AdaptiveQuizPanel } from './AdaptiveQuizPanel';
import type { LessonKeyword } from '../utils/lessonSummary';
import { generateLessonQuizIndex, LessonQuizIndexApiError } from '../utils/lessonQuizIndex';

// pdfjs-dist (~1.4MB worker + parser code) is only needed once a lesson that
// actually uses the PDF slide deck is opened, so keep it out of the initial
// bundle and load it on demand.
const PdfSlideWorkspace = lazy(() => import('./PdfSlideWorkspace').then((m) => ({ default: m.PdfSlideWorkspace })));

const EMPTY_MAP: KnowledgeMap = { nodes: [], edges: [] };

function boundedEnvSeconds(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.round(parsed))) : fallback;
}

export function LearningConsole({ lesson, classId, summaryCacheScope, onClose, onRefreshPdf, canManageLesson = false }: { lesson: Lesson; classId: string; summaryCacheScope: string; onClose: () => void; onRefreshPdf: () => Promise<string>; canManageLesson?: boolean }) {
  const [tab, setTab] = useState<'brief' | 'summary' | 'map' | 'community' | 'quiz'>('brief');
  const [map, setMap] = useState<KnowledgeMap>(EMPTY_MAP);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideNotes, setSlideNotes] = useState<Record<string, string>>({});
  const [isThinking, setIsThinking] = useState(false);
  const [mapSource, setMapSource] = useState<'local' | 'ai' | 'fallback'>('local');
  const [analysisError, setAnalysisError] = useState('');
  const [mapHydratedLessonId, setMapHydratedLessonId] = useState<string | null>(null);
  const [mapGenerationRevision, setMapGenerationRevision] = useState(0);
  const [availableSummary, setAvailableSummary] = useState(isExtractiveFallbackSummary(lesson.summary) ? '' : (lesson.summary?.trim() ?? ''));
  const adaptiveQuizFeatureEnabled = import.meta.env.VITE_ADAPTIVE_QUIZ_ENABLED === 'true';
  const adaptiveQuizPhase2Enabled = import.meta.env.VITE_ADAPTIVE_QUIZ_PHASE2_ENABLED === 'true';
  const adaptiveQuizEnabled = adaptiveQuizFeatureEnabled && !canManageLesson;
  const quizTriggerSeconds = boundedEnvSeconds(import.meta.env.VITE_ADAPTIVE_QUIZ_TRIGGER_SECONDS, 30, 30, 3_600);
  const quizCompletionCooldownSeconds = boundedEnvSeconds(import.meta.env.VITE_ADAPTIVE_QUIZ_COMPLETION_COOLDOWN_SECONDS, 600, 0, 86_400);
  const [quizIndexState, setQuizIndexState] = useState<{ status: 'idle' | 'indexing' | 'ready' | 'error'; chunkCount: number; message: string }>({ status: 'idle', chunkCount: 0, message: '' });
  const [quizBehavior, setQuizBehavior] = useState(() => createQuizBehaviorState(1));
  const [quizRecommendation, setQuizRecommendation] = useState<AdaptiveQuizRecommendation | null>(null);
  const [quizHistory, setQuizHistory] = useState<AdaptiveQuizHistoryItem[]>([]);
  const [selectedQuizHistoryId, setSelectedQuizHistoryId] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<AdaptiveQuizResult | null>(null);
  const [quizPreparing, setQuizPreparing] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quizCooldownActive, setQuizCooldownActive] = useState(false);
  const [dismissedPhase2OfferSignature, setDismissedPhase2OfferSignature] = useState<string | null>(null);
  const [preparingQuestionCount, setPreparingQuestionCount] = useState(3);
  const noteActivityTimer = useRef<number | null>(null);
  const cloudNoteTimer = useRef<number | null>(null);
  const cloudNoteSaveChain = useRef(Promise.resolve());
  const pendingCloudNote = useRef<{ lessonId: string; slideNumber: number; content: string } | null>(null);
  const personalMap = useRef<KnowledgeMap | null>(null);
  const forceMapGeneration = useRef(false);
  const mapRetryCount = useRef(0);
  const preparedQuizSignatures = useRef(new Set<string>());
  const interactedQuizKeywords = useRef(new Set<string>());
  const learningStateDirty = useRef(false);
  const learningStateLessonId = useRef<string | null>(null);
  const mapStorageKey = useMemo(() => `solar-note-map:${classId}:${lesson.id}`, [classId, lesson.id]);
  const notesStorageKey = useMemo(() => `solar-slide-notes:${classId}:${lesson.id}`, [classId, lesson.id]);

  const usesDay01Pdf = lesson.id === 'ai-foundations' || Boolean(lesson.pdfUrl);
  const [pdfPageCount, setPdfPageCount] = useState(42);
  const [pdfLoadedLessonId, setPdfLoadedLessonId] = useState<string | null>(null);
  const slides = useMemo(
    () => usesDay01Pdf ? getPdfPageSlides(pdfPageCount) : getLessonSlides(lesson.id, lesson.name),
    [usesDay01Pdf, pdfPageCount, lesson.id, lesson.name],
  );
  const quizContext = useMemo(() => deriveAdaptiveQuizContext(quizBehavior, quizTriggerSeconds), [quizBehavior, quizTriggerSeconds]);
  const selectedQuizHistory = useMemo(() => quizHistory.find((item) => item.id === selectedQuizHistoryId) ?? null, [quizHistory, selectedQuizHistoryId]);

  const completeSlideDwell = useCallback((signal: { slideNumber: number; activeSeconds: number; revisitCount: number }) => {
    setQuizBehavior((current) => addQuizDwell(current, signal));
    recordStudentActivity({
      lessonId: lesson.id,
      slideId: slides[signal.slideNumber - 1]?.id,
      type: 'slide_dwell_completed',
      metadata: { slideNumber: signal.slideNumber, activeSeconds: signal.activeSeconds, source: 'lesson_slide' },
    });
  }, [lesson.id, slides]);

  useActiveSlideDwell({
    enabled: adaptiveQuizEnabled && tab === 'brief',
    lessonId: lesson.id,
    slideNumber: slideIndex + 1,
    onComplete: completeSlideDwell,
  });

  const interactWithQuizKeyword = useCallback((keyword: LessonKeyword) => {
    if (!adaptiveQuizEnabled) return;
    const normalized = keyword.term.normalize('NFKC').trim().toLocaleLowerCase('vi');
    if (!normalized || interactedQuizKeywords.current.has(normalized)) return;
    interactedQuizKeywords.current.add(normalized);
    setQuizBehavior((current) => addQuizKeyword(current, keyword.term));
    recordStudentActivity({ lessonId: lesson.id, type: 'keyword_opened', metadata: { keyword: keyword.term.slice(0, 80), source: 'lesson_summary' } });
  }, [adaptiveQuizEnabled, lesson.id]);

  useEffect(() => {
    setQuizBehavior(createQuizBehaviorState(1));
    setQuizRecommendation(null);
    setQuizHistory([]);
    setSelectedQuizHistoryId(null);
    setQuizResult(null);
    setQuizPreparing(false);
    setQuizSubmitting(false);
    setQuizError('');
    setQuizCooldownActive(false);
    setDismissedPhase2OfferSignature(null);
    preparedQuizSignatures.current.clear();
    interactedQuizKeywords.current.clear();
  }, [classId, lesson.id]);

  useEffect(() => {
    if (!quizCooldownActive || quizCompletionCooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => setQuizCooldownActive(false), quizCompletionCooldownSeconds * 1_000);
    return () => window.clearTimeout(timer);
  }, [quizCooldownActive, quizCompletionCooldownSeconds]);

  useEffect(() => {
    if (!adaptiveQuizFeatureEnabled || !canManageLesson || !lesson.pdfUrl) {
      setQuizIndexState({ status: 'idle', chunkCount: 0, message: '' });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setQuizIndexState({ status: 'indexing', chunkCount: 0, message: '' });
    const indexLesson = async () => {
      try {
        let pdfUrl = lesson.pdfUrl as string;
        try {
          const result = await generateLessonQuizIndex(lesson.id, pdfUrl, false, controller.signal);
          if (active) setQuizIndexState({ status: 'ready', chunkCount: result.chunkCount, message: '' });
          return;
        } catch (firstError) {
          if (controller.signal.aborted) return;
          if (!(firstError instanceof LessonQuizIndexApiError) || ![400, 502].includes(firstError.status)) throw firstError;
          pdfUrl = await onRefreshPdf();
          if (!pdfUrl) throw firstError;
        }
        const result = await generateLessonQuizIndex(lesson.id, pdfUrl, false, controller.signal);
        if (active) setQuizIndexState({ status: 'ready', chunkCount: result.chunkCount, message: '' });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setQuizIndexState({ status: 'error', chunkCount: 0, message: error instanceof Error ? error.message : 'Không thể lập chỉ mục PDF cho quiz.' });
      }
    };
    void indexLesson();
    return () => { active = false; controller.abort(); };
  }, [adaptiveQuizFeatureEnabled, canManageLesson, lesson.id, lesson.pdfUrl]);

  useEffect(() => {
    if (!adaptiveQuizEnabled) return;
    let active = true;
    Promise.all([
      loadAdaptiveQuizRecommendation(classId, lesson.id),
      loadAdaptiveQuizHistory(classId, lesson.id),
    ]).then(([recommendation, history]) => {
      if (!active) return;
      if (recommendation) setQuizRecommendation(recommendation);
      setQuizHistory(history);
    }).catch((error) => console.error('Không tải được adaptive quiz hoặc lịch sử:', error));
    return () => { active = false; };
  }, [adaptiveQuizEnabled, classId, lesson.id]);

  useEffect(() => {
    if (!adaptiveQuizEnabled || adaptiveQuizPhase2Enabled || quizCooldownActive || !quizContext.eligible || quizRecommendation || preparedQuizSignatures.current.has(quizContext.signature)) return;
    let active = true;
    preparedQuizSignatures.current.add(quizContext.signature);
    setQuizPreparing(true);
    setQuizError('');
    prepareAdaptiveQuiz({ classId, lessonId: lesson.id, ...quizContext }).then((recommendation) => {
      if (!active || !recommendation) return;
      setQuizRecommendation(recommendation);
      recordStudentActivity({
        lessonId: lesson.id,
        type: 'quiz_recommended',
        metadata: { quizId: recommendation.id, questionCount: 3, trigger: quizContext.reasons.join(',').slice(0, 120) },
      });
    }).catch((error) => {
      if (!active) return;
      if (error instanceof AdaptiveQuizApiError && error.status === 409) {
        if (/quiz tiếp theo|tối đa/i.test(error.message)) setQuizError(error.message);
        return;
      }
      setQuizError(error instanceof Error ? error.message : 'Chưa thể chuẩn bị quiz lúc này.');
    }).finally(() => { if (active) setQuizPreparing(false); });
    return () => { active = false; };
  }, [adaptiveQuizEnabled, adaptiveQuizPhase2Enabled, classId, lesson.id, quizContext, quizRecommendation, quizCooldownActive]);

  useEffect(() => {
    setAvailableSummary(isExtractiveFallbackSummary(lesson.summary) ? '' : (lesson.summary?.trim() ?? ''));
  }, [lesson.id, lesson.summary]);

  useEffect(() => {
    recordStudentActivity({ lessonId: lesson.id, slideId: slides[slideIndex]?.id, type: 'slide_viewed' });
  }, [lesson.id, slideIndex]);

  useEffect(() => () => {
    if (noteActivityTimer.current !== null) window.clearTimeout(noteActivityTimer.current);
    if (cloudNoteTimer.current !== null) window.clearTimeout(cloudNoteTimer.current);
    const pending = pendingCloudNote.current;
    if (pending) {
      cloudNoteSaveChain.current = cloudNoteSaveChain.current
        .catch(() => undefined)
        .then(() => persistCloudNote(pending.lessonId, pending.slideNumber, pending.content))
        .catch((error) => console.error('Không lưu được ghi chú lên Supabase:', error));
      pendingCloudNote.current = null;
    }
  }, []);

  useEffect(() => {
    if (lesson.pdfUrl && pdfLoadedLessonId !== lesson.id) return;
    if (learningStateLessonId.current === lesson.id && learningStateDirty.current) return;
    if (learningStateLessonId.current !== lesson.id) {
      learningStateLessonId.current = lesson.id;
      learningStateDirty.current = false;
    }
    const stored = localStorage.getItem(mapStorageKey);
    let parsed = EMPTY_MAP;
    try {
      parsed = stored ? JSON.parse(stored) as KnowledgeMap : EMPTY_MAP;
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error('Invalid map');
    } catch {
      localStorage.removeItem(mapStorageKey);
      parsed = EMPTY_MAP;
    }
    const normalized = {
      ...parsed,
      nodes: parsed.nodes.map((node) => ({ ...node, status: node.status ?? 'confirmed' })),
      edges: parsed.edges.map((edge) => ({ ...edge, label: edge.label ?? 'liên quan đến' })),
    };
    personalMap.current = parsed.nodes.length ? normalized : null;
    mapRetryCount.current = 0;
    setMapHydratedLessonId(null);
    const storedNotes = localStorage.getItem(notesStorageKey);
    let nextSlideNotes: Record<string, string> = {};
    try {
      nextSlideNotes = storedNotes ? JSON.parse(storedNotes) : {};
    } catch {
      localStorage.removeItem(notesStorageKey);
    }
    setSlideNotes(nextSlideNotes);
    setMap(personalMap.current ?? EMPTY_MAP);
    setSlideIndex(0);
    setSelectedId(null);
    setTab('brief');
    let active = true;
    loadCloudLearningState(classId, lesson.id).then((cloud) => {
      if (!active || learningStateDirty.current) return;
      const cloudNotes = Object.fromEntries(cloud.notes.flatMap((note) => {
        const slide = slides[note.slide_number - 1];
        return slide ? [[slide.id, note.content]] : [];
      }));
      if (Object.keys(cloudNotes).length) setSlideNotes(cloudNotes);
      const cloudMap = cloud.map && typeof cloud.map === 'object' ? cloud.map as KnowledgeMap : null;
      if (cloudMap?.nodes?.length) {
        personalMap.current = cloudMap;
        setMap(cloudMap);
      }
    }).catch((error) => console.error('Không tải được dữ liệu học từ Supabase:', error))
      .finally(() => { if (active) setMapHydratedLessonId(lesson.id); });
    return () => { active = false; };
  }, [classId, lesson.id, lesson.pdfUrl, pdfLoadedLessonId, pdfPageCount, mapStorageKey, notesStorageKey]);

  useEffect(() => {
    if (mapHydratedLessonId !== lesson.id) return;
    const controller = new AbortController();
    setIsThinking(true);
    setAnalysisError('');
    const load = async () => {
      try {
        const shouldForce = forceMapGeneration.current;
        forceMapGeneration.current = false;
        const artifact = shouldForce && canManageLesson && lesson.pdfUrl
          ? await generateLessonKnowledgeMap(lesson.id, lesson.pdfUrl, true, controller.signal)
          : await fetchLessonKnowledgeMap(lesson.id, lesson.pdfUrl, controller.signal);
        const restored = personalMap.current?.sourceVersion === artifact.generatedAt
          ? personalMap.current
          : artifact.graph;
        setMap(restored);
        setSelectedId(null);
        setMapSource('ai');
        mapRetryCount.current = 0;
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof KnowledgeMapApiError && error.status === 404 && canManageLesson && lesson.pdfUrl) {
          try {
            const artifact = await generateLessonKnowledgeMap(lesson.id, lesson.pdfUrl, false, controller.signal);
            setMap(artifact.graph);
            setSelectedId(null);
            setMapSource('ai');
            setAnalysisError('');
            return;
          } catch (generationError) {
            if (controller.signal.aborted) return;
            console.error('Không tạo được sơ đồ dùng chung, chuyển sang fallback:', generationError);
          }
        }
        let fallbackSummary = availableSummary;
        if (error instanceof KnowledgeMapApiError && [404, 502].includes(error.status) && !fallbackSummary) {
          try {
            fallbackSummary = (await fetchLessonSummary(lesson.id, lesson.pdfUrl)).summary;
          } catch (summaryError) {
            if (controller.signal.aborted) return;
            console.error('Không tải được bản tóm tắt để tạo sơ đồ:', summaryError);
          }
        }
        if (error instanceof KnowledgeMapApiError && [404, 502].includes(error.status) && fallbackSummary) {
          try {
            const fallbackMap = await requestAiMap(
              fallbackSummary,
              { id: lesson.id, name: lesson.name },
              personalMap.current ?? EMPTY_MAP,
              controller.signal,
            );
            setMap(fallbackMap);
            setSelectedId(null);
            setMapSource('ai');
            setAnalysisError('');
            return;
          } catch (fallbackError) {
            if (controller.signal.aborted) return;
            setAnalysisError(fallbackError instanceof Error ? fallbackError.message : 'Không thể tạo sơ đồ từ bản tóm tắt.');
          }
        }
        setMapSource('fallback');
        if (error instanceof KnowledgeMapApiError && error.status === 404) {
          setMap(EMPTY_MAP);
          setAnalysisError(canManageLesson
            ? 'Sơ đồ đang được tạo từ nội dung từng slide.'
            : 'Giáo viên chưa tạo sơ đồ cho bài học này.');
          if (mapRetryCount.current < 12) {
            mapRetryCount.current += 1;
            forceMapGeneration.current = canManageLesson && Boolean(lesson.pdfUrl);
            window.setTimeout(() => {
              if (!controller.signal.aborted) setMapGenerationRevision((current) => current + 1);
            }, canManageLesson ? 1_000 : 5_000);
          }
        } else {
          setAnalysisError(error instanceof Error ? error.message : 'Không thể tải sơ đồ bài học.');
        }
      } finally {
        if (!controller.signal.aborted) setIsThinking(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [lesson.id, lesson.name, lesson.pdfUrl, availableSummary, mapHydratedLessonId, mapGenerationRevision, canManageLesson]);

  const selected = map.nodes.find((node) => node.id === selectedId);
  const addNode = () => {
    learningStateDirty.current = true;
    const index = map.nodes.length;
    const node: KnowledgeNode = {
      id: crypto.randomUUID(),
      title: `Ý chính ${index + 1}`,
      note: '',
      importance: index === 0 ? 'core' : 'support',
      status: 'confirmed',
      x: 24 + (index * 17) % 58,
      y: 24 + (index * 23) % 54,
    };
    setMap((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
  };

  const updateNode = (patch: Partial<KnowledgeNode>) => {
    learningStateDirty.current = true;
    setMap((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === selectedId ? { ...node, ...patch } : node),
    }));
  };

  const removeNode = () => {
    if (!selectedId) return;
    learningStateDirty.current = true;
    setMap((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== selectedId),
      edges: current.edges.filter((edge) => edge.from !== selectedId && edge.to !== selectedId),
    }));
    setSelectedId(null);
  };

  const chooseNode = (id: string) => {
    setSelectedId(id || null);
  };

  const saveMap = async () => {
    localStorage.setItem(mapStorageKey, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('solar-note-map:saved', {
      detail: { classId, lessonId: lesson.id, nodeCount: map.nodes.length },
    }));
    try {
      await persistCloudMap(lesson.id, lesson.name, map);
      recordStudentActivity({ lessonId: lesson.id, type: 'map_saved', metadata: { nodeCount: map.nodes.length } });
      setSaved(true);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Không thể đồng bộ sơ đồ lên lớp học.');
    }
    window.setTimeout(() => setSaved(false), 1800);
  };

  const resetSmartMap = () => {
    learningStateDirty.current = true;
    personalMap.current = null;
    forceMapGeneration.current = canManageLesson;
    mapRetryCount.current = 0;
    localStorage.removeItem(mapStorageKey);
    window.dispatchEvent(new CustomEvent('solar-note-map:saved', {
      detail: { classId, lessonId: lesson.id, nodeCount: 0 },
    }));
    setMap(EMPTY_MAP);
    setSelectedId(null);
    setMapGenerationRevision((current) => current + 1);
  };

  const changeSlideNote = (content: string) => {
    learningStateDirty.current = true;
    const next = updateSlideNote(slideNotes, slides[slideIndex].id, content);
    setSlideNotes(next);
    localStorage.setItem(notesStorageKey, JSON.stringify(next));
    if (cloudNoteTimer.current !== null) window.clearTimeout(cloudNoteTimer.current);
    const savedSlideNumber = slideIndex + 1;
    const pending = { lessonId: lesson.id, slideNumber: savedSlideNumber, content };
    pendingCloudNote.current = pending;
    cloudNoteTimer.current = window.setTimeout(() => {
      if (pendingCloudNote.current !== pending) return;
      pendingCloudNote.current = null;
      cloudNoteSaveChain.current = cloudNoteSaveChain.current
        .catch(() => undefined)
        .then(() => persistCloudNote(lesson.id, savedSlideNumber, content))
        .catch((error) => console.error('Không lưu được ghi chú lên Supabase:', error));
    }, 600);
    if (noteActivityTimer.current !== null) window.clearTimeout(noteActivityTimer.current);
    noteActivityTimer.current = window.setTimeout(() => {
      recordStudentActivity({ lessonId: lesson.id, slideId: slides[slideIndex].id, type: 'note_updated', metadata: { wordCount: content.trim() ? content.trim().split(/\s+/).length : 0 } });
    }, 1200);
  };

  const updateUnderstanding = (status: 'understood' | 'question' | 'unmarked') => {
    const slideNumber = slideIndex + 1;
    recordStudentActivity({ lessonId: lesson.id, slideId: slides[slideIndex].id, type: 'understanding_updated', metadata: { status, slideNumber } });
    if (adaptiveQuizEnabled && status === 'question') setQuizBehavior((current) => markQuizSlideUnclear(current, slideNumber));
  };

  const preparePhase2Quiz = async (questionCount: number, quizMode: AdaptiveQuizMode) => {
    if (!adaptiveQuizPhase2Enabled || quizPreparing || quizRecommendation) return;
    const signature = `${quizContext.signature}:${quizMode}:${questionCount}`;
    preparedQuizSignatures.current.add(signature);
    setPreparingQuestionCount(questionCount);
    setQuizPreparing(true);
    setQuizError('');
    try {
      const recommendation = await prepareAdaptiveQuiz({ classId, lessonId: lesson.id, ...quizContext, questionCount, quizMode });
      if (!recommendation) throw new Error('Máy chủ không trả về quiz.');
      setQuizRecommendation(recommendation);
      setDismissedPhase2OfferSignature(null);
      recordStudentActivity({
        lessonId: lesson.id,
        type: 'quiz_recommended',
        metadata: { quizId: recommendation.id, questionCount: recommendation.questionCount, trigger: quizContext.reasons.join(',').slice(0, 120), quizMode: recommendation.quizMode },
      });
    } catch (error) {
      preparedQuizSignatures.current.delete(signature);
      setQuizError(error instanceof Error ? error.message : 'Chưa thể chuẩn bị quiz lúc này.');
    } finally {
      setQuizPreparing(false);
    }
  };

  const openAdaptiveQuiz = async () => {
    if (!quizRecommendation || quizSubmitting) return;
    if (quizRecommendation.status === 'accepted' || quizRecommendation.status === 'completed') {
      setSelectedQuizHistoryId(null);
      setTab('quiz');
      return;
    }
    setQuizError('');
    try {
      const started = await startAdaptiveQuiz(quizRecommendation.id);
      if (!started) throw new Error('Máy chủ không trả về quiz.');
      setQuizRecommendation(started);
      setSelectedQuizHistoryId(null);
      setTab('quiz');
      recordStudentActivity({ lessonId: lesson.id, type: 'quiz_started', metadata: { quizId: started.id, questionCount: started.questionCount, quizMode: started.quizMode } });
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Không thể mở quiz lúc này.');
    }
  };

  const closeAdaptiveQuizRecommendation = async () => {
    if (!quizRecommendation) return;
    setQuizError('');
    try {
      await dismissAdaptiveQuiz(quizRecommendation.id);
      recordStudentActivity({ lessonId: lesson.id, type: 'quiz_dismissed', metadata: { quizId: quizRecommendation.id, questionCount: quizRecommendation.questionCount, quizMode: quizRecommendation.quizMode } });
      setQuizRecommendation(null);
      if (tab === 'quiz') setTab('brief');
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Không thể đóng đề xuất quiz.');
    }
  };

  const submitQuiz = async (answers: number[]) => {
    if (!quizRecommendation || quizSubmitting) return;
    setQuizSubmitting(true);
    setQuizError('');
    try {
      const result = await submitAdaptiveQuiz(quizRecommendation.id, answers);
      const completedRecommendation: AdaptiveQuizRecommendation = { ...quizRecommendation, status: 'completed' };
      setQuizResult(result);
      setQuizRecommendation(completedRecommendation);
      setQuizHistory((current) => [{ id: completedRecommendation.id, recommendation: completedRecommendation, result, completedAt: new Date().toISOString() }, ...current.filter((item) => item.id !== completedRecommendation.id)]);
      setSelectedQuizHistoryId(completedRecommendation.id);
      setQuizCooldownActive(quizCompletionCooldownSeconds > 0);
      recordStudentActivity({
        lessonId: lesson.id,
        type: 'quiz_completed',
        metadata: { quizId: quizRecommendation.id, score: result.score, questionCount: result.questionCount, durationSeconds: result.durationSeconds, quizMode: quizRecommendation.quizMode },
      });
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Không thể chấm quiz lúc này.');
    } finally {
      setQuizSubmitting(false);
    }
  };

  const saveQuizProgress = async (answers: Array<number | null>) => {
    if (!adaptiveQuizPhase2Enabled || !quizRecommendation || quizRecommendation.status !== 'accepted') return;
    try {
      await saveAdaptiveQuizProgress(quizRecommendation.id, answers);
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Không thể lưu tiến độ quiz.');
    }
  };

  const continueAfterQuiz = () => {
    const weakKeywords = adaptiveQuizPhase2Enabled
      ? (quizResult?.items.filter((item) => !item.correct).map((item) => item.keyword) ?? [])
      : [];
    setQuizRecommendation(null);
    setSelectedQuizHistoryId(null);
    setQuizResult(null);
    setQuizError('');
    setQuizBehavior(addQuizWrongKeywords(createQuizBehaviorState(slideIndex + 1), weakKeywords));
    setDismissedPhase2OfferSignature(null);
    preparedQuizSignatures.current.clear();
    interactedQuizKeywords.current.clear();
    setTab('brief');
  };

  const reportQuizQuestion = async (slotId: QuizSlotId) => {
    if (!quizRecommendation) return;
    setQuizError('');
    try {
      await reportAdaptiveQuizQuestion(quizRecommendation.id, slotId, 'Câu hỏi, đáp án hoặc giải thích chưa phù hợp với nội dung bài học.');
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Không thể gửi báo cáo câu hỏi.');
      throw error;
    }
  };

  return (
    <aside className={`learning-console ${tab === 'brief' ? 'slide-open' : ''} ${tab === 'summary' ? 'summary-open' : ''} ${tab === 'map' ? 'map-open' : ''} ${tab === 'community' ? 'community-open' : ''} ${tab === 'quiz' ? 'quiz-open' : ''}`} style={{ '--lesson-color': lesson.color } as React.CSSProperties}>
      <header className="console-header">
        <div>
          <h2>{lesson.name}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Đóng">×</button>
      </header>

      <nav className="console-tabs" style={{ gridTemplateColumns: `repeat(${(usesDay01Pdf ? 4 : 3) + (adaptiveQuizEnabled && (quizRecommendation || quizHistory.length) ? 1 : 0)}, 1fr)` }}>
        <button className={tab === 'brief' ? 'active' : ''} onClick={() => setTab('brief')}>Bài giảng</button>
        {usesDay01Pdf && <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>Tóm tắt</button>}
        <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Sơ đồ <span>{map.nodes.length}</span></button>
        <button className={tab === 'community' ? 'active' : ''} onClick={() => setTab('community')}>Thảo luận</button>
        {adaptiveQuizEnabled && (quizRecommendation || quizHistory.length > 0) && <button className={tab === 'quiz' ? 'active' : ''} onClick={() => {
          if (quizRecommendation?.status === 'accepted') {
            setSelectedQuizHistoryId(null);
            void openAdaptiveQuiz();
          } else setTab('quiz');
        }}>Quiz <span>{quizHistory.length + (quizRecommendation && quizRecommendation.status !== 'completed' ? 1 : 0)} lượt</span></button>}
      </nav>

      {adaptiveQuizFeatureEnabled && canManageLesson && quizIndexState.status === 'indexing' && <div className="adaptive-quiz-preparing" role="status">Đang lập chỉ mục PDF cho quiz (không dùng AI)…</div>}
      {adaptiveQuizFeatureEnabled && canManageLesson && quizIndexState.status === 'ready' && <div className="adaptive-quiz-preparing" role="status">✓ Quiz knowledge base sẵn sàng · {quizIndexState.chunkCount} chunks</div>}
      {adaptiveQuizFeatureEnabled && canManageLesson && quizIndexState.status === 'error' && <div className="adaptive-quiz-preparing error" role="alert">Quiz chưa sẵn sàng: {quizIndexState.message}</div>}

      {adaptiveQuizEnabled && quizRecommendation && (quizRecommendation.status === 'pending' || (quizRecommendation.status === 'accepted' && tab !== 'quiz')) && <div className="adaptive-quiz-notice" role="status">
        <div><span>✦ Quiz đã sẵn sàng</span><b>{quizRecommendation.title}</b><small>{quizRecommendation.questionCount} câu · khoảng {quizRecommendation.estimatedDurationMinutes} phút · {quizRecommendation.quizMode === 'lesson_review' ? 'ôn tập toàn bài' : 'dựa trên phần bạn vừa học'}</small></div>
        <div><button onClick={() => void closeAdaptiveQuizRecommendation()}>Để sau</button><button className="primary" onClick={() => void openAdaptiveQuiz()}>Làm ngay</button></div>
      </div>}
      {adaptiveQuizEnabled && adaptiveQuizPhase2Enabled && !quizRecommendation && !quizPreparing && !quizCooldownActive && quizContext.eligible && dismissedPhase2OfferSignature !== quizContext.signature && <div className="adaptive-quiz-offer" role="status">
        <div><span>✦ Bạn đã có đủ context để luyện tập</span><b>Chọn độ dài quiz phù hợp</b><small>BM25 sẽ lấy đúng nội dung từ slide bạn vừa tương tác; AI chỉ nhận các đoạn đã retrieval.</small></div>
        <div className="adaptive-quiz-presets">
          <button onClick={() => void preparePhase2Quiz(3, 'micro')}><b>3 câu</b><small>Kiểm tra nhanh · ~2 phút</small></button>
          <button onClick={() => void preparePhase2Quiz(5, 'micro')}><b>5 câu</b><small>Luyện thêm · ~4 phút</small></button>
          <button onClick={() => void preparePhase2Quiz(10, 'lesson_review')}><b>10 câu</b><small>Ôn tập bài · ~8 phút</small></button>
          <button className="quiet" onClick={() => setDismissedPhase2OfferSignature(quizContext.signature)}>Để sau</button>
        </div>
      </div>}
      {adaptiveQuizEnabled && !quizRecommendation && quizPreparing && <div className="adaptive-quiz-preparing" role="status">✦ AI đang chuẩn bị {preparingQuestionCount} câu kiểm tra…</div>}
      {adaptiveQuizEnabled && !quizRecommendation && quizCooldownActive && <div className="adaptive-quiz-preparing" role="status">Quiz tiếp theo sẽ được xét khi hết cooldown và bạn tạo context học mới.</div>}
      {adaptiveQuizEnabled && !quizRecommendation && quizError && quizContext.eligible && <div className="adaptive-quiz-preparing error" role="status">{quizError}</div>}

      <div className="console-content">
        {tab === 'brief' && (
          usesDay01Pdf ? <Suspense fallback={<div className="pdf-render-loading" role="status"><i /><span>Đang tải slide…</span></div>}>
            <PdfSlideWorkspace
              page={slideIndex + 1}
              pageCount={slides.length}
              pdfUrl={lesson.pdfUrl ?? builtInSlidePdfUrl}
              onDocumentLoad={(pageCount) => { setPdfPageCount(pageCount); setPdfLoadedLessonId(lesson.id); }}
              useBundledPdfContext={lesson.id === 'ai-foundations'}
              onPdfAccessError={onRefreshPdf}
              lessonName={lesson.name}
              note={slideNotes[slides[slideIndex].id] ?? ''}
              map={map}
              accent={lesson.color}
              isThinking={isThinking}
              mapSource={mapSource}
              onPageChange={(page) => setSlideIndex(page - 1)}
              onNoteChange={changeSlideNote}
              onOpenMap={() => setTab('map')}
              onUnderstandingChange={updateUnderstanding}
            />
          </Suspense> : <SlideLearningWorkspace
            slides={slides}
            index={slideIndex}
            note={slideNotes[slides[slideIndex].id] ?? ''}
            map={map}
            accent={lesson.color}
            isThinking={isThinking}
            mapSource={mapSource}
            onIndexChange={setSlideIndex}
            onNoteChange={changeSlideNote}
            onOpenMap={() => setTab('map')}
            onUnderstandingChange={updateUnderstanding}
          />
        )}

        {tab === 'map' && (
          <section className="live-map-workspace">
            <header className="live-map-header">
              <div><span className="live-indicator"><i /> Sơ đồ AI</span><b>Bản tóm tắt slide đang trở thành bản đồ kiến thức</b></div>
              <div className="live-actions">
                <button onClick={addNode}>＋ Thêm ý</button>
                <button disabled={isThinking} onClick={saveMap}>{saved ? '✓ Đã lưu' : isThinking ? 'Đang đồng bộ…' : 'Lưu sơ đồ'}</button>
                <button className="toolbar-more" onClick={resetSmartMap} title="Bắt đầu lại">↻</button>
              </div>
            </header>

            <div className="live-canvas-area">
              <div className="canvas-caption"><div><span>Mind map bài học</span><small>{map.nodes.length ? 'Các nhánh được hình thành từ bản tóm tắt slide' : 'Các khái niệm sẽ xuất hiện tại đây'}</small></div>{map.nodes.length > 0 && <button onClick={() => setSelectedId(null)}>Toàn cảnh</button>}</div>
              <div className="knowledge-board">
                {map.nodes.length > 0 && <KnowledgeFlow map={map} accent={lesson.color} selectedId={selectedId} onSelect={chooseNode} />}
              {map.nodes.length === 0 && <div className="live-empty-state"><div className="orbit-loader"><i /><i /><span>✦</span></div><b>Chưa có dữ liệu để tạo sơ đồ</b><p>{analysisError || 'Sơ đồ sẽ tự động xuất hiện sau khi bản tóm tắt bài giảng được tạo.'}</p></div>}
            </div>
            {selected && (
              <aside className="live-node-editor">
              <div className="node-editor">
                <div className="editor-heading"><span>✦ Nhận diện từ tóm tắt</span><button onClick={() => setSelectedId(null)}>×</button></div>
                <input value={selected.title} onChange={(event) => updateNode({ title: event.target.value })} placeholder="Tên kiến thức" />
                <textarea value={selected.note} onChange={(event) => updateNode({ note: event.target.value })} placeholder="Giải thích bằng lời của bạn…" />
                {selected.slideNumbers?.length ? <button className="node-slide-link" onClick={() => { setSlideIndex(selected.slideNumbers![0] - 1); setTab('brief'); }}>Mở slide {selected.slideNumbers[0]} →</button> : null}
                <div className="node-editor-actions"><button onClick={() => updateNode({ status: 'confirmed' })}>✓ Xác nhận ý này</button><button onClick={removeNode}>Xóa khỏi sơ đồ</button></div>
              </div>
              </aside>
            )}
            </div>
          </section>
        )}

        {tab === 'summary' && <LessonSummary lesson={lesson} cacheScope={summaryCacheScope} onRefreshPdf={onRefreshPdf} canGenerateKeywords={canManageLesson} onSummaryReady={setAvailableSummary} onKeywordInteraction={interactWithQuizKeyword} />}

        {tab === 'community' && <CommunityQuestions
          lesson={lesson}
          classId={classId}
          slides={slides}
          onOpenSlide={(slideId) => {
            const index = slides.findIndex((slide) => slide.id === slideId);
            if (index >= 0) setSlideIndex(index);
            setTab('brief');
          }}
        />}

        {tab === 'quiz' && adaptiveQuizEnabled && <section className="adaptive-quiz-history-shell">
          {quizHistory.length > 0 && <div className="adaptive-quiz-history-strip" aria-label="Lịch sử quiz đã hoàn thành">
            {quizHistory.map((item, index) => <button
              className={selectedQuizHistoryId === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => setSelectedQuizHistoryId(item.id)}
            >
              <span>Lượt {quizHistory.length - index}</span>
              <b>{item.result.score}/{item.result.questionCount} đúng</b>
              <em>{item.recommendation.questions[0]?.question}</em>
              <small>{new Date(item.completedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
            </button>)}
          </div>}
          {selectedQuizHistory ? <AdaptiveQuizPanel
            recommendation={selectedQuizHistory.recommendation}
            result={selectedQuizHistory.result}
            submitting={false}
            error=""
            onSubmit={async () => undefined}
            onContinue={quizRecommendation?.id === selectedQuizHistory.id ? continueAfterQuiz : () => setTab('brief')}
            onOpenSlide={(slideNumber) => { setSlideIndex(Math.max(0, Math.min(slides.length - 1, slideNumber - 1))); setTab('brief'); }}
            onReport={reportQuizQuestion}
            historyMode
          /> : quizRecommendation && canRenderAdaptiveQuizAttempt(quizRecommendation.status) ? <AdaptiveQuizPanel
            recommendation={quizRecommendation}
            result={quizResult}
            submitting={quizSubmitting}
            error={quizError}
            onSubmit={submitQuiz}
            onProgress={saveQuizProgress}
            onContinue={continueAfterQuiz}
            onOpenSlide={(slideNumber) => { setSlideIndex(Math.max(0, Math.min(slides.length - 1, slideNumber - 1))); setTab('brief'); }}
            onReport={reportQuizQuestion}
          /> : quizRecommendation?.status === 'pending'
            ? <div className="adaptive-quiz-history-empty">Quiz đã sẵn sàng. Bấm “Làm ngay” trong thông báo phía trên để bắt đầu.</div>
            : <div className="adaptive-quiz-history-empty">Chọn một lượt quiz phía trên để xem lại.</div>}
        </section>}

      </div>
    </aside>
  );
}
