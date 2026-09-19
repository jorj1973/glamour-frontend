/**
 * Где живёт адрес страницы.
 *
 * До сих пор он жил целиком в хеше: `#salon/glamour`. Человеку разницы
 * нет, а поисковику есть, и решающая: всё, что после решётки, браузер
 * серверу не посылает вовсе. Гугл видел один адрес — glamourapp.md — и
 * одну страницу. Витрин у нас может быть сотня, а в поиске не было ни
 * одной.
 *
 * Теперь витрины живут в пути: `/salon/glamour`, `/master/<id>`,
 * `/try`. Старые адреса продолжают открываться и будут открываться
 * всегда: по ним напечатаны визитки и разосланы письма.
 *
 * Правило чтения одно и записано здесь: **непустой хеш главнее пути**.
 * Так кабинет, который ходит по хешам, работает поверх любого пути, а
 * витрина, открытая по чистому адресу, читается из пути. Второго
 * правила быть не должно — два правила про один адрес однажды
 * разойдутся.
 */

export type PublicAddress =
  | { kind: 'salon'; identifier: string }
  | { kind: 'master'; identifier: string }
  | { kind: 'try'; ref: string };

const SALON = /^\/salon\/([^/?#]+)\/?$/;
const MASTER = /^\/master\/([^/?#]+)\/?$/;

/**
 * Развернуть %-коды, не падая на кривых.
 *
 * Кривая последовательность приходит из пересланной ссылки, которую
 * мессенджер порезал на середине буквы. Берём как есть: сервер ответит
 * «такой ссылки нет», и это честнее, чем белый экран.
 */
function decode(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

/** Витрина, записанная путём. `null` — путь не витринный. */
export function addressFromPath(
  pathname: string = window.location.pathname,
  search: string = window.location.search,
): PublicAddress | null {
  const salon = pathname.match(SALON);

  if (salon) {
    return { kind: 'salon', identifier: decode(salon[1]) };
  }

  const master = pathname.match(MASTER);

  if (master) {
    return { kind: 'master', identifier: decode(master[1]) };
  }

  if (pathname === '/try' || pathname === '/try/') {
    return {
      kind: 'try',
      ref: (new URLSearchParams(search).get('ref') ?? '').trim(),
    };
  }

  return null;
}

/**
 * Строка, по которой приложение выбирает страницу.
 *
 * Приложение всю жизнь разбирало хеш, и переучивать его целиком незачем
 * — довольно перевести витринный путь в ту же запись. Разбор остаётся
 * один, а адресов у витрины теперь два.
 */
export function currentPageKey(): string {
  const hash = window.location.hash;

  if (hash) {
    return hash;
  }

  const address = addressFromPath();

  if (!address) {
    return '';
  }

  if (address.kind === 'try') {
    return address.ref
      ? '#try?ref=' + encodeURIComponent(address.ref)
      : '#try';
  }

  return '#' + address.kind + '/' + encodeURIComponent(address.identifier);
}
