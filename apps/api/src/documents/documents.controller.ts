import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { DocumentsService, type UploadedDocumentFile } from './documents.service';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import { RecordMalwareScanDto } from './dto/record-malware-scan.dto';

@ApiTags('documents')
@ApiBearerAuth()
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @RequirePermissions('document.read')
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListDocumentsQueryDto,
  ) {
    return this.service.list(principal, query);
  }

  @Get(':id')
  @RequirePermissions('document.read')
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(principal, id);
  }

  @Get(':id/content')
  @RequirePermissions('document.read')
  async content(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.service.getContent(principal, id);
    response.set({
      'Content-Type': document.mimeType,
      'Content-Length': String(document.sizeBytes),
      'Content-Disposition': `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(document.content);
  }

  @Post()
  @RequirePermissions('document.upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['missionId', 'type', 'file'],
      properties: {
        missionId: { type: 'string', format: 'uuid' },
        stopId: { type: 'string', format: 'uuid' },
        type: {
          type: 'string',
          enum: [
            'WAYBILL',
            'GATE_PASS',
            'POD',
            'RECEIVER_SIGNATURE',
            'RECEIVER_STAMP',
            'SHORTAGE_PROOF',
            'RETURN_PROOF',
            'OTHER',
          ],
        },
        replacesDocumentId: { type: 'string', format: 'uuid' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  upload(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: UploadDocumentDto,
    @UploadedFile() file?: UploadedDocumentFile,
  ) {
    return this.service.upload(principal, input, file);
  }

  @Post(':id/verify')
  @RequirePermissions('document.verify')
  verify(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: VerifyDocumentDto,
  ) {
    return this.service.verify(principal, id, input);
  }

  @Post(':id/malware-scan')
  @RequirePermissions('document.verify')
  malwareScan(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RecordMalwareScanDto,
  ) {
    return this.service.recordMalwareScan(principal, id, input);
  }
}
