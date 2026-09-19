/**
 * Оферта, политика данных и контакты — тремя языками.
 *
 * Тексты лежат здесь, а не в словарях: словари правятся сценариями по
 * одному ключу, а тут связные документы, которые читают целиком и
 * правят абзацами. Смешивать их с подписями кнопок — значит потерять и
 * то и другое.
 *
 * Написано человеческим языком нарочно. Договор, который нельзя
 * прочесть, не защищает никого: салон его пролистывает, а мы делаем
 * вид, что предупредили.
 *
 * Это черновик, написанный помощником, а не юристом. Перед тем как
 * ссылаться на него в банке или в суде, его надо показать юристу —
 * особенно разделы об ответственности и о данных.
 */

export type LegalSection = {
  heading: string;
  body: string[];
};

export type LegalDocument = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

export type LegalKind = 'terms' | 'privacy' | 'contacts';

export type LegalPack = Record<LegalKind, LegalDocument>;

const RU: LegalPack = {
  terms: {
    title: 'Публичная оферта',
    updated: '17 сентября 2026',
    intro:
      'Это условия, на которых салон пользуется GLAMOUR. Регистрируя салон, вы с ними соглашаетесь.',
    sections: [
      {
        heading: 'Что это за программа',
        body: [
          'GLAMOUR — программа для салона красоты: клиент записывается сам, база хранит историю визитов, расписание видно каждому мастеру, а деньги считаются без калькулятора.',
          'Кто оказывает услугу и как с нами связаться — на странице «Контакты».',
        ],
      },
      {
        heading: 'Как начинается работа',
        body: [
          'Вы открываете ссылку, выбираете тариф и заполняете данные салона. Кабинет открывается сразу, а заявка приходит к владельцу площадки — он её рассматривает.',
          'Денег при регистрации не берут. Если заявка окажется чужой или поддельной, владелец площадки может закрыть салон.',
        ],
      },
      {
        heading: 'Пробные дни',
        body: [
          'Пробные дни идут с самой регистрации — сколько именно, написано на карточке тарифа.',
          'Карта для этого не нужна, автоматического списания нет. Не подошло — просто не оплачиваете.',
        ],
      },
      {
        heading: 'Оплата',
        body: [
          'Цены видны при выборе тарифа. Оплата вперёд: за месяц или за год, год стоит как десять месяцев.',
          'Оплату отмечает владелец площадки. Оплата картой прямо в приложении появится позже, и об этом будет сказано здесь.',
        ],
      },
      {
        heading: 'Если оплата задержалась',
        body: [
          'Сначала три дня отсрочки: всё работает, в кабинете висит предупреждение.',
          'Потом ограничение: салон работает дальше, но новых записей можно создать не больше десяти.',
          'Потом кабинет остаётся только для чтения: всё видно и можно выгрузить, но менять нельзя.',
          'Ничего не удаляется. Оплата возвращает кабинет в прежний вид.',
        ],
      },
      {
        heading: 'Чьи данные',
        body: [
          'База клиентов принадлежит салону. Мы не продаём её, не передаём другим салонам и не используем для своей рекламы.',
          'Уходя, салон забирает базу с собой.',
        ],
      },
      {
        heading: 'За что мы не отвечаем',
        body: [
          'За то, что салон написал своим клиентам, и за то, как салон ведёт свои дела.',
          'Мы делаем всё, чтобы программа работала без перерывов, но не можем обещать этого за интернет, телефон или оператора SMS.',
        ],
      },
      {
        heading: 'Изменения',
        body: [
          'Условия могут меняться. О важном предупреждаем в приложении заранее, а дата последней правки стоит вверху этой страницы.',
        ],
      },
      {
        heading: 'Право',
        body: [
          'Отношения регулируются законодательством Республики Молдова.',
        ],
      },
    ],
  },

  privacy: {
    title: 'Политика данных',
    updated: '17 сентября 2026',
    intro:
      'Коротко: данные клиентов вносит салон, и принадлежат они салону. Мы храним их, чтобы программа работала, и больше ни для чего.',
    sections: [
      {
        heading: 'Кто за что отвечает',
        body: [
          'Салон решает, чьи данные вносить и зачем. Мы храним и обрабатываем их по его поручению.',
          'Если клиент хочет узнать, что о нём записано, или попросить удалить — он обращается в свой салон. Салон обращается к нам, если нужна помощь.',
        ],
      },
      {
        heading: 'Что мы храним о салоне',
        body: [
          'Имя владельца и мастеров, почту и телефон для входа, название и адреса салона, услуги и цены, расписание, записи и деньги салона.',
        ],
      },
      {
        heading: 'Что салон записывает о клиентах',
        body: [
          'Имя, телефон, иногда почту, историю визитов, фотографии работ и заметки мастера. Что именно записывать — решает салон.',
        ],
      },
      {
        heading: 'Зачем',
        body: [
          'Чтобы работала запись, приходили напоминания и считались деньги. Ни для чего другого.',
        ],
      },
      {
        heading: 'Кому передаём',
        body: [
          'Оператору SMS — только номер и текст сообщения, и только когда салон это сообщение отправляет.',
          'Хостингу, на сервере которого стоит программа.',
          'Больше никому. Данные не продаются.',
        ],
      },
      {
        heading: 'Сколько храним',
        body: [
          'Пока салон пользуется программой. После ухода удаляем по письменной просьбе.',
        ],
      },
      {
        heading: 'Что хранится в вашем браузере',
        body: [
          'Ключ входа, выбранный язык и тема. Ничего для рекламы и слежки.',
        ],
      },
      {
        heading: 'Куда писать',
        body: [
          'Вопросы о данных — на почту со страницы «Контакты».',
        ],
      },
    ],
  },

  contacts: {
    title: 'Контакты',
    updated: '17 сентября 2026',
    intro: 'Пишите напрямую — отвечаем в тот же день.',
    sections: [
      {
        heading: 'Юридические сведения',
        body: [
          'SRL в процессе регистрации. Как только она будет зарегистрирована, реквизиты появятся здесь.',
        ],
      },
    ],
  },
};

