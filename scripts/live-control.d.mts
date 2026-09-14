export type Readiness = {
  service: boolean;
  collector: boolean;
  printer: boolean;
  camera: boolean;
};
export function readiness(deps?: {
  health?: () => Promise<boolean>;
  appExists?: (path: string) => boolean;
  state?: () => Promise<{ printers: unknown[]; rooms: unknown[] }>;
  printer?: () => Promise<
    { configured?: boolean; enabled?: boolean; status?: string } | undefined
  >;
  room?: () => Promise<{ status?: string } | undefined>;
}): Promise<Readiness>;
export function requestInit(
  method: string,
  token: string,
  body?: unknown,
): {
  method: string;
  headers: Record<string, string>;
  body?: string;
};
export function printerOnline(status: string): boolean;
