/**
 * Строит короткую ссылку на живой отчёт мероприятия.
 * Ссылка ведёт прямо к документу владельца в Firestore: /share/{uid}/{eventId}.
 * Получатель всегда видит актуальные данные (читаются из Firestore при открытии).
 */
export function buildShareUrl(uid: string, eventId: string): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}share`
  return `${base}/${uid}/${eventId}`
}
