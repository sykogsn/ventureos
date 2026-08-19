export type TelemetryAttribute = string | number | boolean;

export type Telemetry = {
  counter(name: string, value?: number, attributes?: Record<string, TelemetryAttribute>): void;
  trace(name: string, attributes?: Record<string, TelemetryAttribute>): void;
};

export function createTelemetry(): Telemetry {
  return {
    counter(name, value = 1, attributes) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[telemetry:counter]", name, value, attributes ?? {});
      }
    },
    trace(name, attributes) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[telemetry:trace]", name, attributes ?? {});
      }
    },
  };
}
