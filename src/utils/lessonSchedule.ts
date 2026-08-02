export function toDateTimeLocalValue(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function getInitialReleaseLocalValue(existingReleaseAt?: string, now = new Date()) {
  return toDateTimeLocalValue(existingReleaseAt ?? now.toISOString());
}

export function toFutureReleaseIso(value: string, now = new Date()) {
  const releaseAt = new Date(value);
  if (!value || Number.isNaN(releaseAt.getTime())) throw new Error('Hãy chọn ngày giờ mở bài hợp lệ.');
  if (releaseAt.getTime() <= now.getTime()) {
    if (now.getTime() - releaseAt.getTime() < 120_000) return now.toISOString();
    throw new Error('Thời gian mở bài phải ở tương lai.');
  }
  return releaseAt.toISOString();
}
