import { ConfigService } from '@nestjs/config';
import type { MulterModuleOptions } from '@nestjs/platform-express';
import type { Environment } from '../environment';

export function createDocumentUploadOptions(
  config: ConfigService<Environment, true>,
): MulterModuleOptions {
  return {
    limits: {
      fileSize: config.get('DOCUMENT_MAX_SIZE_BYTES', { infer: true }),
      files: 1,
      fields: 3,
      parts: 4,
    },
  };
}
