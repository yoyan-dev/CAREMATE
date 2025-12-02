// components/TalkingAvatar.tsx
import LottieView from "lottie-react-native";
import React, { useEffect, useRef } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

interface Props {
  isTalking: boolean;
  size?: number;
  idleSource?: any; // require local lottie or remote uri
  talkingSource?: any;
}

export default function TalkingAvatar({
  isTalking,
  size = 120,
  idleSource,
  talkingSource,
}: Props) {
  const lottieRef = useRef<LottieView | null>(null);
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const scale = 1 + breath.value * 0.02;
    return {
      transform: [{ scale }],
    };
  });

  useEffect(() => {
    if (!lottieRef.current) return;
    if (isTalking) {
      lottieRef.current.play();
    } else {
      // go to idle loop frame
      lottieRef.current.play();
    }
  }, [isTalking]);

  return (
    <Animated.View
      style={[styles.container, { width: size, height: size }, animStyle]}
    >
      <LottieView
        ref={lottieRef}
        source={isTalking ? talkingSource : idleSource}
        autoPlay
        loop
        style={{ width: size, height: size }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
