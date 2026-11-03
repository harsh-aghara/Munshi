/**
 * Ambient Node and Web API declarations for TypeScript compilation.
 */

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

declare var process: {
  env: NodeJS.ProcessEnv;
  exit(code?: number): never;
  cwd(): string;
  stdout: {
    write(str: string): boolean;
  };
};

declare class Buffer {
  static from(str: string | Uint8Array, encoding?: string): Uint8Array;
}

declare module 'crypto' {
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
  export function randomUUID(): string;
}

declare module 'node:net' {
  export function isIP(input: string): number;
}

declare module 'node:dns/promises' {
  export interface MxRecord {
    exchange: string;
    priority: number;
  }
  export interface LookupAddress {
    address: string;
    family: number;
  }
  export function resolveMx(hostname: string): Promise<MxRecord[]>;
  export function lookup(
    hostname: string,
    options: { all: boolean },
  ): Promise<LookupAddress[]>;
}
