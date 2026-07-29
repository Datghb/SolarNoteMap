import { useMemo, useState } from 'react';
import type { Lesson } from '../data/lessons';
import { createTeacherLesson, summarizeClassroom, type StudentActivity, type TeacherLesson, type TeacherLessonInput } from '../utils/courseStore';

const EVENT_LABELS: Record<StudentActivity['type'], string> = {
  lesson_opened: 'Mở bài học', slide_viewed: 'Xem slide', note_updated: 'Cập nhật ghi chú', map_saved: 'Lưu sơ đồ',
  question_posted: 'Đăng câu hỏi', answer_posted: 'Phản hồi thảo luận', understanding_updated: 'Đánh dấu mức độ hiểu',
};

export function TeacherDashboard({ lessons, customLessons, activities, onCreateLesson, onTogglePublish, onClose }: {
  lessons: Lesson[];
  customLessons: TeacherLesson[];
  activities: StudentActivity[];
  onCreateLesson: (lesson: TeacherLesson) => void | Promise<void>;
  onTogglePublish: (lessonId: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [view, setView] = useState<'overview' | 'lessons' | 'students'>('overview');
  const [showCreator, setShowCreator] = useState(false);
  const [form, setForm] = useState<TeacherLessonInput>({ name: '', shortName: '', description: '', prompt: '' });
  const [formError, setFormError] = useState('');
  const [savingLesson, setSavingLesson] = useState(false);
  const metrics = summarizeClassroom(activities);
  const students = useMemo(() => [...new Set(activities.map((activity) => activity.studentId))].map((studentId) => {
    const rows = activities.filter((activity) => activity.studentId === studentId);
    return { id: studentId, name: rows[0]?.studentName ?? 'Học sinh', events: rows.length, lessons: new Set(rows.map((row) => row.lessonId)).size, lastAt: rows[0]?.occurredAt };
  }), [activities]);

  const submitLesson = async () => {
    setSavingLesson(true);
    try {
      await onCreateLesson(createTeacherLesson(form));
      setForm({ name: '', shortName: '', description: '', prompt: '' });
      setFormError('');
      setShowCreator(false);
      setView('lessons');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Thông tin bài giảng không hợp lệ.');
    } finally { setSavingLesson(false); }
  };

  return <main className="teacher-dashboard">
    <header className="teacher-topbar">
      <button className="teacher-brand" onClick={onClose}><img src="/share-icon.svg" alt="" /><span>Solar Note Map<small>Không gian giáo viên</small></span></button>
      <nav>{(['overview', 'lessons', 'students'] as const).map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item === 'overview' ? 'Tổng quan' : item === 'lessons' ? 'Bài giảng' : 'Học sinh'}</button>)}</nav>
      <div className="teacher-account"><span>GV</span><div><b>Giáo viên</b><small>Quản trị lớp học</small></div><button onClick={onClose}>Về trang học sinh →</button></div>
    </header>

    <section className="teacher-shell">
      <aside className="teacher-sidebar">
        <span className="teacher-kicker">KHÔNG GIAN CÁ NHÂN</span><h1>Xây dựng hành trình học tập.</h1><p>Quản lý bài giảng và nội dung học tập được lưu trên thiết bị này.</p>
        <button className="teacher-create" onClick={() => setShowCreator(true)}>＋ Thêm bài giảng</button>
        <div className="teacher-storage-note"><i>i</i><span><b>Dữ liệu cục bộ</b>Bài giảng và hoạt động được lưu trên thiết bị hiện tại.</span></div>
      </aside>

      <div className="teacher-main">
        {view === 'overview' && <>
          <header className="teacher-heading"><div><span>TỔNG QUAN LỚP HỌC</span><h2>Chào buổi học mới.</h2></div><small>Cập nhật từ hoạt động gần nhất</small></header>
          <div className="teacher-metrics">
            <article><span>Bài giảng</span><b>{lessons.length}</b><small>{customLessons.filter((lesson) => lesson.published).length} bài tự tạo đã xuất bản</small></article>
            <article><span>Học sinh hoạt động</span><b>{metrics.activeStudents}</b><small>Trên thiết bị hiện tại</small></article>
            <article><span>Ghi chú & sơ đồ</span><b>{metrics.notes + metrics.maps}</b><small>{metrics.notes} ghi chú · {metrics.maps} sơ đồ</small></article>
            <article><span>Câu hỏi</span><b>{metrics.questions}</b><small>Cần giáo viên theo dõi</small></article>
          </div>
          <div className="teacher-grid">
            <section className="teacher-panel"><header><div><span>Hoạt động gần đây</span><small>{metrics.totalEvents} sự kiện đã ghi nhận</small></div><button onClick={() => setView('students')}>Xem tất cả →</button></header><ActivityList activities={activities.slice(0, 8)} lessons={lessons} /></section>
            <section className="teacher-panel lesson-health"><header><div><span>Tiến độ theo bài</span><small>Tín hiệu tương tác của lớp</small></div><button onClick={() => setView('lessons')}>Quản lý →</button></header>{lessons.slice(0, 5).map((lesson) => { const count = activities.filter((activity) => activity.lessonId === lesson.id).length; return <div key={lesson.id}><i style={{ background: lesson.color }} /><span><b>{lesson.name}</b><small>{count} hoạt động</small></span><em><u style={{ width: `${Math.min(100, count * 8)}%`, background: lesson.color }} /></em></div>; })}</section>
          </div>
        </>}

        {view === 'lessons' && <section className="teacher-list-page"><header className="teacher-heading"><div><span>THƯ VIỆN NỘI DUNG</span><h2>Bài giảng của lớp</h2></div><button className="teacher-create inline" onClick={() => setShowCreator(true)}>＋ Thêm bài giảng</button></header><div className="teacher-lesson-table"><div className="table-head"><span>Bài giảng</span><span>Nguồn</span><span>Trạng thái</span><span>Hoạt động</span><span /></div>{lessons.map((lesson) => { const custom = customLessons.find((item) => item.id === lesson.id); return <article key={lesson.id}><div><i style={{ background: lesson.color }} /><span><b>{lesson.name}</b><small>{lesson.description}</small></span></div><span>{lesson.pdfName || (lesson.id === 'ai-foundations' ? 'PDF · 42 trang' : 'Nội dung hệ thống')}</span><span className={`publish-state ${custom && !custom.published ? 'draft' : ''}`}>{custom && !custom.published ? 'Bản nháp' : 'Đã xuất bản'}</span><span>{activities.filter((activity) => activity.lessonId === lesson.id).length}</span>{custom ? <button onClick={() => onTogglePublish(custom.id)}>{custom.published ? 'Đưa về nháp' : 'Xuất bản'}</button> : <small>Mặc định</small>}</article>; })}</div></section>}

        {view === 'students' && <section className="teacher-list-page"><header className="teacher-heading"><div><span>HOẠT ĐỘNG HỌC SINH</span><h2>Theo dõi quá trình học</h2></div><small>{students.length} học sinh có hoạt động</small></header><div className="student-overview-table"><div className="table-head"><span>Học sinh</span><span>Bài đã học</span><span>Hoạt động</span><span>Lần cuối</span></div>{students.length ? students.map((student) => <article key={student.id}><div><i>{student.name.charAt(0)}</i><b>{student.name}</b></div><span>{student.lessons}</span><span>{student.events}</span><span>{student.lastAt ? new Date(student.lastAt).toLocaleString('vi-VN') : '—'}</span></article>) : <div className="teacher-empty">Chưa có hoạt động học sinh trên thiết bị này.</div>}</div><section className="teacher-panel all-activity"><header><div><span>Nhật ký chi tiết</span><small>Mới nhất trước</small></div></header><ActivityList activities={activities} lessons={lessons} /></section></section>}
      </div>
    </section>

    {showCreator && <div className="lesson-creator-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreator(false); }}><section className="lesson-creator"><header><div><span>＋ BÀI GIẢNG MỚI</span><h2>Thêm nội dung học tập</h2></div><button onClick={() => setShowCreator(false)}>×</button></header><label>Tên bài giảng<input maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: Prompt Engineering căn bản" /></label><label>Tên ngắn<input maxLength={48} value={form.shortName} onChange={(event) => setForm((current) => ({ ...current, shortName: event.target.value }))} placeholder="Prompt Engineering" /></label><label>Mô tả<textarea maxLength={500} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Người học sẽ học được gì?" /></label><label>Câu hỏi dẫn đường<input maxLength={300} value={form.prompt} onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))} placeholder="Câu hỏi trọng tâm của bài học" /></label>{formError && <p className="creator-error">{formError}</p>}<footer><button onClick={() => setShowCreator(false)}>Hủy</button><button className="primary" disabled={savingLesson} onClick={submitLesson}>{savingLesson ? 'Đang lưu…' : 'Lưu bản nháp'}</button></footer></section></div>}
  </main>;
}

function ActivityList({ activities, lessons }: { activities: StudentActivity[]; lessons: Lesson[] }) {
  if (!activities.length) return <div className="teacher-empty">Hoạt động sẽ xuất hiện khi học sinh mở bài, ghi chú, lưu sơ đồ hoặc đặt câu hỏi.</div>;
  return <div className="teacher-activity-list">{activities.map((activity) => <article key={activity.id}><i>{activity.studentName.charAt(0)}</i><div><b>{activity.studentName}</b><span>{EVENT_LABELS[activity.type]} · {lessons.find((lesson) => lesson.id === activity.lessonId)?.name ?? 'Bài học'}</span></div><time>{new Date(activity.occurredAt).toLocaleString('vi-VN')}</time></article>)}</div>;
}
