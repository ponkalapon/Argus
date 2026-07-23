import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import type { DailyRecord } from '../services/tokenStats';
import { colors, spacing } from '../styles/theme';

type Props = {
  data: DailyRecord[];
};

const CHART_HEIGHT = 190;
const BAR_GAP = 12;
const AXIS_WIDTH = 44;
const RIGHT_PADDING = 16;

const formatDay = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(Date.UTC(year, month, day));
    const dayIdx = d.getUTCDay();
    return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dayIdx] || '';
  } catch {
    return '';
  }
};

const formatShortDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return `${d}.${m < 10 ? '0' + m : m}`;
  } catch {
    return dateStr;
  }
};

const formatToken = (n: number) => {
  if (isNaN(n) || !isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};

export const UsageChart = ({ data }: Props) => {
  const [containerWidth, setContainerWidth] = useState(500);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 100 && w !== containerWidth) {
      setContainerWidth(w);
    }
  };

  const chartData = useMemo(() => {
    const daysMap = new Map<string, DailyRecord>();
    (data || []).forEach((r) => {
      if (r && r.date) daysMap.set(r.date, r);
    });

    const last7: DailyRecord[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const record = daysMap.get(dateStr);
      last7.push({
        date: dateStr,
        input: Number(record?.input) || 0,
        output: Number(record?.output) || 0,
        requests: Number(record?.requests) || 0,
      });
    }

    const rawMax = last7.reduce((m, r) => Math.max(m, r.input + r.output), 0);
    const maxVal = rawMax === 0 ? 1000 : Math.ceil(rawMax * 1.15);

    const availableWidth = Math.max(200, containerWidth - AXIS_WIDTH - RIGHT_PADDING);
    const barWidth = Math.max(16, Math.floor((availableWidth - (last7.length - 1) * BAR_GAP) / last7.length));

    return { records: last7, maxVal, barWidth, availableWidth };
  }, [data, containerWidth]);

  const { records, maxVal, barWidth } = chartData;

  const baseline = CHART_HEIGHT - 25;
  const topY = 15;
  const drawHeight = baseline - topY;

  const yTicks = useMemo(() => {
    return [0, Math.round(maxVal * 0.33), Math.round(maxVal * 0.66), maxVal];
  }, [maxVal]);

  return (
    <View style={{ width: '100%', alignItems: 'center' }} onLayout={handleLayout}>
      <Svg width={containerWidth} height={CHART_HEIGHT}>
        {/* Horizontal Gridlines & Y-Axis Labels */}
        {yTicks.map((tick) => {
          const ratio = tick / maxVal;
          const y = baseline - ratio * drawHeight;
          return (
            <React.Fragment key={tick}>
              <Line x1={AXIS_WIDTH} y1={y} x2={containerWidth - RIGHT_PADDING} y2={y} stroke="#27272a" strokeWidth={1} strokeDasharray={tick === 0 ? undefined : '4,4'} />
              <SvgText x={AXIS_WIDTH - 8} y={y + 4} fill={colors.textMuted} fontSize={10} fontWeight="500" textAnchor="end">
                {formatToken(tick)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Bars */}
        {records.map((record, i) => {
          const x = AXIS_WIDTH + i * (barWidth + BAR_GAP) + (BAR_GAP / 2);
          const totalTokens = record.input + record.output;

          if (totalTokens === 0) return null;

          const inputH = (record.input / maxVal) * drawHeight;
          const outputH = (record.output / maxVal) * drawHeight;
          const inputY = baseline - inputH;
          const outputY = baseline - inputH - outputH;

          return (
            <React.Fragment key={record.date}>
              {inputH > 0 && (
                <Rect x={x} y={inputY} width={barWidth} height={inputH} rx={3} fill={colors.accent} />
              )}
              {outputH > 0 && (
                <Rect x={x} y={outputY} width={barWidth} height={outputH} rx={3} fill="#34d399" />
              )}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Date Labels below chart */}
      <View style={{ flexDirection: 'row', marginLeft: AXIS_WIDTH, width: containerWidth - AXIS_WIDTH - RIGHT_PADDING, justifyContent: 'space-around', marginTop: 4 }}>
        {records.map((record) => (
          <View key={record.date} style={{ width: barWidth + BAR_GAP, alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600', lineHeight: 14 }}>
              {formatDay(record.date)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, lineHeight: 13, marginTop: 1 }}>
              {formatShortDate(record.date)}
            </Text>
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.accent }} />
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '500' }}>Входные токены</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#34d399' }} />
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '500' }}>Выходные токены</Text>
        </View>
      </View>
    </View>
  );
};
