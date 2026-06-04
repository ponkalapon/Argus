import { RefObject } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { Settings } from 'lucide-react-native';

import { MessageBubble } from '../MessageBubble';
import { colors } from '../../styles/theme';
import type { ChatMessage } from '../../types';

type Props = {
  entrance: Animated.Value;
  error: string;
  hasRequiredSettings: boolean;
  isEmptyChat: boolean;
  messages: ChatMessage[];
  onContentSizeChange: () => void;
  onOpenSettings: () => void;
  scrollRef: RefObject<ScrollView | null>;
  styles: any;
};

export const MessageList = ({ entrance, error, hasRequiredSettings, isEmptyChat, messages, onContentSizeChange, onOpenSettings, scrollRef, styles }: Props) => (
  <Animated.ScrollView
    ref={scrollRef}
    contentContainerStyle={[
      styles.scrollContent,
      isEmptyChat && styles.scrollContentEmpty,
    ]}
    keyboardShouldPersistTaps="handled"
    nestedScrollEnabled
    onContentSizeChange={onContentSizeChange}
    showsVerticalScrollIndicator={false}
    style={{ flex: 1, opacity: entrance }}
  >
    {isEmptyChat ? (
      <View style={styles.welcomeWrap}>
        <Text style={styles.welcomeTitle}>Чем могу помочь?</Text>
        {!hasRequiredSettings && (
          <Pressable
            onPress={onOpenSettings}
            style={({ pressed }) => [styles.connectHint, pressed && styles.pressed]}
          >
            <Settings size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.connectHintText}>Настроить подключение</Text>
          </Pressable>
        )}
      </View>
    ) : (
      messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => <MessageBubble key={m.id} message={m} />)
    )}

    {!!error && (
      <View style={styles.errorCard}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )}
  </Animated.ScrollView>
);
