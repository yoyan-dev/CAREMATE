import Voice from "@react-native-voice/voice";
import React, { useEffect, useState } from "react";
import {
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Message {
  role: "assistant" | "user";
  text: string;
  time: string;
}

export default function VoiceChatbot() {
  /** 🕐 Timestamp generator */
  const getTimestamp = (): string => {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi! I'm your assistant. Tap the mic to talk.",
      time: getTimestamp(),
    },
  ]);
  const [, setAvatarText] = useState(messages[0].text);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  /** 🧠 Send message to backend */
  const sendMessageToAssistant = async (text: string): Promise<string> => {
    try {
      const response = await fetch("http://localhost:5678/webhook/chatbot-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "user-123", message: text }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      return data.reply?.trim() || "(no reply)";
    } catch (err) {
      console.error("Network Error:", err);
      return "Network error, please try again.";
    }
  };

  /** 🎙️ Handle voice */
  const handleVoice = async () => {
    if (isListening || loading) return;

    // Android microphone permission
    if (Platform.OS === "android") {
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: "Microphone Permission",
        message: "This app needs access to your microphone for voice chat.",
        buttonPositive: "OK",
      }
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert("Permission denied", "Microphone access is required.");
      return;
    }

    setIsListening(true);
    setAvatarText("🎤 Listening...");

    // Event listeners
    Voice.onSpeechResults = (event: any) => {
      const transcript = event.value?.[0];
      if (transcript) {
        // Log user message
        const userMsg: Message = {
          role: "user",
          text: transcript,
          time: getTimestamp(),
        };
        setMessages((prev) => [...prev, userMsg]);

        // Send to assistant
        setLoading(true);
        sendMessageToAssistant(transcript)
          .then((reply) => {
            const assistantMsg: Message = {
              role: "assistant",
              text: reply,
              time: getTimestamp(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setAvatarText(reply); // update avatar text
          })
          .finally(() => setLoading(false));
      }
      setIsListening(false);
    };

    Voice.onSpeechError = (err: any) => {
      console.log("Speech error:", err);
      setAvatarText(`⚠️ Voice error: ${err.error}`);
      setIsListening(false);
    };

    try {
      await Voice.start("en-US");
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  /** Cleanup listeners */
  useEffect(() => {
    Voice.onSpeechResults = (event: any) => {
      console.log("RESULTS:", event.value);
    };
    Voice.onSpeechError = (err: any) => {
      console.log("ERROR:", err);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🤖 Voice Assistant</Text>

      {/* <View style={styles.avatarContainer}>
        <TalkingAvatar text={avatarText} />
      </View> */}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.micButton,
            isListening && { backgroundColor: "#22c55e" },
          ]}
          onPress={handleVoice}
        >
          <Text style={styles.micText}>
            {isListening ? "🎧 Listening..." : "🎤 Start Talking"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* 🎨 Styles */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071028",
    padding: 16,
    paddingTop: Platform.OS === "android" ? 36 : 60,
    justifyContent: "space-between",
  },
  header: {
    fontSize: 20,
    color: "#e6eef8",
    textAlign: "center",
  },
  avatarContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    alignItems: "center",
    marginBottom: 20,
  },
  micButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 16,
    borderRadius: 12,
  },
  micText: {
    fontSize: 18,
    color: "#fff",
  },
});
