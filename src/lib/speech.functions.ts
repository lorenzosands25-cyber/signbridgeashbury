import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const synthesizeTranslation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ text: z.string().trim().min(1).max(5000) }))
  .handler(async ({ data }): Promise<{ audio: string; error: null } | { audio: null; error: string }> => {
    const key = process.env['ELEVENLABS_API_KEY'];
    if (!key) return { audio: null, error: "ElevenLabs is not connected. Text translation is still available." };
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128", {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error(`ElevenLabs speech failed [${response.status}]: ${body}`);
        return { audio: null, error: `ElevenLabs [${response.status}]: ${body}` };
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return { audio: btoa(binary), error: null };
    } catch {
      return { audio: null, error: "Couldn't reach ElevenLabs. Try playing the translation again." };
    }
  });