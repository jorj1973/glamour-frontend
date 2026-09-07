/**
 * Последний салон, чья страница записи открылась удачно.
 *
 * Нужен там, где человеку надо предложить записаться снова, а ссылки
 * под рукой нет: в кабинете клиента, в отложенных записях и на экране
 * ошибки. Раньше эти места подставляли пустое значение в адрес и уводили
 * человека в тупик, из которого не было выхода.
 *
 * Хранится только у него в браузере и только двумя полями — код ссылки
 * и название салона. Ничего личного здесь нет.
 */

const LINK_KEY = 'glamour_booking_link';
const NAME_KEY = 'glamour_booking_salon';

export type LastSalon = {
  identifier: string;
  name: string;
};

/**
 * Короткий адрес записи.
 *
 * Без вопросительного знака: мессенджеры и почтовые клиенты режут адрес
 * именно по нему, и до салона доезжала половина ссылки. Прежняя форма
 * `#book?identifier=` продолжает работать — напечатанные визитки
 * и разосланные письма не должны перестать открываться.
 */
export function bookingUrl(
  identifier: string,
  fullChoice = false,
): string {
  const base = '/#salon/' + encodeURIComponent(identifier);

  // Полный выбор нужен там, где человек пришёл НЕ по чужой ссылке,
  // а сам: из своего кабинета или из отложенных. Ссылка мастера
  // в этом случае не должна навязывать ему этого мастера — он хочет
  // услугу, и мастера выбирает заново.
  return fullChoice ? base + '?all=1' : base;
}

/** Просили ли открыть запись без привязки к мастеру или услуге ссылки. */
export function wantsFullChoice(): boolean {
  const hash = window.location.hash;
  const mark = hash.indexOf('?');

  if (mark === -1) {
    return false;
  }

  return new URLSearchParams(hash.slice(mark + 1)).get('all') === '1';
}

export function readLastSalon(): LastSalon | null {
  try {
    const identifier = (
      localStorage.getItem(LINK_KEY) ?? ''
    ).trim();

    if (!identifier) {
      return null;
    }

    return {
      identifier,
      name: (localStorage.getItem(NAME_KEY) ?? '').trim(),
    };
  } catch {
    // Приватный режим браузера запрещает хранилище. Это не поломка:
    // просто предложить возврат будет нечем, и вызывающий покажет
    // подсказку вместо кнопки.
    return null;
  }
}

export function rememberLastSalon(
  identifier: string,
  name: string,
): void {
  try {
    localStorage.setItem(LINK_KEY, identifier);
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // См. выше. Не смогли запомнить — переживём.
  }
}
