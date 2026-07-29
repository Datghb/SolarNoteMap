import { useState } from 'react';
import type { UserProfile } from '../hooks/useAuth';
import { createClassroom, joinClassroom } from '../utils/cloudClassroom';

export function ClassroomOnboarding({ profile, onReady, onSignOut, onRedeemTeacher }: { profile: UserProfile; onReady: (classId: string) => void; onSignOut: () => void; onRedeemTeacher?: (code: string) => Promise<unknown> }) {
  const [name, setName] = useState('Lớp AI căn bản');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const classId = profile.role === 'teacher' ? await createClassroom(name, description, code) : await joinClassroom(code);
      onReady(classId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể kết nối lớp học.'); }
    finally { setBusy(false); }
  };
  const redeem = async () => {
    if (!onRedeemTeacher) return;
    setBusy(true); setError('');
    try { await onRedeemTeacher(teacherCode); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Mã mời giáo viên không hợp lệ.'); }
    finally { setBusy(false); }
  };
  return <main className="classroom-onboarding"><section><span className="auth-kicker">SOLAR CLASSROOM</span><h1>{profile.role === 'teacher' ? 'Tạo lớp học đầu tiên' : 'Tham gia lớp học'}</h1><p>{profile.role === 'teacher' ? 'Tạo một mã lớp riêng để mời học sinh.' : 'Nhập mã do giáo viên cung cấp để bắt đầu học.'}</p>{profile.role === 'teacher' && <><label>Tên lớp<input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><label>Mô tả<textarea maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /></label></>}<label>Mã lớp<input minLength={8} maxLength={64} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ít nhất 8 ký tự" /></label>{error && <div className="auth-message error">{error}</div>}<button className="auth-primary" disabled={busy || code.trim().length < 8 || (profile.role === 'teacher' && !name.trim())} onClick={submit}>{busy ? 'Đang xử lý…' : profile.role === 'teacher' ? 'Tạo lớp' : 'Tham gia'}</button>{profile.role === 'student' && onRedeemTeacher && <div className="auth-invite"><label>Mã mời dành cho giáo viên<input value={teacherCode} onChange={(event) => setTeacherCode(event.target.value)} /></label><button disabled={busy || teacherCode.trim().length < 24} onClick={redeem}>Kích hoạt</button></div>}<button className="auth-switch" onClick={onSignOut}>Đăng xuất</button></section></main>;
}
