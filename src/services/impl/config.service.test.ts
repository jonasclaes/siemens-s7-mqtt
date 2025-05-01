import test from "ava";
import * as td from "testdouble";

// Mock data for tests
const mockConfig = {
  x: {
    y: "test",
  },
};

let originalEnv: NodeJS.ProcessEnv;

test.before(async () => {
  const fsExports = {
    readFileSync: () => JSON.stringify(mockConfig),
  };
  await td.replaceEsm("fs", fsExports, fsExports);
});

test.after(async () => {
  td.reset();
});

test.beforeEach(async () => {
  // Save original env vars
  originalEnv = { ...process.env };
});

test.afterEach(() => {
  // Restore original env vars
  process.env = { ...originalEnv };
});

test("getOrThrow() should return the correct value for a valid key", async (t) => {
  const { ConfigServiceImpl } = await import("./config.service.ts");

  // Arrange
  const configService = new ConfigServiceImpl("config.json");

  // Act
  const result = configService.getOrThrow<string>("x.y");

  // Assert
  t.is(result, "test");
});

test("getOrThrow() should throw an error if the config entry is not found", async (t) => {
  const { ConfigServiceImpl } = await import("./config.service.ts");

  // Arrange
  const configService = new ConfigServiceImpl("config.json");

  // Act & Assert
  t.throws(
    () => {
      configService.getOrThrow("nonexistentKey");
    },
    { instanceOf: TypeError }
  );
});

test("get() should return the correct value for a valid key", async (t) => {
  const { ConfigServiceImpl } = await import("./config.service.ts");

  // Arrange
  const configService = new ConfigServiceImpl("config.json");

  // Act
  const result = configService.get<string>("x.y");

  // Assert
  t.is(result, "test");
});

test("get() should return undefined for a nonexistent key", async (t) => {
  const { ConfigServiceImpl } = await import("./config.service.ts");

  // Arrange
  const configService = new ConfigServiceImpl("config.json");

  // Act
  const result = configService.get("nonexistentKey");

  // Assert
  t.is(result, undefined);
});

test("environment variables should override config values", async (t) => {
  const { ConfigServiceImpl } = await import("./config.service.ts");

  // Arrange
  process.env.X__Y = "overriddenValue";
  const configService = new ConfigServiceImpl("config.json");

  // Act
  const result = configService.get<string>("x.y");

  // Assert
  t.is(result, "overriddenValue");
});

test("nested environment variables should be properly parsed", async (t) => {
  const { ConfigServiceImpl } = await import("./config.service.ts");

  // Arrange
  process.env.NEW__SECTION__VALUE = "newValue";
  const configService = new ConfigServiceImpl("config.json");

  // Act
  const result = configService.get<string>("new.section.value");

  // Assert
  t.is(result, "newValue");
});
