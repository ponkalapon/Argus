import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { DocumentContext, pickAndParseDocument } from '../services/rag';
import * as VoiceService from '../services/voice';
import { searchContacts } from '../services/contacts';

type PendingAttach = { name: string; content: string } | null | undefined;

type UseAttachmentsParams = {
  onOpenFiles: () => void;
  pendingAttach?: PendingAttach;
  onClearPendingAttach?: () => void;
  setDraft: Dispatch<SetStateAction<string>>;
};

export const useAttachments = ({ onOpenFiles, pendingAttach, onClearPendingAttach, setDraft }: UseAttachmentsParams) => {
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachedDocs, setAttachedDocs] = useState<DocumentContext[]>([]);
  const [internetEnabled, setInternetEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    VoiceService.onResult((text) => {
      setDraft((prev) => prev ? `${prev} ${text}` : text);
      setIsRecording(false);
    });
    VoiceService.onError(() => setIsRecording(false));
    return () => { VoiceService.destroy(); };
  }, [setDraft]);

  useEffect(() => {
    if (pendingAttach && onClearPendingAttach) {
      setAttachedDocs((prev) => [...prev, { name: pendingAttach.name, content: pendingAttach.content }]);
      onClearPendingAttach();
    }
  }, [pendingAttach, onClearPendingAttach]);

  const attachImage = async (uri: string, name: string) => {
    setAttachedDocs((prev) => [...prev, { name, content: `[Image: ${name}]\nURI: ${uri}` }]);
  };

  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нет доступа', 'Разреши доступ к камере в настройках');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false });
    if (!result.canceled && result.assets?.[0]) {
      await attachImage(result.assets[0].uri, result.assets[0].fileName || 'photo.jpg');
    }
  };

  const handlePhotoLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нет доступа', 'Разреши доступ к галерее в настройках');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false });
    if (!result.canceled && result.assets?.[0]) {
      await attachImage(result.assets[0].uri, result.assets[0].fileName || 'photo.jpg');
    }
  };

  const handleAttachDocument = async () => {
    try {
      const doc = await pickAndParseDocument();
      if (doc) {
        setAttachedDocs((prev) => [...prev, doc]);
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить файл');
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      setIsRecording(false);
      await VoiceService.stopListening();
    } else {
      const { PermissionsAndroid } = require('react-native');
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Нет доступа', 'Разреши доступ к микрофону в настройках');
        return;
      }
      setIsRecording(true);
      try {
        await VoiceService.startListening('ru-RU');
      } catch {
        setIsRecording(false);
        Alert.alert('Ошибка', 'Не удалось запустить запись');
      }
    }
  };

  const handleContactsSearch = async () => {
    try {
      const results = await searchContacts('');
      if (results.length === 0) {
        Alert.alert('Контакты не найдены');
        return;
      }
      const names = results.map((c) => `${c.name} — ${c.phones.join(', ')}`).join('\n');
      setDraft(`Найди контакт:\n${names}`);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить контакты');
    }
  };

  return {
    attachedDocs,
    handleAttachDocument,
    handleCamera,
    handleContactsSearch,
    handleOpenFiles: onOpenFiles,
    handlePhotoLibrary,
    handleVoiceToggle,
    internetEnabled,
    isRecording,
    setAttachedDocs,
    setInternetEnabled,
    setShowAttachMenu,
    showAttachMenu,
  };
};
