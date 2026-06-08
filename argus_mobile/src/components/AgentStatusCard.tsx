import { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AgentSettings, AgentStatus } from '../types';
import { colors, radius, spacing, typography } from '../styles/theme';

type Props = {
  settings: AgentSettings;
  status: AgentStatus;
  hasApiKey: boolean;
  messageCount: number;
};

const statusLabel: Record<AgentStatus, string> = {
  idle: 'Готов',
  thinking: 'Отвечает…',
  error: 'Ошибка',
};

const statusDotColor: Record<AgentStatus, string> = {
  idle: colors.success,
  thinking: colors.warning,
  error: colors.danger,
};

export const AgentStatusCard = memo(({ settings, status, hasApiKey, messageCount }: Props) => {
  const modelLabel = settings.model.trim() || 'Модель не задана';
  const isReady = Boolean(settings.baseUrl.trim() && settings.model.trim());

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.dot, { backgroundColor: statusDotColor[status] }]} />
        <Text style={styles.statusText}>{statusLabel[status]}</Text>
        {status === 'thinking' && (
          <ActivityIndicator color={colors.textDim} size="small" style={styles.spinner} />
        )}
      </View>
      <Text style={styles.model} numberOfLines={1}>
        {isReady ? modelLabel : 'Подключение не настроено'}
      </Text>
      <View style={styles.badges}>
        <View style={styles.badge}>
          <View style={styles.badgeRow}>
            <View style={[styles.badgeDot, { backgroundColor: hasApiKey ? colors.success : colors.textMuted }]} />
            <Text style={styles.badgeText}>{hasApiKey ? 'ключ задан' : 'без ключа'}</Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{Math.max(messageCount, 0)} сообщ.</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
    padding: spacing.lg,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: {
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: spacing.xs,
  },
  model: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  badgeDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  badgeText: {
    color: colors.textDim,
    fontSize: typography.caption,
    fontWeight: '500',
  },
});
