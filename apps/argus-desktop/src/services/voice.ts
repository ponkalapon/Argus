let onResultCallback: ((text: string) => void) | null = null;
let onErrorCallback: ((error: string) => void) | null = null;
let _isRecording = false;

export const isRecording = () => _isRecording;

export const startListening = async (locale = 'ru-RU'): Promise<void> => {
  if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = locale;
    recognition.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript || '';
      if (text && onResultCallback) onResultCallback(text);
    };
    recognition.onerror = (e: any) => {
      if (onErrorCallback) onErrorCallback(e.error || 'Ошибка распознавания');
    };
    recognition.onend = () => {
      _isRecording = false;
    };
    _isRecording = true;
    recognition.start();
    return;
  }
  _isRecording = false;
  throw new Error('Голосовой ввод недоступен');
};

export const stopListening = async (): Promise<void> => {
  _isRecording = false;
};

export const destroy = async (): Promise<void> => {
  _isRecording = false;
};

export const onResult = (cb: (text: string) => void) => {
  onResultCallback = cb;
};

export const onError = (cb: (error: string) => void) => {
  onErrorCallback = cb;
};
