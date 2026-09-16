/**
 * Выбранная точка салона — одно место на весь кабинет.
 *
 * Сначала переключатель стоял отдельно на списке записей и на списке
 * мастеров. Это были два независимых выбора: перешёл на другой экран —
 * и снова смотришь всё вместе. Владелец сказал прямо, что имел в виду
 * не фильтр, а переход, и он прав: точка — это то, где ты сейчас
 * находишься, а не то, как отсортирован один список.
 *
 * Поэтому выбор живёт здесь и переживает переход между экранами. Хранится
 * рядом с выбранным салоном, в той же памяти браузера: салон и точка —
 * один вопрос «где я», разносить их по разным местам незачем.
 *
 * Значения:
 *   ''       — все точки;
 *   'salon'  — главный адрес (у записи и у мастера там пусто);
 *   <id>     — филиал.
 */

const CURRENT_POINT_KEY = 'glamour_current_point_id';

/** Событие для экранов, открытых в момент переключения. */
const POINT_CHANGED = 'glamour:point-changed';

export function readCurrentPoint(): string {
  try {
    return localStorage.getItem(CURRENT_POINT_KEY) ?? '';
  } catch {
    // Приватное окно или запрет на хранилище: живём без памяти,
    // показываем всё. Ломать кабинет из-за этого нельзя.
    return '';
  }
}

export function writeCurrentPoint(value: string): void {
  try {
    if (value) {
      localStorage.setItem(CURRENT_POINT_KEY, value);
    } else {
      localStorage.removeItem(CURRENT_POINT_KEY);
    }
  } catch {
    // См. выше: без памяти выбор проживёт до перехода на другой экран.
  }

  window.dispatchEvent(new Event(POINT_CHANGED));
}

/** Подписка экрана на переключение. Возвращает отписку. */
export function onPointChanged(handler: () => void): () => void {
  window.addEventListener(POINT_CHANGED, handler);

  return () => window.removeEventListener(POINT_CHANGED, handler);
}

/**
 * Подходит ли запись (или мастер) выбранной точке.
 *
 * Пустая точка у записи значит главный адрес — это ответ, а не пропуск,
 * поэтому 'salon' сравнивается именно с пустотой.
 */
export function matchesPoint(
  chosen: string,
  locationId: string | null | undefined,
): boolean {
  if (!chosen) {
    return true;
  }

  if (chosen === 'salon') {
    return !locationId;
  }

  return locationId === chosen;
}
