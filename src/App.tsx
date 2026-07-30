import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
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
} from "./utils/courseStore";
import { AuthScreen } from "./components/AuthScreen";
import { ClassroomOnboarding } from "./components/ClassroomOnboarding";
import { AdminDashboard } from "./components/AdminDashboard";
import { useAuth } from "./hooks/useAuth";
import {
  createClassForCourse,
  createCloudLesson,
  createCourse,
  loadCloudActivities,
  loadCloudLessons,
  loadCourseLessons,
  loadMyClasses,
  loadMyCourses,
  loadOwnedClasses,
  setCloudLessonPublished,
  setCloudLessonRelease,
  type CloudClassroom,
  type CloudCourse,
} from "./utils/cloudClassroom";

export function App() {
  const auth = useAuth();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [showOrbits, setShowOrbits] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(0.16);
  const [savedMaps, setSavedMaps] = useState<Record<string, number>>({});
  const [teacherMode, setTeacherMode] = useState(false);
  const [customLessons, setCustomLessons] = useState<TeacherLesson[]>([]);
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [classes, setClasses] = useState<CloudClassroom[]>([]);
  const [courses, setCourses] = useState<CloudCourse[]>([]);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudError, setCloudError] = useState("");
  const lessons = customLessons.filter((lesson) => lesson.published);
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

  const selectByPlanetName = (shortName: string) => {
    const lesson = lessons.find((item) => item.shortName === shortName);
    if (lesson) {
      setSelectedLessonId(lesson.id);
      recordStudentActivity({ lessonId: lesson.id, type: "lesson_opened" });
    }
  };

  const openLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    recordStudentActivity({ lessonId, type: "lesson_opened" });
  };

  const createLesson = async (lesson: TeacherLesson, pdf?: File) => {
    if (!auth.user) throw new Error("Chưa đăng nhập.");
    if (!activeCourseId) throw new Error("Chưa chọn chương trình học.");
    await createCloudLesson(activeCourseId, auth.user.id, lesson, pdf);
    setCustomLessons((await (activeClassId ? loadCloudLessons(activeClassId) : loadCourseLessons(activeCourseId))) as TeacherLesson[]);
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
        onCreateLesson={createLesson}
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
        <button className="brand" onClick={() => setSelectedLessonId(null)}>
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
                width: `${customLessons.length ? Math.round((lessons.length / customLessons.length) * 100) : 0}%`,
              }}
            />
          </div>
          <b>
            {lessons.length} / {customLessons.length || 0}
          </b>
        </div>
        <div className="account-actions">
          {auth.profile.role === "student" && classes.length > 1 && (
            <select
              className="class-quick-select"
              aria-label="Lớp đang học"
              value={activeClassId ?? ""}
              onChange={(event) => selectClass(event.target.value)}
            >
              {classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
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
            className="profile-button"
            onClick={() =>
              auth.profile?.role === "teacher"
                ? setTeacherMode(true)
                : void auth.signOut()
            }
            title={
              auth.profile?.role === "teacher"
                ? "Mở trang giáo viên"
                : "Đăng xuất"
            }
          >
            <span>{auth.profile?.display_name.charAt(0).toUpperCase()}</span>
            <div>
              {auth.profile?.display_name}
              <small>
                {auth.profile?.role === "teacher"
                  ? "Giáo viên"
                  : "Học sinh · Đăng xuất"}
              </small>
            </div>
            <i>→</i>
          </button>
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
          onClose={() => setSelectedLessonId(null)}
        />
      )}
    </main>
  );
}
