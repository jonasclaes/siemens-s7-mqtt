import { Ajv, type ValidateFunction } from "ajv";
import type { SiemensS7MQTTConfiguration } from "../../generated/config.schema.ts";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LoggerService } from "../logger.service.ts";
import { LoggerServiceImpl } from "./logger.service.ts";

export class ConfigServiceImpl {
  readonly #loggerService: LoggerService;
  readonly #configFilePath: string;

  constructor(
    configFilePath?: string,
    loggerService: LoggerService = new LoggerServiceImpl(ConfigServiceImpl.name)
  ) {
    this.#loggerService = loggerService;
    this.#configFilePath =
      configFilePath ?? path.join(process.cwd(), "config.json");
  }

  #isValidData(
    validate: ValidateFunction<unknown>,
    data: unknown
  ): data is SiemensS7MQTTConfiguration {
    return validate(data);
  }

  getConfig(): SiemensS7MQTTConfiguration {
    const ajv = new Ajv();

    const schema = JSON.parse(
      readFileSync(new URL("../../../config.schema.json", import.meta.url), {
        encoding: "utf-8",
      })
    );

    this.#loggerService.debug(
      `Loading configuration from ${this.#configFilePath}`
    );

    const data = JSON.parse(
      readFileSync(this.#configFilePath, {
        encoding: "utf-8",
      })
    );

    const validate = ajv.compile(schema);

    if (!this.#isValidData(validate, data)) {
      this.#loggerService.error(
        `Invalid configuration data: ${JSON.stringify(validate.errors)}`
      );
      throw new Error("Invalid configuration data");
    }

    this.#loggerService.debug(`Configuration data is valid.`);

    return data;
  }
}