const RO: LegalPack = {
  terms: {
    title: 'Termeni și condiții',
    updated: '17 septembrie 2026',
    intro:
      'Acestea sunt condițiile în care salonul folosește GLAMOUR. Înregistrând salonul, sunteți de acord cu ele.',
    sections: [
      {
        heading: 'Ce este această aplicație',
        body: [
          'GLAMOUR este aplicația salonului de frumusețe: clientul se programează singur, baza păstrează istoricul vizitelor, orarul se vede la fiecare maestru, iar banii se numără fără calculator.',
          'Cine prestează serviciul și cum ne găsiți — pe pagina «Contacte».',
        ],
      },
      {
        heading: 'Cum începe colaborarea',
        body: [
          'Deschideți linkul, alegeți tariful și completați datele salonului. Contul se deschide imediat, iar cererea ajunge la proprietarul platformei, care o examinează.',
          'La înregistrare nu se încasează niciun ban. Dacă cererea se dovedește străină sau falsă, proprietarul platformei poate închide salonul.',
        ],
      },
      {
        heading: 'Zilele de probă',
        body: [
          'Zilele de probă curg chiar de la înregistrare — câte anume scrie pe cartela tarifului.',
          'Nu este nevoie de card și nu există debitare automată. Nu vi se potrivește — pur și simplu nu plătiți.',
        ],
      },
      {
        heading: 'Plata',
        body: [
          'Prețurile se văd la alegerea tarifului. Plata este înainte: pe lună sau pe an, iar anul costă cât zece luni.',
          'Plata o confirmă proprietarul platformei. Plata cu cardul direct în aplicație va apărea mai târziu, și se va scrie aici.',
        ],
      },
      {
        heading: 'Dacă plata întârzie',
        body: [
          'Mai întâi trei zile de răgaz: totul funcționează, iar în cont este un avertisment.',
          'Apoi limitarea: salonul lucrează mai departe, dar se pot crea cel mult zece programări noi.',
          'Apoi contul rămâne doar pentru citit: totul se vede și se poate descărca, dar nu se poate modifica.',
          'Nimic nu se șterge. Plata readuce contul la starea de dinainte.',
        ],
      },
      {
        heading: 'Ale cui sunt datele',
        body: [
          'Baza de clienți aparține salonului. Nu o vindem, nu o dăm altor saloane și nu o folosim pentru reclama noastră.',
          'Dacă plecați, luați baza cu dumneavoastră.',
        ],
      },
      {
        heading: 'Pentru ce nu răspundem',
        body: [
          'Pentru ce le-a scris salonul clienților săi și pentru felul în care salonul își conduce afacerea.',
          'Facem totul ca aplicația să meargă fără întreruperi, dar nu putem promite acest lucru în locul internetului, al telefonului sau al operatorului de SMS.',
        ],
      },
      {
        heading: 'Modificări',
        body: [
          'Condițiile se pot schimba. Despre ce este important anunțăm din timp în aplicație, iar data ultimei modificări este sus pe această pagină.',
        ],
      },
      {
        heading: 'Legea aplicabilă',
        body: [
          'Raporturile sunt guvernate de legislația Republicii Moldova.',
        ],
      },
    ],
  },

  privacy: {
    title: 'Politica datelor',
    updated: '17 septembrie 2026',
    intro:
      'Pe scurt: datele clienților le introduce salonul și ele aparțin salonului. Noi le păstrăm ca aplicația să funcționeze și pentru nimic altceva.',
    sections: [
      {
        heading: 'Cine de ce răspunde',
        body: [
          'Salonul hotărăște ale cui date le introduce și în ce scop. Noi le păstrăm și le prelucrăm la cererea lui.',
          'Dacă un client vrea să afle ce este scris despre el sau cere ștergerea — se adresează salonului său. Salonul ni se adresează nouă, dacă are nevoie de ajutor.',
        ],
      },
      {
        heading: 'Ce păstrăm despre salon',
        body: [
          'Numele proprietarului și al maeștrilor, emailul și telefonul pentru autentificare, denumirea și adresele salonului, serviciile și prețurile, orarul, programările și banii salonului.',
        ],
      },
      {
        heading: 'Ce scrie salonul despre clienți',
        body: [
          'Numele, telefonul, uneori emailul, istoricul vizitelor, fotografiile lucrărilor și notițele maestrului. Ce anume — hotărăște salonul.',
        ],
      },
      {
        heading: 'Pentru ce',
        body: [
          'Ca să funcționeze programarea, să ajungă reamintirile și să se numere banii. Pentru nimic altceva.',
        ],
      },
      {
        heading: 'Cui transmitem',
        body: [
          'Operatorului de SMS — doar numărul și textul mesajului, și doar atunci când salonul trimite acel mesaj.',
          'Găzduirii pe al cărei server stă aplicația.',
          'Nimănui altcuiva. Datele nu se vând.',
        ],
      },
      {
        heading: 'Cât păstrăm',
        body: [
          'Cât timp salonul folosește aplicația. După plecare ștergem la cerere scrisă.',
        ],
      },
      {
        heading: 'Ce se păstrează în browserul dumneavoastră',
        body: [
          'Cheia de autentificare, limba și tema alese. Nimic pentru reclamă sau urmărire.',
        ],
      },
      {
        heading: 'Unde scrieți',
        body: [
          'Întrebările despre date — la adresa de email de pe pagina «Contacte».',
        ],
      },
    ],
  },

  contacts: {
    title: 'Contacte',
    updated: '17 septembrie 2026',
    intro: 'Scrieți-ne direct — răspundem în aceeași zi.',
    sections: [
      {
        heading: 'Date juridice',
        body: [
          'SRL este în curs de înregistrare. Imediat ce va fi înregistrată, datele vor apărea aici.',
        ],
      },
    ],
  },
};

