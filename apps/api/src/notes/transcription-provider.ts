/**
 * Transcription provider seam.
 *
 * No speech-to-text provider is configured yet — transcripts enter the API as
 * text (pasted, dictated, or supplied by the caller). When the agency adds a
 * provider key (e.g. Whisper, Deepgram), implement this interface and wire it
 * into NotesService.transcribe(); the note workflow below doesn't change.
 */
export interface TranscriptionProvider {
  /** Audio bytes → transcript text. */
  transcribe(audio: Buffer, mimeType: string): Promise<string>;
  readonly providerName: string;
}

/** Thrown when transcription is attempted without a configured provider. */
export class TranscriptionNotConfiguredError extends Error {
  constructor() {
    super(
      "No transcription provider is configured. Supply the transcript as text, or configure a provider (see TranscriptionProvider).",
    );
    this.name = "TranscriptionNotConfiguredError";
  }
}
