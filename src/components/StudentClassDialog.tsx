import { useState } from "react";
import type { CloudClassroom } from "../utils/cloudClassroom";
import { joinClassroom } from "../utils/cloudClassroom";
import { canSubmitClassCode, normalizeClassCode } from "../utils/classCode";
import { shouldSubmitOnEnter } from "../utils/submitOnEnter";

export function StudentClassDialog({ classes, activeClassId, onSelectClass, onJoined, onClose }: {
  classes: CloudClassroom[];
  activeClassId: string | null;
  onSelectClass: (classId: string) => void;
  onJoined: (classId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const join = async () => {
    if (!canSubmitClassCode(code)) return;
    setBusy(true);
    setError("");
    try {
      const classId = await joinClassroom(normalizeClassCode(code));
      await onJoined(classId);
      setCode("");
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Mã lớp không đúng hoặc đã hết hiệu lực.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lesson-creator-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="lesson-creator student-class-dialog">
        <header><div><span>LỚP HỌC CỦA TÔI</span><h2>Chọn lớp để học</h2></div><button disabled={busy} onClick={onClose}>×</button></header>
        <div className="student-class-list">
          {classes.map((classroom) => (
            <button key={classroom.id} disabled={busy} className={classroom.id === activeClassId ? "active" : ""} onClick={() => onSelectClass(classroom.id)}>
              <span><b>{classroom.name}</b><small>{classroom.description || "Lớp học đang tham gia"}</small></span>
              <em>{classroom.id === activeClassId ? "Đang học" : "Chọn lớp"}</em>
            </button>
          ))}
        </div>
        <div className="student-join-another">
          <b>Tham gia lớp khác</b>
          <p>Nhập mã mới do giáo viên cung cấp. Các lớp đã tham gia vẫn được giữ nguyên.</p>
          <label>Mã lớp<input minLength={8} maxLength={64} value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => {
            if (shouldSubmitOnEnter({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing }, false) && !busy && canSubmitClassCode(code)) {
              event.preventDefault();
              void join();
            }
          }} placeholder="Nhập mã lớp" /></label>
          {error && <p className="creator-error">{error}</p>}
          <button className="auth-primary" disabled={busy || !canSubmitClassCode(code)} onClick={() => void join()}>{busy ? "Đang tham gia…" : "＋ Tham gia lớp"}</button>
        </div>
      </section>
    </div>
  );
}