const EN: LegalPack = {
  terms: {
    title: 'Terms of service',
    updated: '17 September 2026',
    intro:
      'These are the terms on which a salon uses GLAMOUR. By registering a salon you agree to them.',
    sections: [
      {
        heading: 'What this application is',
        body: [
          'GLAMOUR is the salon application: the client books for themselves, the base keeps the visit history, the schedule is visible to every specialist, and the money is counted without a calculator.',
          'Who provides the service and how to reach us — on the Contacts page.',
        ],
      },
      {
        heading: 'How the work begins',
        body: [
          'You open the link, choose a plan and fill in the salon details. The cabinet opens right away, and the application reaches the platform owner, who reviews it.',
          'No money is taken at registration. If the application turns out to be false or to belong to someone else, the platform owner can close the salon.',
        ],
      },
      {
        heading: 'Trial days',
        body: [
          'Trial days run from registration itself — how many is written on the plan card.',
          'No card is needed and nothing is charged automatically. If it does not suit you, you simply do not pay.',
        ],
      },
      {
        heading: 'Payment',
        body: [
          'Prices are visible when choosing a plan. Payment is up front: per month or per year, and the year costs as much as ten months.',
          'Payment is confirmed by the platform owner. Paying by card inside the application will come later, and it will be said here.',
        ],
      },
      {
        heading: 'If the payment is late',
        body: [
          'First three days of grace: everything works, with a warning in the cabinet.',
          'Then the limit: the salon keeps working, but no more than ten new appointments can be created.',
          'Then the cabinet stays read-only: everything is visible and can be exported, but nothing can be changed.',
          'Nothing is deleted. Payment brings the cabinet back as it was.',
        ],
      },
      {
        heading: 'Whose data it is',
        body: [
          'The client base belongs to the salon. We do not sell it, do not pass it to other salons and do not use it for our own advertising.',
          'When leaving, the salon takes the base along.',
        ],
      },
      {
        heading: 'What we are not responsible for',
        body: [
          'What the salon wrote to its clients, and how the salon runs its business.',
          'We do everything so the application runs without interruption, but we cannot promise that on behalf of the internet, the phone network or the SMS operator.',
        ],
      },
      {
        heading: 'Changes',
        body: [
          'The terms may change. We warn about anything important inside the application in advance, and the date of the last change is at the top of this page.',
        ],
      },
      {
        heading: 'Governing law',
        body: ['The relationship is governed by the law of the Republic of Moldova.'],
      },
    ],
  },

  privacy: {
    title: 'Data policy',
    updated: '17 September 2026',
    intro:
      'In short: the client data is entered by the salon and belongs to the salon. We keep it so that the application works, and for nothing else.',
    sections: [
      {
        heading: 'Who is responsible for what',
        body: [
          'The salon decides whose data to enter and why. We keep and process it on its instruction.',
          'If a client wants to know what is written about them, or asks for deletion, they turn to their salon. The salon turns to us if it needs help.',
        ],
      },
      {
        heading: 'What we keep about the salon',
        body: [
          'The name of the owner and of the specialists, the email and phone used to sign in, the name and addresses of the salon, the services and prices, the schedule, the appointments and the salon money.',
        ],
      },
      {
        heading: 'What the salon writes about clients',
        body: [
          'Name, phone, sometimes email, visit history, photos of the work and the specialist notes. What exactly — the salon decides.',
        ],
      },
      {
        heading: 'What for',
        body: [
          'So that booking works, reminders arrive and money is counted. For nothing else.',
        ],
      },
      {
        heading: 'Who we pass it to',
        body: [
          'To the SMS operator — only the number and the message text, and only when the salon sends that message.',
          'To the hosting provider whose server the application runs on.',
          'To nobody else. The data is not sold.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'While the salon uses the application. After leaving we delete it on a written request.',
        ],
      },
      {
        heading: 'What is kept in your browser',
        body: [
          'The sign-in key, the chosen language and the chosen theme. Nothing for advertising or tracking.',
        ],
      },
      {
        heading: 'Where to write',
        body: ['Questions about data — to the email on the Contacts page.'],
      },
    ],
  },

  contacts: {
    title: 'Contacts',
    updated: '17 September 2026',
    intro: 'Write to us directly — we answer the same day.',
    sections: [
      {
        heading: 'Legal details',
        body: [
          'The company is being registered. As soon as it is, the details will appear here.',
        ],
      },
    ],
  },
};

