import { useState } from 'react';
import type { UserProfile } from '../hooks/useAuth';
import { createClassroom, joinClassroom } from '../utils/cloudClassroom';

export function ClassroomOnboarding({ profile, onReady, onSignOut }: { profile: UserProfile; onReady: (classId: string) => void; onSignOut: () => void }) {
  const [name, setName] = useState('Lớp AI căn bản');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [createdClass, setCreatedClass] = useState<{ classId: string; joinCode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (profile.role === 'teacher') {
        setCreatedClass(await createClassroom(name, description));
      } else {
        onReady(await joinClassroom(code));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể kết nối lớp học.'); }
    finally { setBusy(false); }
  };
  if (createdClass) return <main className="classroom-onboarding"><section><span className="auth-kicker">LỚP ĐÃ SẴN SÀNG</span><h1>Lưu mã lớp này</h1><p>Gửi riêng mã dưới đây cho học sinh. Vì lý do bảo mật, mã chỉ hiển thị ở bước này.</p><label>Mã lớp<input readOnly value={createdClass.joinCode} onFocus={(event) => event.currentTarget.select()} /></label><button className="auth-primary" onClick={() => onReady(createdClass.classId)}>Vào trang giáo viên</button><button className="auth-switch" onClick={onSignOut}>Đăng xuất</button></section></main>;
  return <main className="classroom-onboarding"><section><span className="auth-kicker">SOLAR CLASSROOM</span><h1>{profile.role === 'teacher' ? 'Tạo lớp học đầu tiên' : 'Tham gia lớp học'}</h1><p>{profile.role === 'teacher' ? 'Hệ thống sẽ tạo mã bảo mật ngẫu nhiên để bạn gửi riêng cho học sinh.' : 'Nhập mã do giáo viên cung cấp để bắt đầu học.'}</p>{profile.role === 'teacher' && <><label>Tên lớp<input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><label>Mô tả<textarea maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /></label></>}{profile.role === 'student' && <label>Mã lớp<input minLength={8} maxLength={64} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Nhập mã lớp" /></label>}{error && <div className="auth-message error">{error}</div>}<button className="auth-primary" disabled={busy || (profile.role === 'student' && code.trim().length < 8) || (profile.role === 'teacher' && !name.trim())} onClick={submit}>{busy ? 'Đang xử lý…' : profile.role === 'teacher' ? 'Tạo lớp' : 'Tham gia'}</button><button className="auth-switch" onClick={onSignOut}>Đăng xuất</button></section></main>;
}
