import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

interface SplashScreenProps {
  onVideoEnd?: () => void;
}

export const AnimatedSplashScreen: React.FC<SplashScreenProps> = ({ onVideoEnd }) => {
  return (
    <View style={styles.container}>
      <Video
        source={require('../../assets/splash_video.mp4')}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        useNativeControls={false}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded && status.didJustFinish && onVideoEnd) {
            onVideoEnd();
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050508',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
