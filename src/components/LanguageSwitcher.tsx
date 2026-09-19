import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Globe } from 'lucide-react';

import { headerPill } from './headerControls';
import { DEFAULT_LANGUAGE, READY_LANGUAGES } from '../i18n/languages';

/**
 * Выбор языка.
 *
 * Раньше три языка стояли в ряд отдельными кнопками. Это работало,
 * пока их было три; на восьми ряд не поместится ни в шапку кабинета,
 * ни в телефон. Значит — список.
 *
 * Список нарочно сделан на обычном `select`, а не нарисован вручную.
 * На телефоне браузер покажет свой родной выбор во весь экран, пальцем
 * по нему попасть легче, чем по нарисованному; с клавиатуры он работает
 * сам; и его не обрежет шапка, как обрезала бы выпадающую коробку.
 *
 * Сам `select` невидим и лежит поверх кнопки: так закрытая кнопка
 * показывает то, что нужно нам — глобус, код языка и уголок — и не
 * меняет ширину от того, что «Українська» длиннее «English». Открытый
 * список показывает названия целиком, каждое на своём языке.
 */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [focused, setFocused] = useState(false);

  const current = i18n.language?.slice(0, 2) ?? 'ru';

  // Если в хранилище браузера остался язык, которого в списке больше
  // нет, кнопка не должна опустеть: показываем язык площадки.
  const active =
    READY_LANGUAGES.find((one) => one.code === current) ?? DEFAULT_LANGUAGE;

  function changeLanguage(code: string) {
    void i18n.changeLanguage(code);
    localStorage.setItem('glamour_language', code);
  }

  const box: CSSProperties = {
    ...headerPill,
    position: 'relative',
    gap: 6,
    padding: '0 10px',
    cursor: 'pointer',
    // Рамка при переходе с клавиатуры: сам `select` невидим, и без
    // этого не было бы видно, что выбор языка сейчас под руками.
    boxShadow: focused ? '0 0 0 2px var(--app-accent)' : 'none',
  };

  // Ключ уже есть в словарях: «Язык».
  const label = t('language.select');

  return (
    <div style={box} title={active.name}>
      <Globe size={18} color="var(--app-text-muted)" aria-hidden="true" />

      <span style={CODE}>{active.code.toUpperCase()}</span>

      <ChevronDown size={14} color="var(--app-text-muted)" aria-hidden="true" />

      <select
        value={active.code}
        onChange={(event) => changeLanguage(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={label}
        style={HIDDEN_SELECT}
      >
        {READY_LANGUAGES.map((one) => (
          <option key={one.code} value={one.code}>
            {one.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Код языка на кнопке — теми же буквами, что были на старых кнопках. */
const CODE: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: 'var(--app-text)',
  lineHeight: 1,
};

/**
 * Настоящий `select`, растянутый на всю кнопку и прозрачный.
 *
 * Размер шрифта 16 не случаен: на iPhone Safari приближает страницу,
 * если у поля шрифт мельче, — и не смотрит на то, что поле невидимо.
 */
const HIDDEN_SELECT: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0,
  border: 0,
  opacity: 0,
  appearance: 'none',
  background: 'transparent',
  fontSize: 16,
  cursor: 'pointer',
};
