import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

import type { AgentSettings } from '../types';

export type ModelGroup = { provider: string; models: string[] };

const guessProvider = (modelId: string): string => {
  const id = modelId.toLowerCase();
  if (id.startsWith('gpt-') || id.startsWith('o3-') || id.startsWith('o4-')) return 'OpenAI';
  if (id.startsWith('claude-')) return 'Anthropic';
  if (id.startsWith('gemini-') || id.startsWith('gemma-')) return 'Google';
  if (id.includes('/')) return id.split('/')[0];
  if (id.startsWith('deepseek-')) return 'DeepSeek';
  if (id.startsWith('qwen-') || id.startsWith('qwen/')) return 'Qwen';
  if (id.startsWith('mistral-') || id.startsWith('mixtral-')) return 'Mistral';
  if (id.startsWith('llama-')) return 'Meta';
  if (id.startsWith('phi-')) return 'Microsoft';
  return 'Другие';
};

const groupModels = (ids: string[]): ModelGroup[] => {
  const map = new Map<string, string[]>();
  for (const id of ids) {
    const provider = guessProvider(id);
    if (!map.has(provider)) map.set(provider, []);
    map.get(provider)!.push(id);
  }
  const sorted: ModelGroup[] = [];
  for (const [provider, models] of map) {
    sorted.push({ provider, models: models.sort() });
  }
  const otherIdx = sorted.findIndex((g) => g.provider === 'Другие');
  if (otherIdx > 0) sorted.push(sorted.splice(otherIdx, 1)[0]);
  return sorted;
};

export const useModelCatalog = (settings: AgentSettings, apiKey: string) => {
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const modelPickerAnim = useRef(new Animated.Value(0)).current;

  const modelLabel = settings.model.trim() || 'Выбрать модель';

  useEffect(() => {
    Animated.spring(modelPickerAnim, {
      toValue: showModelPicker ? 1 : 0,
      useNativeDriver: true,
      damping: 26,
      stiffness: 250,
    }).start();
  }, [showModelPicker]);

  const modelOverlayOpacity = modelPickerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });
  const modelPanelTranslate = modelPickerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });

  const filteredGroups = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return modelGroups;
    return modelGroups.map(g => ({
      ...g,
      models: g.models.filter(m => m.toLowerCase().includes(q)),
    })).filter(g => g.models.length > 0);
  }, [modelSearch, modelGroups]);

  useEffect(() => {
    if (!showModelPicker || !settings.baseUrl.trim()) return;
    let cancelled = false;
    setIsLoadingModels(true);
    const baseUrl = settings.baseUrl.trim().replace(/\/+$/, '');
    fetch(`${baseUrl}/v1/models`, {
      headers: apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : undefined,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: { data?: { id: string }[] }) => {
        if (cancelled) return;
        const ids = json.data?.map((m) => m.id).filter(Boolean) || [];
        setModelGroups(groupModels(ids));
        if (!cancelled) setIsLoadingModels(false);
      })
      .catch(() => {
        if (cancelled) return;
        setModelGroups([]);
        if (!cancelled) setIsLoadingModels(false);
      });
    return () => { cancelled = true; };
  }, [showModelPicker, settings.baseUrl, apiKey]);

  const openModelPicker = () => {
    setModelSearch('');
    setShowModelPicker(true);
  };

  return {
    filteredGroups,
    isLoadingModels,
    modelLabel,
    modelPanelTranslate,
    modelPickerAnim,
    modelSearch,
    modelOverlayOpacity,
    openModelPicker,
    setModelSearch,
    setShowModelPicker,
    showModelPicker,
  };
};
