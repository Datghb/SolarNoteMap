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

  const continueWithGoogle = async () => {
    setNotice(null);
    try {
      await auth.signInWithGoogle();
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
        <button className="auth-google" type="button" onClick={continueWithGoogle} disabled={auth.loading || !auth.configured}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.92 3.27-4.75 3.27-8.1Z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.29-2.65l-3.57-2.77c-.98.66-2.24 1.06-3.72 1.06-2.87 0-5.3-1.94-6.17-4.54H2.14v2.84A11 11 0 0 0 12 23Z"/><path fill="#fbbc05" d="M5.83 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.14a11 11 0 0 0 0 9.88l3.69-2.84Z"/><path fill="#ea4335" d="M12 5.36c1.62 0 3.06.56 4.2 1.64l3.17-3.17A10.64 10.64 0 0 0 2.14 7.06L5.83 9.9C6.7 7.3 9.13 5.36 12 5.36Z"/></svg>
          Tiếp tục với Google
        </button>
        <div className="auth-divider"><span>hoặc đăng nhập bằng email</span></div>
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
