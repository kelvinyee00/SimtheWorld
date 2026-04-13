import { SimulationBlockDefinition, BlockStepContext, BlockStepResult } from "@/src/simulation/types";
import { SensorManager } from "@/src/simulation/sensors/SensorManager";

export const GPS_BLOCK_TYPE = "gps";

export interface GpsState {
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  lastUpdate: number;
  permissionRequested: boolean;
}

export const GpsBlock: SimulationBlockDefinition = {
  type: GPS_BLOCK_TYPE,

  initialize: () => ({
    lat: 0,
    lon: 0,
    alt: 0,
    speed: 0,
    lastUpdate: 0,
    permissionRequested: false,
  }),

  outputPortTypes: {
    lat: "number",
    lon: "number",
    alt: "number",
    speed: "number",
  },

  step: (context: BlockStepContext): BlockStepResult => {
    const state = (context.previousState as GpsState) || GpsBlock.initialize!({});
    const sensorManager = SensorManager.getInstance();

    // Side-effect: try to update internal state from browser GPS
    // Note: This is an exception to the pure step function rule for sensors.
    if (!state.permissionRequested && typeof navigator !== 'undefined') {
        sensorManager.requestGeolocationPermission().then(status => {
            if (status === 'granted') {
                navigator.geolocation.watchPosition((pos) => {
                    state.lat = pos.coords.latitude;
                    state.lon = pos.coords.longitude;
                    state.alt = pos.coords.altitude || 0;
                    state.speed = pos.coords.speed || 0;
                    state.lastUpdate = Date.now();
                });
            }
        });
        state.permissionRequested = true;
    }

    return {
      outputs: {
        lat: state.lat,
        lon: state.lon,
        alt: state.alt,
        speed: state.speed,
      },
      nextState: state,
    };
  },
};
