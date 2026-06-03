import { ReactNode, useEffect, useRef } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { colors, motion, radius, spacing } from '../styles/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type SnapPoint = 'closed' | 'partial' | 'full';
export const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT;

type Props = {
  visible: boolean;
  onClose: () => void;
  snapPoints?: Partial<Record<SnapPoint, number>>;
  children: ReactNode;
  springConfig?: { damping: number; stiffness: number };
  overlayOpacity?: { closed: number; open: number };
};

const defaultSnapPoints = {
  closed: SCREEN_HEIGHT,
  partial: SCREEN_HEIGHT * 0.45,
  full: SCREEN_HEIGHT * 0.08,
};

const defaultSpring = { damping: 28, stiffness: 220 };
const defaultOverlay = { closed: 0, open: 0.5 };

const snapOrder: SnapPoint[] = ['full', 'partial', 'closed'];

export const GestureBottomSheet = ({
  visible,
  onClose,
  snapPoints: userSnapPoints,
  children,
  springConfig = defaultSpring,
  overlayOpacity: userOverlay = defaultOverlay,
}: Props) => {
  const points = { ...defaultSnapPoints, ...userSnapPoints };
  const spring = { ...defaultSpring, ...springConfig };
  const overlay = { ...defaultOverlay, ...userOverlay };

  const translateY = useSharedValue(points.closed);
  const overlayOpacity = useSharedValue(0);
  const currentY = useSharedValue(points.closed);
  const gestureStartY = useSharedValue(points.closed);
  const canCloseRef = useRef(false);

  const enableClose = () => { canCloseRef.current = true; };

  const snapTo = (point: SnapPoint, closeAfter = false) => {
    'worklet';
    const target = points[point];
    currentY.value = target;
    translateY.value = withSpring(target, {
      damping: spring.damping,
      stiffness: spring.stiffness,
    }, (finished) => {
      if (finished) {
        runOnJS(enableClose)();
      }
    });
    overlayOpacity.value = withSpring(
      point === 'closed' ? overlay.closed : overlay.open,
      { damping: spring.damping, stiffness: spring.stiffness }
    );

    if (closeAfter) {
      runOnJS(onClose)();
    }
  };

  useEffect(() => {
    if (visible) {
      canCloseRef.current = false;
      snapTo('partial');
    } else {
      snapTo('closed');
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      gestureStartY.value = currentY.value;
    })
    .onUpdate((e) => {
      const newY = gestureStartY.value + e.translationY;
      translateY.value = Math.max(points.full, Math.min(points.closed, newY));
      const progress = 1 - (translateY.value - points.full) / (points.closed - points.full);
      overlayOpacity.value = interpolate(
        progress,
        [0, 1],
        [overlay.closed, overlay.open],
        Extrapolation.CLAMP
      );
    })
    .onEnd((e) => {
      const velocity = e.velocityY;
      const currentY = translateY.value;
      const progress = 1 - (currentY - points.full) / (points.closed - points.full);

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
    opacity: overlayOpacity.value,
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
        <Animated.View style={[styles.sheet, sheetStyle]}>
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
    maxHeight: SCREEN_HEIGHT - 60,
    paddingBottom: spacing.xl,
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
