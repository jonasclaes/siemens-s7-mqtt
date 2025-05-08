export type S7Type = string | number | boolean;

export interface S7Service {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  read(address: string): Promise<S7Type>;
  write(address: string, value: S7Type): Promise<void>;
}
