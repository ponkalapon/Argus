import { ReactNode, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, radius, spacing } from '../styles/theme';

export type SnapPoint = 'closed' | 'partial' | 'full';

type Props = {
  visible: boolean;
  onClose: () => void;
  snapPoints?: Partial<Record<SnapPoint, number>>;
  children: ReactNode;
  springConfig?: { damping: number; stiffness: number };
  overlayOpacity?: { closed: number; open: number };
};

// Keep export for consumers that reference it
export const BOTTOM_SHEET_HEIGHT = 0; // deprecated — use useWindowDimensions inside

const defaultSpring = { damping: 28, stiffness: 220 };
const defaultOverlay = { closed: 0, open: 0.5 };

export const GestureBottomSheet = ({
  visible,
  onClose,
  snapPoints: userSnapPoints,
  children,
  springConfig = defaultSpring,
  overlayOpacity: userOverlay = defaultOverlay,
}: Props) => {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Compute snap points relative to real screen dimensions each render
  const defaultSnapPoints = {
    closed: screenHeight,
    partial: Math.round(screenHeight * 0.42),
    full: insets.top + 20,
  };

  const points = { ...defaultSnapPoints, ...userSnapPoints };
  const spring = { ...defaultSpring, ...springConfig };
  const overlay = { ...defaultOverlay, ...userOverlay };

  const translateY = useSharedValue(points.closed);
  const overlayOpacityVal = useSharedValue(0);
  const currentY = useSharedValue(points.closed);
  const gestureStartY = useSharedValue(points.closed);
  const canCloseRef = useRef(false);

  const snapTo = (point: SnapPoint, closeAfter = false) => {
    'worklet';
    const target = points[point];
    currentY.value = target;
    translateY.value = withSpring(target, {
      damping: spring.damping,
      stiffness: spring.stiffness,
    });
    overlayOpacityVal.value = withSpring(
      point === 'closed' ? overlay.closed : overlay.open,
      { damping: spring.damping, stiffness: spring.stiffness }
    );

    if (closeAfter) {
      runOnJS(onClose)();
    }
  };

  useEffect(() => {
    if (!visible) {
      canCloseRef.current = false;
      snapTo('closed');
      return;
    }
    canCloseRef.current = false;
    snapTo('partial');
    const timer = setTimeout(() => { canCloseRef.current = true; }, 300);
    return () => clearTimeout(timer);
  }, [visible]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .onStart(() => {
      gestureStartY.value = currentY.value;
    })
    .onUpdate((e) => {
      const newY = gestureStartY.value + e.translationY;
      translateY.value = Math.max(points.full, Math.min(points.closed, newY));
      const progress = 1 - (translateY.value - points.full) / (points.closed - points.full);
      overlayOpacityVal.value = interpolate(
        progress,
        [0, 1],
        [overlay.closed, overlay.open],
        Extrapolation.CLAMP
      );
    })
    .onEnd((e) => {
      const velocity = e.velocityY;
      const cur = translateY.value;
      const progress = 1 - (cur - points.full) / (points.closed - points.full);

      let targetSnap: SnapPoint;
      if (velocity > 500) {
        targetSnap = 'closed';
      } else if (velocity < -500) {
        targetSnap = 'full';
      } else {
        if (progress > 0.7) targetSnap = 'full';
        else if (progress > 0.3) targetSnap = 'partial';
        else targetSnap = 'closed';
      }
      snapTo(targetSnap, targetSnap === 'closed');
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacityVal.value,
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            if (canCloseRef.current) {
              snapTo('closed', true);
            }
          }}
        />
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }, sheetStyle]}>
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.borderStrong,
    borderRadius: 3,
    height: 4,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    width: 36,
  },
});
