import { Message } from "@/types/index";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useState } from "react";
import { askGemini } from "../services/gemini";

export function useVoiceAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState<any>(null);

  // Load messages from AsyncStorage on mount
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem("chatMessages");
        const savedMessages = jsonValue ? JSON.parse(jsonValue) : [];
        if (savedMessages.length === 0) {
          // default welcome message
          const welcome: Message = {
            id: Math.floor(Math.random() * 10000000000000).toString(),
            role: "assistant",
            text: "Hello! I can give general health & first aid information. I do not diagnose or prescribe. How can I help?",
            time: new Date().toISOString(),
          };
          setMessages([welcome]);
        } else {
          setMessages(savedMessages);
        }
      } catch (e) {
        console.error("Failed to load messages:", e);
      }
    };

    loadMessages();
  }, []);

  // Save messages to AsyncStorage whenever they change
  useEffect(() => {
    const saveMessages = async () => {
      try {
        await AsyncStorage.setItem("chatMessages", JSON.stringify(messages));
      } catch (e) {
        console.error("Failed to save messages:", e);
      }
    };
    saveMessages();
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: Math.floor(Math.random() * 10000000000000).toString(),
        role: "user",
        text,
        time: new Date().toISOString(),
      };

      // Add user message
      setMessages((prev) => [...prev, userMsg]);

      setIsThinking(true);

      // AI response
      const aiText = await askGemini([...messages, userMsg]);
      const aiMsg: Message = {
        id: Math.floor(Math.random() * 10000000000000).toString(),
        role: "assistant",
        text: aiText,
        time: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMsg]);

      // TTS
      Speech.speak(aiText, {
        onStart: () => setIsTalking(true),
        onDone: () => setIsTalking(false),
      });

      setIsThinking(false);
    },
    [messages],
  );

  const startListening = useCallback(async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) return;

    setListening(true);

    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();

    setRecording(rec);
  }, []);

  const stopListening = useCallback(async () => {
    setListening(false);

    if (!recording) return;
  }, [recording]);

  return {
    messages,
    isThinking,
    isTalking,
    listening,
    sendMessage,
    startListening,
    stopListening,
  };
}
