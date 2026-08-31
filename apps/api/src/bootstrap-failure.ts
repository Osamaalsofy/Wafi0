import { Logger } from '@nestjs/common';

const bootstrapLogger = new Logger('Bootstrap');

type ExitProcess = (code: number) => void;

export function handleBootstrapFailure(
  error: unknown,
  exitProcess: ExitProcess = (code) => process.exit(code),
): void {
  void error;
  bootstrapLogger.error({
    message: 'API bootstrap failed',
    action: 'process_exit',
    exitCode: 1,
  });
  exitProcess(1);
}
