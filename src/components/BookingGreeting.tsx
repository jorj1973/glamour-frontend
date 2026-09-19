import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'glamour_greeting_seen';

/** Задержка перед появлением: страница успевает отрисоваться. */
const APPEAR_MS = 200;

/** Сколько окно держится целым, чтобы его успели прочитать. */
const SHOW_MS = 900;

/** Сколько гаснет само окно. */
const CARD_MS = 1100;

/** Бабочек: четыре на четыре — по одной на каждый участок окна. */
const COLUMNS = 4;
const ROWS = 4;

/** Самый поздний вылет и самый долгий полёт. */
const LAST_DELAY_MS = 7 * 70 + 2 * 40;
const LONGEST_FLIGHT_MS = 1900 + 4 * 170;

/** Весь разлёт. */
const DISSOLVE_MS = LAST_DELAY_MS + LONGEST_FLIGHT_MS;

/**
 * Бабочки вместо распада окна.
 *
 * Раньше окно резалось на шестнадцать кусков, и каждый кусок —
 * вместе со своим обрывком текста и фона — обрезался по силуэту
 * бабочки. В полёте это читалось не как бабочки, а как непонятные
 * лоскуты: слишком мелко, чтобы разглядеть форму, и слишком пёстро,
 * чтобы принять её на веру. Взмах там был сжатием всего лоскута по
 * горизонтали.
 *
 * Теперь окно гаснет целиком, а из него разлетаются настоящие
 * бабочки: два верхних крыла, два нижних, тельце, усики. Крылья
 * складываются не до конца (до 45 сотых), потому что сложенная
 * бабочка в тридцать пикселей выглядит палочкой — а человек видит её
 * именно в тот миг, когда она сложена.
 *
 * Каждая начинает с того места окна, за которое «отвечала», и уходит
 * прочь от середины: кажется, что окно рассыпалось ими. Гаснут они не
 * разом, а последней третью пути.
 *
 * Разгон у кривой полёта нарочно вялый: `0.496` вместо `0.62` — это
 * ровно на пятую часть меньшая скорость в первый миг. Бабочка,
 * прыгающая с места, читается как брызги, а не как полёт.
 */

const STYLES = `
@keyframes glamour-bf-fly {
  0% {
    transform: translate(calc(-50% + var(--bf-sx)), calc(-50% + var(--bf-sy)))
      scale(0.55);
    opacity: 0;
  }

  14% {
    opacity: 1;
  }

  66% {
    opacity: 1;
  }

  100% {
    transform: translate(
        calc(-50% + var(--bf-sx) + var(--bf-dx)),
        calc(-50% + var(--bf-sy) + var(--bf-dy))
      )
      rotate(var(--bf-spin)) scale(1);
    opacity: 0;
  }
}

@keyframes glamour-bf-bob {
  from {
    transform: translateY(-7px) rotate(-7deg);
  }

  to {
    transform: translateY(7px) rotate(7deg);
  }
}

@keyframes glamour-bf-flap {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0.45);
  }
}

@keyframes glamour-bf-card {
  to {
    opacity: 0;
    transform: scale(0.94);
  }
}

.glamour-bf {
  position: absolute;
  left: 50%;
  top: 50%;
  opacity: 0;
  animation: glamour-bf-fly var(--bf-dur) cubic-bezier(0.16, 0.496, 0.28, 1)
    var(--bf-delay) forwards;
}

.glamour-bf-bob {
  display: block;
  animation: glamour-bf-bob var(--bf-bob) ease-in-out infinite alternate;
}

.glamour-bf svg {
  display: block;
  overflow: visible;
}

.glamour-bf-wing {
  transform-box: view-box;
  transform-origin: 22px 19px;
  animation: glamour-bf-flap var(--bf-flap) ease-in-out infinite alternate;
}
`;

type Props = {
  text: string;
  hint?: string;
};

type Butterfly = {
  key: string;
  size: number;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  spin: number;
  delay: number;
  duration: number;
  bob: number;
  flap: number;
};

