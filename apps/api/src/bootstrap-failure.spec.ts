import { Logger } from '@nestjs/common';
import { handleBootstrapFailure } from './bootstrap-failure';

describe('handleBootstrapFailure', () => {
  it('sets a failing exit code and emits only a safe structured event', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const exitProcess = jest.fn();
    const sensitiveError = new Error(
      'postgresql://administrator:secret-password@database.internal/production',
    );

    handleBootstrapFailure(sensitiveError, exitProcess);

    expect(exitProcess).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledWith({
      message: 'API bootstrap failed',
      action: 'process_exit',
      exitCode: 1,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(sensitiveError.message);
    log.mockRestore();
  });
});
