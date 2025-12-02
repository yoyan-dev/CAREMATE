// hooks/useVoiceAssistant.ts
import { Message } from "@/types/index";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useCallback, useState } from "react";
// import { v4 as uuidv4 } from "uuid";
import { askGemini } from "../services/gemini";

export function useVoiceAssistant() {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: Math.floor(Math.random() * 100).toString(),
      role: "assistant",
      text: "Hello! I can give general health & first aid information. I do not diagnose or prescribe. How can I help?",
      time: new Date().toISOString(),
    },
  ]);

  const [isThinking, setIsThinking] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState<any>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: Math.floor(Math.random() * 100).toString(),
        role: "user",
        text,
        time: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);

      setIsThinking(true);

      const aiText = await askGemini([...messages, userMsg]);

      const aiMsg: Message = {
        id: Math.floor(Math.random() * 100).toString(),
        role: "assistant",
        text: aiText,
        time: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMsg]);

      // TTS
      setIsTalking(true);
      Speech.speak(aiText, {
        onDone: () => setIsTalking(false),
      });

      setIsThinking(false);
    },
    [messages]
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

    // try {
    //   await recording.stopAndUnloadAsync();
    //   const uri = recording.getURI();
    //   setRecording(null);

    //   if (!uri) return;

    //   setIsThinking(true);
    //   // const spokenText = await transcribeAudio(uri);
    //   // setIsThinking(false);

    //   // if (spokenText) {
    //   //   await sendMessage(spokenText);
    //   // }

    //   console.log("Recorded file URI:", uri);
    // } catch (err) {
    //   console.error("Error stopping recording or transcribing:", err);
    //   setRecording(null);
    //   setIsThinking(false);
    // }
  }, [recording, sendMessage]);

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
