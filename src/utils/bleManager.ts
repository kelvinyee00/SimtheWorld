
export type BLEConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BLEDeviceState {
  id: string;
  name: string;
  status: BLEConnectionStatus;
  lastValue: number[] | null;
  lastUpdate: number;
}

export class BLEManager {
  private static instance: BLEManager;
  private devices: Map<string, BLEDeviceState> = new Map();
  private deviceObjects: Map<string, BluetoothDevice> = new Map();

  private constructor() {}

  public static getInstance(): BLEManager {
    if (!BLEManager.instance) {
      BLEManager.instance = new BLEManager();
    }
    return BLEManager.instance;
  }

  public async requestDevice(filters?: BluetoothLEScanFilter[], optionalServices?: string[]): Promise<string | null> {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      console.error('Web Bluetooth API not available');
      return null;
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: filters && filters.length > 0 ? filters : undefined,
        acceptAllDevices: !filters || filters.length === 0,
        optionalServices: optionalServices,
      });

      if (!device) return null;

      const deviceId = device.id;
      this.deviceObjects.set(deviceId, device);
      this.devices.set(deviceId, {
        id: deviceId,
        name: device.name || 'Unknown Device',
        status: 'disconnected',
        lastValue: null,
        lastUpdate: 0,
      });

      device.addEventListener('gattserverdisconnected', () => {
        const state = this.devices.get(deviceId);
        if (state) {
          state.status = 'disconnected';
          this.devices.set(deviceId, { ...state });
        }
      });

      return deviceId;
    } catch (error) {
      console.error('BLE Request Error:', error);
      return null;
    }
  }

  public async connect(deviceId: string, characteristicUUID: string, serviceUUID?: string): Promise<boolean> {
    const state = this.devices.get(deviceId);
    const device = this.deviceObjects.get(deviceId);
    if (!state || !device) return false;

    try {
      state.status = 'connecting';
      this.devices.set(deviceId, { ...state });

      if (!device.gatt) throw new Error("GATT not available");
      const server = await device.gatt.connect();

      const service = serviceUUID 
        ? await server.getPrimaryService(serviceUUID)
        : (await server.getPrimaryServices())[0];
      
      const characteristic = await service.getCharacteristic(characteristicUUID);

      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        this.updateValue(deviceId, value);
      });

      await characteristic.startNotifications();

      state.status = 'connected';
      this.devices.set(deviceId, { ...state });
      return true;
    } catch (error) {
      console.error('BLE Connect Error:', error);
      state.status = 'error';
      this.devices.set(deviceId, { ...state });
      return false;
    }
  }

  private updateValue(deviceId: string, dataView: DataView) {
    const state = this.devices.get(deviceId);
    if (!state) return;

    const bytes = [];
    for (let i = 0; i < dataView.byteLength; i++) {
      bytes.push(dataView.getUint8(i));
    }

    state.lastValue = bytes;
    state.lastUpdate = Date.now();
    this.devices.set(deviceId, { ...state });
  }

  public getDeviceState(deviceId: string): BLEDeviceState | undefined {
    return this.devices.get(deviceId);
  }
}
