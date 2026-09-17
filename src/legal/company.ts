/**
 * Кто мы для закона.
 *
 * Одно место на всё приложение: оферта, политика данных и страница
 * контактов берут отсюда. Когда SRL зарегистрирована — заполняется
 * здесь, и три страницы меняются разом.
 *
 * Пустое поле не печатается вовсе. Это нарочно: страница, где написано
 * «ООО «Название», ИДНО 0000000000000», хуже, чем страница, где этой
 * строки нет. Первая врёт, вторая молчит.
 */
export type Company = {
  /** Как нас зовут люди. */
  brand: string;

  /** Адрес приложения. */
  site: string;

  /** Полное имя юридического лица — после регистрации SRL. */
  legalName: string;

  /** IDNO. */
  idno: string;

  /** Юридический адрес. */
  address: string;

  /** Почта для писем — на неё же идут вопросы о данных. */
  email: string;

  /** Телефон. */
  phone: string;

  /** Телеграм — без собачки, только имя. */
  telegram: string;
};

export const COMPANY: Company = {
  brand: 'GLAMOUR',
  site: 'glamourapp.md',
  legalName: '',
  idno: '',
  address: '',
  email: '',
  phone: '',
  telegram: '',
};

/** Есть ли вообще что печатать в блоке реквизитов. */
export function hasCompanyDetails(): boolean {
  return Boolean(
    COMPANY.legalName ||
      COMPANY.idno ||
      COMPANY.address ||
      COMPANY.email ||
      COMPANY.phone ||
      COMPANY.telegram,
  );
}
