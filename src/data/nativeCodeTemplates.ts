/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NativeCodeFile {
  title: string;
  platform: 'Android (Kotlin)' | 'iOS (Swift)' | 'Protocol & Protobuf';
  fileName: string;
  language: string;
  description: string;
  code: string;
}

export const NATIVE_CODE_SPECIFICATIONS: NativeCodeFile[] = [
  {
    title: 'Android BLE Mesh Service',
    platform: 'Android (Kotlin)',
    fileName: 'BleMeshService.kt',
    language: 'kotlin',
    description: 'Complete Android Foreground Service using Android Bluetooth Low Energy APIs, GATT Server, Advertising, and Coroutines.',
    code: `package com.meshtalk.engine.ble

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.ParcelUuid
import android.util.Log
import kotlinx.coroutines.*
import java.util.*
import java.util.concurrent.ConcurrentHashMap

/**
 * MeshTalk Native Android BLE Mesh Service
 * Implements concurrent BLE Advertising, BLE Scanning, and GATT Server
 * for multi-hop peer-to-peer packet propagation without Internet or Wi-Fi.
 */
class BleMeshService : Service() {

    companion object {
        const val TAG = "MeshTalk_BLE"
        val SERVICE_UUID: UUID = UUID.fromString("0000FE60-0000-1000-8000-00805F9B34FB")
        val CHARACTERISTIC_TX_UUID: UUID = UUID.fromString("0000FE61-0000-1000-8000-00805F9B34FB")
        val CHARACTERISTIC_RX_UUID: UUID = UUID.fromString("0000FE62-0000-1000-8000-00805F9B34FB")
        const val NOTIFICATION_CHANNEL_ID = "meshtalk_ble_channel"
        const val NOTIFICATION_ID = 404
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var bluetoothManager: BluetoothManager? = null
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bleAdvertiser: BluetoothLeAdvertiser? = null
    private var bleScanner: BluetoothLeScanner? = null
    private var gattServer: BluetoothGattServer? = null

    // Active connected peers and deduplication cache
    private val connectedGatts = ConcurrentHashMap<String, BluetoothGatt>()
    private val seenPacketCache = Collections.newSetFromMap(ConcurrentHashMap<String, Boolean>())

    override fun onCreate() {
        super.onCreate()
        initBluetooth()
        startForeground(NOTIFICATION_ID, buildForegroundNotification())
        startMeshAdvertising()
        startMeshScanning()
    }

    @SuppressLint("MissingPermission")
    private fun initBluetooth() {
        bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter
        bleAdvertiser = bluetoothAdapter?.bluetoothLeAdvertiser
        bleScanner = bluetoothAdapter?.bluetoothLeScanner
        setupGattServer()
    }

    @SuppressLint("MissingPermission")
    private fun setupGattServer() {
        val callback = object : BluetoothGattServerCallback() {
            override fun onCharacteristicWriteRequest(
                device: BluetoothDevice,
                requestId: Int,
                characteristic: BluetoothGattCharacteristic,
                preparedWrite: Boolean,
                responseNeeded: Boolean,
                offset: Int,
                value: ByteArray
            ) {
                if (characteristic.uuid == CHARACTERISTIC_RX_UUID) {
                    processIncomingPacket(value, device.address)
                    if (responseNeeded) {
                        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
                    }
                }
            }
        }

        gattServer = bluetoothManager?.openGattServer(this, callback)
        val meshService = BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)

        val rxChar = BluetoothGattCharacteristic(
            CHARACTERISTIC_RX_UUID,
            BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
            BluetoothGattCharacteristic.PERMISSION_WRITE
        )

        val txChar = BluetoothGattCharacteristic(
            CHARACTERISTIC_TX_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ
        )

        meshService.addCharacteristic(rxChar)
        meshService.addCharacteristic(txChar)
        gattServer?.addService(meshService)
        Log.i(TAG, "GATT Server running with Service UUID: $SERVICE_UUID")
    }

    @SuppressLint("MissingPermission")
    private fun startMeshAdvertising() {
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .setTimeout(0)
            .build()

        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(ParcelUuid(SERVICE_UUID))
            .build()

        bleAdvertiser?.startAdvertising(settings, data, object : AdvertiseCallback() {
            override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                Log.d(TAG, "BLE Mesh Advertising active.")
            }
            override fun onStartFailure(errorCode: Int) {
                Log.e(TAG, "BLE Mesh Advertising failed with code: $errorCode")
            }
        })
    }

    @SuppressLint("MissingPermission")
    private fun startMeshScanning() {
        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(SERVICE_UUID))
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_BALANCED)
            .setReportDelay(0)
            .build()

        bleScanner?.startScan(listOf(filter), settings, object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val device = result.device
                if (!connectedGatts.containsKey(device.address)) {
                    connectToMeshPeer(device)
                }
            }
        })
    }

    @SuppressLint("MissingPermission")
    private fun connectToMeshPeer(device: BluetoothDevice) {
        val gattCallback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    Log.i(TAG, "Connected to mesh neighbor: \${device.address}")
                    connectedGatts[device.address] = gatt
                    gatt.discoverServices()
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    Log.w(TAG, "Mesh neighbor disconnected: \${device.address}")
                    connectedGatts.remove(device.address)
                    gatt.close()
                }
            }

            override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    // Negotiate MTU for high-throughput packet exchange
                    gatt.requestMtu(512)
                }
            }
        }
        device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }

    /**
     * Deduplicates incoming packets, checks TTL, and relays to adjacent mesh nodes
     */
    private fun processIncomingPacket(rawBytes: ByteArray, sourceAddress: String) {
        serviceScope.launch {
            try {
                val packet = MeshPacketParser.deserialize(rawBytes)
                if (seenPacketCache.contains(packet.packetId)) return@launch
                seenPacketCache.add(packet.packetId)

                // Decrypt or dispatch if meant for this node
                if (packet.isForLocalNode()) {
                    MeshCryptoManager.handleDeliveredPacket(packet)
                    return@launch
                }

                // Decrement TTL and relay if hops remain
                if (packet.ttl > 1) {
                    val forwardPacket = packet.copy(
                        ttl = packet.ttl - 1,
                        hopCount = packet.hopCount + 1,
                        relayHistory = packet.relayHistory + LocalIdentity.getNodeId()
                    )
                    broadcastToConnectedPeers(forwardPacket.serialize(), excludeAddress = sourceAddress)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Malformed mesh packet rejected", e)
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun broadcastToConnectedPeers(packetBytes: ByteArray, excludeAddress: String) {
        connectedGatts.forEach { (address, gatt) ->
            if (address != excludeAddress) {
                val service = gatt.getService(SERVICE_UUID)
                val characteristic = service?.getCharacteristic(CHARACTERISTIC_RX_UUID)
                if (characteristic != null) {
                    characteristic.value = packetBytes
                    characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                    gatt.writeCharacteristic(characteristic)
                }
            }
        }
    }

    private fun buildForegroundNotification(): Notification {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "MeshTalk Mesh Radio",
            NotificationManager.IMPORTANCE_LOW
        )
        manager.createNotificationChannel(channel)
        return Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("MeshTalk Active")
            .setContentText("Relaying offline BLE mesh packets for nearby peers")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        bleAdvertiser?.stopAdvertising(object : AdvertiseCallback() {})
        bleScanner?.stopScan(object : ScanCallback() {})
        gattServer?.close()
        connectedGatts.values.forEach { it.close() }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}`,
  },
  {
    title: 'iOS CoreBluetooth Mesh Manager',
    platform: 'iOS (Swift)',
    fileName: 'BleMeshManager.swift',
    language: 'swift',
    description: 'Complete iOS implementation with CBCentralManager, CBPeripheralManager, background state restoration, and multi-hop forwarding.',
    code: `import Foundation
import CoreBluetooth
import CryptoKit

/**
 * MeshTalk Native iOS CoreBluetooth Mesh Engine
 * Manages dual Central/Peripheral roles for true peer-to-peer relaying.
 */
final class BleMeshManager: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate {

    static let shared = BleMeshManager()

    // MeshTalk Standard 16-bit / 128-bit UUIDs
    static let serviceUUID = CBUUID(string: "0000FE60-0000-1000-8000-00805F9B34FB")
    static let rxCharUUID  = CBUUID(string: "0000FE61-0000-1000-8000-00805F9B34FB")
    static let txCharUUID  = CBUUID(string: "0000FE62-0000-1000-8000-00805F9B34FB")

    private var centralManager: CBCentralManager!
    private var peripheralManager: CBPeripheralManager!
    private var rxCharacteristic: CBMutableCharacteristic?

    // Track active connected peers
    private var connectedPeripherals = [UUID: CBPeripheral]()
    private var subscribedCentrals = [CBCentral]()
    private var seenPacketIds = Set<String>()

    private override init() {
        super.init()
        let centralOptions = [CBCentralManagerOptionRestoreIdentifierKey: "com.meshtalk.central.restore"]
        let peripheralOptions = [CBPeripheralManagerOptionRestoreIdentifierKey: "com.meshtalk.peripheral.restore"]

        centralManager = CBCentralManager(delegate: self, queue: .global(qos: .userInitiated), options: centralOptions)
        peripheralManager = CBPeripheralManager(delegate: self, queue: .global(qos: .userInitiated), options: peripheralOptions)
    }

    // MARK: - CBCentralManagerDelegate
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            print("[MeshTalk iOS] Central BLE Powered On. Starting Mesh Scan...")
            central.scanForPeripherals(
                withServices: [BleMeshManager.serviceUUID],
                options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
            )
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        if connectedPeripherals[peripheral.identifier] == nil {
            connectedPeripherals[peripheral.identifier] = peripheral
            peripheral.delegate = self
            central.connect(peripheral, options: nil)
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        print("[MeshTalk iOS] Connected to mesh peer: \\(peripheral.identifier)")
        peripheral.discoverServices([BleMeshManager.serviceUUID])
    }

    // MARK: - CBPeripheralManagerDelegate
    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        if peripheral.state == .poweredOn {
            setupGATTService()
            let advertisementData: [String: Any] = [
                CBAdvertisementDataServiceUUIDsKey: [BleMeshManager.serviceUUID],
                CBAdvertisementDataLocalNameKey: "MeshTalk-Node"
            ]
            peripheralManager.startAdvertising(advertisementData)
        }
    }

    private func setupGATTService() {
        let rxChar = CBMutableCharacteristic(
            type: BleMeshManager.rxCharUUID,
            properties: [.writeWithoutResponse, .write],
            value: nil,
            permissions: [.writeable]
        )
        self.rxCharacteristic = rxChar

        let txChar = CBMutableCharacteristic(
            type: BleMeshManager.txCharUUID,
            properties: [.notify, .read],
            value: nil,
            permissions: [.readable]
        )

        let service = CBMutableService(type: BleMeshManager.serviceUUID, primary: true)
        service.characteristics = [rxChar, txChar]
        peripheralManager.add(service)
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        for request in requests {
            if let data = request.value {
                processIncomingPacketData(data)
                peripheral.respond(to: request, withResult: .success)
            }
        }
    }

    // MARK: - Packet Routing & Relay
    private func processIncomingPacketData(_ data: Data) {
        guard let packet = try? JSONDecoder().decode(MeshWirePacket.self, from: data) else { return }

        // Deduplication
        if seenPacketIds.contains(packet.packetId) { return }
        seenPacketIds.insert(packet.packetId)

        if packet.isForLocalIdentity {
            NotificationCenter.default.post(name: .didReceiveMeshMessage, object: packet)
            return
        }

        // Multi-hop forwarding
        if packet.ttl > 1 {
            var forwardPacket = packet
            forwardPacket.ttl -= 1
            forwardPacket.hopCount += 1
            forwardPacket.relayHistory.append(LocalDevice.nodeId)

            if let forwardData = try? JSONEncoder().encode(forwardPacket) {
                relayToConnectedPeers(forwardData)
            }
        }
    }

    private func relayToConnectedPeers(_ data: Data) {
        for peripheral in connectedPeripherals.values {
            guard let service = peripheral.services?.first(where: { $0.uuid == BleMeshManager.serviceUUID }),
                  let char = service.characteristics?.first(where: { $0.uuid == BleMeshManager.rxCharUUID }) else { continue }
            peripheral.writeValue(data, for: char, type: .withoutResponse)
        }
    }
}
struct MeshWirePacket: Codable {
    let packetId: String
    var ttl: Int
    var hopCount: Int
    var relayHistory: [String]
    let senderId: String
    let recipientId: String
    let payload: String
    var isForLocalIdentity: Bool {
        return recipientId == LocalDevice.nodeId || recipientId == "*"
    }
}
struct LocalDevice {
    static let nodeId = "node_ios_" + UUID().uuidString.prefix(8)
}
extension Notification.Name {
    static let didReceiveMeshMessage = Notification.Name("didReceiveMeshMessage")
}`,
  },
  {
    title: 'Wire Format & Protobuf Schema',
    platform: 'Protocol & Protobuf',
    fileName: 'meshtalk_packet.proto',
    language: 'protobuf',
    description: 'Universal Protocol Buffers definition and binary framing format used for cross-platform Android & iOS interoperability.',
    code: `syntax = "proto3";

package meshtalk.protocol.v1;

option java_package = "com.meshtalk.protocol.v1";
option swift_prefix = "MeshTalk_";

// Binary Frame Header
// [0..1] Magic Bytes: 0x4D 0x54 ('MT')
// [2]    Protocol Version: 0x01
// [3]    Packet Type Enum
// [4..7] Payload Length (Big Endian uint32)
// [8..N] Serialized Protobuf Body

enum PacketType {
  DISCOVERY_BEACON = 0;
  PUBLIC_BROADCAST = 1;
  ENCRYPTED_DIRECT = 2;
  GROUP_MESSAGE = 3;
  STORE_FORWARD_COURIER = 4;
  FILE_FRAGMENT = 5;
  VOICE_NOTE = 6;
  DELIVERY_ACK = 7;
  EMERGENCY_SOS = 8;
  ROUTING_TABLE_EXCHANGE = 9;
}

enum PowerMode {
  PERFORMANCE = 0; // Scanning 100%, high TX, TTL 7
  BALANCED = 1;    // Adaptive 300ms window, TTL 5
  SAVER = 2;       // Periodic 1200ms burst, TTL 3
}

message MeshPacket {
  uint32 magic = 1;              // 0x4D54
  uint32 version = 2;            // 1
  string packet_id = 3;          // 16-byte hex unique identifier
  PacketType type = 4;
  
  string sender_id = 5;          // Ed25519 Public Key hex
  string sender_name = 6;        // User display name
  string recipient_id = 7;       // Target ID or "*" for mesh broadcast
  string channel = 8;            // Optional room e.g. "#general", "#emergency"
  
  uint32 ttl = 9;                // Decremented at each relay hop
  uint32 hop_count = 10;         // Incremented at each relay hop
  uint64 timestamp_ms = 11;      // Epoch UTC ms
  
  repeated string relay_history = 12; // Trace of node IDs to avoid loops
  bytes signature = 13;          // Ed25519 digital signature of header + payload
  
  oneof payload_data {
    string plain_text = 14;
    EncryptedEnvelope encrypted_envelope = 15;
    FileChunk file_chunk = 16;
    VoiceRecording voice_recording = 17;
    EmergencyBeacon emergency_beacon = 18;
  }
}

message EncryptedEnvelope {
  string algorithm = 1;          // "ChaCha20-Poly1305"
  bytes ephemeral_public_key = 2; // X25519 32-byte ephemeral key
  bytes iv = 3;                  // 12-byte initialization vector
  bytes cipher_text = 4;         // Encrypted payload
  bytes auth_tag = 5;            // 16-byte Poly1305 authentication tag
}

message FileChunk {
  string file_id = 1;
  string file_name = 2;
  uint32 file_size = 3;
  string mime_type = 4;
  uint32 chunk_index = 5;
  uint32 total_chunks = 6;
  bytes chunk_data = 7;
  string checksum_sha256 = 8;
}

message VoiceRecording {
  string voice_id = 1;
  uint32 duration_ms = 2;
  bytes opus_audio_data = 3;
  repeated float waveform_samples = 4;
}

message EmergencyBeacon {
  string distress_code = 1;      // "CRITICAL_SOS", "MEDICAL", "RESCUE"
  string description = 2;
  double approx_latitude = 3;
  double approx_longitude = 4;
  uint64 urgency_timestamp = 5;
}`,
  },
];
