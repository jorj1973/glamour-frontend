import { useEffect, useMemo, useState } from 'react';
import { Download, QrCode, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import qrcode from 'qrcode-generator';

/**
 * QR-код ссылки — в цветах приложения.
 *
 * Раньше здесь стоял совет сходить на чужой сайт и сделать код там.
 * Совет плохой по трём причинам сразу: человек уходит из кабинета,
 * копирует ссылку руками (и однажды скопирует не ту), и приносит
 * обратно код в чужих цветах.
 *
 * Рисуем сами. Ссылка берётся из той же строки, что показана рядом,
 * поэтому «код ведёт не туда» стать не может.
 *
 * Про цвета. Сканер читает не картинку, а тёмное на светлом, и наш
 * акцентный розовый на белом даёт всего 2,9:1 — дешёвый телефон
 * в полумраке такой код не возьмёт. Поэтому модули красим фоном
 * приложения #17151C (18:1, и это не чёрный — в нём лиловый подтон),
 * а фирменный розовый уходит в рамки трёх «глаз», где он ничем
 * не рискует. Узнаётся как наш, читается как чёрный.
 */

/** Модули кода. Тот же цвет, что фон приложения. */
const BODY = '#17151C';

/** Рамка «глаза». Розовый, различимый на белом. */
const EYE_FRAME = '#B0518C';

/** Зрачок «глаза» — снова тёмный: он часть данных наведения. */
const EYE_BALL = '#17151C';

/** Фон. Только белый: инвертированный код многие сканеры не видят. */
const BG = '#FFFFFF';

/** Тихая зона. Меньше четырёх модулей нельзя — это часть стандарта. */
const QUIET = 4;

/** Размер модуля в единицах вектора. */
const CELL = 10;

/** Пикселей на модуль в скачиваемой картинке. */
const PNG_SCALE = 40;

type Paths = { size: number; body: string; frame: string; ball: string };

/**
 * Внутри какого «глаза» лежит модуль.
 *
 * Три квадрата наведения стоят в углах, кроме правого нижнего.
 * Внешнее кольцо семь на семь — рамка, середина три на три — зрачок.
 */
function eyePart(n: number, r: number, c: number): 'frame' | 'ball' | null {
  const corners: [number, number][] = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];

  for (const [baseR, baseC] of corners) {
    const dr = r - baseR;
    const dc = c - baseC;

    if (dr >= 0 && dr < 7 && dc >= 0 && dc < 7) {
      return dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4 ? 'ball' : 'frame';
    }
  }

  return null;
}

/**
 * Три контура вместо тысячи квадратиков.
 *
 * Один код — это под тысячу модулей. Отдельным прямоугольником
 * на каждый браузер рисует медленно, а файл раздувается впятеро.
 * Собираем по контуру на цвет.
 */
function buildPaths(value: string): Paths {
  const qr = qrcode(0, 'H');

  qr.addData(value);
  qr.make();

  const n = qr.getModuleCount();
  const size = (n + QUIET * 2) * CELL;

  const parts = { body: '', frame: '', ball: '' };

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!qr.isDark(r, c)) {
        continue;
      }

      const x = (c + QUIET) * CELL;
      const y = (r + QUIET) * CELL;
      const piece = `M${x} ${y}h${CELL}v${CELL}h-${CELL}z`;

      const part = eyePart(n, r, c);

      if (part === 'ball') {
        parts.ball += piece;
      } else if (part === 'frame') {
        parts.frame += piece;
      } else {
        parts.body += piece;
      }
    }
  }

  return { size, ...parts };
}

/** Готовый файл для печати. */
function toSvg(p: Paths): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.size} ${p.size}" ` +
    `width="${p.size}" height="${p.size}" shape-rendering="crispEdges">` +
    `<rect width="${p.size}" height="${p.size}" fill="${BG}"/>` +
    `<path fill="${BODY}" d="${p.body}"/>` +
    `<path fill="${EYE_FRAME}" d="${p.frame}"/>` +
    `<path fill="${EYE_BALL}" d="${p.ball}"/>` +
    '</svg>'
  );
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = name;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  /** Освобождаем не сразу: Safari успевает не начать скачивание. */
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function downloadSvg(paths: Paths, name: string): void {
  saveBlob(new Blob([toSvg(paths)], { type: 'image/svg+xml' }), name + '.svg');
}

/**
 * Картинка рисуется по модулям, а не пересъёмкой вектора.
 *
 * Перерисовка вектора в растр даёт мыло по краям, а мыло на границах
 * модулей — первое, на чём спотыкается сканер при плохом свете.
 */
function downloadPng(value: string, name: string): void {
  const qr = qrcode(0, 'H');

  qr.addData(value);
  qr.make();

  const n = qr.getModuleCount();
  const side = (n + QUIET * 2) * PNG_SCALE;

  const canvas = document.createElement('canvas');

  canvas.width = side;
  canvas.height = side;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return;
  }

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, side, side);

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!qr.isDark(r, c)) {
        continue;
      }

      const part = eyePart(n, r, c);

      ctx.fillStyle =
        part === 'ball' ? EYE_BALL : part === 'frame' ? EYE_FRAME : BODY;

      ctx.fillRect(
        (c + QUIET) * PNG_SCALE,
        (r + QUIET) * PNG_SCALE,
        PNG_SCALE,
        PNG_SCALE,
      );
    }
  }

  canvas.toBlob((blob) => {
    if (blob) {
      saveBlob(blob, name + '.png');
    }
  }, 'image/png');
}

