/** Наибольшая сторона снимка после сжатия. */
const MAX_SIDE = 1280;

/** Качество JPEG: на глаз неотличимо, а весит втрое меньше. */
const JPEG_QUALITY = 0.82;

/**
 * Сжать снимок перед отправкой.
 *
 * Фотография с айфона весит четыре мегабайта, а в переписке от неё
 * нужен экран телефона — после сжатия остаётся около двухсот
 * килобайт. По мобильной сети это разница между «ушло сразу»
 * и «крутится полминуты».
 */
export async function compressImage(file: File): Promise<File> {
  try {
    /**
     * Поворот берём из снимка.
     *
     * Айфон пишет портретные кадры повёрнутыми, а разворот держит
     * в метке ориентации. Без этого указания на холст лёг бы кадр,
     * лежащий на боку.
     */
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });

    const scale = Math.min(
      1,
      MAX_SIDE / Math.max(bitmap.width, bitmap.height),
    );

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });

    if (!blob) {
      return file;
    }

    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    // Не вышло сжать — отправим как есть, это лучше отказа.
    return file;
  }
}

/**
 * Порядок предпочтения при записи звука.
 *
 * mp4 с кодеком AAC стоит первым не случайно: такой файл открывается
 * во всех браузерах, включая Safari. webm с Opus в Safari годами
 * проигрывался через раз, поэтому он только запасной.
 */
const AUDIO_CANDIDATES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
];

/** Умеет ли этот браузер записывать звук. */
export function canRecordAudio(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/** Первый поддерживаемый формат записи, пустая строка — на усмотрение браузера. */
export function pickAudioMime(): string {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  return (
    AUDIO_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
  );
}

/** Имя файла под выбранный формат — по нему сервер ничего не решает. */
export function audioFileName(mimeType: string): string {
  if (mimeType.includes('mp4')) {
    return 'voice.m4a';
  }

  if (mimeType.includes('ogg')) {
    return 'voice.ogg';
  }

  return 'voice.webm';
}

/** «1:05» из числа секунд. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;

  return minutes + ':' + String(rest).padStart(2, '0');
}
