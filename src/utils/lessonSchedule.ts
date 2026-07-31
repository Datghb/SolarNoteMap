export function toFutureReleaseIso(value: string, now = new Date()) {
  const releaseAt = new Date(value);
  if (!value || Number.isNaN(releaseAt.getTime())) throw new Error('Hãy chọn ngày giờ mở bài hợp lệ.');
  if (releaseAt.getTime() <= now.getTime()) throw new Error('Thời gian mở bài phải ở tương lai.');
  return releaseAt.toISOString();
}
