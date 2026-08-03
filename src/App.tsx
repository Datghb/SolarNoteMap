import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SolarSystem } from "./components/SolarSystem";
import {
  Comet,
  LuminousStarBand,
  MilkyWayGalaxy,
  Nebula,
  SpaceDust,
  ShootingStars,
  StarCluster,
} from "./components/SpaceObjects";
import { LearningConsole } from "./components/LearningConsole";
import { TeacherDashboard } from "./components/TeacherDashboard";
import {
  recordStudentActivity,
  setActiveCloudClass,
  type StudentActivity,
  type TeacherLesson,
  type TeacherLessonInput,
} from "./utils/courseStore";
import { AuthScreen } from "./components/AuthScreen";
import { ClassroomOnboarding } from "./components/ClassroomOnboarding";
import { StudentClassDialog } from "./components/StudentClassDialog";
import { AdminDashboard } from "./components/AdminDashboard";
import { useAuth } from "./hooks/useAuth";
import {
  createClassForCourse,
  regenerateClassJoinCode,
  createCloudLesson,
  createCourse,
  loadCloudActivities,
  loadCloudLessons,
  loadCourseLessons,
  loadMyClasses,
  loadMyCourses,
  loadOwnedClasses,
  refreshCloudLessonPdfUrl,
  updateCloudLesson,
  deleteCloudLesson,
  setCloudLessonPublished,
  setCloudLessonRelease,
  type CloudClassroom,
  type CloudCourse,
} from "./utils/cloudClassroom";
import { getVisibleLessons } from "./utils/lessonVisibility";
import { isExtractiveFallbackSummary, queueLessonSummaryGeneration } from "./utils/lessonSummary";
import { getLessonSessionKey, resolveRestoredLessonId } from "./utils/lessonSession";
import { builtInSlidePdfUrl, prefetchPdfPage } from "./components/SelectablePdfPage";
import { createPdfPreloadPlan } from "./utils/pdfLoading";

