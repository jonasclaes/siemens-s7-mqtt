export interface ConfigService {
  get<T>(key: string): T | undefined;
  getOrThrow<T>(key: string): T;
}
