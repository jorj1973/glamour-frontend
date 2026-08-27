import type { CSSProperties } from 'react';

/**
 * Общий размер для всего, что стоит в шапке кабинета.
 *
 * Языки, тема, общение, колокольчик и выход — пять разных
 * составляющих, но в ряду они читаются как один набор. Пока размеры
 * жили в каждом файле по отдельности, они разъезжались: пилюли были
 * на тридцать шесть, значки на сорок четыре, и линия выходила рваной.
 * Держим их здесь, в одном месте.
 */
export const HEADER_CONTROL_HEIGHT = 44;

/** Скругление внешней коробки. */
export const HEADER_CONTROL_RADIUS = 14;

/** Высота кнопки внутри пилюли: 1 + 4 + 34 + 4 + 1 = 44. */
export const HEADER_SEGMENT_HEIGHT = 34;

/** Внешняя коробка: одна рамка, одна заливка, одно скругление. */
export const headerControlBox: CSSProperties = {
  height: HEADER_CONTROL_HEIGHT,
  border: '1px solid var(--app-border)',
  borderRadius: HEADER_CONTROL_RADIUS,
  background: 'var(--app-input)',
  boxSizing: 'border-box',
  flexShrink: 0,
};

/** Пилюля из нескольких кнопок: языки, тема. */
export const headerPill: CSSProperties = {
  ...headerControlBox,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  padding: 4,
};

/** Кнопка внутри пилюли. */
export function headerSegment(isActive: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 38,
    height: HEADER_SEGMENT_HEIGHT,
    padding: 0,
    border: 0,
    borderRadius: 11,
    background: isActive ? 'var(--app-accent)' : 'transparent',
    color: isActive ? '#17151c' : 'var(--app-text-muted)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    transition: 'background 0.2s, color 0.2s',
  };
}

/** Одиночный значок: общение, колокольчик, выход. */
export const headerIconButton: CSSProperties = {
  ...headerControlBox,
  position: 'relative',
  width: HEADER_CONTROL_HEIGHT,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  color: 'var(--app-text)',
  cursor: 'pointer',
};

/** Размер значка внутри такой кнопки. */
export const HEADER_ICON_SIZE = 20;
