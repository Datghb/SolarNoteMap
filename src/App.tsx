import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Suspense, useEffect, useState } from 'react';
import * as THREE from 'three';
import { SolarSystem } from './components/SolarSystem';
import { SpaceDust, ShootingStars } from './components/SpaceObjects';
import { LearningConsole } from './components/LearningConsole';
import { LESSONS } from './data/lessons';

export function App() {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [showOrbits, setShowOrbits] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(0.16);
  const [savedMaps, setSavedMaps] = useState<Record<string, number>>({});
  const selectedLesson = LESSONS.find((lesson) => lesson.id === selectedLessonId) ?? null;

  useEffect(() => {
    const readSavedMaps = () => {
      const next: Record<string, number> = {};
      LESSONS.forEach((lesson) => {
        const stored = localStorage.getItem(`solar-note-map:${lesson.id}`);
        if (!stored) return;
        try {
          const nodeCount = JSON.parse(stored).nodes?.length ?? 0;
          if (nodeCount > 0) next[lesson.id] = nodeCount;
        } catch {
          localStorage.removeItem(`solar-note-map:${lesson.id}`);
        }
      });
      setSavedMaps(next);
    };

    readSavedMaps();
    window.addEventListener('solar-note-map:saved', readSavedMaps);
    return () => window.removeEventListener('solar-note-map:saved', readSavedMaps);
  }, []);

  const selectByPlanetName = (shortName: string) => {
    const lesson = LESSONS.find((item) => item.shortName === shortName);
    if (lesson) setSelectedLessonId(lesson.id);
  };

  return (
    <main className="app-shell">
      <div className="space-canvas">
        <Canvas camera={{ position: [0, 68, 145], fov: 52 }} gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.35;
        }}>
          <Suspense fallback={null}>
            <color attach="background" args={['#020208']} />
            <fog attach="fog" args={['#020208', 190, 420]} />
            <ambientLight intensity={0.08} color="#7d9dff" />
            <Stars radius={330} depth={110} count={4200} factor={4} saturation={0.25} fade speed={0.25} />
            <Stars radius={250} depth={80} count={1800} factor={7} saturation={0.4} fade speed={0.12} />
            <SpaceDust count={1800} color="#c9d6ff" />
            <ShootingStars count={3} color="#ffffff" />
            <SolarSystem speedMultiplier={speedMultiplier} onPlanetClick={selectByPlanetName} showOrbits={showOrbits} showLabels={!selectedLesson} accentColor="#7085ff" savedMaps={savedMaps} />
            <OrbitControls enablePan enableZoom enableRotate minDistance={28} maxDistance={250} autoRotate={!selectedLesson} autoRotateSpeed={0.18} />
          </Suspense>
        </Canvas>
      </div>

      <header className="top-bar">
        <button className="brand" onClick={() => setSelectedLessonId(null)}><span className="brand-mark">S</span><span>Solar Note Map<small>AI Learning Universe</small></span></button>
        <div className="course-progress"><span>Hành trình AI căn bản</span><div><i style={{ width: '20%' }} /></div><b>1 / 5</b></div>
        <button className="profile-button"><span>AN</span><div>Anh Nguyen<small>Nhà thám hiểm</small></div><i>⌄</i></button>
      </header>

      <section className="hero-copy">
        <span className="eyebrow">MISSION CONTROL · KHÓA 01</span>
        <h1>Vũ trụ kiến thức<br/><em>của riêng bạn.</em></h1>
        <p>Chọn một hành tinh để bắt đầu bài học.<br/>Mỗi sơ đồ bạn tạo sẽ trở thành một vệ tinh tri thức.</p>
      </section>

      <nav className="lesson-dock" aria-label="Danh sách bài học">
        {LESSONS.map((lesson, index) => (
          <button key={lesson.id} className={selectedLessonId === lesson.id ? 'active' : ''} onClick={() => setSelectedLessonId(lesson.id)} style={{ '--planet-color': lesson.color } as React.CSSProperties}>
            <span className="dock-number">0{index + 1}</span><i /><div><small>{index === 0 ? 'SẴN SÀNG' : 'BUỔI HỌC'}</small><b>{lesson.shortName}</b></div>
          </button>
        ))}
      </nav>

      <div className="view-controls">
        <button onClick={() => setShowOrbits((value) => !value)} className={showOrbits ? 'active' : ''} title="Bật tắt quỹ đạo">◎</button>
        <button onClick={() => setSpeedMultiplier((value) => value === 0 ? 0.16 : 0)} title="Dừng chuyển động">{speedMultiplier === 0 ? '▶' : 'Ⅱ'}</button>
        <span>Kéo để xoay · Cuộn để thu phóng</span>
      </div>

      {selectedLesson && <LearningConsole lesson={selectedLesson} onClose={() => setSelectedLessonId(null)} />}
    </main>
  );
}
