import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import api from '../api/api';

/**
 * Срок подписки — так, чтобы его было видно кожей.
 *
 * До 2026-09-17 срок не кончался ни у кого: даты проставлялись при
 * одобрении и больше не читались. Теперь сервер считает состояние сам и
 * отдаёт число `alarm` от нуля до единицы; здесь оно только красится.
 * Своей арифметики тут нет нарочно — разойдись она с серверной, кабинет
 * покажет «два дня», сервер откажет в записи, и правы будут оба.
 *
 * Кому что видно — решение владельца площадки, и оно про людей, а не про
 * технику:
 *
 * — **владелец и администратор** видят всё: цвет, окно посередине и
 *   мигающее место, где платить. Платят они;
 * — **мастер** видит только спокойную полосу сверху. Кабинет открыт у
 *   него во время работы, и клиентка сидит рядом. Если она увидит, что у
 *   салона «не оплачено», салон потеряет лицо перед своим клиентом за наш
 *   долг — и обидится он на нас, а не на себя;
 * — **страница записи** не краснеет никогда: клиентка вообще не должна
 *   знать, что между салоном и нами что-то не так. Этот слой в неё и не
 *   попадает — она живёт вне кабинета.
 */

type SubscriptionState = {
  phase: 'pending' | 'trial' | 'paid' | 'grace' | 'limited' | 'stopped';
  until: string | null;
  daysLeft: number | null;
  appointmentsLeft: number | null;
  alarm: number;
};

type Props = {
  salonId: string;
  /** Владелец или администратор — тот, кто платит. */
  canPay: boolean;
};

const RED = '220, 38, 38';

function SubscriptionAlarm({ salonId, canPay }: Props) {
  const { t } = useTranslation();

  const [state, setState] = useState<SubscriptionState | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const response = await api.get<SubscriptionState>(
          `/salons/${salonId}/subscription`,
        );

        if (alive) {
          setState(response.data);
        }
      } catch {
        // Не смогли спросить — молчим. Пугать красным из-за оборванной
        // сети хуже, чем не сказать вовремя.
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [salonId]);

  if (!state || state.alarm <= 0) {
    return null;
  }

  const strong = state.phase === 'limited' || state.phase === 'stopped';

  const line =
    state.phase === 'grace'
      ? t('subscription.grace', { count: state.daysLeft ?? 0 })
      : state.phase === 'limited'
        ? t('subscription.limited', { count: state.appointmentsLeft ?? 0 })
        : state.phase === 'stopped'
          ? t('subscription.stopped')
          : t('subscription.endsIn', { count: state.daysLeft ?? 0 });

  return (
    <>
      {/*
        Заливка всего кабинета. Прозрачность растёт вместе с тревогой,
        поэтому переход от обычного цвета к красному получается плавным,
        а не «вчера было белое, сегодня красное».
      */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 40,
          background: `rgba(${RED}, ${(canPay ? 0.16 : 0.05) * state.alarm})`,
          boxShadow: canPay
            ? `inset 0 0 ${Math.round(120 * state.alarm)}px rgba(${RED}, ${0.35 * state.alarm})`
            : 'none',
          transition: 'background 600ms ease, box-shadow 600ms ease',
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 41,
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 700,
          color: '#fff',
          background: `rgba(${RED}, ${Math.max(0.55, state.alarm)})`,
        }}
      >
        {canPay ? line : t('subscription.masterNote')}
      </div>

      {/*
        Окно посередине — только тем, кто платит, и только когда дело
        дошло до предела. В льготные дни довольно полосы: человек мог
        просто уехать на выходные.
      */}
      {canPay && strong && !hidden ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 42,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(0, 0, 0, 0.45)',
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: '100%',
              padding: 24,
              borderRadius: 16,
              background: 'var(--app-surface, #fff)',
              color: 'var(--app-text, #111)',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            }}
          >
            <strong style={{ display: 'block', fontSize: 18, marginBottom: 8 }}>
              {line}
            </strong>

            {/*
              Мигает то место, где надо платить. Кнопки со ссылкой здесь
              пока нет нарочно: страницы оплаты ещё не существует, а
              кнопка, ведущая в никуда, обесценивает всё остальное. Как
              только оплата появится — она встанет ровно сюда.
            */}
            <span
              style={{
                display: 'inline-block',
                marginTop: 12,
                padding: '10px 18px',
                borderRadius: 999,
                fontWeight: 800,
                color: '#fff',
                background: `rgb(${RED})`,
                animation: 'glamour-pay-blink 1.1s ease-in-out infinite',
              }}
            >
              {t('subscription.pay')}
            </span>

            {state.phase === 'limited' ? (
              <button
                type="button"
                onClick={() => setHidden(true)}
                style={{
                  display: 'block',
                  margin: '16px auto 0',
                  border: 'none',
                  background: 'none',
                  color: 'var(--app-text-muted, #666)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {t('subscription.later')}
              </button>
            ) : null}
          </div>

          <style>
            {`@keyframes glamour-pay-blink {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.45; transform: scale(0.97); }
              }`}
          </style>
        </div>
      ) : null}
    </>
  );
}

export default SubscriptionAlarm;
