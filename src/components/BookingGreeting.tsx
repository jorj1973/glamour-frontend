import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'glamour_greeting_seen';

/** Сетка распада: четыре на четыре — шестнадцать кусочков. */
const COLUMNS = 4;
const ROWS = 4;

/** Задержка перед появлением: страница успевает отрисоваться. */
const APPEAR_MS = 200;

/** Сколько окно держится целым, прежде чем начать распадаться. */
const SHOW_MS = 800;

/** Сколько гаснет рамка. */
const FADE_MS = 300;

/** Промежуток между вылетами. */
const STAGGER_MS = 135;

/**
 * Сколько летит один кусок.
 *
 * Ровно пять промежутков: пока летит первый, стартуют ещё
 * четыре — в воздухе всегда пятеро, не больше.
 */
const FLIGHT_MS = STAGGER_MS * 5;

const TILE_COUNT = COLUMNS * ROWS;

/** Весь распад: три секунды. */
const DISSOLVE_MS = FADE_MS + (TILE_COUNT - 1) * STAGGER_MS + FLIGHT_MS;

/**
 * Силуэт бабочки для обрезки куска.
 *
 * Кусок не заменяется отдельной фигуркой, а сам принимает форму
 * бабочки — вместе со своей частью текста и фона. Поэтому нужна
 * маска, а не рисунок поверх.
 */
const BUTTERFLY_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cg fill='%23000'%3E%3Cellipse cx='9.5' cy='12' rx='8' ry='6.4' transform='rotate(-24 9.5 12)'/%3E%3Cellipse cx='22.5' cy='12' rx='8' ry='6.4' transform='rotate(24 22.5 12)'/%3E%3Cellipse cx='11.5' cy='21.5' rx='5.8' ry='5.2' transform='rotate(18 11.5 21.5)'/%3E%3Cellipse cx='20.5' cy='21.5' rx='5.8' ry='5.2' transform='rotate(-18 20.5 21.5)'/%3E%3Crect x='14.9' y='6.5' width='2.2' height='19' rx='1.1'/%3E%3C/g%3E%3C/svg%3E\")";

/** Разлёт куска и покачивание крыльев. */
const KEYFRAMES = `
@keyframes glamour-piece-fly {
  0% {
    transform: translate(0, 0) rotate(0deg) scale(1);
    opacity: 1;
  }

  55% {
    opacity: 1;
  }

  100% {
    transform: translate(var(--gl-dx), var(--gl-dy)) rotate(var(--gl-spin))
      scale(0.35);
    opacity: 0;
  }
}

@keyframes glamour-piece-flutter {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0.62);
  }
}
`;

type Props = {
  text: string;
  hint?: string;
};

type Tile = {
  key: string;
  row: number;
  column: number;
  delay: number;
  driftX: string;
  riseY: string;
  spin: string;
};

/**
 * Часть окна, приходящаяся на один кусок.
 *
 * Внутри каждого куска лежит полное окно, сдвинутое так, чтобы
 * в прорезь попал нужный участок. Поэтому кусок уносит с собой
 * и фон, и попавшую на него часть текста.
 */
