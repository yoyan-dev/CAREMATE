import axios from "axios";
import type { Message } from "../types";

const MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? "gemini-2.5-flash-lite";
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

/** Builds a single Gemini prompt from the chat history */
function buildPrompt(messages: Message[]) {
  const systemPrompt = `
    You are an AI Healthcare Assistant named CAREMATE. Follow these rules:
    1) Never provide diagnoses.
    2) Never give medication dosages or prescriptions.
    3) For serious issues, tell the user to seek emergency care.
    4) Provide step-by-step first aid when appropriate.
    5) Ask clarifying questions if details are missing.
    6) Keep responses concise.

    Conversation:
  `;

  return (
    `${systemPrompt}\n` +
    messages
      .map((m) => `${m.role === "assistant" ? "AI" : "User"}: ${m.text}`)
      .join("\n")
  );
}

export async function askGemini(messages: Message[]) {
  if (!API_KEY) {
    throw new Error(
      "Missing EXPO_PUBLIC_GEMINI_API_KEY. Add it to .env and restart Expo."
    );
  }

  const prompt = buildPrompt(messages);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    };

    const response = await axios.post(url, payload);

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "No response from Gemini.";

    return text.trim();
  } catch (error: any) {
    console.error("Gemini error:", error.response?.data || error.message);
    throw new Error("Failed to contact AI assistant");
  }
}

// export async function transcribeAudioLocal(uri: string) {
//   try {
//     const fileInfo = await FileSystem.getInfoAsync(uri);
//     if (!fileInfo.exists) throw new Error("File not found");

//     const formData = new FormData();
//     formData.append("file", {
//       uri,
//       type: "audio/m4a",
//       name: "recording.m4a",
//     });
//     formData.append("model", "gemini-2.0-flash");
//     formData.append("prompt", "Please transcribe this audio.");

//     const response = await fetch(
//       "https://api.genai.google/v1/models/generateContent",
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${API_KEY}`,
//           // Do NOT set Content-Type; fetch sets the boundary automatically
//         },
//         body: formData,
//       }
//     );

//     const data = await response.json();
//     return data?.text ?? null;
//   } catch (err) {
//     console.error("Error transcribing audio:", err);
//     return null;
//   }
// }
