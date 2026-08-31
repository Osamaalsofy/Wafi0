import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import type { Environment } from '../environment';
import { DOCUMENT_STORAGE } from './document-storage';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalDocumentStorage } from './local-document.storage';
import { createDocumentUploadOptions } from './document-upload.options';
import { S3DocumentStorage } from './s3-document.storage';
import { WaybillsController } from './waybills.controller';
import { WaybillsService } from './waybills.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: createDocumentUploadOptions,
    }),
  ],
  controllers: [DocumentsController, WaybillsController],
  providers: [
    DocumentsService,
    WaybillsService,
    {
      provide: DOCUMENT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => {
        if (config.get('DOCUMENT_STORAGE_PROVIDER', { infer: true }) === 's3') {
          return new S3DocumentStorage({
            bucket: config.get('S3_BUCKET', { infer: true }),
            region: config.get('S3_REGION', { infer: true }),
            endpoint: config.get('S3_ENDPOINT', { infer: true }),
            accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
            secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
            forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
          });
        }
        return new LocalDocumentStorage(config.get('DOCUMENT_STORAGE_LOCAL_PATH', { infer: true }));
      },
    },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
