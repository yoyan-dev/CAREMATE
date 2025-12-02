// components/ChatBubble.tsx
import { colors } from "@/theme/color";
import { Message } from "@/types/index";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.container, isUser ? styles.userRow : styles.aiRow]}>
      <View
        style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}
      >
        <Text
          style={[
            styles.text,
            { color: isUser ? colors.textDark : colors.textDark },
          ]}
        >
          {message.text}
        </Text>
        <Text style={styles.time}>
          {new Date(message.time).toLocaleTimeString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  userRow: {
    alignItems: "flex-end",
  },
  aiRow: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: colors.bubbleUser,
    borderTopRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.bubbleAI,
    borderTopLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  time: {
    fontSize: 10,
    color: "#666",
    marginTop: 6,
    textAlign: "right",
  },
});