/** Имя файла из ссылки: латиница, цифры и дефис. */
function fileNameOf(value: string): string {
  const tail = value.split(/[/=?#]/).filter(Boolean).pop() ?? 'link';

  return 'glamour-qr-' + tail.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
}

type Props = {
  /** Что зашить в код. Ровно та ссылка, что показана рядом. */
  value: string;
  /** Ширина картинки на экране. */
  size?: number;
  /**
   * Показывать подсказку про визитку и зеркало.
   *
   * На карточке мастера она уже написана выше — повторять её под
   * кодом значит сказать человеку одно и то же дважды подряд.
   */
  hint?: boolean;
};

/**
 * Код и две кнопки скачивания.
 *
 * SVG — для типографии: он не мылится ни при каком увеличении.
 * PNG — для экрана, соцсетей и быстрой печати из дома.
 */
export function LinkQrCode({ value, size = 190, hint = true }: Props) {
  const { t } = useTranslation();

  const paths = useMemo(() => buildPaths(value), [value]);
  const name = useMemo(() => fileNameOf(value), [value]);

  const button = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 38,
    padding: '0 14px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 11,
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as const;

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div
        style={{
          padding: 10,
          borderRadius: 14,
          background: BG,
          lineHeight: 0,
          flexShrink: 0,
        }}
      >
        <svg
          viewBox={`0 0 ${paths.size} ${paths.size}`}
          width={size}
          height={size}
          shapeRendering="crispEdges"
          style={{ display: 'block' }}
        >
          <rect width={paths.size} height={paths.size} fill={BG} />
          <path fill={BODY} d={paths.body} />
          <path fill={EYE_FRAME} d={paths.frame} />
          <path fill={EYE_BALL} d={paths.ball} />
        </svg>
      </div>

      <div style={{ flex: '1 1 200px', minWidth: 180 }}>
        {hint && (
          <p
            style={{
              margin: '0 0 12px',
              color: 'var(--app-text-muted)',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {t('promotion.qrSubtitle')}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => downloadSvg(paths, name)}
            style={button}
          >
            <Download size={14} />
            {t('promotion.qrSvg')}
          </button>

          <button
            type="button"
            onClick={() => downloadPng(value, name)}
            style={button}
          >
            <Download size={14} />
            {t('promotion.qrPng')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Кнопка, раскрывающая код поверх экрана.
 *
 * Нужна там, где ссылок много: рисовать десяток кодов сразу значит
 * превратить список в мозаику, в которой не найти нужную строку.
 * Поверх экрана код ещё и крупнее — его показывают клиентке
 * с телефона, а не разглядывают в углу карточки.
 */
export function LinkQrButton({
  value,
  bare = false,
}: {
  value: string;
  /**
   * Кнопка без своей оболочки.
   *
   * В списке ссылок она встаёт внутрь готовой розовой плашки —
   * своя рамка поверх чужой выглядит как кнопка в кнопке.
   */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const trigger = bare
    ? ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 0,
        border: 0,
        background: 'none',
        color: 'inherit',
        font: 'inherit',
        fontWeight: 700,
        cursor: 'pointer',
      } as const)
    : ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 32,
        padding: '0 12px',
        border: '1px solid rgba(var(--app-accent-rgb), 0.25)',
        borderRadius: 10,
        background: 'rgba(var(--app-accent-rgb), 0.08)',
        color: 'var(--app-accent-strong)',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
      } as const);

  /** Escape закрывает: окно перекрывает список, выход должен быть всегда. */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} style={trigger}>
        <QrCode size={13} />
        {t('promotion.qrShort')}
      </button>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            background: 'rgba(12,10,15,0.72)',
          }}
        >
          {/* Клик по самому окну не должен его закрывать: человек
              целится в кнопку скачивания и промахивается. */}
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px 20px 22px',
              border: '1px solid var(--app-border)',
              borderRadius: 20,
              background: 'var(--app-panel)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <strong style={{ color: 'var(--app-text)', fontSize: 15 }}>
                {t('promotion.qrTitle')}
              </strong>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t('promotion.qrClose')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  border: '1px solid var(--app-border)',
                  borderRadius: 10,
                  background: 'transparent',
                  color: 'var(--app-text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            </div>

            <LinkQrCode value={value} size={220} />

            <p
              style={{
                margin: '16px 0 0',
                padding: '9px 12px',
                borderRadius: 10,
                background: 'var(--app-input)',
                color: 'var(--app-text-muted)',
                fontFamily: 'monospace',
                fontSize: 11,
                wordBreak: 'break-all',
              }}
            >
              {value}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default LinkQrCode;
