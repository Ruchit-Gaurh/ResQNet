package org.resqnet.ble

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.MessageDigest
import java.util.ArrayDeque
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private const val MANUFACTURER_ID = 0x5251
// Legacy Android advertisements are limited to 31 bytes. Flags (3 bytes), the
// 128-bit ResQNet service UUID (18 bytes), and manufacturer framing (4 bytes)
// leave 6 bytes. Keep the rotating pseudonymous tag at 4 bytes so the packet
// fits across phones that do not support extended advertising.
private const val ADVERTISEMENT_TAG_BYTES = 4
private const val DEFAULT_FRAME_BYTES = 20
private const val REQUESTED_MTU = 247
private const val PEER_EVENT_THROTTLE_MS = 5_000L
private val CLIENT_CONFIGURATION_UUID: UUID =
  UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

private data class CentralLink(
  val peerId: String,
  val gatt: BluetoothGatt,
  val inbound: BluetoothGattCharacteristic,
  var frameBytes: Int,
  var ready: Boolean,
)

private data class PendingWrite(val bytes: ByteArray, val promise: Promise)
private data class PendingServerWrite(
  val peerId: String,
  val device: BluetoothDevice,
  val bytes: ByteArray,
  val promise: Promise,
)

/**
 * ResQNet's Android-only BLE byte radio. Both phones advertise a private
 * ResQNet service, scan only for that service, host a GATT server, and can act
 * as a GATT client. The TypeScript transport owns disaster protocol semantics.
 */
class ResQNetBleModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val devicesByPeerId = ConcurrentHashMap<String, BluetoothDevice>()
  private val peerIdByAddress = ConcurrentHashMap<String, String>()
  private val lastPeerEventAt = ConcurrentHashMap<String, Long>()
  private val centralLinks = ConcurrentHashMap<String, CentralLink>()
  private val pendingConnections = ConcurrentHashMap.newKeySet<String>()
  private val centralWriteQueues = ConcurrentHashMap<String, ArrayDeque<PendingWrite>>()
  private val serverDevices = ConcurrentHashMap<String, BluetoothDevice>()
  private val serverFrameBytes = ConcurrentHashMap<String, Int>()
  private val serverReadyPeers = ConcurrentHashMap.newKeySet<String>()
  private val serverWriteQueue = ArrayDeque<PendingServerWrite>()

  private var scanner: BluetoothLeScanner? = null
  private var scanCallback: ScanCallback? = null
  private var advertiseCallback: AdvertiseCallback? = null
  private var gattServer: BluetoothGattServer? = null
  private var outboundCharacteristic: BluetoothGattCharacteristic? = null
  private var wantedServiceUuid: UUID? = null
  private var inboundUuid: UUID? = null
  private var outboundUuid: UUID? = null
  private var advertisingConfig: Map<String, Any?>? = null
  private var scanningServiceUuid: UUID? = null
  private var ephemeralSeed = ""
  private var rotationMs = 15 * 60 * 1000L
  private var registeredReceiver = false
  private var emergencyTone: ToneGenerator? = null
  private var emergencyToneRunnable: Runnable? = null
  private var originalAlarmVolume: Int? = null

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is unavailable." }

  private val bluetoothManager: BluetoothManager?
    get() = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager

  private val bluetoothAdapter: BluetoothAdapter?
    get() = bluetoothManager?.adapter

  override fun definition() = ModuleDefinition {
    Name("ResQNetBle")
    Events(
      "onPeerFound",
      "onConnectionChanged",
      "onFrameReceived",
      "onRadioStateChanged",
      "onRadioError",
    )

    AsyncFunction("getStatus") { getStatus() }
    AsyncFunction("startAdvertising") { config: Map<String, Any?> ->
      startAdvertising(config)
    }
    AsyncFunction("startScanning") { serviceUuid: String ->
      startScanning(UUID.fromString(serviceUuid))
    }
    AsyncFunction("connect") { peerId: String -> connect(peerId) }
    AsyncFunction("disconnect") { peerId: String -> disconnect(peerId) }
    AsyncFunction("writeFrame") {
        peerId: String,
        characteristicUuid: String,
        frame: List<Int>,
        promise: Promise ->
      writeFrame(peerId, UUID.fromString(characteristicUuid), frame, promise)
    }
    AsyncFunction("playEmergencyAlert") { playEmergencyAlert() }
    AsyncFunction("stopEmergencyAlert") { stopEmergencyAlert() }
    AsyncFunction("stop") { stopAll() }

    OnCreate { registerBluetoothReceiver() }
    OnActivityEntersBackground { pauseDiscovery() }
    OnActivityEntersForeground { resumeDiscovery() }
    OnDestroy {
      stopEmergencyAlert()
      stopAll()
      unregisterBluetoothReceiver()
    }
  }

  private fun playEmergencyAlert() {
    stopEmergencyAlert()
    val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    if (audioManager != null) {
      originalAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM)
      audioManager.setStreamVolume(
        AudioManager.STREAM_ALARM,
        audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM),
        0,
      )
    }
    val tone = ToneGenerator(AudioManager.STREAM_ALARM, 100)
    emergencyTone = tone
    val runnable = object : Runnable {
      override fun run() {
        if (emergencyTone !== tone) return
        tone.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 420)
        mainHandler.postDelayed(this, 700)
      }
    }
    emergencyToneRunnable = runnable
    mainHandler.post(runnable)

    val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 450, 250, 450, 250, 900), 0))
    } else {
      @Suppress("DEPRECATION")
      vibrator?.vibrate(longArrayOf(0, 450, 250, 450, 250, 900), 0)
    }
  }

  private fun stopEmergencyAlert() {
    emergencyToneRunnable?.let(mainHandler::removeCallbacks)
    emergencyToneRunnable = null
    emergencyTone?.stopTone()
    emergencyTone?.release()
    emergencyTone = null
    val savedVolume = originalAlarmVolume
    originalAlarmVolume = null
    if (savedVolume != null) {
      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      audioManager?.setStreamVolume(AudioManager.STREAM_ALARM, savedVolume, 0)
    }
    val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    vibrator?.cancel()
  }

  private fun getStatus(): Map<String, Any> {
    val adapter = bluetoothAdapter
    val supported = context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE) && adapter != null
    val enabled = try {
      adapter?.isEnabled == true
    } catch (_: SecurityException) {
      // Permission state is evaluated in JavaScript before radio work starts.
      true
    }
    val canAdvertise = try {
      supported && adapter?.isMultipleAdvertisementSupported == true && adapter.bluetoothLeAdvertiser != null
    } catch (_: SecurityException) {
      false
    }
    val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    val locationEnabled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      locationManager?.isLocationEnabled != false
    } else {
      @Suppress("DEPRECATION")
      (locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true ||
        locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true)
    }
    return mapOf(
      "sdkInt" to Build.VERSION.SDK_INT,
      "supported" to supported,
      "enabled" to enabled,
      "locationEnabled" to locationEnabled,
      "canScan" to supported,
      "canAdvertise" to canAdvertise,
      "canGattClient" to supported,
      "canGattServer" to supported,
    )
  }

  private fun startAdvertising(config: Map<String, Any?>) {
    requireRadioPermissions(advertise = true)
    val service = UUID.fromString(config["serviceUuid"] as? String ?: error("serviceUuid is required."))
    val inbound = UUID.fromString(config["inboundCharacteristicUuid"] as? String ?: error("inboundCharacteristicUuid is required."))
    val outbound = UUID.fromString(config["outboundCharacteristicUuid"] as? String ?: error("outboundCharacteristicUuid is required."))
    wantedServiceUuid = service
    inboundUuid = inbound
    outboundUuid = outbound
    ephemeralSeed = config["ephemeralTag"] as? String ?: error("ephemeralTag is required.")
    rotationMs = (config["rotationMs"] as? Number)?.toLong()?.coerceAtLeast(60_000L)
      ?: 15 * 60 * 1000L
    advertisingConfig = config
    openGattServer(service, inbound, outbound)
    startAdvertiser(service)
  }

  private fun openGattServer(serviceUuid: UUID, inbound: UUID, outbound: UUID) {
    if (gattServer != null) return
    val server = bluetoothManager?.openGattServer(context, gattServerCallback)
      ?: error("Android could not open a BLE GATT server.")
    val service = BluetoothGattService(serviceUuid, BluetoothGattService.SERVICE_TYPE_PRIMARY)
    val inboundCharacteristic = BluetoothGattCharacteristic(
      inbound,
      BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
      BluetoothGattCharacteristic.PERMISSION_WRITE,
    )
    val outboundValue = BluetoothGattCharacteristic(
      outbound,
      BluetoothGattCharacteristic.PROPERTY_NOTIFY,
      BluetoothGattCharacteristic.PERMISSION_READ,
    )
    outboundValue.addDescriptor(
      BluetoothGattDescriptor(
        CLIENT_CONFIGURATION_UUID,
        BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE,
      ),
    )
    service.addCharacteristic(inboundCharacteristic)
    service.addCharacteristic(outboundValue)
    if (!server.addService(service)) {
      server.close()
      error("Android rejected the ResQNet GATT service.")
    }
    gattServer = server
    outboundCharacteristic = outboundValue
  }

  private fun startAdvertiser(serviceUuid: UUID) {
    val adapter = bluetoothAdapter ?: error("Bluetooth is unsupported.")
    if (!adapter.isEnabled) error("Bluetooth is disabled.")
    val advertiser = adapter.bluetoothLeAdvertiser ?: error("BLE advertising is unsupported on this device.")
    advertiseCallback?.let { runCatching { advertiser.stopAdvertising(it) } }
    val callback = object : AdvertiseCallback() {
      override fun onStartFailure(errorCode: Int) {
        emitError("advertising", "Android BLE advertising failed with code $errorCode.")
      }
    }
    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
      .setConnectable(true)
      .setTimeout(0)
      .build()
    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .addServiceUuid(ParcelUuid(serviceUuid))
      .addManufacturerData(MANUFACTURER_ID, rotatingTag())
      .build()
    advertiser.startAdvertising(settings, data, callback)
    advertiseCallback = callback
    scheduleAdvertisementRotation()
  }

  private fun scheduleAdvertisementRotation() {
    mainHandler.removeCallbacks(advertisementRotation)
    mainHandler.postDelayed(advertisementRotation, rotationMs)
  }

  private val advertisementRotation = object : Runnable {
    override fun run() {
      val service = wantedServiceUuid ?: return
      runCatching { startAdvertiser(service) }.onFailure { emitError("advertising", it.message ?: "Could not rotate advertisement.") }
    }
  }

  private fun rotatingTag(): ByteArray {
    // Mobile persists identities as NODE-XXXXXXXX. Advertising those four
    // pseudonymous bytes lets both phones show the same stable ResQNet name
    // without exposing an Android Bluetooth address or any report data.
    val encodedNodeId = ephemeralSeed
      .removePrefix("NODE-")
      .takeIf { value ->
        value.length == ADVERTISEMENT_TAG_BYTES * 2 &&
          value.all { character -> character in '0'..'9' || character in 'A'..'F' || character in 'a'..'f' }
      }
      ?.chunked(2)
      ?.map { it.toInt(16).toByte() }
      ?.toByteArray()
    return encodedNodeId ?: MessageDigest.getInstance("SHA-256")
      .digest(ephemeralSeed.toByteArray(Charsets.UTF_8))
      .copyOfRange(0, ADVERTISEMENT_TAG_BYTES)
  }

  private fun startScanning(serviceUuid: UUID) {
    requireRadioPermissions(scan = true)
    scanningServiceUuid = serviceUuid
    val adapter = bluetoothAdapter ?: error("Bluetooth is unsupported.")
    if (!adapter.isEnabled) error("Bluetooth is disabled.")
    val leScanner = adapter.bluetoothLeScanner ?: error("BLE scanning is unavailable.")
    scanCallback?.let { runCatching { leScanner.stopScan(it) } }
    val callback = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        acceptScanResult(result)
      }

      override fun onBatchScanResults(results: MutableList<ScanResult>) {
        results.forEach(::acceptScanResult)
      }

      override fun onScanFailed(errorCode: Int) {
        emitError("scanning", "Android BLE scan failed with code $errorCode.")
      }
    }
    val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(serviceUuid)).build()
    val settings = ScanSettings.Builder()
      .setScanMode(ScanSettings.SCAN_MODE_BALANCED)
      .setReportDelay(0)
      .build()
    leScanner.startScan(listOf(filter), settings, callback)
    scanner = leScanner
    scanCallback = callback
  }

  private fun acceptScanResult(result: ScanResult) {
    val bytes = result.scanRecord?.getManufacturerSpecificData(MANUFACTURER_ID) ?: return
    if (bytes.isEmpty()) return
    val peerId = "NODE-${bytes.joinToString("") { "%02X".format(it.toInt() and 0xFF) }}"
    val address = result.device.address
    peerIdByAddress[address]?.takeIf { it != peerId }?.let { oldPeer -> devicesByPeerId.remove(oldPeer) }
    peerIdByAddress[address] = peerId
    devicesByPeerId[peerId] = result.device
    val now = System.currentTimeMillis()
    val last = lastPeerEventAt[peerId] ?: 0L
    if (now - last >= PEER_EVENT_THROTTLE_MS) {
      lastPeerEventAt[peerId] = now
      emit("onPeerFound", mapOf("peerId" to peerId, "lastSeenAt" to now.toDouble()))
    }
  }

  private fun connect(peerId: String) {
    requireRadioPermissions(connect = true)
    if (centralLinks.containsKey(peerId) || !pendingConnections.add(peerId)) return
    val device = devicesByPeerId[peerId]
    if (device == null) {
      pendingConnections.remove(peerId)
      error("ResQNet peer $peerId is no longer discoverable.")
    }
    try {
      device.connectGatt(context, false, createGattCallback(peerId), BluetoothDevice.TRANSPORT_LE)
    } catch (error: Throwable) {
      pendingConnections.remove(peerId)
      throw error
    }
  }

  private fun createGattCallback(peerId: String): BluetoothGattCallback {
    var frameBytes = DEFAULT_FRAME_BYTES
    return object : BluetoothGattCallback() {
      override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
        if (status == BluetoothGatt.GATT_SUCCESS && newState == BluetoothProfile.STATE_CONNECTED) {
          runCatching { gatt.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH) }
          if (!runCatching { gatt.requestMtu(REQUESTED_MTU) }.getOrDefault(false)) {
            gatt.discoverServices()
          }
          return
        }
        pendingConnections.remove(peerId)
        removeCentralLink(peerId, "connection closed")
        runCatching { gatt.close() }
        emitConnection(peerId, false, frameBytes)
        if (status != BluetoothGatt.GATT_SUCCESS) emitError("connection", "Peer $peerId disconnected with GATT status $status.")
      }

      override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
        if (status == BluetoothGatt.GATT_SUCCESS) frameBytes = (mtu - 3).coerceIn(DEFAULT_FRAME_BYTES, 244)
        gatt.discoverServices()
      }

      override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
          failConnection(peerId, gatt, "service discovery failed with status $status")
          return
        }
        val service = wantedServiceUuid?.let(gatt::getService)
        val inbound = inboundUuid?.let { service?.getCharacteristic(it) }
        val outbound = outboundUuid?.let { service?.getCharacteristic(it) }
        if (service == null || inbound == null || outbound == null) {
          failConnection(peerId, gatt, "peer does not expose the ResQNet GATT service")
          return
        }
        val link = CentralLink(peerId, gatt, inbound, frameBytes, false)
        centralLinks[peerId] = link
        pendingConnections.remove(peerId)
        val notificationEnabled = runCatching { gatt.setCharacteristicNotification(outbound, true) }.getOrDefault(false)
        val descriptor = outbound.getDescriptor(CLIENT_CONFIGURATION_UUID)
        if (!notificationEnabled || descriptor == null) {
          markCentralReady(peerId)
          return
        }
        val started = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          gatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) == BluetoothStatusCodes.SUCCESS
        } else {
          @Suppress("DEPRECATION")
          descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
          @Suppress("DEPRECATION")
          gatt.writeDescriptor(descriptor)
        }
        if (!started) markCentralReady(peerId)
      }

      override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
        if (descriptor.uuid == CLIENT_CONFIGURATION_UUID) {
          if (status == BluetoothGatt.GATT_SUCCESS) markCentralReady(peerId)
          else failConnection(peerId, gatt, "notification setup failed with status $status")
        }
      }

      @Deprecated("Deprecated in Android 13")
      override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
        if (characteristic.uuid == outboundUuid) emitFrame(peerId, characteristic.value ?: byteArrayOf())
      }

      override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
        if (characteristic.uuid == outboundUuid) emitFrame(peerId, value)
      }

      override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
        if (characteristic.uuid == inboundUuid) completeCentralWrite(peerId, status)
      }
    }
  }

  private fun markCentralReady(peerId: String) {
    val link = centralLinks[peerId] ?: return
    if (link.ready) return
    link.ready = true
    emitConnection(peerId, true, link.frameBytes)
  }

  private fun failConnection(peerId: String, gatt: BluetoothGatt, reason: String) {
    emitError("connection", "Peer $peerId $reason.")
    pendingConnections.remove(peerId)
    removeCentralLink(peerId, reason)
    runCatching { gatt.disconnect() }
    runCatching { gatt.close() }
    emitConnection(peerId, false, DEFAULT_FRAME_BYTES)
  }

  private fun disconnect(peerId: String) {
    centralLinks.remove(peerId)?.let { link ->
      runCatching { link.gatt.disconnect() }
      runCatching { link.gatt.close() }
    }
    serverDevices.remove(peerId)?.let { device -> runCatching { gattServer?.cancelConnection(device) } }
    serverReadyPeers.remove(peerId)
    rejectCentralQueue(peerId, "Peer disconnected before frame transfer completed.")
    emitConnection(peerId, false, DEFAULT_FRAME_BYTES)
  }

  private fun writeFrame(peerId: String, characteristicUuid: UUID, frame: List<Int>, promise: Promise) {
    if (characteristicUuid != inboundUuid) {
      promise.reject("ERR_BLE_CHARACTERISTIC", "Only the ResQNet inbound characteristic is writable.", null)
      return
    }
    val bytes = frame.map { (it and 0xFF).toByte() }.toByteArray()
    val central = centralLinks[peerId]
    if (central?.ready == true) {
      val queue = centralWriteQueues.computeIfAbsent(peerId) { ArrayDeque() }
      synchronized(queue) {
        queue.addLast(PendingWrite(bytes, promise))
        if (queue.size == 1) startNextCentralWrite(peerId)
      }
      return
    }
    val serverDevice = serverDevices[peerId]
    if (serverDevice != null && serverReadyPeers.contains(peerId)) {
      synchronized(serverWriteQueue) {
        serverWriteQueue.addLast(PendingServerWrite(peerId, serverDevice, bytes, promise))
        if (serverWriteQueue.size == 1) startNextServerWrite()
      }
      return
    }
    promise.reject("ERR_BLE_NOT_CONNECTED", "ResQNet peer $peerId is not ready for transfer.", null)
  }

  private fun startNextCentralWrite(peerId: String) {
    val queue = centralWriteQueues[peerId] ?: return
    val pending = queue.peekFirst() ?: return
    val link = centralLinks[peerId]
    if (link == null || !link.ready) {
      rejectCentralQueue(peerId, "Peer disconnected before frame transfer completed.")
      return
    }
    val started = try {
      link.inbound.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        link.gatt.writeCharacteristic(link.inbound, pending.bytes, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS
      } else {
        @Suppress("DEPRECATION")
        link.inbound.value = pending.bytes
        @Suppress("DEPRECATION")
        link.gatt.writeCharacteristic(link.inbound)
      }
    } catch (error: Throwable) {
      false
    }
    if (!started) {
      queue.pollFirst()?.promise?.reject("ERR_BLE_WRITE", "Android rejected the BLE frame write.", null)
      if (queue.isNotEmpty()) startNextCentralWrite(peerId)
    }
  }

  private fun completeCentralWrite(peerId: String, status: Int) {
    val queue = centralWriteQueues[peerId] ?: return
    synchronized(queue) {
      val pending = queue.pollFirst() ?: return
      if (status == BluetoothGatt.GATT_SUCCESS) pending.promise.resolve()
      else pending.promise.reject("ERR_BLE_WRITE", "BLE frame write failed with GATT status $status.", null)
      if (queue.isNotEmpty()) startNextCentralWrite(peerId)
    }
  }

  private fun startNextServerWrite() {
    val pending = serverWriteQueue.peekFirst() ?: return
    val server = gattServer
    val characteristic = outboundCharacteristic
    if (server == null || characteristic == null || !serverReadyPeers.contains(pending.peerId)) {
      serverWriteQueue.pollFirst()?.promise?.reject("ERR_BLE_NOT_CONNECTED", "Peer disconnected before notification.", null)
      if (serverWriteQueue.isNotEmpty()) startNextServerWrite()
      return
    }
    val started = try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        server.notifyCharacteristicChanged(pending.device, characteristic, false, pending.bytes) == BluetoothStatusCodes.SUCCESS
      } else {
        @Suppress("DEPRECATION")
        characteristic.value = pending.bytes
        @Suppress("DEPRECATION")
        server.notifyCharacteristicChanged(pending.device, characteristic, false)
      }
    } catch (_: Throwable) {
      false
    }
    if (!started) {
      serverWriteQueue.pollFirst()?.promise?.reject("ERR_BLE_NOTIFY", "Android rejected the BLE notification.", null)
      if (serverWriteQueue.isNotEmpty()) startNextServerWrite()
    }
  }

  private val gattServerCallback = object : BluetoothGattServerCallback() {
    override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
      val peerId = privateServerPeerId(device)
      if (status == BluetoothGatt.GATT_SUCCESS && newState == BluetoothProfile.STATE_CONNECTED) {
        serverDevices[peerId] = device
        serverFrameBytes[peerId] = DEFAULT_FRAME_BYTES
      } else {
        serverDevices.remove(peerId)
        serverFrameBytes.remove(peerId)
        val wasReady = serverReadyPeers.remove(peerId)
        rejectServerWritesFor(peerId, "Peer disconnected before notification completed.")
        if (wasReady) emitConnection(peerId, false, DEFAULT_FRAME_BYTES)
      }
    }

    override fun onMtuChanged(device: BluetoothDevice, mtu: Int) {
      val peerId = privateServerPeerId(device)
      serverFrameBytes[peerId] = (mtu - 3).coerceIn(DEFAULT_FRAME_BYTES, 244)
    }

    override fun onDescriptorWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      descriptor: BluetoothGattDescriptor,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray,
    ) {
      val success = descriptor.uuid == CLIENT_CONFIGURATION_UUID && offset == 0 && !preparedWrite
      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, if (success) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_FAILURE, offset, null)
      }
      if (success) {
        val peerId = privateServerPeerId(device)
        serverDevices[peerId] = device
        if (serverReadyPeers.add(peerId)) emitConnection(peerId, true, serverFrameBytes[peerId] ?: DEFAULT_FRAME_BYTES)
      }
    }

    override fun onCharacteristicWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      characteristic: BluetoothGattCharacteristic,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray,
    ) {
      val success = characteristic.uuid == inboundUuid && offset == 0 && !preparedWrite && value.isNotEmpty()
      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, if (success) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_FAILURE, offset, null)
      }
      if (success) emitFrame(privateServerPeerId(device), value)
    }

    override fun onNotificationSent(device: BluetoothDevice, status: Int) {
      synchronized(serverWriteQueue) {
        val pending = serverWriteQueue.pollFirst() ?: return
        if (status == BluetoothGatt.GATT_SUCCESS) pending.promise.resolve()
        else pending.promise.reject("ERR_BLE_NOTIFY", "BLE notification failed with GATT status $status.", null)
        if (serverWriteQueue.isNotEmpty()) startNextServerWrite()
      }
    }
  }

  private fun privateServerPeerId(device: BluetoothDevice): String {
    peerIdByAddress[device.address]?.let { return it }
    val digest = MessageDigest.getInstance("SHA-256").digest(device.address.toByteArray(Charsets.UTF_8))
    return "GATT-${digest.copyOfRange(0, 6).joinToString("") { "%02X".format(it.toInt() and 0xFF) }}"
  }

  private fun removeCentralLink(peerId: String, reason: String) {
    centralLinks.remove(peerId)
    rejectCentralQueue(peerId, reason)
  }

  private fun rejectCentralQueue(peerId: String, reason: String) {
    val queue = centralWriteQueues.remove(peerId) ?: return
    synchronized(queue) {
      while (queue.isNotEmpty()) queue.pollFirst()?.promise?.reject("ERR_BLE_DISCONNECTED", reason, null)
    }
  }

  private fun rejectServerWritesFor(peerId: String, reason: String) {
    synchronized(serverWriteQueue) {
      val retained = ArrayDeque<PendingServerWrite>()
      while (serverWriteQueue.isNotEmpty()) {
        val pending = serverWriteQueue.pollFirst() ?: continue
        if (pending.peerId == peerId) pending.promise.reject("ERR_BLE_DISCONNECTED", reason, null)
        else retained.addLast(pending)
      }
      serverWriteQueue.addAll(retained)
      if (serverWriteQueue.isNotEmpty()) startNextServerWrite()
    }
  }

  private fun pauseDiscovery() {
    stopScanner()
    stopAdvertiser()
  }

  private fun resumeDiscovery() {
    if (!hasRadioPermissions()) return
    wantedServiceUuid?.takeIf { advertisingConfig != null }?.let {
      runCatching { startAdvertiser(it) }.onFailure { error -> emitError("advertising", error.message ?: "Could not resume advertising.") }
    }
    scanningServiceUuid?.let {
      runCatching { startScanning(it) }.onFailure { error -> emitError("scanning", error.message ?: "Could not resume scanning.") }
    }
  }

  private fun stopScanner() {
    val callback = scanCallback
    if (callback != null) runCatching { scanner?.stopScan(callback) }
    scanCallback = null
    scanner = null
  }

  private fun stopAdvertiser() {
    mainHandler.removeCallbacks(advertisementRotation)
    val callback = advertiseCallback
    if (callback != null) runCatching { bluetoothAdapter?.bluetoothLeAdvertiser?.stopAdvertising(callback) }
    advertiseCallback = null
  }

  private fun stopAll() {
    stopScanner()
    stopAdvertiser()
    centralLinks.values.forEach { link ->
      runCatching { link.gatt.disconnect() }
      runCatching { link.gatt.close() }
    }
    centralLinks.clear()
    pendingConnections.clear()
    centralWriteQueues.keys.toList().forEach { rejectCentralQueue(it, "BLE radio stopped.") }
    synchronized(serverWriteQueue) {
      while (serverWriteQueue.isNotEmpty()) {
        serverWriteQueue.pollFirst()?.promise?.reject("ERR_BLE_STOPPED", "BLE radio stopped.", null)
      }
    }
    runCatching { gattServer?.close() }
    gattServer = null
    outboundCharacteristic = null
    serverDevices.clear()
    serverFrameBytes.clear()
    serverReadyPeers.clear()
  }

  private fun registerBluetoothReceiver() {
    if (registeredReceiver) return
    val filter = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(bluetoothReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(bluetoothReceiver, filter)
    }
    registeredReceiver = true
  }

  private fun unregisterBluetoothReceiver() {
    if (!registeredReceiver) return
    runCatching { context.unregisterReceiver(bluetoothReceiver) }
    registeredReceiver = false
  }

  private val bluetoothReceiver = object : BroadcastReceiver() {
    override fun onReceive(receiverContext: Context?, intent: Intent?) {
      if (intent?.action != BluetoothAdapter.ACTION_STATE_CHANGED) return
      val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
      if (state == BluetoothAdapter.STATE_OFF || state == BluetoothAdapter.STATE_TURNING_OFF) stopAll()
      emit("onRadioStateChanged", mapOf("state" to state))
    }
  }

  private fun hasPermission(permission: String): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.M || ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

  private fun hasRadioPermissions(): Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    hasPermission(Manifest.permission.BLUETOOTH_SCAN) &&
      hasPermission(Manifest.permission.BLUETOOTH_CONNECT) &&
      hasPermission(Manifest.permission.BLUETOOTH_ADVERTISE)
  } else {
    hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)
  }

  private fun requireRadioPermissions(scan: Boolean = false, advertise: Boolean = false, connect: Boolean = false) {
    val missing = mutableListOf<String>()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (scan && !hasPermission(Manifest.permission.BLUETOOTH_SCAN)) missing.add(Manifest.permission.BLUETOOTH_SCAN)
      if (advertise && !hasPermission(Manifest.permission.BLUETOOTH_ADVERTISE)) missing.add(Manifest.permission.BLUETOOTH_ADVERTISE)
      if ((connect || scan || advertise) && !hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) missing.add(Manifest.permission.BLUETOOTH_CONNECT)
    } else if (scan && !hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
      missing.add(Manifest.permission.ACCESS_FINE_LOCATION)
    }
    if (missing.isNotEmpty()) throw SecurityException("Missing Android BLE permission(s): ${missing.joinToString()}.")
  }

  private fun emitConnection(peerId: String, connected: Boolean, frameBytes: Int) {
    emit("onConnectionChanged", mapOf(
      "peerId" to peerId,
      "connected" to connected,
      "negotiatedFrameBytes" to frameBytes,
    ))
  }

  private fun emitFrame(peerId: String, bytes: ByteArray) {
    if (bytes.isEmpty()) return
    emit("onFrameReceived", mapOf(
      "peerId" to peerId,
      "frame" to bytes.map { it.toInt() and 0xFF },
    ))
  }

  private fun emitError(operation: String, message: String) {
    emit("onRadioError", mapOf("operation" to operation, "message" to message))
  }

  private fun emit(name: String, body: Map<String, Any?>) {
    mainHandler.post { sendEvent(name, body) }
  }
}
