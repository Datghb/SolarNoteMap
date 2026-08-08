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

        <div className="auth-divider"><span>hoặc</span></div>
        <button
          className="auth-google"
          type="button"
          disabled={auth.loading || !auth.configured}
          onClick={() => { setNotice(null); void auth.signInWithGoogle().catch(() => {}); }}
        >
          <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l6.19 5.238C41.201 35.091 44 30.023 44 24c0-1.341-.138-2.65-.389-3.917z" />
          </svg>
          Đăng nhập với Google
        </button>

        <button className="auth-switch" type="button" onClick={() => setMode((current) => current === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>

      </section>
    </main>
  );
}
