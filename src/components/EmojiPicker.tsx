/**
 * Набор смайликов.
 *
 * Своя сетка, а не готовая библиотека: полный набор Unicode весит
 * несколько сотен килобайт и грузится на телефоне заметно дольше,
 * чем открывается сам чат. Здесь то, чем пишут в салоне каждый день.
 */
const GROUPS: { key: string; emojis: string[] }[] = [
  {
    key: 'faces',
    emojis: [
      '🙂', '😊', '😁', '😄', '😅', '😂', '🥰', '😍',
      '😘', '😉', '🤗', '🤔', '😐', '😴', '😌', '🙃',
      '😢', '😭', '😱', '😳', '🥺', '😤', '😎', '🤩',
    ],
  },
  {
    key: 'hands',
    emojis: [
      '👍', '👎', '👌', '🤝', '👏', '🙏', '💪', '✌️',
      '👋', '🤞', '☝️', '✍️',
    ],
  },
  {
    key: 'beauty',
    emojis: [
      '💅', '💇', '💆', '💄', '✂️', '🪮', '🧴', '🧖',
      '💈', '🪞', '👑', '💍', '👗', '👠', '🌸', '🌺',
      '🌷', '🌹', '✨', '💫', '⭐', '🔥', '💎', '🎀',
    ],
  },
  {
    key: 'other',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔',
      '🎉', '🎁', '🎂', '☕', '🍰', '🍾', '📅', '⏰',
      '📍', '📞', '✅', '❌', '❗', '❓', '💰', '🚗',
    ],
  },
];

type Props = {
  onPick: (emoji: string) => void;
};

function EmojiPicker({ onPick }: Props) {
  return (
    <div
      style={{
        maxHeight: 210,
        overflowY: 'auto',
        padding: 10,
        borderRadius: 14,
        border: '1px solid var(--app-border)',
        background: 'var(--app-panel)',
      }}
    >
      {GROUPS.map((group) => (
        <div key={group.key} style={{ marginBottom: 6 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))',
              gap: 2,
            }}
          >
            {group.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
                style={{
                  minHeight: 38,
                  border: 0,
                  borderRadius: 10,
                  background: 'transparent',
                  fontSize: 21,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default EmojiPicker;