/** Крылья, тельце и усики. Одна фигура на всех, размер задаёт полёт. */
function Wings({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={Math.round((size * 40) / 44)}
      viewBox="0 0 44 40"
      aria-hidden="true"
    >
      <g className="glamour-bf-wing">
        <path
          d="M22 19 C 15 3, 3 2, 2.5 11 C 2 18, 12 21, 22 19 Z"
          fill="#f3b9d8"
        />
        <path
          d="M22 19 C 16 23, 8 25, 9 31 C 10 36, 19 28, 22 19 Z"
          fill="#d98ab9"
        />
        <circle cx="9" cy="10.5" r="1.7" fill="#e8c27a" opacity="0.85" />
      </g>

      <g className="glamour-bf-wing">
        <path
          d="M22 19 C 29 3, 41 2, 41.5 11 C 42 18, 32 21, 22 19 Z"
          fill="#f3b9d8"
        />
        <path
          d="M22 19 C 28 23, 36 25, 35 31 C 34 36, 25 28, 22 19 Z"
          fill="#d98ab9"
        />
        <circle cx="35" cy="10.5" r="1.7" fill="#e8c27a" opacity="0.85" />
      </g>

      <path
        d="M22 10 C 22.9 10, 23.2 11.6, 23.1 13.6 L 22.6 26 C 22.5 27.2, 21.5
           27.2, 21.4 26 L 20.9 13.6 C 20.8 11.6, 21.1 10, 22 10 Z"
        fill="#3a2f42"
      />
      <circle cx="22" cy="10.6" r="1.5" fill="#3a2f42" />

      <path
        d="M21.2 9.6 C 19.4 6.2, 17.6 5.2, 16.2 4.9"
        stroke="#3a2f42"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M22.8 9.6 C 24.6 6.2, 26.4 5.2, 27.8 4.9"
        stroke="#3a2f42"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="15.9" cy="4.8" r="1" fill="#3a2f42" />
      <circle cx="28.1" cy="4.8" r="1" fill="#3a2f42" />
    </svg>
  );
}

function BookingGreeting({ text, hint }: Props) {
  const [phase, setPhase] = useState<'hidden' | 'shown' | 'dissolving' | 'gone'>(
    'hidden',
  );

  /**
   * Кому движение мешает, тому его не показываем.
   *
   * Настройка стоит в самой системе, и просят её не от придирчивости:
   * у части людей от разлетающегося по экрану кружится голова.
   * Приветствие им просто погаснет.
   */
  const calm = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
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
      APPEAR_MS + SHOW_MS + (calm ? CARD_MS : DISSOLVE_MS) + 150,
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
  }, [calm]);

  /**
   * Где какая бабочка родилась и куда полетела.
   *
   * Числа берутся из её места в сетке, а не из случайных: при
   * повторной отрисовке бабочка не должна прыгать на другую
   * траекторию посреди полёта.
   */
  const butterflies = useMemo(() => {
    const result: Butterfly[] = [];

    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        const index = row * COLUMNS + column;
        const seed = (row * 31 + column * 17) % 97;

        const startX = (column - (COLUMNS - 1) / 2) * 92 + (seed % 5) * 6 - 12;
        const startY = (row - (ROWS - 1) / 2) * 92 + (seed % 7) * 5 - 15;

        // Прочь от середины: чем дальше стояла, тем круче в сторону.
        const length = Math.max(1, Math.hypot(startX, startY));
        const distance = 165 + (seed % 7) * 26;

        result.push({
          key: row + '-' + column,
          // На пять сотых крупнее: в полёте мельче кажется, чем в покое.
          size: Math.round((32 + (seed % 5) * 5) * 1.05),
          startX: Math.round(startX),
          startY: Math.round(startY),
          driftX: Math.round((startX / length) * distance),
          // Бабочки тянет вверх: вниз падают, вверх — улетают.
          driftY: Math.round((startY / length) * distance) - 70,
          spin: (seed % 9) * 8 - 32,
          delay: (index % 8) * 70 + (seed % 3) * 40,
          duration: 1900 + (seed % 5) * 170,
          bob: 700 + (seed % 5) * 90,
          flap: 240 + (seed % 6) * 30,
        });
      }
    }

    return result;
  }, []);

  if (phase === 'gone' || phase === 'hidden') {
    return null;
  }

  const isDissolving = phase === 'dissolving';

  return (
    <>
      <style>{STYLES}</style>

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
          transition:
            'opacity ' + (isDissolving ? DISSOLVE_MS * 0.7 : CARD_MS) / 1000 +
            's ease',
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
        {/* Само окно. Гаснет плавно и чуть уменьшается — как будто
            его разобрали и унесли. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 34px',
            boxSizing: 'border-box',
            textAlign: 'center',
            borderRadius: 24,
            border: '2px solid var(--app-accent)',
            background: 'var(--app-panel)',
            boxShadow:
              '0 0 0 1px rgba(var(--app-accent-rgb), 0.28), 0 30px 80px rgba(0, 0, 0, 0.5)',
            animation: isDissolving
              ? 'glamour-bf-card ' + CARD_MS + 'ms ease forwards'
              : undefined,
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

        {/* Бабочки. Слой не обрезан, поэтому они уходят за край окна
            и за край экрана. */}
        {isDissolving && !calm && (
          <div
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {butterflies.map((one) => (
              <span
                key={one.key}
                className="glamour-bf"
                style={
                  {
                    '--bf-sx': one.startX + 'px',
                    '--bf-sy': one.startY + 'px',
                    '--bf-dx': one.driftX + 'px',
                    '--bf-dy': one.driftY + 'px',
                    '--bf-spin': one.spin + 'deg',
                    '--bf-delay': one.delay + 'ms',
                    '--bf-dur': one.duration + 'ms',
                    '--bf-bob': one.bob + 'ms',
                    '--bf-flap': one.flap + 'ms',
                  } as React.CSSProperties
                }
              >
                <span className="glamour-bf-bob">
                  <Wings size={one.size} />
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
