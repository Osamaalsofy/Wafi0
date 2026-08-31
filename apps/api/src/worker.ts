import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { handleBootstrapFailure } from './bootstrap-failure';
import { OperationsProcessor } from './jobs/operations.processor';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  const processor = app.get(OperationsProcessor);
  processor.start();
  const shutdown = async () => {
    await processor.close();
    await app.close();
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
}

void bootstrapWorker().catch(handleBootstrapFailure);
