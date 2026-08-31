import { access, mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDocumentStorage } from './local-document.storage';

describe('LocalDocumentStorage', () => {
  let temporaryRoot: string;

  beforeEach(async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'wafi-documents-'));
  });

  afterEach(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it('stores document directories and files with private permissions', async () => {
    const storage = new LocalDocumentStorage(temporaryRoot);
    const key = 'organization/mission/document.pdf';

    await storage.put({ key, content: Buffer.from('%PDF-test'), contentType: 'application/pdf' });

    expect(await readFile(join(temporaryRoot, key), 'utf8')).toBe('%PDF-test');
    expect((await stat(join(temporaryRoot, 'organization/mission'))).mode & 0o777).toBe(0o700);
    expect((await stat(join(temporaryRoot, key))).mode & 0o777).toBe(0o600);
  });

  it.each(['../escape.pdf', 'organization/../../escape.pdf', '/tmp/escape.pdf'])(
    'rejects a storage key outside its root: %s',
    async (key) => {
      const storage = new LocalDocumentStorage(temporaryRoot);

      await expect(
        storage.put({ key, content: Buffer.from('test'), contentType: 'application/pdf' }),
      ).rejects.toThrow('Invalid document storage key');
    },
  );

  it('does not follow a symbolic link outside the storage root', async () => {
    const externalRoot = await mkdtemp(join(tmpdir(), 'wafi-documents-external-'));
    await symlink(externalRoot, join(temporaryRoot, 'linked'));
    const storage = new LocalDocumentStorage(temporaryRoot);

    await expect(
      storage.put({
        key: 'linked/escape.pdf',
        content: Buffer.from('test'),
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow('Invalid document storage path');
    await expect(access(join(externalRoot, 'escape.pdf'))).rejects.toMatchObject({
      code: 'ENOENT',
    });

    await rm(externalRoot, { recursive: true, force: true });
  });
});
