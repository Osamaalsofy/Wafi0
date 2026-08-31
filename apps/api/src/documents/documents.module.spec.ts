import { ConfigService } from '@nestjs/config';
import type { Environment } from '../environment';
import { createDocumentUploadOptions } from './document-upload.options';

describe('createDocumentUploadOptions', () => {
  it('applies the configured file limit while Multer receives the request', () => {
    const config = new ConfigService<Environment, true>({ DOCUMENT_MAX_SIZE_BYTES: 2048 });

    expect(createDocumentUploadOptions(config)).toEqual({
      limits: { fileSize: 2048, files: 1, fields: 3, parts: 4 },
    });
  });
});
