import Voice from '@react-native-voice/voice';

let onResultCallback: ((text: string) => void) | null = null;
let onErrorCallback: ((error: string) => void) | null = null;
let _isRecording = false;

Voice.onSpeechResults = (e) => {
  const text = e.value?.[0] || '';
  if (text && onResultCallback) onResultCallback(text);
};

Voice.onSpeechError = (e) => {
  if (onErrorCallback) onErrorCallback(e.error?.message || 'Ошибка распознавания');
};

Voice.onSpeechEnd = () => {
  _isRecording = false;
};

export const isRecording = () => _isRecording;

export const startListening = async (locale = 'ru-RU'): Promise<void> => {
  try {
    _isRecording = true;
    await Voice.start(locale);
  } catch {
    _isRecording = false;
    throw new Error('Не удалось запустить запись');
  }
};

export const stopListening = async (): Promise<void> => {
  try {
    _isRecording = false;
    await Voice.stop();
  } catch {}
};

export const destroy = async (): Promise<void> => {
  _isRecording = false;
  try {
    await Voice.destroy();
  } catch {}
};

export const onResult = (cb: (text: string) => void) => {
  onResultCallback = cb;
};

export const onError = (cb: (error: string) => void) => {
  onErrorCallback = cb;
};
