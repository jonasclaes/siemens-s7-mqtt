import mqtt, { MqttClient } from "mqtt";
import type { LoggerService } from "../logger.service.ts";
import { LoggerServiceImpl } from "./logger.service.ts";
import type { Mqtt } from "../../generated/config.schema.ts";

export class MqttServiceImpl {
  readonly #loggerService: LoggerService;
  readonly #config: Mqtt;
  #client: MqttClient | null;

  constructor(
    config: Mqtt,
    loggerService: LoggerService = new LoggerServiceImpl(MqttServiceImpl.name)
  ) {
    this.#loggerService = loggerService;
    this.#config = config;
    this.#client = null;
  }

  async connect(): Promise<void> {
    if (this.#client) {
      this.#loggerService.error("Client already connected.");
      throw new Error("Client already connected.");
    }

    const { protocol, host, username, password } = new URL(this.#config.url);

    this.#client = await mqtt.connectAsync(`${protocol}//${host}`, {
      username,
      password,
    });

    this.#loggerService.info("Connected to MQTT broker.");
  }

  async disconnect(): Promise<void> {
    if (!this.#client) {
      this.#loggerService.error("Client not connected.");
      throw new Error("Client not connected.");
    }

    await this.#client.endAsync(false);

    this.#loggerService.info("Disconnected from MQTT broker.");
  }

  async publish(
    topic: string,
    message: string | Buffer,
    opts?: { qos?: 0 | 1 | 2; retain?: boolean }
  ): Promise<void> {
    if (!this.#client) {
      this.#loggerService.error("Client not connected.");
      throw new Error("Client not connected.");
    }

    await this.#client.publishAsync(topic, message, opts);

    this.#loggerService.debug(
      `Published message to topic ${topic}: ${message}`
    );
  }

  async subscribe(
    topic: string,
    callback: (topic: string, payload: Buffer) => void
  ): Promise<void> {
    if (!this.#client) {
      this.#loggerService.error("Client not connected.");
      throw new Error("Client not connected.");
    }

    this.#client.on("message", (_topic, _payload) => {
      if (_topic === topic) {
        this.#loggerService.debug(
          `Received message on topic ${_topic}: ${_payload}`
        );
        callback(_topic, _payload);
      }
    });

    await this.#client.subscribeAsync(topic);

    this.#loggerService.debug(`Subscribed to topic ${topic}`);
  }
}
