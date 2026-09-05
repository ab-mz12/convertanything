import { getConverterKind } from '../routing';
import { FORMATS } from '../formats';
import { ConversionError, type ConversionRequest, type ConversionResult } from './types';

/**
 * Convert a single file. Each converter family is loaded on demand so the initial bundle stays
 * small; FFmpeg in particular is only fetched when a video/audio conversion is requested.
 */
export async function convertFile(request: ConversionRequest): Promise<ConversionResult> {
  const kind = getConverterKind(request.source, request.target);
  if (!kind) {
    throw new ConversionError(
      `Converting ${FORMATS[request.source].label} to ${FORMATS[request.target].label} is not supported.`,
    );
  }
  switch (kind) {
    case 'image': {
      const { convertImage } = await import('./image/imageConverter');
      return convertImage(request);
    }
    case 'document': {
      const { convertDocument } = await import('./document/documentConverter');
      return convertDocument(request);
    }
    case 'media': {
      const { convertMedia } = await import('./media/mediaConverter');
      return convertMedia(request);
    }
  }
}
