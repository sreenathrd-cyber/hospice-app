/**
 * Deepgram speech-to-text transcription provider.
 *
 * Sends raw audio bytes to Deepgram's /v1/listen endpoint and returns the
 * plain transcript. The API key is read from process.env.DEEPGRAM_API_KEY
 * at call time (never bundled, never logged).
 *
 * HIPAA note: run this only under a signed Deepgram BAA before any real
 * patient audio flows through it. Demo/fake data is fine.
 */
import type { TranscriptionProvider } from "./transcription-provider.js";

const DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen";

interface DeepgramListenResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{ transcript?: string }>;
    }>;
  };
}

function extractTranscript(payload: DeepgramListenResponse): string {
  const channels = payload.results?.channels ?? [];
  return channels
    .map((c) => c.alternatives?.[0]?.transcript ?? "")
    .filter((t) => t.length > 0)
    .join(" ")
    .trim();
}

export class DeepgramTranscriptionProvider implements TranscriptionProvider {
  readonly providerName = "deepgram";

  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY is not set");
    }
    if (audio.length === 0) {
      throw new Error("Empty audio payload");
    }

    const url =
      `${DEEPGRAM_LISTEN_URL}?model=nova-3&smart_format=true` +
      `&punctuate=true&diarize=false&language=en`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": mimeType,
        },
        body: new Uint8Array(audio),
      });
    } catch (err) {
      throw new Error(`Deepgram request failed: ${err instanceof Error ? err.message : err}`);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Deepgram error ${res.status}: ${detail.slice(0, 300)}`);
    }
    const payload = (await res.json()) as DeepgramListenResponse;
    const transcript = extractTranscript(payload);
    if (!transcript) {
      throw new Error("Deepgram returned no transcript for this audio");
    }
    return transcript;
  }
}
