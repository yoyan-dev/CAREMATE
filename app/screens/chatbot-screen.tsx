// screens/HomeScreen.tsx
import ChatBubble from "@/components/chat/chat-bubble";
import { useVoiceAssistant } from "@/hooks/use-voice-assistance";
import { colors } from "@/theme/color";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ChatbotScreen() {
  const {
    messages,
    isThinking,
    isTalking,
    listening,
    sendMessage,
    startListening,
    stopListening,
  } = useVoiceAssistant();

  const bars = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  const [input, setInput] = useState("");
  const flatRef = useRef<FlatList<any> | null>(null);

  useEffect(() => {
    if (flatRef.current) {
      flatRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, isThinking, isTalking]);

  const onSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  const renderItem = ({ item }: any) => <ChatBubble message={item} />;

  useEffect(() => {
    if (isTalking) {
      animateBars();
    } else {
      // Reset bars when not speaking
      bars.forEach((bar) => bar.setValue(1));
    }
  }, [isTalking]);

  const animateBars = () => {
    bars.forEach((bar, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: Math.random() * 1.5 + 0.5, // random height
            duration: 200 + index * 50,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: Math.random() * 1.5 + 0.5,
            duration: 200 + index * 50,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>🏥</Text>
          </View>
          <View>
            <Text style={styles.title}>AIDME</Text>
            <Text style={styles.subtitle}>
              First aid, home care & wellness guidance
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.avatarRow}>
        {/* <TalkingAvatar
          isTalking={isTalking}
          size={110}
          idleSource={require("../assets/lottie/idle.json")}
          talkingSource={require("../assets/lottie/talking.json")}
        /> */}
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.welcome}>Hi — I'm your assistant</Text>
          <Text style={styles.small}>Say "What to do for a burn?"</Text>
        </View>
      </View>

      <View style={styles.chatArea}>
        <FlatList
          ref={flatRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          onContentSizeChange={() =>
            flatRef.current?.scrollToEnd({ animated: true })
          }
        />

        {isThinking && (
          <View style={styles.typingRow}>
            <Text style={{ color: "#444" }}>AI is thinking...</Text>
          </View>
        )}
      </View>
      {isTalking && (
        <Animated.View style={styles.speakingOverlay}>
          <View style={styles.barsContainer}>
            {bars.map((bar, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.bar,
                  {
                    transform: [{ scaleY: bar }],
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask about first aid, symptoms or home care..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={onSend}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={onSend}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.micBtn,
              listening ? { backgroundColor: colors.primary } : null,
            ]}
            onPressIn={startListening}
            onPressOut={stopListening}
          >
            <Text style={styles.micText}>🎤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <View style={styles.disclaimer}>
        <Text style={{ fontSize: 12, color: "#333" }}>
          ⚠️ This app provides general guidance only and is not a medical
          professional. For severe symptoms, call emergency services
          immediately.
        </Text>
      </View>
      {/* {error ? (
        <Text style={{ color: colors.alert, padding: 8 }}>{error}</Text>
      ) : null} */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderColor: "#eee",
    backgroundColor: colors.secondary,
  },
  logoContainer: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: colors.textLight,
    fontSize: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  welcome: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
  },
  small: {
    fontSize: 12,
    color: "#666",
  },
  chatArea: {
    flex: 1,
  },
  typingRow: {
    padding: 8,
    alignItems: "flex-start",
    marginHorizontal: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 8,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#F4FBFF",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendText: {
    color: "#fff",
    fontWeight: "700",
  },
  micBtn: {
    marginLeft: 8,
    backgroundColor: colors.secondary,
    padding: 10,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  micText: {
    fontSize: 18,
  },
  disclaimer: {
    padding: 10,
    backgroundColor: "#fff",
    borderTopWidth: 0.5,
    borderColor: "#eee",
  },
  speakingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.49)", // semi-transparent overlay
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 50,
    width: 120,
    justifyContent: "space-between",
  },
  bar: {
    width: 10,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
});