export function App() {
  const auth = useAuth();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [showOrbits, setShowOrbits] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(0.16);
  const [savedMaps, setSavedMaps] = useState<Record<string, number>>({});
  const [teacherMode, setTeacherMode] = useState(false);
  const [showStudentClasses, setShowStudentClasses] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [customLessons, setCustomLessons] = useState<TeacherLesson[]>([]);
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [classes, setClasses] = useState<CloudClassroom[]>([]);
  const [courses, setCourses] = useState<CloudCourse[]>([]);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudError, setCloudError] = useState("");
  const [loadedLessonsClassId, setLoadedLessonsClassId] = useState<string | null>(null);
  const queuedSummaryLessons = useRef(new Set<string>());
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const lessons = getVisibleLessons(customLessons, auth.profile?.role);
  const publishedLessonCount = customLessons.filter(
    (lesson) => lesson.published,
  ).length;
  const selectedLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const activeCourse =
    courses.find((course) => course.id === activeCourseId) ?? null;
  const activeClass =
    classes.find((classroom) => classroom.id === activeClassId) ?? null;

  useEffect(() => {
    if (!auth.user) {
      setCloudLoading(false);
      return;
    }
    if (auth.profile?.role === "admin") {
      setActiveClassId(null);
      setCloudLoading(false);
      return;
    }
    let active = true;
    setCloudLoading(true);
    setCloudError("");
    Promise.all([
      auth.profile?.role === "teacher" ? loadOwnedClasses() : loadMyClasses(),
      auth.profile?.role === "teacher" ? loadMyCourses() : Promise.resolve([]),
    ])
      .then(([rows, courseRows]) => {
        if (!active) return;
        setClasses(rows);
        setCourses(courseRows);
        const preferred = localStorage.getItem("solar-active-class");
        const nextClassId = rows.some((row) => row.id === preferred)
          ? preferred
          : (rows[0]?.id ?? null);
        setActiveClassId(nextClassId);
        setActiveCourseId(
          rows.find((row) => row.id === nextClassId)?.course_id ??
            courseRows[0]?.id ??
            null,
        );
      })
      .catch((error) => {
        if (active)
          setCloudError(
            error instanceof Error
              ? error.message
              : "Không thể tải danh sách lớp học.",
          );
      })
      .finally(() => {
        if (active) setCloudLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auth.profile?.role, auth.user?.id]);

  useEffect(() => {
    setActiveCloudClass(activeClassId);
    setLoadedLessonsClassId(null);
    if (!activeClassId) {
      setActivities([]);
      if (auth.profile?.role === "teacher" && activeCourseId) {
        let active = true;
        loadCourseLessons(activeCourseId)
          .then((rows) => { if (active) setCustomLessons(rows as TeacherLesson[]); })
          .catch((error) => { if (active) setCloudError(error instanceof Error ? error.message : "Không thể tải bài giảng."); });
        return () => { active = false; };
      }
      setCustomLessons([]);
      return;
    }
    localStorage.setItem("solar-active-class", activeClassId);
    let active = true;
    setCloudError("");
    Promise.all([
      loadCloudLessons(activeClassId),
      loadCloudActivities(activeClassId),
    ])
      .then(([lessonRows, activityRows]) => {
        if (!active) return;
        setCustomLessons(lessonRows as TeacherLesson[]);
        setActivities(activityRows);
        setLoadedLessonsClassId(activeClassId);
      })
      .catch((error) => {
        if (active)
          setCloudError(
            error instanceof Error
              ? error.message
              : "Không thể tải dữ liệu lớp học.",
          );
      });
    return () => {
      active = false;
    };
  }, [activeClassId, activeCourseId, auth.profile?.role]);

  useEffect(() => {
    const readSavedMaps = () => {
      const next: Record<string, number> = {};
      if (!activeClassId) {
        setSavedMaps(next);
        return;
      }
      lessons.forEach((lesson) => {
        const stored = localStorage.getItem(`solar-note-map:${activeClassId}:${lesson.id}`);
        if (!stored) return;
        try {
          const nodeCount = JSON.parse(stored).nodes?.length ?? 0;
          if (nodeCount > 0) next[lesson.id] = nodeCount;
        } catch {
          localStorage.removeItem(`solar-note-map:${activeClassId}:${lesson.id}`);
        }
      });
      setSavedMaps(next);
    };

    readSavedMaps();
    window.addEventListener("solar-note-map:saved", readSavedMaps);
    return () =>
      window.removeEventListener("solar-note-map:saved", readSavedMaps);
  }, [activeClassId, customLessons]);

  useEffect(() => {
    if (!activeClassId || cloudLoading || loadedLessonsClassId !== activeClassId) return;
    const storageKey = getLessonSessionKey(activeClassId);
    const restoredLessonId = resolveRestoredLessonId(
      selectedLessonId,
      localStorage.getItem(storageKey),
      lessons.map((lesson) => lesson.id),
    );
    if (restoredLessonId !== selectedLessonId) {
      setSelectedLessonId(restoredLessonId);
    }
    if (restoredLessonId) localStorage.setItem(storageKey, restoredLessonId);
    else localStorage.removeItem(storageKey);
  }, [activeClassId, auth.profile?.role, cloudLoading, customLessons, loadedLessonsClassId, selectedLessonId]);

  useEffect(() => {
    if (auth.profile?.role !== "teacher") return;
    customLessons.forEach((lesson) => {
      const obsoleteFallback = isExtractiveFallbackSummary(lesson.summary);
      if ((lesson.summary && !obsoleteFallback) || !lesson.pdfUrl || queuedSummaryLessons.current.has(lesson.id)) return;
      queuedSummaryLessons.current.add(lesson.id);
      void queueLessonSummaryGeneration(lesson.id, lesson.pdfUrl, obsoleteFallback)
        .catch((error) => {
          queuedSummaryLessons.current.delete(lesson.id);
          console.error("Không thể tự động bổ sung tóm tắt:", error);
        });
    });
  }, [auth.profile?.role, customLessons]);

  useEffect(() => {
    if (!showAccountMenu) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setShowAccountMenu(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAccountMenu(false);
        profileButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showAccountMenu]);

  useEffect(() => {
    if (auth.profile?.role !== "student" || !activeClassId || loadedLessonsClassId !== activeClassId) return;
    const pdfUrls = lessons.flatMap((lesson) => {
      if (lesson.pdfUrl) return [lesson.pdfUrl];
      return lesson.id === "ai-foundations" ? [builtInSlidePdfUrl] : [];
    });
    const { immediate } = createPdfPreloadPlan(pdfUrls);
    if (!immediate.length) return;

    let cancelled = false;
    let nextIndex = 0;
    const runWorker = async () => {
      while (!cancelled && nextIndex < immediate.length) {
        const item = immediate[nextIndex];
        nextIndex += 1;
        await prefetchPdfPage(item.pdfUrl, item.pageNumber).catch(() => undefined);
      }
    };
    void Promise.all([runWorker(), runWorker()]);
    return () => { cancelled = true; };
  }, [activeClassId, auth.profile?.role, customLessons, loadedLessonsClassId]);

  useEffect(() => {
    if (auth.profile?.role !== "student" || !activeClassId || loadedLessonsClassId !== activeClassId || selectedLessonId) return;
    const pdfUrls = lessons.flatMap((lesson) => {
      if (lesson.pdfUrl) return [lesson.pdfUrl];
      return lesson.id === "ai-foundations" ? [builtInSlidePdfUrl] : [];
    });
    const { deferred: queue } = createPdfPreloadPlan(pdfUrls);
    if (!queue.length) return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timerHandle: number | null = null;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const schedule = (index: number) => {
      if (cancelled || index >= queue.length) return;
      const warmNextPage = () => {
        if (cancelled) return;
        const item = queue[index];
        void prefetchPdfPage(item.pdfUrl, item.pageNumber)
          .catch(() => undefined)
          .finally(() => schedule(index + 1));
      };
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(warmNextPage, { timeout: 1200 });
      } else {
        timerHandle = window.setTimeout(warmNextPage, 450);
      }
    };
    schedule(0);
    return () => {
      cancelled = true;
      if (idleHandle !== null) idleWindow.cancelIdleCallback?.(idleHandle);
      if (timerHandle !== null) window.clearTimeout(timerHandle);
    };
  }, [activeClassId, auth.profile?.role, customLessons, loadedLessonsClassId, selectedLessonId]);

  const selectByPlanetName = (shortName: string) => {
    const lesson = lessons.find((item) => item.shortName === shortName);
    if (lesson) {
      if (lesson.pdfUrl || lesson.id === "ai-foundations") {
        void prefetchPdfPage(lesson.pdfUrl ?? builtInSlidePdfUrl).catch(() => undefined);
      }
      setSelectedLessonId(lesson.id);
      if (activeClassId) localStorage.setItem(getLessonSessionKey(activeClassId), lesson.id);
      recordStudentActivity({ lessonId: lesson.id, type: "lesson_opened" });
    }
  };

  const openLesson = (lessonId: string) => {
    const lesson = lessons.find((item) => item.id === lessonId);
    if (lesson && (lesson.pdfUrl || lesson.id === "ai-foundations")) {
      void prefetchPdfPage(lesson.pdfUrl ?? builtInSlidePdfUrl).catch(() => undefined);
    }
    setSelectedLessonId(lessonId);
    if (activeClassId) localStorage.setItem(getLessonSessionKey(activeClassId), lessonId);
    recordStudentActivity({ lessonId, type: "lesson_opened" });
  };

  const closeLesson = () => {
    setSelectedLessonId(null);
    if (activeClassId) localStorage.removeItem(getLessonSessionKey(activeClassId));
  };

  const refreshLessonPdf = async (lessonId: string) => {
    const pdfUrl = await refreshCloudLessonPdfUrl(lessonId);
    setCustomLessons((current) => current.map((lesson) =>
      lesson.id === lessonId ? { ...lesson, pdfUrl } : lesson,
    ));
    return pdfUrl;
  };

  const createLesson = async (lesson: TeacherLesson, pdf?: File) => {
    if (!auth.user) throw new Error("Chưa đăng nhập.");
    if (!activeCourseId) throw new Error("Chưa chọn chương trình học.");
    if (!pdf) throw new Error("Vui lòng chọn tài liệu PDF.");
    const created = await createCloudLesson(activeCourseId, auth.user.id, lesson, pdf);
    const nextLessons = (await (activeClassId
      ? loadCloudLessons(activeClassId)
      : loadCourseLessons(activeCourseId))) as TeacherLesson[];
    setCustomLessons(nextLessons);
    const createdLesson = nextLessons.find((item) => item.id === created.id);
    if (createdLesson?.pdfUrl) {
      void queueLessonSummaryGeneration(createdLesson.id, createdLesson.pdfUrl)
        .catch((error) => console.error("Không thể tạo tóm tắt nền:", error));
    }
  };

  const updateLesson = async (lessonId: string, input: TeacherLessonInput, pdf?: File) => {
    await updateCloudLesson(lessonId, input, pdf);
    const nextLessons = (await (activeClassId
      ? loadCloudLessons(activeClassId)
      : loadCourseLessons(activeCourseId!))) as TeacherLesson[];
    setCustomLessons(nextLessons);
    if (pdf) {
      const updatedLesson = nextLessons.find((item) => item.id === lessonId);
      if (updatedLesson?.pdfUrl) {
        void queueLessonSummaryGeneration(lessonId, updatedLesson.pdfUrl, true)
          .catch((error) => console.error('Không thể tạo lại tóm tắt nền:', error));
      }
    }
  };

  const deleteLesson = async (lessonId: string) => {
    await deleteCloudLesson(lessonId);
    setCustomLessons((current) => current.filter((lesson) => lesson.id !== lessonId));
    if (selectedLessonId === lessonId) closeLesson();
  };

  const toggleLessonPublish = async (lessonId: string) => {
    if (!activeClassId) return;
    const lesson = customLessons.find((item) => item.id === lessonId);
    const shouldOpenNow = !lesson?.published && !lesson?.availableAt;
    await setCloudLessonPublished(activeClassId, lessonId, shouldOpenNow);
    setCustomLessons(
      (await loadCloudLessons(activeClassId)) as TeacherLesson[],
    );
  };

  const scheduleLesson = async (lessonId: string, releaseAt: string) => {
    if (!activeClassId) throw new Error("Chưa chọn lớp học.");
    await setCloudLessonRelease(
      activeClassId,
      lessonId,
      new Date(releaseAt).toISOString(),
    );
    setCustomLessons(
      (await loadCloudLessons(activeClassId)) as TeacherLesson[],
    );
  };

  const refreshActivities = async () => {
    if (!activeClassId) return;
    setActivities(await loadCloudActivities(activeClassId));
  };

  const selectClass = (classId: string) => {
    setSelectedLessonId(null);
    setActiveClassId(classId);
    setActiveCourseId(
      classes.find((row) => row.id === classId)?.course_id ?? null,
    );
  };

  const selectCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    setActiveClassId(
      classes.find((row) => row.course_id === courseId)?.id ?? null,
    );
  };

  const createProgram = async (name: string, description: string) => {
    const courseId = await createCourse(name, description);
    setCourses(await loadMyCourses());
    setActiveCourseId(courseId);
    setActiveClassId(null);
    return courseId;
  };

  const createClass = async (name: string, description: string) => {
    if (!activeCourseId)
      throw new Error("Hãy tạo hoặc chọn chương trình học trước.");
    const created = await createClassForCourse(
      activeCourseId,
      name,
      description,
    );
    setClasses(await loadOwnedClasses());
    setTeacherMode(true);
    setActiveClassId(created.classId);
    return created;
  };

  const handleClassroomReady = async (classId: string) => {
    setSelectedLessonId(null);
    setActiveClassId(classId);
    const nextClasses = await loadMyClasses();
    setClasses(nextClasses);
    setActiveCourseId(
      nextClasses.find((row) => row.id === classId)?.course_id ?? null,
    );
  };

  if (!auth.configured || (!auth.loading && !auth.user)) return <AuthScreen />;
  if (auth.loading)
    return (
      <main className="auth-screen">
        <div className="auth-message">Đang tải tài khoản…</div>
      </main>
    );
  if (!auth.profile)
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="auth-message error" role="alert">
            {auth.error || "Không thể tải hồ sơ tài khoản."}
          </div>
          <button className="auth-primary" onClick={() => void auth.signOut()}>
            Đăng xuất và thử lại
          </button>
        </section>
      </main>
    );
  if (auth.profile.blocked_at)
    return (
      <main className="auth-screen"><section className="auth-card"><span className="auth-kicker">TÀI KHOẢN ĐÃ BỊ CHẶN</span><h1>Quyền truy cập tạm dừng</h1><div className="auth-message error" role="alert">{auth.profile.block_reason || "Vui lòng liên hệ quản trị viên để được hỗ trợ."}</div><button className="auth-primary" onClick={() => void auth.signOut()}>Đăng xuất</button></section></main>
    );
  if (auth.profile.role === "admin")
    return (
      <AdminDashboard
        currentUserId={auth.profile.id}
        onSignOut={() => void auth.signOut()}
      />
    );
  if (cloudLoading)
    return (
      <main className="auth-screen">
        <div className="auth-message">Đang tải lớp học…</div>
      </main>
    );
  if (cloudError)
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="auth-message error" role="alert">
            {cloudError}
          </div>
          <button
            className="auth-primary"
            onClick={() => window.location.reload()}
          >
            Thử tải lại
          </button>
          <button className="auth-switch" onClick={() => void auth.signOut()}>
            Đăng xuất
          </button>
        </section>
      </main>
    );
  if (!activeClassId && auth.profile.role === "student")
    return (
      <ClassroomOnboarding
        profile={auth.profile}
        onReady={(classId) => void handleClassroomReady(classId)}
        onSignOut={() => void auth.signOut()}
      />
    );
  if (auth.profile.role === "teacher" && teacherMode)
    return (
      <TeacherDashboard
        courses={courses}
        classes={classes}
        activeCourseId={activeCourseId}
        activeClassId={activeClassId}
        onSelectCourse={selectCourse}
        onSelectClass={selectClass}
        hasActiveClass={Boolean(activeClassId)}
        lessons={customLessons}
        customLessons={customLessons}
        activities={activities}
        onCreateCourse={createProgram}
        onCreateClass={createClass}
        onRegenerateJoinCode={regenerateClassJoinCode}
        onCreateLesson={createLesson}
        onUpdateLesson={updateLesson}
        onDeleteLesson={deleteLesson}
        onTogglePublish={toggleLessonPublish}
        onScheduleLesson={scheduleLesson}
        onRefreshActivities={refreshActivities}
        onClose={() => setTeacherMode(false)}
        onSignOut={() => void auth.signOut()}
      />
    );

  return (
    <main className="app-shell">
      <div className="space-canvas">
        <Canvas
          camera={{ position: [0, 68, 145], fov: 52 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.35;
          }}
        >
          <Suspense fallback={null}>
            <color attach="background" args={["#020208"]} />
            <fog attach="fog" args={["#020208", 190, 420]} />
            <ambientLight intensity={0.08} color="#7d9dff" />
            <Stars
              radius={380}
              depth={140}
              count={8000}
              factor={4.8}
              saturation={0.2}
              fade
              speed={0.25}
            />
            <Stars
              radius={300}
              depth={100}
              count={4500}
              factor={7.5}
              saturation={0.3}
              fade
              speed={0.14}
            />
            <Stars
              radius={220}
              depth={70}
              count={2200}
              factor={10}
              saturation={0.1}
              fade
              speed={0.08}
            />
            <MilkyWayGalaxy color="#536dff" />
            <Nebula
              position={[-185, 35, -310]}
              scale={1.45}
              colors={["#163b8f", "#315dff", "#6328a8"]}
            />
            <Nebula
              position={[205, -45, -360]}
              scale={1.25}
              colors={["#312477", "#6740c7", "#173e8f"]}
            />
            <StarCluster
              position={[150, 80, -200]}
              count={650}
              radius={28}
              color="#ffffff"
            />
            <StarCluster
              position={[-180, 60, -180]}
              count={520}
              radius={24}
              color="#a5b4fc"
            />
            <StarCluster
              position={[80, -50, -250]}
              count={560}
              radius={25}
              color="#ffe4b5"
            />
            <StarCluster
              position={[-230, 115, -300]}
              count={1400}
              radius={52}
              color="#d9e2ff"
            />
            <StarCluster
              position={[245, 85, -340]}
              count={1250}
              radius={48}
              color="#fff0d2"
            />
            <StarCluster
              position={[-40, -125, -290]}
              count={1100}
              radius={44}
              color="#9fb5ff"
            />
            <LuminousStarBand
              position={[-95, 42, -150]}
              rotation={[0.15, -0.35, 0.32]}
              length={150}
              width={22}
              count={2200}
              color="#b9c8ff"
            />
            <LuminousStarBand
              position={[125, -30, -190]}
              rotation={[-0.08, 0.5, -0.25]}
              length={125}
              width={18}
              count={1700}
              color="#ffe1b8"
            />
            <LuminousStarBand
              position={[15, 95, -240]}
              rotation={[0.2, 0.1, -0.12]}
              length={185}
              width={26}
              count={2600}
              color="#8fa7ff"
            />
            <SpaceDust count={5200} color="#c9d6ff" />
            <ShootingStars count={14} color="#e9f2ff" />
            <Comet startPosition={[-55, 24, -15]} speed={0.7} color="#8fe8ff" />
            <Comet
              startPosition={[35, -18, -35]}
              speed={1.05}
              color="#ffffff"
            />
            <Comet startPosition={[-20, 42, -60]} speed={0.5} color="#ffe4a8" />
            <SolarSystem
              lessons={lessons}
              speedMultiplier={speedMultiplier}
              onPlanetClick={selectByPlanetName}
              showOrbits={showOrbits}
              showLabels={!selectedLesson}
              accentColor="#7085ff"
              savedMaps={savedMaps}
            />
            <OrbitControls
              enablePan
              enableZoom
              enableRotate
              minDistance={28}
              maxDistance={250}
              autoRotate={!selectedLesson}
              autoRotateSpeed={0.18}
            />
          </Suspense>
        </Canvas>
      </div>

      <header className="top-bar">
        <button className="brand" onClick={closeLesson}>
          <img className="brand-mark" src="/share-icon.svg" alt="" />
          <span>
            Solar Note Map<small>AI Learning Universe</small>
          </span>
        </button>
        <div className="course-progress">
          <span>
            {activeCourse?.name ?? activeClass?.name ?? "Chưa chọn lớp"}
          </span>
          <div>
            <i
              style={{
                width: `${customLessons.length ? Math.round((publishedLessonCount / customLessons.length) * 100) : 0}%`,
              }}
            />
          </div>
          <b>
            {publishedLessonCount} / {customLessons.length || 0}
          </b>
        </div>
        <div ref={accountMenuRef} className="account-actions">
          {auth.profile.role === "student" && (
            <>
              {classes.length > 1 && (
                <select className="class-quick-select" aria-label="Lớp đang học" value={activeClassId ?? ""} onChange={(event) => selectClass(event.target.value)}>
                  {classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
              )}
              <button className="class-management-button" onClick={() => setShowStudentClasses(true)}>Lớp học</button>
            </>
          )}
          {auth.profile.role === "teacher" && (
            <>
              {classes.length > 1 && (
                <select
                  className="class-quick-select"
                  aria-label="Lớp đang xem"
                  value={activeClassId ?? ""}
                  onChange={(event) => selectClass(event.target.value)}
                >
                  {classes
                    .filter(
                      (row) =>
                        !activeCourseId || row.course_id === activeCourseId,
                    )
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                </select>
              )}
              <button
                className="class-management-button"
                onClick={() => setTeacherMode(true)}
              >
                {activeClassId
                  ? "Quản lý lớp"
                  : courses.length
                    ? "＋ Tạo lớp"
                    : "＋ Tạo chương trình"}
              </button>
            </>
          )}
          <button
            ref={profileButtonRef}
            className="profile-button"
            onClick={() => setShowAccountMenu((visible) => !visible)}
            aria-haspopup="dialog"
            aria-expanded={showAccountMenu}
            title="Mở thông tin tài khoản"
          >
            <span>{auth.profile?.display_name.charAt(0).toUpperCase()}</span>
            <div>
              {auth.profile?.display_name}
              <small>
                {auth.profile?.role === "teacher"
                  ? "Giáo viên"
                  : "Học sinh"}
              </small>
            </div>
            <i>{showAccountMenu ? "⌃" : "⌄"}</i>
          </button>
          {showAccountMenu && (
            <aside className="teacher-account-menu" role="dialog" aria-label="Thông tin tài khoản">
              <header>
                <span>{auth.profile.display_name.charAt(0).toUpperCase() || (auth.profile.role === "teacher" ? "GV" : "HS")}</span>
                <div><b>{auth.profile.display_name}</b><small>{auth.profile.role === "teacher" ? "Giáo viên" : "Học sinh"}</small></div>
              </header>
              <dl>
                <div><dt>Email</dt><dd>{auth.user?.email ?? "Chưa có email"}</dd></div>
                <div><dt>Lớp đang xem</dt><dd>{activeClass?.name ?? "Chưa chọn lớp"}</dd></div>
              </dl>
              <button className="teacher-sign-out" onClick={() => void auth.signOut()}>Đăng xuất <span>→</span></button>
            </aside>
          )}
        </div>
      </header>

      <section className="hero-copy">
        <span className="eyebrow">
          MISSION CONTROL ·{" "}
          {auth.profile.role === "teacher" ? "KHÔNG GIAN GIÁO VIÊN" : "KHÓA 01"}
        </span>
        <h1>
          Vũ trụ kiến thức
          <br />
          <em>của riêng bạn.</em>
        </h1>
        <p>
          {auth.profile.role === "teacher" && !activeClassId
            ? "Tạo lớp khi bạn sẵn sàng, sau đó đăng bài giảng và mời học sinh tham gia."
            : "Chọn một hành tinh để bắt đầu bài học. Mỗi sơ đồ bạn tạo sẽ trở thành một vệ tinh tri thức."}
        </p>
        {auth.profile.role === "teacher" && !activeClassId && (
          <button
            className="hero-class-button"
            onClick={() => setTeacherMode(true)}
          >
            {courses.length ? "＋ Tạo lớp học" : "＋ Tạo chương trình đầu tiên"}
          </button>
        )}
      </section>

      <nav className="lesson-dock" aria-label="Danh sách bài học">
        {lessons.map((lesson, index) => (
          <button
            key={lesson.id}
            className={selectedLessonId === lesson.id ? "active" : ""}
            onClick={() => openLesson(lesson.id)}
            onPointerEnter={() => {
              if (lesson.pdfUrl || lesson.id === "ai-foundations") {
                void prefetchPdfPage(lesson.pdfUrl ?? builtInSlidePdfUrl).catch(() => undefined);
              }
            }}
            onFocus={() => {
              if (lesson.pdfUrl || lesson.id === "ai-foundations") {
                void prefetchPdfPage(lesson.pdfUrl ?? builtInSlidePdfUrl).catch(() => undefined);
              }
            }}
            style={{ "--planet-color": lesson.color } as React.CSSProperties}
          >
            <span className="dock-number">0{index + 1}</span>
            <i />
            <div>
              <small>{index === 0 ? "SẴN SÀNG" : "BUỔI HỌC"}</small>
              <b>{lesson.shortName}</b>
            </div>
          </button>
        ))}
      </nav>

      <div className="view-controls">
        <button
          onClick={() => setShowOrbits((value) => !value)}
          className={showOrbits ? "active" : ""}
          title="Bật tắt quỹ đạo"
        >
          ◎
        </button>
        <button
          onClick={() =>
            setSpeedMultiplier((value) => (value === 0 ? 0.16 : 0))
          }
          title="Dừng chuyển động"
        >
          {speedMultiplier === 0 ? "▶" : "Ⅱ"}
        </button>
        <span>Kéo để xoay · Cuộn để thu phóng</span>
      </div>

      {selectedLesson && activeClassId && (
        <LearningConsole
          lesson={selectedLesson}
          classId={activeClassId}
          summaryCacheScope={`${auth.profile.id}:${activeClassId}`}
          canManageLesson={auth.profile.role === "teacher"}
          onRefreshPdf={() => refreshLessonPdf(selectedLesson.id)}
          onClose={closeLesson}
        />
      )}
      {showStudentClasses && auth.profile.role === "student" && (
        <StudentClassDialog
          classes={classes}
          activeClassId={activeClassId}
          onSelectClass={(classId) => {
            selectClass(classId);
            setShowStudentClasses(false);
          }}
          onJoined={handleClassroomReady}
          onClose={() => setShowStudentClasses(false)}
        />
      )}
    </main>
  );
}
