const { withAndroidManifest } = require('expo/config-plugins');

function upsertPermission(manifest, attributes) {
  const permissions = manifest['uses-permission'] ?? [];
  const name = attributes['android:name'];
  const index = permissions.findIndex((entry) => entry.$?.['android:name'] === name);
  const value = { $: attributes };
  if (index >= 0) permissions[index] = value;
  else permissions.push(value);
  manifest['uses-permission'] = permissions;
}

function removePermission(manifest, name) {
  upsertPermission(manifest, {
    'android:name': name,
    'tools:node': 'remove',
  });
}

module.exports = function withResQNetBle(config) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    upsertPermission(manifest, {
      'android:name': 'android.permission.BLUETOOTH',
      'android:maxSdkVersion': '30',
    });
    upsertPermission(manifest, {
      'android:name': 'android.permission.BLUETOOTH_ADMIN',
      'android:maxSdkVersion': '30',
    });
    upsertPermission(manifest, {
      'android:name': 'android.permission.ACCESS_FINE_LOCATION',
    });
    upsertPermission(manifest, {
      'android:name': 'android.permission.BLUETOOTH_SCAN',
      'android:usesPermissionFlags': 'neverForLocation',
    });
    upsertPermission(manifest, { 'android:name': 'android.permission.BLUETOOTH_CONNECT' });
    upsertPermission(manifest, { 'android:name': 'android.permission.BLUETOOTH_ADVERTISE' });
    removePermission(manifest, 'android.permission.SYSTEM_ALERT_WINDOW');

    const features = manifest['uses-feature'] ?? [];
    if (!features.some((entry) => entry.$?.['android:name'] === 'android.hardware.bluetooth_le')) {
      features.push({
        $: {
          'android:name': 'android.hardware.bluetooth_le',
          'android:required': 'false',
        },
      });
    }
    manifest['uses-feature'] = features;
    return result;
  });
};
