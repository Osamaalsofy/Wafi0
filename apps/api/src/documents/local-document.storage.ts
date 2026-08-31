import { chmod, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { DocumentStorage, StoredDocumentInput } from './document-storage';

export class LocalDocumentStorage implements DocumentStorage {
  private readonly root: string;

  constructor(rootPath: string) {
    this.root = resolve(rootPath);
  }

  async put(input: StoredDocumentInput): Promise<void> {
    const target = this.resolveKey(input.key);
    const directory = dirname(target);
    await this.ensurePrivateDirectory(directory);
    await writeFile(target, input.content, { flag: 'wx', mode: 0o600 });
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  private resolveKey(key: string): string {
    const target = resolve(this.root, key);
    if (!target.startsWith(`${this.root}${sep}`)) throw new Error('Invalid document storage key');
    return target;
  }

  private async ensurePrivateDirectory(directory: string): Promise<void> {
    const segments = relative(this.root, directory).split(sep).filter(Boolean);
    let current = this.root;

    for (const segment of ['', ...segments]) {
      if (segment) current = join(current, segment);
      try {
        const metadata = await lstat(current);
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
          throw new Error('Invalid document storage path');
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await mkdir(current, { mode: 0o700 });
      }
      await chmod(current, 0o700);
    }
  }
}