const PACKS: Record<string, LegalPack> = {
  ru: RU,
  ro: RO,
  en: EN,
};

/** Подписи ссылок внизу страницы. */
export const LEGAL_LINKS: Record<string, Record<LegalKind, string>> = {
  ru: {
    terms: 'Оферта',
    privacy: 'Данные',
    contacts: 'Контакты',
  },
  ro: {
    terms: 'Termeni',
    privacy: 'Date',
    contacts: 'Contacte',
  },
  en: {
    terms: 'Terms',
    privacy: 'Data',
    contacts: 'Contacts',
  },
};

/** Подпись «назад» и заголовок реквизитов. */
export const LEGAL_UI: Record<
  string,
  { back: string; updated: string; details: string }
> = {
  ru: {
    back: 'Назад',
    updated: 'Последняя правка',
    details: 'Как с нами связаться',
  },
  ro: {
    back: 'Înapoi',
    updated: 'Ultima modificare',
    details: 'Cum ne găsiți',
  },
  en: {
    back: 'Back',
    updated: 'Last changed',
    details: 'How to reach us',
  },
};

function packOf(lang: string): LegalPack {
  return PACKS[lang] ?? PACKS.ro;
}

export function legalDocument(lang: string, kind: LegalKind): LegalDocument {
  return packOf(lang)[kind];
}

export function legalLinks(lang: string): Record<LegalKind, string> {
  return LEGAL_LINKS[lang] ?? LEGAL_LINKS.ro;
}

export function legalUi(lang: string) {
  return LEGAL_UI[lang] ?? LEGAL_UI.ro;
}
