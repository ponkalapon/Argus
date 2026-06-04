import { Dispatch, SetStateAction } from 'react';
import { Animated, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ArrowUp, Layers, Mic, X } from 'lucide-react-native';

import { colors } from '../../styles/theme';
import type { DocumentContext } from '../../services/rag';

type Props = {
  animInputTokens: number;
  animOutputTokens: number;
  attachedDocs: DocumentContext[];
  contextPressureColor: string;
  draft: string;
  formatTokenNumber: (value: number) => string;
  handleVoiceToggle: () => void | Promise<void>;
  isFocused: boolean;
  isRecording: boolean;
  modelLabel: string;
  onOpenAttachMenu: () => void;
  onSendMessage: (text: string) => void | Promise<void>;
  setAttachedDocs: Dispatch<SetStateAction<DocumentContext[]>>;
  setDraft: Dispatch<SetStateAction<string>>;
  setIsFocused: Dispatch<SetStateAction<boolean>>;
  styles: any;
  tokenPulse: Animated.Value;
};

export const WorkspaceComposer = ({
  animInputTokens,
  animOutputTokens,
  attachedDocs,
  contextPressureColor,
  draft,
  formatTokenNumber,
  handleVoiceToggle,
  isFocused,
  isRecording,
  modelLabel,
  onOpenAttachMenu,
  onSendMessage,
  setAttachedDocs,
  setDraft,
  setIsFocused,
  styles,
  tokenPulse,
}: Props) => (
  <View style={styles.composerWrap}>
    {attachedDocs.length > 0 && (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.docScroll}>
        {attachedDocs.map((doc, i) => (
          <View key={i} style={styles.docChip}>
            <Text style={styles.docChipText}>{doc.name}</Text>
            <TouchableOpacity onPress={() => setAttachedDocs(prev => prev.filter((_, idx) => idx !== i))}>
              <X size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    )}

    <View style={[styles.composer, isFocused && styles.composerFocused]}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenAttachMenu}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Text style={styles.attachIcon}>+</Text>
      </Pressable>

      <TextInput
        multiline
        onChangeText={setDraft}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Спросить Agent…"
        placeholderTextColor={colors.textDim}
        style={styles.input}
        textAlignVertical="top"
        value={draft}
      />

      <Animated.View
        style={styles.sendBtnWrap}
        pointerEvents={draft.trim().length > 0 ? 'auto' : 'auto'}
      >
        <Pressable
          accessibilityRole="button"
          onPress={draft.trim().length > 0 ? () => onSendMessage(draft) : handleVoiceToggle}
          style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed]}
        >
          {draft.trim().length > 0 ? (
            <ArrowUp size={20} color={colors.background} />
          ) : (
            <Mic size={20} color={isRecording ? '#ef4444' : colors.background} />
          )}
        </Pressable>
      </Animated.View>
    </View>

    <View style={styles.statusBar}>
      <View style={styles.statusLeft}>
        <View style={[styles.statusDot, { backgroundColor: contextPressureColor }]} />
        <Animated.View style={{ opacity: tokenPulse }}>
          <Layers size={11} color={colors.textMuted} style={{ marginRight: 2 }} />
        </Animated.View>
        <Text style={styles.tokenText}>
          Вх: {formatTokenNumber(animInputTokens)}
          {' / '}
          Вых: {formatTokenNumber(animOutputTokens)}
        </Text>
      </View>
      <Text style={styles.statusModel} numberOfLines={1}>{modelLabel}</Text>
    </View>
  </View>
);
