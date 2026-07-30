import { useMemo, useState } from 'react';
import type { Lesson } from '../data/lessons';
import { createTeacherLesson, summarizeClassroom, type StudentActivity, type TeacherLesson, type TeacherLessonInput } from '../utils/courseStore';

const EVENT_LABELS: Record<StudentActivity['type'], string> = {
  lesson_opened: 'Mở bài học', slide_viewed: 'Xem slide', note_updated: 'Cập nhật ghi chú', map_saved: 'Lưu sơ đồ',
  question_posted: 'Đăng câu hỏi', answer_posted: 'Phản hồi thảo luận', understanding_updated: 'Đánh dấu mức độ hiểu',
};

export function TeacherDashboard({ hasActiveClass, lessons, customLessons, activities, onCreateClass, onCreateLesson, onTogglePublish, onRefreshActivities, onClose, onSignOut }: {
  hasActiveClass: boolean;
  lessons: Lesson[];
  customLessons: TeacherLesson[];
  activities: StudentActivity[];
  onCreateClass: (name: string, description: string) => Promise<{ classId: string; joinCode: string }>;
  onCreateLesson: (lesson: TeacherLesson, pdf?: File) => void | Promise<void>;
  onTogglePublish: (lessonId: string) => void | Promise<void>;
  onRefreshActivities: () => void | Promise<void>;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const [view, setView] = useState<'overview' | 'lessons' | 'students'>('overview');
  const [showCreator, setShowCreator] = useState(false);
  const [form, setForm] = useState<TeacherLessonInput>({ name: '', shortName: '', description: '', prompt: '' });
  const [formError, setFormError] = useState('');
  const [pdfFile, setPdfFile] = useState<File>();
  const [savingLesson, setSavingLesson] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showClassCreator, setShowClassCreator] = useState(false);
  const [className, setClassName] = useState('Lớp AI căn bản');
  const [classDescription, setClassDescription] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);
  const [createdJoinCode, setCreatedJoinCode] = useState('');
  const metrics = summarizeClassroom(activities);
  const students = useMemo(() => [...new Set(activities.map((activity) => activity.studentId))].map((studentId) => {
    const rows = activities.filter((activity) => activity.studentId === studentId);
    return { id: studentId, name: rows[0]?.studentName ?? 'Học sinh', events: rows.length, lessons: new Set(rows.map((row) => row.lessonId)).size, lastAt: rows[0]?.occurredAt };
  }), [activities]);

  const submitLesson = async () => {
    setSavingLesson(true);
    try {
      await onCreateLesson(createTeacherLesson(form), pdfFile);
      setForm({ name: '', shortName: '', description: '', prompt: '' });
      setPdfFile(undefined);
      setFormError('');
      setShowCreator(false);
      setView('lessons');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Thông tin bài giảng không hợp lệ.');
    } finally { setSavingLesson(false); }
  };

  const togglePublish = async (lessonId: string) => {
    setPublishingId(lessonId);
    setActionError('');
    try { await onTogglePublish(lessonId); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái bài giảng.'); }
    finally { setPublishingId(null); }
  };

  const refreshActivity = async () => {
    setRefreshing(true);
    setActionError('');
    try { await onRefreshActivities(); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể làm mới hoạt động.'); }
    finally { setRefreshing(false); }
  };

  const submitClass = async () => {
    setCreatingClass(true);
    setActionError('');
    try {
      const created = await onCreateClass(className.trim(), classDescription.trim());
      setCreatedJoinCode(created.joinCode);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể tạo lớp học.');
    } finally { setCreatingClass(false); }
  };

  const openClassCreator = () => {
    setCreatedJoinCode('');
    setActionError('');
    setShowClassCreator(true);
  };

  return <main className="teacher-dashboard">
    <header className="teacher-topbar">
      <button className="teacher-brand" onClick={onClose}><img src="/share-icon.svg" alt="" /><span>Solar Note Map<small>Không gian giáo viên</small></span></button>
      <nav>{(['overview', 'lessons', 'students'] as const).map((item) => <button key={item} disabled={!hasActiveClass && item !== 'overview'} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item === 'overview' ? 'Tổng quan' : item === 'lessons' ? 'Bài giảng' : 'Học sinh'}</button>)}</nav>
      <div className="teacher-account"><span>GV</span><div><b>Giáo viên</b><small>Quản trị lớp học</small></div><button onClick={hasActiveClass ? onClose : onSignOut}>{hasActiveClass ? 'Về không gian học →' : 'Đăng xuất →'}</button></div>
    </header>

    <section className="teacher-shell">
      <aside className="teacher-sidebar">
        <span className="teacher-kicker">{hasActiveClass ? 'LỚP ĐANG QUẢN LÝ' : 'KHÔNG GIAN GIÁO VIÊN'}</span><h1>{hasActiveClass ? 'Theo dõi hành trình học tập.' : 'Bắt đầu khi bạn sẵn sàng.'}</h1><p>{hasActiveClass ? 'Quản lý bài giảng và quan sát những tín hiệu học tập quan trọng theo thời gian.' : 'Bạn có thể tạo lớp mới rồi chia sẻ mã lớp cho học sinh sau.'}</p>
        {hasActiveClass && <button className="teacher-create" onClick={() => setShowCreator(true)}>＋ Thêm bài giảng</button>}
        <button className="teacher-create" onClick={openClassCreator}>＋ Tạo lớp mới</button>
        <div className="teacher-storage-note"><i>i</i><span><b>Đồng bộ Supabase</b>Bài giảng PDF và hoạt động học sinh được lưu theo lớp.</span></div>
      </aside>

      <div className="teacher-main">
        {view !== 'lessons' && actionError && <p className="creator-error">{actionError}</p>}
        {view === 'overview' && <>
          <header className="teacher-heading"><div><span>TỔNG QUAN LỚP HỌC</span><h2>{hasActiveClass ? 'Chào buổi học mới.' : 'Bạn chưa tạo lớp học.'}</h2></div>{hasActiveClass && <button className="teacher-create inline" disabled={refreshing} onClick={() => void refreshActivity()}>{refreshing ? 'Đang tải…' : '↻ Làm mới hoạt động'}</button>}</header>
          <div className="teacher-metrics">
            <article><span>Bài giảng</span><b>{lessons.length}</b><small>{customLessons.filter((lesson) => lesson.published).length} bài tự tạo đã xuất bản</small></article>
            <article><span>Học sinh hoạt động</span><b>{metrics.activeStudents}</b><small>Trong lớp học hiện tại</small></article>
            <article><span>Ghi chú & sơ đồ</span><b>{metrics.notes + metrics.maps}</b><small>{metrics.notes} ghi chú · {metrics.maps} sơ đồ</small></article>
            <article><span>Câu hỏi</span><b>{metrics.questions}</b><small>Cần giáo viên theo dõi</small></article>
          </div>
          <div className="teacher-grid">
            <section className="teacher-panel"><header><div><span>Hoạt động gần đây</span><small>{metrics.totalEvents} sự kiện đã ghi nhận</small></div>{hasActiveClass && <button onClick={() => setView('students')}>Xem tất cả →</button>}</header><ActivityList activities={activities.slice(0, 8)} lessons={lessons} /></section>
            <section className="teacher-panel lesson-health"><header><div><span>Tiến độ theo bài</span><small>Tín hiệu tương tác của lớp</small></div>{hasActiveClass && <button onClick={() => setView('lessons')}>Quản lý →</button>}</header>{lessons.slice(0, 5).map((lesson) => { const count = activities.filter((activity) => activity.lessonId === lesson.id).length; return <div key={lesson.id}><i style={{ background: lesson.color }} /><span><b>{lesson.name}</b><small>{count} hoạt động</small></span><em><u style={{ width: `${Math.min(100, count * 8)}%`, background: lesson.color }} /></em></div>; })}</section>
          </div>
        </>}

        {view === 'lessons' && <section className="teacher-list-page"><header className="teacher-heading"><div><span>THƯ VIỆN NỘI DUNG</span><h2>Bài giảng của lớp</h2></div><button className="teacher-create inline" onClick={() => setShowCreator(true)}>＋ Thêm bài giảng</button></header>{actionError && <p className="creator-error">{actionError}</p>}<div className="teacher-lesson-table"><div className="table-head"><span>Bài giảng</span><span>Nguồn</span><span>Trạng thái</span><span>Hoạt động</span><span /></div>{lessons.map((lesson) => { const custom = customLessons.find((item) => item.id === lesson.id); return <article key={lesson.id}><div><i style={{ background: lesson.color }} /><span><b>{lesson.name}</b><small>{lesson.description}</small></span></div><span>{lesson.pdfName || (lesson.id === 'ai-foundations' ? 'PDF · 42 trang' : 'Nội dung hệ thống')}</span><span className={`publish-state ${custom && !custom.published ? 'draft' : ''}`}>{custom && !custom.published ? 'Bản nháp' : 'Đã xuất bản'}</span><span>{activities.filter((activity) => activity.lessonId === lesson.id).length}</span>{custom ? <button disabled={publishingId === custom.id} onClick={() => void togglePublish(custom.id)}>{publishingId === custom.id ? 'Đang lưu…' : custom.published ? 'Đưa về nháp' : 'Xuất bản'}</button> : <small>Mặc định</small>}</article>; })}</div></section>}

        {view === 'students' && <section className="teacher-list-page"><header className="teacher-heading"><div><span>HOẠT ĐỘNG HỌC SINH</span><h2>Theo dõi quá trình học</h2></div><small>{students.length} học sinh có hoạt động</small></header><div className="student-overview-table"><div className="table-head"><span>Học sinh</span><span>Bài đã học</span><span>Hoạt động</span><span>Lần cuối</span></div>{students.length ? students.map((student) => <article key={student.id}><div><i>{student.name.charAt(0)}</i><b>{student.name}</b></div><span>{student.lessons}</span><span>{student.events}</span><span>{student.lastAt ? new Date(student.lastAt).toLocaleString('vi-VN') : '—'}</span></article>) : <div className="teacher-empty">Chưa có hoạt động học sinh trong lớp.</div>}</div><section className="teacher-panel all-activity"><header><div><span>Nhật ký chi tiết</span><small>Mới nhất trước</small></div></header><ActivityList activities={activities} lessons={lessons} /></section></section>}
      </div>
    </section>

    {showClassCreator && <div className="lesson-creator-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !creatingClass) setShowClassCreator(false); }}><section className="lesson-creator"><header><div><span>＋ LỚP HỌC MỚI</span><h2>{createdJoinCode ? 'Lớp đã sẵn sàng' : 'Tạo lớp học'}</h2></div>{!creatingClass && <button onClick={() => setShowClassCreator(false)}>×</button>}</header>{createdJoinCode ? <><p>Gửi riêng mã này cho học sinh. Mã chỉ được hiển thị tại bước này.</p><label>Mã lớp<input readOnly value={createdJoinCode} onFocus={(event) => event.currentTarget.select()} /></label><footer><button className="primary" onClick={() => setShowClassCreator(false)}>Vào quản lý lớp</button></footer></> : <><label>Tên lớp<input maxLength={120} value={className} onChange={(event) => setClassName(event.target.value)} /></label><label>Mô tả<textarea maxLength={500} value={classDescription} onChange={(event) => setClassDescription(event.target.value)} /></label>{actionError && <p className="creator-error">{actionError}</p>}<footer><button disabled={creatingClass} onClick={() => setShowClassCreator(false)}>Hủy</button><button className="primary" disabled={creatingClass || !className.trim()} onClick={() => void submitClass()}>{creatingClass ? 'Đang tạo…' : 'Tạo lớp'}</button></footer></>}</section></div>}

    {showCreator && <div className="lesson-creator-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreator(false); }}><section className="lesson-creator"><header><div><span>＋ BÀI GIẢNG MỚI</span><h2>Thêm nội dung cho lớp</h2></div><button onClick={() => setShowCreator(false)}>×</button></header><label>Tên bài giảng<input maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: Prompt Engineering căn bản" /></label><label>Tên ngắn<input maxLength={48} value={form.shortName} onChange={(event) => setForm((current) => ({ ...current, shortName: event.target.value }))} placeholder="Prompt Engineering" /></label><label>Mô tả<textarea maxLength={500} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Học sinh sẽ học được gì?" /></label><label>Câu hỏi dẫn đường<input maxLength={300} value={form.prompt} onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))} placeholder="Câu hỏi trọng tâm của bài học" /></label><label className="lesson-file">Tài liệu PDF<input type="file" accept="application/pdf" onChange={(event) => { const file = event.target.files?.[0]; setPdfFile(file); setForm((current) => ({ ...current, pdfName: file?.name })); }} /><span>{form.pdfName || 'Chọn tệp PDF từ máy'}</span></label>{formError && <p className="creator-error">{formError}</p>}<footer><button onClick={() => setShowCreator(false)}>Hủy</button><button className="primary" disabled={savingLesson} onClick={submitLesson}>{savingLesson ? 'Đang tải lên…' : 'Lưu bản nháp'}</button></footer></section></div>}
  </main>;
}

function ActivityList({ activities, lessons }: { activities: StudentActivity[]; lessons: Lesson[] }) {
  if (!activities.length) return <div className="teacher-empty">Hoạt động sẽ xuất hiện khi học sinh mở bài, ghi chú, lưu sơ đồ hoặc đặt câu hỏi.</div>;
  return <div className="teacher-activity-list">{activities.map((activity) => <article key={activity.id}><i>{activity.studentName.charAt(0)}</i><div><b>{activity.studentName}</b><span>{EVENT_LABELS[activity.type]} · {lessons.find((lesson) => lesson.id === activity.lessonId)?.name ?? 'Bài học'}{activity.slideId ? ` · ${activity.slideId}` : ''}</span></div><time>{new Date(activity.occurredAt).toLocaleString('vi-VN')}</time></article>)}</div>;
}
