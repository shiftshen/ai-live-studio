import type { FastifyInstance } from "fastify";
import type { Store } from "../store.ts";
import type { Engine } from "../engine.ts";
import type { Worker } from "../worker.ts";
import type { Secrets } from "../providers.ts";
import type { Adapters } from "../adapters.ts";
export interface RouteContext {
  app: FastifyInstance;
  s: Store;
  engine: Engine;
  worker: Worker;
  secrets: Secrets;
  adapters: Adapters;
  dir: string;
  auth: (req: any) => any;
  roomAllowed: (a: any, id: string) => boolean;
  requireRoom: (req: any, id: string) => void;
  admin: (req: any) => void;
}
