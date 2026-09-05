import { ConversionError } from '../types';
import { convertImageCore, type ImageWorkerRequest, type ImageWorkerResponse } from './imageCore';

self.onmessage = async (event: MessageEvent<ImageWorkerRequest>) => {
  const { id, job } = event.data;
  let response: ImageWorkerResponse;
  try {
    const blob = await convertImageCore(job);
    response = { id, ok: true, blob };
  } catch (error) {
    response = {
      id,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      details: error instanceof ConversionError ? error.details : undefined,
    };
  }
  self.postMessage(response);
};
