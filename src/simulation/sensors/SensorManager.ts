export type SensorPermissionStatus = 'prompt' | 'granted' | 'denied';


interface DevicePermissionRequest {
  requestPermission?: () => Promise<SensorPermissionStatus>;
}

export class SensorManager {
  private static instance: SensorManager;
  private permissions: Map<string, SensorPermissionStatus> = new Map();

  private constructor() {}

  public static getInstance(): SensorManager {
    if (!SensorManager.instance) {
      SensorManager.instance = new SensorManager();
    }
    return SensorManager.instance;
  }

  public async requestGeolocationPermission(): Promise<SensorPermissionStatus> {
    if (this.permissions.get('geolocation') === 'granted') return 'granted';
    
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        this.permissions.set('geolocation', 'denied');
        resolve('denied');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => {
          this.permissions.set('geolocation', 'granted');
          resolve('granted');
        },
        () => {
          this.permissions.set('geolocation', 'denied');
          resolve('denied');
        }
      );
    });
  }

  public async requestDeviceMotionPermission(): Promise<SensorPermissionStatus> {
    if (this.permissions.get('devicemotion') === 'granted') return 'granted';
    if (typeof window === 'undefined') return 'denied';

    // Handle iOS 13+ requestPermission pattern
    if (typeof (DeviceMotionEvent as unknown as DevicePermissionRequest).requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as unknown as Required<DevicePermissionRequest>).requestPermission();
        this.permissions.set('devicemotion', response);
        return response;
      } catch (e) {
        this.permissions.set('devicemotion', 'denied');
        return 'denied';
      }
    }

    // Non-iOS or older devices - assume granted if event exists
    if ('DeviceMotionEvent' in window) {
      this.permissions.set('devicemotion', 'granted');
      return 'granted';
    }

    this.permissions.set('devicemotion', 'denied');
    return 'denied';
  }

  public async requestDeviceOrientationPermission(): Promise<SensorPermissionStatus> {
    if (this.permissions.get('deviceorientation') === 'granted') return 'granted';
    if (typeof window === 'undefined') return 'denied';

    if (typeof (DeviceOrientationEvent as unknown as DevicePermissionRequest).requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as unknown as Required<DevicePermissionRequest>).requestPermission();
        this.permissions.set('deviceorientation', response);
        return response;
      } catch (e) {
        this.permissions.set('deviceorientation', 'denied');
        return 'denied';
      }
    }

    if ('DeviceOrientationEvent' in window) {
      this.permissions.set('deviceorientation', 'granted');
      return 'granted';
    }

    this.permissions.set('deviceorientation', 'denied');
    return 'denied';
  }

  public getPermissionStatus(sensor: string): SensorPermissionStatus {
    return this.permissions.get(sensor) || 'prompt';
  }
}
