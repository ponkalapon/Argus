import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const getRCTVoice = () => NativeModules.RCTVoice || NativeModules.Voice;

let onResultCallback: ((text: string) => void) | null = null;
let onErrorCallback: ((error: string) => void) | null = null;
let _isRecording = false;

let voiceEmitter: NativeEventEmitter | null = null;
let listeners: any[] | null = null;

function setupEmitter() {
  const module = getRCTVoice();
  if (!module || voiceEmitter) return;
  voiceEmitter = new NativeEventEmitter(module);
  listeners = [
    voiceEmitter.addListener('onSpeechResults', (e: any) => {
      const text = e.value?.[0] || '';
      if (text && onResultCallback) onResultCallback(text);
    }),
    voiceEmitter.addListener('onSpeechError', (e: any) => {
      if (onErrorCallback) onErrorCallback(e.error?.message || 'Ошибка распознавания');
    }),
    voiceEmitter.addListener('onSpeechEnd', () => {
      _isRecording = false;
    }),
  ];
}

function teardownEmitter() {
  if (listeners) {
    listeners.forEach(l => l.remove());
    listeners = null;
  }
  voiceEmitter = null;
}

setupEmitter();

export const isRecording = () => _isRecording;

export const startListening = async (locale = 'ru-RU'): Promise<void> => {
  try {
    const module = getRCTVoice();
    if (!module) {
      throw new Error('Голосовой модуль не инициализирован (NativeModules.RCTVoice is null)');
    }
    setupEmitter();
    const available = await new Promise<boolean>((resolve, reject) => {
      module.isSpeechAvailable((isAvailable: 0 | 1, error: string) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(isAvailable === 1);
        }
      });
    });
    if (!available) {
      throw new Error('Распознавание речи недоступно на устройстве');
    }
    _isRecording = true;
    await new Promise<void>((resolve, reject) => {
      const callback = (error: string) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve();
        }
      };
      module.startSpeech(
        locale,
        {
          EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
          EXTRA_MAX_RESULTS: 5,
          EXTRA_PARTIAL_RESULTS: true,
          REQUEST_PERMISSIONS_AUTO: true,
        },
        callback,
      );
    });
  } catch (e) {
    _isRecording = false;
    throw new Error(e instanceof Error ? e.message : 'Не удалось запустить запись');
  }
};

export const stopListening = async (): Promise<void> => {
  try {
    const module = getRCTVoice();
    if (!module) return;
    _isRecording = false;
    await new Promise<void>((resolve, reject) => {
      module.stopSpeech((error: string) => {
        if (error) reject(new Error(error));
        else resolve();
      });
    });
  } catch {}
};

export const destroy = async (): Promise<void> => {
  _isRecording = false;
  teardownEmitter();
  try {
    const module = getRCTVoice();
    if (!module) return;
    await new Promise<void>((resolve, reject) => {
      module.destroySpeech((error: string) => {
        if (error) reject(new Error(error));
        else resolve();
      });
    });
  } catch {}
};

export const onResult = (cb: (text: string) => void) => {
  onResultCallback = cb;
};

export const onError = (cb: (error: string) => void) => {
  onErrorCallback = cb;
};