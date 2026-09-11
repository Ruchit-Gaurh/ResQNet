import { Vibration } from 'react-native';

import ResQNetBleModule from '../../modules/resqnet-ble';

export async function playNearbyRescuerAlert(): Promise<void> {
  Vibration.vibrate([0, 450, 250, 450, 250, 900], true);
  try {
    await ResQNetBleModule?.playEmergencyAlert();
  } catch (error) {
    console.warn('Emergency alert tone could not start; vibration remains active.', error);
  }
}

export async function stopNearbyRescuerAlert(): Promise<void> {
  Vibration.cancel();
  try {
    await ResQNetBleModule?.stopEmergencyAlert();
  } catch (error) {
    console.warn('Emergency alert tone could not be stopped cleanly.', error);
  }
}
