import { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AgentSettings, AgentStatus } from '../types';
import { colors, radius, spacing, typography } from '../styles/theme';
import { t } from '../services/i18n';

type Props = {
  settings: AgentSettings;
  status: AgentStatus;
  hasApiKey: boolean;
  messageCount: number;
};

const statusDotColor: Record<AgentStatus, string> = {
  idle: colors.success,
  thinking: colors.warning,
  error: colors.danger,
};

export const AgentStatusCard = memo(({ settings, status, hasApiKey, messageCount }: Props) => {
  const statusLabelText = {
    idle: t('status.idle', 'Готов'),
    thinking: t('status.thinking', 'Отвечает…'),
    error: t('status.error', 'Ошибка'),
  }[status];

  const modelLabel = settings.model.trim() || t('status.no_model', 'Модель не задана');
  const isReady = Boolean(settings.baseUrl.trim() && settings.model.trim());

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.dot, { backgroundColor: statusDotColor[status] }]} />
        <Text style={styles.statusText}>{statusLabelText}</Text>
        {status === 'thinking' && (
          <ActivityIndicator color={colors.textDim} size="small" style={styles.spinner} />
        )}
      </View>
      <Text style={styles.model} numberOfLines={1}>
        {isReady ? modelLabel : t('status.not_configured', 'Подключение не настроено')}
      </Text>
      <View style={styles.badges}>
        <View style={styles.badge}>
          <View style={styles.badgeRow}>
            <View style={[styles.badgeDot, { backgroundColor: hasApiKey ? colors.success : colors.textMuted }]} />
            <Text style={styles.badgeText}>{hasApiKey ? t('status.key_set', 'ключ задан') : t('status.no_key', 'без ключа')}</Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{Math.max(messageCount, 0)} {t('status.msgs', 'сообщ.')}</Text>
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    color: colors.text,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
  },
  spinner: {
    marginLeft: spacing.sm,
  },
  model: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xs,
    marginBottom: spacing.md,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  badgeText: {
    color: colors.textSubtle,
    fontSize: typography.fontSizes.xs,
  },
});
