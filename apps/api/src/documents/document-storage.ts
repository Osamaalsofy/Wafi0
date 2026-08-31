export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');

export interface StoredDocumentInput {
  key: string;
  content: Buffer;
  contentType: string;
}

export interface DocumentStorage {
  put(input: StoredDocumentInput): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  signedGetUrl?(key: string, expiresInSeconds: number): Promise<string>;
}
