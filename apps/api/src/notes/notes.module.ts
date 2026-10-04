import { Module } from "@nestjs/common";
import { NotesController } from "./notes.controller.js";
import { NotesService } from "./notes.service.js";
import { DeepgramTranscriptionProvider } from "./deepgram-transcription.provider.js";
import {
  TRANSCRIPTION_PROVIDER,
  type TranscriptionProvider,
} from "./transcription-provider.js";

@Module({
  controllers: [NotesController],
  providers: [
    NotesService,
    {
      // Null when no provider key is configured — the service fails loudly
      // instead of silently skipping transcription.
      provide: TRANSCRIPTION_PROVIDER,
      useFactory: (): TranscriptionProvider | null =>
        process.env.DEEPGRAM_API_KEY ? new DeepgramTranscriptionProvider() : null,
    },
  ],
})
export class NotesModule {}
