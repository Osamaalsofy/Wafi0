export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}
