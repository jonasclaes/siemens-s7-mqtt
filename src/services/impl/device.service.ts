import type {
  Controller,
  DimmableLight,
  Light,
} from "../../generated/config.schema.ts";
import type { LoggerService } from "../logger.service.ts";
import type { S7Service } from "../s7.service.ts";
import { LoggerServiceImpl } from "./logger.service.ts";
import type { MqttServiceImpl } from "./mqtt.service.ts";
import { S7ServiceImpl } from "./s7.service.ts";

type Device = Light | DimmableLight;

interface DeviceState {
  id: string;
  type: string;
  on: boolean;
  brightness?: number;
  lastUpdated: string;
}

// TODO: Refactor this class to use a more generic approach for handling devices
// and their states. This could involve creating a base class or interface for devices
// and implementing specific logic for each type of device in separate classes.
// This would make the code more maintainable and extensible for future device types.

export class DeviceServiceImpl {
  readonly #loggerService: LoggerService;
  readonly #mqttService: MqttServiceImpl;
  readonly #s7Service: S7Service;
  readonly #config: Controller;

  #deviceStates: Map<string, DeviceState> = new Map();
  #pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    config: Controller,
    mqttService: MqttServiceImpl,
    loggerService: LoggerService = new LoggerServiceImpl(DeviceServiceImpl.name)
  ) {
    this.#loggerService = loggerService;
    this.#config = config;
    this.#mqttService = mqttService;
    this.#s7Service = new S7ServiceImpl(this.#config.s7);
  }

  async initializeDevices() {
    this.#loggerService.info(
      `Registering ${this.#config.devices.length} device(s) for controller ${
        this.#config.s7.host
      }`
    );

    try {
      await this.#s7Service.connect();

      for (const device of this.#config.devices) {
        await this.#initializeDevice(device);
      }

      this.#loggerService.info(
        `Successfully registered ${
          this.#config.devices.length
        } device(s) for controller ${this.#config.s7.host}`
      );
    } catch (error) {
      this.#loggerService.error(`Failed to initialize devices`, error);
      throw error;
    }
  }

  async #initializeDevice(device: Device) {
    this.#loggerService.info(`Initializing device ${device.friendlyName}`);

    // Initial read of device state from PLC
    const plcState = await this.#readDeviceStateFromPLC(device);

    // Store the initial state
    this.#deviceStates.set(device.id, {
      id: device.id,
      type: device.type,
      on: plcState.on,
      brightness: plcState.brightness,
      lastUpdated: new Date().toISOString(),
    });

    this.#loggerService.debug(
      `Device ${device.friendlyName} state read from PLC: ${JSON.stringify(
        plcState
      )}`
    );

    // Register the device with the MQTT service
    await this.#sendDiscovery(device);

    // Publish the initial state to MQTT
    await this.#publishDeviceState(device.id);
  }

  async #sendDiscovery(device: Device) {
    const components: Record<string, object> = {};

    if (device.type === "light") {
      components[`${device.id}-light`] = {
        unique_id: `${device.id}-light`,
        platform: "light",
        command_topic: `siemens-s7-mqtt/${device.id}/command`,
        state_topic: `siemens-s7-mqtt/${device.id}/state`,
        payload_on: "ON",
        payload_off: "OFF",
        optimistic: false,
      };
    }

    if (device.type === "dimmableLight") {
      components[`${device.id}-dimmableLight`] = {
        unique_id: `${device.id}-dimmableLight`,
        platform: "light",
        command_topic: `siemens-s7-mqtt/${device.id}/command`,
        state_topic: `siemens-s7-mqtt/${device.id}/state`,
        brightness_command_topic: `siemens-s7-mqtt/${device.id}/brightness/set`,
        brightness_state_topic: `siemens-s7-mqtt/${device.id}/brightness`,
        payload_on: "ON",
        payload_off: "OFF",
        optimistic: false,
      };
    }

    const discoveryTopic = `homeassistant/device/${device.id}/config`;
    const discoveryPayload = JSON.stringify({
      device: {
        identifiers: [device.id],
        name: device.friendlyName,
        manufacturer: "jonasclaes",
        model: device.type,
        sw_version: "1.0.0",
        serial_number: device.id,
        hw_version: "1.0.0",
      },
      origin: {
        name: "Siemens S7 MQTT",
        sw_version: "1.0.0",
        support_url: "https://github.com/jonasclaes/siemens-s7-mqtt",
      },
      components,
    });

    await this.#mqttService.publish(discoveryTopic, discoveryPayload, {
      qos: 1,
      retain: true,
    });

    this.#loggerService.info(
      `Sent discovery message for device ${device.friendlyName} to topic ${discoveryTopic}`
    );

    if (device.type === "light" || device.type === "dimmableLight") {
      // Subscribe to the command topic for this device
      const commandTopic = `siemens-s7-mqtt/${device.id}/command`;
      await this.#mqttService.subscribe(commandTopic, (_, message) => {
        try {
          const state = message.toString();
          this.#loggerService.debug(`Received command for ${device.id}`, state);

          // Handle the command
          this.handleDeviceCommand(device.id, { state }).catch((err) =>
            this.#loggerService.error(
              `Failed to handle command for ${device.id}`,
              err
            )
          );
        } catch (err) {
          this.#loggerService.error(
            `Invalid command message for ${device.id}`,
            err
          );
        }
      });
    }

    if (device.type === "dimmableLight") {
      // Subscribe to the brightness command topic for this device
      const brightnessTopic = `siemens-s7-mqtt/${device.id}/brightness/set`;
      await this.#mqttService.subscribe(brightnessTopic, (_, message) => {
        try {
          const brightness = parseInt(message.toString(), 10);
          this.#loggerService.info(
            `Received brightness command for ${device.id}`,
            brightness
          );

          // Handle the command
          this.handleDeviceCommand(device.id, { brightness }).catch((err) =>
            this.#loggerService.error(
              `Failed to handle brightness command for ${device.id}`,
              err
            )
          );
        } catch (err) {
          this.#loggerService.error(
            `Invalid brightness command message for ${device.id}`,
            err
          );
        }
      });
    }
  }

  async #readDeviceStateFromPLC(
    device: Device
  ): Promise<{ on: boolean; brightness?: number }> {
    // Read on/off status
    const statusAddress = device.status.on.address;
    const on = (await this.#s7Service.read(statusAddress)) as boolean;

    let brightness: number | undefined = undefined;

    if (device.type === "dimmableLight") {
      // Read brightness level
      const brightnessAddress = device.status.brightness.address;
      brightness = (await this.#s7Service.read(brightnessAddress)) as number;
      this.#loggerService.debug(
        `Read brightness for ${device.friendlyName}: ${brightness}`
      );
    }

    return { on, brightness };
  }

  async #publishDeviceState(deviceId: string): Promise<void> {
    const state = this.#deviceStates.get(deviceId);
    if (!state) {
      this.#loggerService.warn(`No state found for device ${deviceId}`);
      return;
    }

    const device = this.#findDeviceConfig(deviceId);
    if (!device) {
      this.#loggerService.warn(`No device found for ID ${deviceId}`);
      return;
    }

    if (device.type === "light" || device.type === "dimmableLight") {
      const topic = `siemens-s7-mqtt/${deviceId}/state`;
      const payload = state.on ? "ON" : "OFF";
      try {
        await this.#mqttService.publish(topic, payload);
        this.#loggerService.debug(`Published state update for ${deviceId}`);
      } catch (err) {
        this.#loggerService.error(
          `Failed to publish state for ${deviceId}`,
          err
        );
      }
    }

    if (device.type === "dimmableLight") {
      const topic = `siemens-s7-mqtt/${deviceId}/brightness`;
      const payload = state.brightness ?? 0;
      try {
        await this.#mqttService.publish(topic, payload.toString());
        this.#loggerService.debug(
          `Published brightness update for ${deviceId}`
        );
      } catch (err) {
        this.#loggerService.error(
          `Failed to publish brightness for ${deviceId}`,
          err
        );
      }
    }
  }

  async handleDeviceCommand(
    deviceId: string,
    command: Record<string, string | number | boolean>
  ): Promise<void> {
    // Verify device exists
    const deviceState = this.#deviceStates.get(deviceId);
    if (!deviceState) {
      throw new Error(`Unknown device: ${deviceId}`);
    }

    this.#loggerService.info(`Handling command for ${deviceId}`, command);

    try {
      const device = this.#findDeviceConfig(deviceId);

      if (!device) {
        throw new Error(`Device config not found: ${deviceId}`);
      }

      // Process "state" command (turn on/off)
      if ("state" in command) {
        const state = command.state as string;

        if (state === "ON" && device.command.on) {
          await this.#s7Service.write(device.command.on.address, true);
          this.#loggerService.debug(`Turned ON ${deviceId}`);
        } else if (state === "OFF" && device.command.off) {
          await this.#s7Service.write(device.command.off.address, true);
          this.#loggerService.debug(`Turned OFF ${deviceId}`);
        }
      }

      // Process "brightness" command (for dimmable lights)
      if ("brightness" in command && device.type === "dimmableLight") {
        const brightness = command.brightness as number;
        if (device.command.brightness) {
          await this.#s7Service.write(
            device.data.brightness.address,
            brightness
          );
          await this.#s7Service.write(device.command.brightness.address, true);
          this.#loggerService.debug(
            `Set brightness of ${deviceId} to ${brightness}`
          );
        }
      }

      // Read back the actual state from PLC
      await this.#updateDeviceState(deviceId);
    } catch (err) {
      this.#loggerService.error(
        `Failed to process command for ${deviceId}`,
        err
      );
      throw err;
    }
  }

  #findDeviceConfig(deviceId: string): Device | undefined {
    return this.#config.devices.find((d) => d.id === deviceId);
  }

  async #updateDeviceState(deviceId: string) {
    try {
      const deviceState = this.#deviceStates.get(deviceId);

      if (!deviceState) {
        this.#loggerService.error(`Device ${deviceId} not found`);
        return;
      }

      const device = this.#findDeviceConfig(deviceId);

      if (!device) {
        this.#loggerService.error(
          `Device ${deviceId} not found in config for update`
        );
        return;
      }

      const plcState = await this.#readDeviceStateFromPLC(device);

      const newState: DeviceState = {
        ...deviceState,
        on: plcState.on,
        brightness: plcState.brightness,
        lastUpdated: new Date().toISOString(),
      };

      // Only update and publish if the state has changed
      if (this.#hasStateChanged(deviceState, newState)) {
        this.#deviceStates.set(deviceId, newState);
        await this.#publishDeviceState(deviceId);
      }
    } catch (error) {
      this.#loggerService.error(
        `Failed to update state for ${deviceId}`,
        error
      );
    }
  }

  #hasStateChanged(oldState: DeviceState, newState: DeviceState): boolean {
    return (
      oldState.on !== newState.on || oldState.brightness !== newState.brightness
    );
  }

  startPolling(intervalMs: number) {
    if (this.#pollingInterval) {
      this.#loggerService.error("Polling already started.");
      throw new Error("Polling already started.");
    }

    this.#loggerService.info(
      `Starting polling for controller ${
        this.#config.s7.host
      } every ${intervalMs} ms`
    );

    this.#pollingInterval = setInterval(async () => {
      try {
        await this.#pollDevices();
      } catch (error) {
        this.#loggerService.error(`Error while polling devices: ${error}`);
      }
    }, intervalMs);
  }

  async #pollDevices() {
    for (const deviceId of this.#deviceStates.keys()) {
      try {
        await this.#updateDeviceState(deviceId);
      } catch {
        // Already caught in updateDeviceState
      }
    }
  }

  stopPolling() {
    if (!this.#pollingInterval) {
      this.#loggerService.error("Polling not started.");
      throw new Error("Polling not started.");
    }

    this.#loggerService.info(
      `Stopping polling for controller ${this.#config.s7.host}`
    );

    clearInterval(this.#pollingInterval);
    this.#pollingInterval = null;

    this.#loggerService.info(
      `Stopped polling for controller ${this.#config.s7.host}`
    );
  }

  async shutdown() {
    this.#loggerService.info(
      `Shutting down device service for controller ${this.#config.s7.host}`
    );

    this.stopPolling();

    try {
      await this.#s7Service.disconnect();
      this.#loggerService.info(
        `Disconnected from S7 service for controller ${this.#config.s7.host}`
      );
    } catch (error) {
      this.#loggerService.error(
        `Error while disconnecting S7 service: ${error}`
      );
    }

    this.#loggerService.info(
      `Device service for controller ${this.#config.s7.host} shut down`
    );
  }
}