function WindowFace({
  text,
  hint,
  row,
  column,
}: {
  text: string;
  hint?: string;
  row: number;
  column: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        width: COLUMNS * 100 + '%',
        height: ROWS * 100 + '%',
        left: -column * 100 + '%',
        top: -row * 100 + '%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 34px',
        boxSizing: 'border-box',
        textAlign: 'center',
        background: 'var(--app-panel)',
      }}
    >
      <p
        style={{
          margin: 0,
          color: 'var(--app-text)',
          fontSize: 30,
          fontWeight: 800,
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
        }}
      >
        {text}
      </p>

      {hint && (
        <p
          style={{
            margin: '14px 0 0',
            color: 'var(--app-text-muted)',
            fontSize: 20,
            lineHeight: 1.55,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function BookingGreeting({ text, hint }: Props) {
  const [phase, setPhase] = useState<'hidden' | 'shown' | 'dissolving' | 'gone'>(
    'hidden',
  );

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      setPhase('gone');

      return;
    }

    localStorage.setItem(STORAGE_KEY, '1');

    const appear = setTimeout(() => setPhase('shown'), APPEAR_MS);

    const dissolve = setTimeout(
      () => setPhase('dissolving'),
      APPEAR_MS + SHOW_MS,
    );

    const finish = setTimeout(
      () => setPhase('gone'),
      APPEAR_MS + SHOW_MS + DISSOLVE_MS + 150,
    );

    // Кто спешит — обрывает нажатием, ждать не заставляем.
    function hurry() {
      setPhase((current) => (current === 'shown' ? 'dissolving' : current));
    }

    window.addEventListener('pointerdown', hurry);

    return () => {
      clearTimeout(appear);
      clearTimeout(dissolve);
      clearTimeout(finish);
      window.removeEventListener('pointerdown', hurry);
    };
  }, []);

  /**
   * Кусочки в порядке вылета: сверху вниз, слева направо.
   *
   * Смещения взяты из координат, а не из случайных чисел: при
   * повторной отрисовке кусок не должен прыгать на другую
   * траекторию.
   */
  const tiles = useMemo(() => {
    const result: Tile[] = [];

    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        const index = row * COLUMNS + column;
        const seed = (row * 31 + column * 17) % 97;

        result.push({
          key: row + '-' + column,
          row,
          column,
          delay: FADE_MS + index * STAGGER_MS,
          driftX: (seed % 9) * 16 - 64 + '%',
          riseY: -(240 + (seed % 11) * 28) + '%',
          spin: (seed % 7) * 7 - 21 + 'deg',
        });
      }
    }

    return result;
  }, []);

  if (phase === 'gone' || phase === 'hidden') {
    return null;
  }

  const isDissolving = phase === 'dissolving';

  const cellStyle = (tile: Tile) => ({
    position: 'absolute' as const,
    left: (tile.column / COLUMNS) * 100 + '%',
    top: (tile.row / ROWS) * 100 + '%',
    width: 100 / COLUMNS + '%',
    height: 100 / ROWS + '%',
    overflow: 'hidden' as const,
  });

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* Затемнение: без него окно теряется среди содержимого
          страницы, и время уходит на поиск, а не на чтение. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 899,
          background: 'rgba(0, 0, 0, 0.6)',
          opacity: isDissolving ? 0 : 1,
          transition: 'opacity ' + DISSOLVE_MS / 1000 + 's ease',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 900,
          width: 'min(92vw, 460px)',
          aspectRatio: '1 / 1',
          pointerEvents: 'none',
        }}
      >
        {/* Целое окно: шестнадцать кусков, сложенных встык. Каждый
            показывает свой участок, вместе они дают сплошное
            полотно с текстом. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          {tiles.map((tile) => (
            <span
              key={tile.key}
              style={{
                ...cellStyle(tile),
                // Кусок пропадает мгновенно — ровно тогда, когда
                // на его месте появляется тот же кусок в форме
                // бабочки и начинает подниматься.
                opacity: isDissolving ? 0 : 1,
                transition: 'opacity 0s linear ' + tile.delay + 'ms',
              }}
            >
              <WindowFace
                text={text}
                hint={hint}
                row={tile.row}
                column={tile.column}
              />
            </span>
          ))}
        </div>

        {/* Оправа в цвете приложения. Гаснет первой, освобождая
            куски — иначе они улетали бы из-под рамки. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 24,
            border: '2px solid var(--app-accent)',
            boxShadow:
              '0 0 0 1px rgba(var(--app-accent-rgb), 0.28), 0 30px 80px rgba(0, 0, 0, 0.5)',
            opacity: isDissolving ? 0 : 1,
            transition: 'opacity ' + FADE_MS / 1000 + 's ease',
            pointerEvents: 'none',
          }}
        />

        {/* Улетающие куски. Слой не обрезан, поэтому они уходят
            за границы окна. */}
        {isDissolving && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }}
          >
            {tiles.map((tile) => (
              <span
                key={tile.key}
                style={
                  {
                    ...cellStyle(tile),
                    overflow: 'visible',
                    // До своей очереди кусок невидим: на его месте
                    // ещё лежит целая часть полотна.
                    opacity: 0,
                    animation:
                      'glamour-piece-fly ' +
                      FLIGHT_MS +
                      'ms cubic-bezier(0.25, 0.6, 0.35, 1) ' +
                      tile.delay +
                      'ms forwards',
                    '--gl-dx': tile.driftX,
                    '--gl-dy': tile.riseY,
                    '--gl-spin': tile.spin,
                  } as React.CSSProperties
                }
              >
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden',
                    transformOrigin: 'center',
                    // Маска режет кусок по силуэту бабочки вместе
                    // с его содержимым.
                    WebkitMaskImage: BUTTERFLY_MASK,
                    maskImage: BUTTERFLY_MASK,
                    WebkitMaskSize: '132%',
                    maskSize: '132%',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    animation:
                      'glamour-piece-flutter 0.3s ease-in-out infinite alternate',
                  }}
                >
                  <WindowFace
                    text={text}
                    hint={hint}
                    row={tile.row}
                    column={tile.column}
                  />
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default BookingGreeting;
