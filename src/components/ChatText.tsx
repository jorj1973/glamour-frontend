import type { ReactNode } from 'react';

/**
 * Ссылки, почта и телефоны в тексте сообщения.
 *
 * Люди присылают друг другу адрес салона, ссылку на образец причёски
 * и номер, по которому перезвонить. Пока это был обычный текст, его
 * приходилось выделять и копировать — а на телефоне это отдельное
 * упражнение с лупой.
 *
 * Разбираем текст на части и подменяем узлами, а не вставляем разметку
 * строкой: сообщение пишет человек, и всё, что он написал, обязано
 * остаться текстом, что бы он туда ни вложил.
 */

/**
 * Три вида разом, потому что порядок важен.
 *
 * Почта должна проверяться раньше телефона, иначе «+373...» внутри
 * адреса разорвётся пополам; ссылка — раньше почты, иначе адрес
 * внутри ссылки уведёт на почтовую программу.
 */
const PATTERN = new RegExp(
  [
    // Ссылка: с протоколом или начинающаяся с www.
    'https?://[^\\s<>()]+',
    'www\\.[^\\s<>()]+',
    // Почта.
    '[^\\s<>()@]+@[^\\s<>()@]+\\.[a-zA-Z]{2,}',
    /**
     * Телефон: международный с плюсом или местный с нуля.
     *
     * Точка сюда не входит намеренно. С ней «05.09.2026» проходит
     * как номер, и дата в сообщении превращается в ссылку «позвонить».
     */
    '\\+\\d[\\d\\s()-]{7,17}\\d',
    '\\b0\\d[\\d\\s()-]{6,14}\\d',
  ].join('|'),
  'g',
);

/** Сколько в найденном настоящих цифр. */
function digitsIn(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/** Убрать хвостовые знаки препинания, приклеившиеся к ссылке. */
function trimTail(value: string): { body: string; tail: string } {
  const match = value.match(/[.,;:!?)»"']+$/);

  if (!match) {
    return { body: value, tail: '' };
  }

  return {
    body: value.slice(0, value.length - match[0].length),
    tail: match[0],
  };
}

function isEmail(value: string): boolean {
  return value.includes('@');
}

function isPhone(value: string): boolean {
  return /^[+0]/.test(value) && !value.includes('@');
}

/**
 * Куда ведёт найденное.
 *
 * Телефон чистим от пробелов и скобок: набирать по нему будет
 * телефон, а не человек, и красота записи ему только мешает.
 */
function hrefFor(value: string): string {
  if (isEmail(value)) {
    return 'mailto:' + value;
  }

  if (isPhone(value)) {
    return 'tel:' + value.replace(/[^\d+]/g, '');
  }

  return value.startsWith('www.') ? 'https://' + value : value;
}

const linkStyle = {
  color: 'var(--app-accent-text)',
  textDecoration: 'underline',
  wordBreak: 'break-word' as const,
};

function ChatText({ text }: { text: string }) {
  const parts: ReactNode[] = [];

  let cursor = 0;
  let found: RegExpExecArray | null;

  PATTERN.lastIndex = 0;

  while ((found = PATTERN.exec(text)) !== null) {
    const { body, tail } = trimTail(found[0]);

    // Слишком короткий остаток после обрезки — значит это была
    // не ссылка, а знаки препинания. Оставляем текстом.
    if (body.length < 4) {
      continue;
    }

    // Номер короче восьми цифр — это не номер, а какое-то число.
    if (isPhone(body) && digitsIn(body) < 8) {
      continue;
    }

    if (found.index > cursor) {
      parts.push(text.slice(cursor, found.index));
    }

    parts.push(
      <a
        key={found.index}
        href={hrefFor(body)}
        target={isPhone(body) || isEmail(body) ? undefined : '_blank'}
        rel="noreferrer"
        // Нажатие на ссылку — это переход, а не выбор сообщения:
        // без этого заодно открывалось бы меню действий.
        onClick={(event) => event.stopPropagation()}
        style={linkStyle}
      >
        {body}
      </a>,
    );

    if (tail) {
      parts.push(tail);
    }

    cursor = found.index + found[0].length;
  }

  if (cursor === 0) {
    return <>{text}</>;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}

export default ChatText;
