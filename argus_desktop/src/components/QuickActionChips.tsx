import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../styles/theme';

type Props = {
  disabled?: boolean;
  onSelect: (text: string) => void;
};

const actions = [
  { label: 'Код', prompt: 'Напиши код' },
  { label: 'План', prompt: 'Составь план' },
  { label: 'Объяснение', prompt: 'Объясни' },
  { label: 'Исправление', prompt: 'Исправь ошибку' },
];

export const QuickActionChips = memo(({ disabled, onSelect }: Props) => {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onSelect(action.prompt)}
          style={({ pressed }) => [
            styles.chip,
            pressed && styles.chipPressed,
            disabled && styles.chipDisabled,
          ]}
        >
          <Text style={styles.text}>{action.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {
    marginBottom: spacing.sm,
  },
  content: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipPressed: {
    backgroundColor: colors.surfaceElevated,
    transform: [{ scale: 0.97 }],
  },
  chipDisabled: {
    opacity: 0.4,
  },
  text: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '500',
  },
});
