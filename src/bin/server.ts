import { ConfigServiceImpl } from "../services/impl/config.service.ts";
import { DeviceServiceImpl } from "../services/impl/device.service.ts";
import { MqttServiceImpl } from "../services/impl/mqtt.service.ts";

// TODO: Refactor this whole file

const configService = new ConfigServiceImpl();
const config = configService.getConfig();

const mqttService = new MqttServiceImpl(config.mqtt);

await mqttService.connect();

const deviceService = new DeviceServiceImpl(config.controllers[0], mqttService);

await deviceService.initializeDevices();
deviceService.startPolling(100);

const shutdown = async () => {
  await deviceService.shutdown();

  await mqttService.disconnect();

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
