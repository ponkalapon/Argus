import React, { useMemo } from 'react';
import { Dimensions, Text, View } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import type { DailyRecord } from '../api';
import { colors, spacing, typography } from '../styles/theme';

type Props = {
  data: DailyRecord[];
};

const CHART_HEIGHT = 180;
const BAR_GAP = 6;
const AXIS_WIDTH = 40;

export const UsageChart = ({ data }: Props) => {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(AXIS_WIDTH + 20, screenWidth - spacing.xl * 2 - spacing.xl * 2);

  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const last7 = sorted.slice(-7);
    const maxVal = last7.reduce((m, r) => Math.max(m, r.input + r.output), 1);
    const scale = (CHART_HEIGHT - 20) / maxVal;
    const barWidth = Math.max(8, (chartWidth - AXIS_WIDTH - (last7.length - 1) * BAR_GAP) / Math.max(last7.length, 1));
    return { records: last7, maxVal, scale, barWidth };
  }, [data, chartWidth]);

  const { records, maxVal, scale, barWidth } = chartData;

  const yTicks = useMemo(() => {
    const step = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const normalized = Math.ceil(Math.max(maxVal, 1) / step) * step;
    const count = Math.min(5, Math.ceil(normalized / (step / 2)));
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push((normalized / count) * i);
    }
    return ticks;
  }, [maxVal]);

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getUTCDay()];
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
  };

  const formatToken = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  if (records.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
        <Text style={{ color: colors.textMuted, fontSize: typography.caption }}>
          Нет данных за последние дни
        </Text>
      </View>
    );
  }

  const baseline = CHART_HEIGHT - 10;

  return (
    <View>
      <Svg width={chartWidth} height={CHART_HEIGHT + 30}>
        {yTicks.map((tick) => {
          const y = baseline - tick * scale;
          return (
            <Line key={tick} x1={AXIS_WIDTH} y1={y} x2={chartWidth} y2={y} stroke={colors.border} strokeWidth={0.5} />
          );
        })}

        {yTicks.map((tick) => {
          const y = baseline - tick * scale;
          return (
            <SvgText key={tick} x={AXIS_WIDTH - 4} y={y + 4} fill={colors.textDim} fontSize={9} textAnchor="end">
              {formatToken(tick)}
            </SvgText>
          );
        })}

        {records.map((record, i) => {
          const x = AXIS_WIDTH + i * (barWidth + BAR_GAP);
          const inputH = record.input * scale;
          const outputH = record.output * scale;
          const totalH = inputH + outputH;
          const outputY = baseline - totalH;
          const inputY = baseline - inputH;

          return (
            <React.Fragment key={record.date}>
              <Rect x={x} y={inputY} width={barWidth} height={inputH} rx={2} fill="#a78bfa" />
              <Rect x={x} y={outputY} width={barWidth} height={outputH} rx={2} fill="#6ee7b7" />
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={{ flexDirection: 'row', marginLeft: AXIS_WIDTH }}>
        {records.map((record) => (
          <View key={record.date} style={{ width: barWidth + BAR_GAP, alignItems: 'center', paddingTop: 4 }}>
            <Text style={{ color: colors.textDim, fontSize: 9, lineHeight: 12 }}>{formatDay(record.date)}</Text>
            <Text style={{ color: colors.textDim, fontSize: 8, lineHeight: 11 }}>{formatShortDate(record.date)}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#6ee7b7' }} />
          <Text style={{ color: colors.textMuted, fontSize: typography.caption }}>выходные</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#a78bfa' }} />
          <Text style={{ color: colors.textMuted, fontSize: typography.caption }}>входные</Text>
        </View>
      </View>
    </View>
  );
};
