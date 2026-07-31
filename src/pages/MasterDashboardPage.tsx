import {
  CalendarDays,
  Clock3,
  Scissors,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';

function MasterDashboardPage() {
  const metrics = [
    {
      label: 'Записей сегодня',
      value: '0',
      icon: <CalendarDays size={22} />,
    },
    {
      label: 'Ближайшая запись',
      value: 'Нет записей',
      icon: <Clock3 size={22} />,
    },
    {
      label: 'Мои клиенты',
      value: '0',
      icon: <Users size={22} />,
    },
    {
      label: 'Доход сегодня',
      value: '0 MDL',
      icon: <Wallet size={22} />,
    },
  ];

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">
              GLAMOUR SALON STUDIO
            </p>

            <h1>Мой кабинет мастера</h1>

            <p className="dashboard-subtitle">
              Личное расписание, записи, клиенты, услуги и
              финансовые показатели.
            </p>
          </div>

          <div className="dashboard-period">
            <span>Рабочее пространство</span>
            <strong>Мастер</strong>
          </div>
        </header>

        <section
          className="metrics-grid"
          aria-label="Личные показатели мастера"
        >
          {metrics.map((metric) => (
            <article
              className="metric-card"
              key={metric.label}
            >
              <div className="metric-icon">
                {metric.icon}
              </div>

              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <section className="dashboard-columns">
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">
                  РАСПИСАНИЕ
                </p>
                <h2>Ближайшие записи</h2>
              </div>

              <CalendarDays size={22} />
            </div>

            <p className="empty-state">
              Ближайших записей пока нет.
            </p>
          </article>

          <article className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">
                  ЛИЧНЫЙ ПРОФИЛЬ
                </p>
                <h2>Профиль мастера</h2>
              </div>

              <UserRound size={22} />
            </div>

            <div className="ranking-list">
              <div className="ranking-row">
                <span className="ranking-number">
                  <Scissors size={14} />
                </span>

                <div className="ranking-main">
                  <strong>Услуги мастера</strong>
                  <span>
                    Настройка личного перечня услуг
                  </span>
                </div>
              </div>

              <div className="ranking-row">
                <span className="ranking-number">
                  <Clock3 size={14} />
                </span>

                <div className="ranking-main">
                  <strong>Рабочий график</strong>
                  <span>
                    Настройка рабочих дней и времени
                  </span>
                </div>
              </div>

              <div className="ranking-row">
                <span className="ranking-number">
                  <Users size={14} />
                </span>

                <div className="ranking-main">
                  <strong>Мои клиенты</strong>
                  <span>
                    Клиенты, записанные к этому мастеру
                  </span>
                </div>
              </div>
            </div>
          </article>
        </section>
      </main>
    </AppLayout>
  );
}

export default MasterDashboardPage;
