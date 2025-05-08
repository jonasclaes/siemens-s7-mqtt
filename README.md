# Siemens S7 MQTT

A bridge between Siemens S7 PLCs and MQTT, designed for home automation integration with platforms like Home Assistant.

## Features

- Connect to Siemens S7 PLCs
- Expose PLC values to MQTT
- Control PLC outputs via MQTT
- Auto-discovery for Home Assistant
- Support for various device types:
  - Lights (on/off)
  - Dimmable lights

## Installation

```bash
# Clone the repository
git clone https://github.com/jonasclaes/siemens-s7-mqtt.git
cd siemens-s7-mqtt

# Install dependencies
pnpm install

# Build the project
pnpm run build
```

## Configuration

Create a `config.json` file in the root directory, following the schema defined in `config.schema.json`. Example:

```json
{
  "$schema": "./config.schema.json",
  "mqtt": {
    "url": "mqtt://username:password@broker.example.com:1883"
  },
  "controllers": [
    {
      "s7": {
        "host": "192.168.1.10",
        "port": 102,
        "rack": 0,
        "slot": 1
      },
      "devices": [
        {
          "type": "light",
          "id": "unique-id-1",
          "friendlyName": "Living Room Light",
          "command": {
            "on": {
              "address": "DB1,X0.0"
            },
            "off": {
              "address": "DB1,X0.1"
            }
          },
          "status": {
            "on": {
              "address": "DB1,X2.0"
            }
          }
        }
      ]
    }
  ]
}
```

### Configuration Schema

The configuration follows a JSON schema that defines:

- MQTT broker connection details
- S7 PLC connection parameters
- Device definitions with addresses for inputs and outputs

## Usage

```bash
# Start the service
pnpm start

# For development with auto-reload
pnpm run dev
```

## PLC Addressing

The application uses the `nodes7` library for S7 communication. Address formats:

- `DBx,Xy.z` - Bit at position z of byte y in data block x
- `DBx,By` - Byte y in data block x
- `DBx,Cy` - Char at byte y in data block x
- `DBx,Iy` - 16-bit integer at byte y in data block x
- `DBx,DINTy` - 32-bit integer at byte y in data block x
- `DBx,Ry` - Real (float) at byte y in data block x

## Development

```bash
# Run tests
pnpm test

# Run tests with watch mode
pnpm run test:watch

# Generate code coverage
pnpm run test:coverage

# Generate TypeScript types from schema
pnpm run generate:config-schema
```

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
