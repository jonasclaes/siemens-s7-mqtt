import * as fs from "fs";
import * as path from "path";
import type { ConfigService } from "../config.service.ts";

// Define more specific types for better type safety
type ConfigValue =
  | string
  | number
  | boolean
  | null
  | ConfigObject
  | ConfigArray;
type ConfigObject = { [key: string]: ConfigValue };
type ConfigArray = ConfigValue[];

export class ConfigServiceImpl implements ConfigService {
  protected config: ConfigObject;

  constructor(
    configFilePath: string = path.resolve(process.cwd(), "config.json")
  ) {
    this.config = this.loadConfig(configFilePath);
    this.mergeWithEnvironmentVars();
  }

  get<T>(key: string): T | undefined {
    return this.getValueByPath(key, this.config) as T | undefined;
  }

  getOrThrow<T>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new TypeError(`Configuration key '${key}' not found`);
    }
    return value;
  }

  private loadConfig(configFilePath: string): ConfigObject {
    try {
      const configContent = fs.readFileSync(configFilePath, "utf8");
      return JSON.parse(configContent) as ConfigObject;
    } catch (error) {
      console.warn(`Failed to load config file: ${(error as Error).message}`);
      return {};
    }
  }

  private mergeWithEnvironmentVars(): void {
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        // Convert environment variables with __ to nested objects
        // e.g. MQTT__URL -> mqtt.url
        const pathParts = key.toLowerCase().split("__");

        if (pathParts.length > 1) {
          this.setValueByPath(pathParts, value, this.config);
        }
      }
    }
  }

  private getValueByPath(path: string, obj: ConfigObject): unknown {
    const pathParts = path.split(".");
    let current: ConfigValue = obj;

    for (const part of pathParts) {
      if (
        current === undefined ||
        current === null ||
        typeof current !== "object"
      ) {
        return undefined;
      }

      // Check if current is an object with the expected property
      if (
        typeof current === "object" &&
        !Array.isArray(current) &&
        part in current
      ) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private setValueByPath(
    pathParts: string[],
    value: string,
    obj: ConfigObject
  ): void {
    let current = obj;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];

      // If the path doesn't exist yet, create it
      if (
        !(part in current) ||
        typeof current[part] !== "object" ||
        current[part] === null ||
        Array.isArray(current[part])
      ) {
        current[part] = {};
      }

      // We've verified current[part] is an object, safe to cast
      current = current[part] as ConfigObject;
    }

    const lastPart = pathParts[pathParts.length - 1];
    current[lastPart] = value;
  }
}
