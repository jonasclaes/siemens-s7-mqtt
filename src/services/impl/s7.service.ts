import type { S7Service, S7Type } from "../s7.service.ts";
import nodeS7 from "nodes7";
import type { LoggerService } from "../logger.service.ts";
import { LoggerServiceImpl } from "./logger.service.ts";
import type { S7 as S7Config } from "../../generated/config.schema.ts";

interface ReadOperation {
  type: "read";
  address: string;
  resolve: (value: S7Type) => void;
  reject: (error: Error) => void;
}

interface WriteOperation {
  type: "write";
  address: string;
  value: S7Type;
  resolve: () => void;
  reject: (error: Error) => void;
}

type S7Operation = ReadOperation | WriteOperation;

export class S7ServiceImpl implements S7Service {
  readonly #loggerService: LoggerService;
  readonly #config: S7Config;
  readonly #s7Client: nodeS7;
  readonly #s7ConnectionOptions: nodeS7.ConnectionOptions;

  #maxQueueSize = 10_000;

  #operationQueue: S7Operation[] = [];
  #isProcessingQueue = false;

  constructor(
    config: S7Config,
    loggerService: LoggerService = new LoggerServiceImpl(S7ServiceImpl.name)
  ) {
    this.#loggerService = loggerService;
    this.#config = config;
    this.#s7Client = new nodeS7({
      debug: false,
      silent: true,
    });

    this.#s7ConnectionOptions = {
      host: this.#config.host,
      port: this.#config.port ?? 102,
      rack: this.#config.rack ?? 0,
      slot: this.#config.slot ?? 1,
      // @ts-expect-error Undocumented property for nodes7
      doNotOptimize: true,
    };

    this.#loggerService.debug(
      `S7 connection options: ${JSON.stringify(this.#s7ConnectionOptions)}`
    );
  }

  async connect(): Promise<void> {
    return await new Promise((resolve, reject) => {
      this.#s7Client.initiateConnection(this.#s7ConnectionOptions, (err) => {
        if (err) return reject(err);
        return resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    return await new Promise((resolve) => {
      this.#s7Client.dropConnection(() => {
        // Clear all pending requests
        this.#clearQueues();
        return resolve();
      });
    });
  }

  async read(address: string): Promise<S7Type> {
    return await new Promise((resolve, reject) => {
      this.#enqueueOperation({
        type: "read",
        address,
        resolve,
        reject,
      });
    });
  }

  async write(address: string, value: S7Type): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#enqueueOperation({
        type: "write",
        address,
        value,
        resolve,
        reject,
      });
    });
  }

  #enqueueOperation(operation: S7Operation): void {
    const { type, address, reject } = operation;

    // Check if the queue is full
    if (this.#operationQueue.length >= this.#maxQueueSize) {
      this.#loggerService.warn(
        `Operation queue is full. Dropping ${type} request for ${address}.`
      );
      return reject(
        new Error(`Operation queue is full. Max size: ${this.#maxQueueSize}`)
      );
    }

    this.#operationQueue.push(operation);

    this.#loggerService.debug(`Added operation to queue`, {
      address,
      type,
      queueSize: this.#operationQueue.length,
    });

    // Start processing the queue if not already processing
    if (!this.#isProcessingQueue) {
      this.#processQueue();
    }
  }

  #processQueue(): void {
    if (this.#isProcessingQueue || this.#operationQueue.length === 0) {
      return;
    }

    this.#isProcessingQueue = true;
    this.#processNextOperation();
  }

  #processNextOperation(): void {
    if (this.#operationQueue.length === 0) {
      this.#isProcessingQueue = false;
      return;
    }

    const operation = this.#operationQueue.shift()!;
    const { type, address } = operation;

    this.#loggerService.debug(`Processing next operation`, {
      type,
      address,
      queueSize: this.#operationQueue.length,
    });

    if (type === "read") {
      this.#processRead(operation);
    }

    if (type === "write") {
      this.#processWrite(operation);
    }
  }

  #processRead({ address, resolve, reject }: ReadOperation): void {
    this.#s7Client.addItems(address);
    this.#s7Client.readAllItems((err, values) => {
      this.#s7Client.removeItems(address);

      if (err) {
        this.#loggerService.error(`Read failed`, err, {
          address,
        });
        reject(new Error(`Read failed: ${err}`));
      } else {
        this.#loggerService.debug(`Read successful`, {
          address,
        });
        resolve(values[address]);
      }

      // Process next operation
      this.#processNextOperation();
    });
  }

  #processWrite({ address, value, resolve, reject }: WriteOperation): void {
    const result = this.#s7Client.writeItems(address, value, (err) => {
      if (err) {
        this.#loggerService.error(`Write failed`, err, {
          address,
        });
        reject(new Error(`Write failed: ${err}`));
      } else {
        this.#loggerService.debug(`Write successful`, {
          address,
        });
        resolve();
      }

      // Process next operation
      this.#processNextOperation();
    });

    // Handle case where PLC is busy
    if (result !== 0) {
      this.#loggerService.warn(`PLC busy, requeueing write`, {
        address,
      });
      // Put it back at the front of the queue to retry
      this.#operationQueue.unshift({
        type: "write",
        address,
        value,
        resolve,
        reject,
      });

      // Wait before retrying
      setTimeout(() => {
        this.#processNextOperation();
      }, 50);
    }
  }

  #clearQueues(): void {
    // Reject all pending operations
    while (this.#operationQueue.length > 0) {
      const operation = this.#operationQueue.shift()!;
      operation.reject(new Error("S7 service disconnected"));
    }
    this.#isProcessingQueue = false;
  }
}
