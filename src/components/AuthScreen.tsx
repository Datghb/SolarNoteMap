import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import '../auth.css';

export interface AuthScreenProps {
  onAuthenticated?: () => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    try {
      if (mode === 'login') {
        await auth.signIn(email, password);
        onAuthenticated?.();
      } else {
        const result = await auth.signUp({ email, password, fullName });
        if (result.session) onAuthenticated?.();
        else setNotice('Hãy kiểm tra email để xác nhận tài khoản.');
      }
    } catch {
      // The hook exposes a localized, renderable error.
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-orbit" aria-hidden="true"><i /></div>
        <p className="auth-kicker">SOLAR NOTE MAP</p>
        <h1 id="auth-title">{mode === 'login' ? 'Chào mừng trở lại' : 'Bắt đầu hành trình'}</h1>
        <p className="auth-subtitle">Đăng nhập để tiếp tục khám phá vũ trụ kiến thức của bạn.</p>

        {!auth.configured && <div className="auth-message error" role="alert">{auth.error}</div>}
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <label>Họ và tên<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required /></label>
          )}
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required /></label>
          <button className="auth-primary" type="submit" disabled={auth.loading || !auth.configured}>{auth.loading ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
        </form>

        {auth.error && auth.configured && <div className="auth-message error" role="alert">{auth.error}</div>}
        {notice && <div className="auth-message success" role="status">{notice}</div>}
        <button className="auth-switch" type="button" onClick={() => setMode((current) => current === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>

      </section>
    </main>
  );
}
