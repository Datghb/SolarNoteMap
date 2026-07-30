import { useState } from 'react';
import type { UserProfile } from '../hooks/useAuth';
import { joinClassroom } from '../utils/cloudClassroom';

export function ClassroomOnboarding({ profile, onReady, onSignOut }: { profile: UserProfile; onReady: (classId: string) => void; onSignOut: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true); setError('');
    try {
      onReady(await joinClassroom(code));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể kết nối lớp học.'); }
    finally { setBusy(false); }
  };
  if (profile.role !== 'student') return <main className="classroom-onboarding"><section><span className="auth-kicker">SOLAR CLASSROOM</span><h1>Dành cho học sinh</h1><p>Giáo viên tạo chương trình và lớp học trong trang quản lý giáo viên.</p><button className="auth-switch" onClick={onSignOut}>Đăng xuất</button></section></main>;
  return <main className="classroom-onboarding"><section><span className="auth-kicker">SOLAR CLASSROOM</span><h1>Tham gia lớp học</h1><p>Nhập mã do giáo viên cung cấp để bắt đầu học.</p><label>Mã lớp<input minLength={8} maxLength={64} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Nhập mã lớp" /></label>{error && <div className="auth-message error">{error}</div>}<button className="auth-primary" disabled={busy || code.trim().length < 8} onClick={submit}>{busy ? 'Đang xử lý…' : 'Tham gia'}</button><button className="auth-switch" onClick={onSignOut}>Đăng xuất</button></section></main>;
}
