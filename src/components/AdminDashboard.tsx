import { useEffect, useMemo, useState } from 'react';
import { loadAdminAccounts, updateAccountRole, type AdminAccount, type ManagedAccountRole } from '../utils/adminAccounts';
import './admin.css';

type RoleFilter = 'all' | AdminAccount['role'];

const ROLE_LABELS: Record<AdminAccount['role'], string> = {
  admin: 'Quản trị viên',
  teacher: 'Giáo viên',
  student: 'Học sinh',
};

export function AdminDashboard({ currentUserId, onSignOut }: { currentUserId: string; onSignOut: () => void }) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try { setAccounts(await loadAdminAccounts()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách tài khoản.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const visibleAccounts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi');
    return accounts.filter((account) =>
      (filter === 'all' || account.role === filter) &&
      (!keyword || `${account.display_name} ${account.email}`.toLocaleLowerCase('vi').includes(keyword)),
    );
  }, [accounts, filter, query]);

  const setRole = async (account: AdminAccount, role: ManagedAccountRole) => {
    if (account.role === role) return;
    setSavingId(account.id);
    setError('');
    try {
      await updateAccountRole(account.id, role);
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, role } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật quyền tài khoản.'); }
    finally { setSavingId(null); }
  };

  const counts = accounts.reduce((result, account) => ({ ...result, [account.role]: result[account.role] + 1 }), { admin: 0, teacher: 0, student: 0 });

  return <main className="admin-dashboard">
    <header className="admin-topbar">
      <div className="admin-brand"><img src="/share-icon.svg" alt="" /><span>Solar Note Map<small>Trung tâm quản trị</small></span></div>
      <button onClick={onSignOut}>Đăng xuất</button>
    </header>
    <section className="admin-shell">
      <header className="admin-heading"><div><span>QUẢN LÝ TÀI KHOẢN</span><h1>Giáo viên và học sinh</h1><p>Theo dõi tài khoản và cấp đúng vai trò cho từng người dùng.</p></div><button onClick={() => void refresh()} disabled={loading}>↻ Làm mới</button></header>
      <div className="admin-metrics"><article><span>Tất cả</span><b>{accounts.length}</b></article><article><span>Giáo viên</span><b>{counts.teacher}</b></article><article><span>Học sinh</span><b>{counts.student}</b></article><article><span>Quản trị viên</span><b>{counts.admin}</b></article></div>
      <section className="admin-panel">
        <div className="admin-tools"><input aria-label="Tìm tài khoản" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc email…" /><select aria-label="Lọc theo vai trò" value={filter} onChange={(event) => setFilter(event.target.value as RoleFilter)}><option value="all">Tất cả vai trò</option><option value="teacher">Giáo viên</option><option value="student">Học sinh</option><option value="admin">Quản trị viên</option></select></div>
        {error && <div className="admin-error" role="alert">{error}</div>}
        <div className="admin-table"><div className="admin-table-head"><span>Tài khoản</span><span>Vai trò</span><span>Số lớp</span><span>Ngày tạo</span><span>Quản lý</span></div>
          {loading ? <div className="admin-empty">Đang tải tài khoản…</div> : visibleAccounts.map((account) => <article key={account.id}><div className="admin-person"><i>{account.display_name.charAt(0).toUpperCase()}</i><span><b>{account.display_name}</b><small>{account.email}</small></span></div><span className={`admin-role ${account.role}`}>{ROLE_LABELS[account.role]}</span><span>{account.class_count}</span><time>{new Date(account.created_at).toLocaleDateString('vi-VN')}</time><div>{account.role === 'admin' || account.id === currentUserId ? <small className="admin-protected">Được bảo vệ</small> : <select aria-label={`Vai trò của ${account.display_name}`} value={account.role} disabled={savingId === account.id} onChange={(event) => void setRole(account, event.target.value as ManagedAccountRole)}><option value="student">Học sinh</option><option value="teacher">Giáo viên</option></select>}</div></article>)}
          {!loading && !visibleAccounts.length && <div className="admin-empty">Không tìm thấy tài khoản phù hợp.</div>}
        </div>
      </section>
    </section>
  </main>;
}
