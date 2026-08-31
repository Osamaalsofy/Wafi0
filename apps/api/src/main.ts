import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { httpAccessLogMiddleware } from './common/http-access-log.middleware';
import { requestIdMiddleware } from './common/request-id.middleware';
import { handleBootstrapFailure } from './bootstrap-failure';
import type { Environment } from './environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Environment, true>);

  app.enableShutdownHooks();
  app.use(helmet());
  app.use(requestIdMiddleware);
  app.use(httpAccessLogMiddleware);
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const openApiConfig = new DocumentBuilder()
      .setTitle('WAFI OS API')
      .setDescription('Versioned API for the WAFI OS logistics operations platform')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, openApiConfig));
  }

  await app.listen(config.get('API_PORT', { infer: true }));
}

void bootstrap().catch(handleBootstrapFailure);
