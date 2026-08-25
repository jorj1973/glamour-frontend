import { AxiosError } from 'axios';

/**
 * Превращает ошибку запроса в ключ перевода.
 *
 * Бэкенд отвечает по-английски, поэтому его текст не показываем напрямую,
 * а сопоставляем с ключом словаря. Незнакомые случаи падают
 * в errors.unknown — лучше общая фраза, чем английская строка.
 */
export function getErrorKey(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string | string[] }>;

  if (!axiosError?.isAxiosError) {
    return 'errors.unknown';
  }

  // Сервер не ответил вовсе.
  if (!axiosError.response) {
    return 'errors.network';
  }

  const status = axiosError.response.status;

  const rawMessage = axiosError.response.data?.message;

  const message = Array.isArray(rawMessage)
    ? rawMessage.join(' ')
    : (rawMessage ?? '');

  const lower = message.toLowerCase();

  // Размер и формат файла определяем по тексту:
  // оба приходят с кодом 400.
  if (lower.includes('too large')) {
    return 'errors.fileTooLarge';
  }

  if (lower.includes('are allowed') || lower.includes('does not match')) {
    return 'errors.fileFormat';
  }

  if (lower.includes('portfolio is full')) {
    return 'errors.portfolioFull';
  }

  if (lower.includes('too many credentials')) {
    return 'errors.tooManyCredentials';
  }

  // Отзыв доступен только тем, кто действительно пользовался услугой:
  // общий «Доступ запрещён» здесь ничего не объясняет.
  if (lower.includes('app review requires completed service')) {
    return 'errors.reviewNeedsVisit';
  }

  if (lower.includes('salon review requires completed service')) {
    return 'errors.reviewNeedsSalonWork';
  }

  if (lower.includes('already reviewed this salon')) {
    return 'errors.salonAlreadyReviewed';
  }

  switch (status) {
    case 400:
      return 'errors.badRequest';
    case 401:
      return 'errors.sessionExpired';
    case 403:
      return 'errors.forbidden';
    case 404:
      return 'errors.notFound';
    case 409:
      return 'errors.conflict';
    case 413:
      return 'errors.fileTooLarge';
    case 429:
      return 'errors.tooManyRequests';
    default:
      return status >= 500 ? 'errors.server' : 'errors.unknown';
  }
}
