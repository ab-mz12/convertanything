// bidi-js ships no TypeScript declarations; this covers the subset we use.
declare module 'bidi-js' {
  export interface EmbeddingLevels {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  }
  export interface Bidi {
    getEmbeddingLevels(text: string, explicitDirection?: 'ltr' | 'rtl'): EmbeddingLevels;
    getReorderSegments(text: string, levels: EmbeddingLevels, start?: number, end?: number): Array<[number, number]>;
    getMirroredCharactersMap(text: string, levels: EmbeddingLevels, start?: number, end?: number): Map<number, string>;
    getMirroredCharacter(char: string): string | null;
    getBidiCharTypeName(char: string): string;
  }
  export default function bidiFactory(): Bidi;
}
