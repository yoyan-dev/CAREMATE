import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export default function TalkingAvatar({
  isTalking,
  size = 140,
}: {
  isTalking: boolean;
  size: number;
}) {
  const mouthAnim = useRef(new Animated.Value(8)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const headBob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startBlinking();
    startBreathing();

    if (isTalking) startTalking();
    else stopTalking();
  }, [isTalking]);

  // Mouth animation
  const startTalking = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(mouthAnim, {
          toValue: 22,
          duration: 120,
          useNativeDriver: false,
        }),
        Animated.timing(mouthAnim, {
          toValue: 10,
          duration: 140,
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  const stopTalking = () => {
    mouthAnim.stopAnimation();
    mouthAnim.setValue(8);
  };

  // Blinking eyes
  const startBlinking = () => {
    const blink = () => {
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.delay(2000 + Math.random() * 2000),
      ]).start(blink);
    };
    blink();
  };

  // Breathing / idle bob
  const startBreathing = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(headBob, {
          toValue: -5,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(headBob, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const headSize = size * 1;

  return (
    <Animated.View
      style={[
        styles.container,
        { width: size, height: size },
        { transform: [{ translateY: headBob }] },
      ]}
    >
      <View
        style={[
          styles.head,
          {
            width: headSize,
            height: headSize,
            borderRadius: headSize / 2,
          },
        ]}
      />

      <View
        style={[
          styles.headband,
          {
            width: headSize * 0.8,
            height: headSize * 0.22,
            top: headSize * 0.05,
          },
        ]}
      >
        <View style={styles.crossVertical} />
        <View style={styles.crossHorizontal} />
      </View>

      <View style={[styles.faceFeatures, { top: headSize * 0.4 }]}>
        <View style={styles.eyeRow}>
          <Animated.View
            style={[styles.eye, { transform: [{ scaleY: blinkAnim }] }]}
          />
          <Animated.View
            style={[styles.eye, { transform: [{ scaleY: blinkAnim }] }]}
          />
        </View>

        <Animated.View
          style={[
            styles.mouth,
            {
              width: headSize * 0.42,
              height: mouthAnim,
              marginTop: 16,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  head: {
    position: "absolute",
    top: 0,
    backgroundColor: "#F7F7F7",
    borderColor: "#d4d4d4",
    borderWidth: 2,
  },
  headband: {
    position: "absolute",
    backgroundColor: "#4AA8D8",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  crossVertical: {
    position: "absolute",
    width: 10,
    height: 26,
    backgroundColor: "white",
    borderRadius: 4,
  },
  crossHorizontal: {
    position: "absolute",
    width: 26,
    height: 10,
    backgroundColor: "white",
    borderRadius: 4,
  },

  faceFeatures: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
  },
  eyeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 60,
  },
  eye: {
    width: 18,
    height: 18,
    backgroundColor: "#333",
    borderRadius: 10,
  },
  mouth: {
    backgroundColor: "#333",
    borderRadius: 30,
  },
});
