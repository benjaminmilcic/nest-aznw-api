import { Injectable } from '@nestjs/common';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export type SpeechLanguage = 'de' | 'en' | 'hr';

/**
 * Neural voices of Microsoft Edge's "Read aloud" feature. The German and English voices are multilingual, so they
 * also pronounce English technology names in the middle of a German sentence correctly.
 */
const VOICES: Record<SpeechLanguage, string> = {
  de: 'de-DE-SeraphinaMultilingualNeural',
  en: 'en-US-AvaMultilingualNeural',
  hr: 'hr-HR-GabrijelaNeural',
};

/** If edge-tts hangs, the frontend should switch to the browser voice instead of waiting forever */
const SYNTHESIS_TIMEOUT_MS = 15 * 1000;

/**
 * Text-to-speech for the "read aloud" button of the AI chat via edge-tts (msedge-tts): free and without an account,
 * but an unofficial use of the Edge read-aloud service – Microsoft can change or block it at any time. The frontend
 * then falls back to the browser's own voice.
 */
@Injectable()
export class SpeechService {
  async synthesize(text: string, language: SpeechLanguage): Promise<Buffer> {
    const tts = new MsEdgeTTS();
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('edge-tts did not answer')), SYNTHESIS_TIMEOUT_MS);
      });
      return await Promise.race([this.read(tts, text, language), timeout]);
    } finally {
      clearTimeout(timer);
      tts.close();
    }
  }

  private async read(tts: MsEdgeTTS, text: string, language: SpeechLanguage): Promise<Buffer> {
    await tts.setMetadata(VOICES[language], OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(speakable(text)));
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }
}

/** Removes what should not be read out: emojis, Markdown symbols, links and images. */
export function speakable(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) → text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Join_Control}\p{Variation_Selector}]/gu, '') // emojis
    .replace(/^\s*(#{1,6}|[-*+]|\d+\.)\s+/gm, '') // headings and list markers
    .replace(/[*_`~>|]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** The text is placed inside SSML, so <, > and & must be escaped. */
function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
