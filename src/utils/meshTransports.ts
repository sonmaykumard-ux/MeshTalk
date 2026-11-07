/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MeshNode, MeshPacket, BatteryPowerMode } from './meshProtocol';
import { generateRandomHex, computeFingerprint } from './crypto';

export interface TransportStatus {
  webBluetoothAvailable: boolean;
  bluetoothActive: boolean;
  broadcastChannelActive: boolean;
  nostrFallbackActive: boolean;
  nostrRelayConnected: boolean;
  totalTxPackets: number;
  totalRxPackets: number;
  totalRelayedPackets: number;
  totalDroppedPackets: number;
  activeNeighborsCount: number;
}

export type PacketCallback = (packet: MeshPacket, viaTransport: 'ble' | 'broadcast_channel' | 'nostr' | 'simulated') => void;
export type NodePresenceCallback = (node: MeshNode) => void;

// Seed initial simulated mesh peers for rich offline demonstration
export const INITIAL_SIMULATED_NODES: MeshNode[] = [
  {
    id: 'node_alpha_base',
    name: 'Alpha-Command',
    shortFingerprint: 'MT-4E1B-902C',
    rssi: -58,
    batteryMode: 'performance',
    batteryLevel: 94,
    isDirectNeighbor: true,
    hopDistance: 1,
    lastSeen: Date.now(),
    isSimulated: true,
    isCourierEligible: true,
    forwardedCount: 142,
    isVerified: true,
    isBlocked: false,
  },
  {
    id: 'node_bravo_repeater',
    name: 'Relay-Bravo [Hilltop]',
    shortFingerprint: 'MT-8A2F-11C4',
    rssi: -72,
    batteryMode: 'performance',
    batteryLevel: 88,
    isDirectNeighbor: true,
    hopDistance: 1,
    lastSeen: Date.now(),
    isSimulated: true,
    isCourierEligible: true,
    forwardedCount: 389,
    isVerified: true,
    isBlocked: false,
  },
  {
    id: 'node_charlie_courier',
    name: 'Courier-Charlie [Drone]',
    shortFingerprint: 'MT-3F90-7D12',
    rssi: -84,
    batteryMode: 'balanced',
    batteryLevel: 67,
    isDirectNeighbor: false,
    hopDistance: 2,
    viaRelayId: 'node_bravo_repeater',
    lastSeen: Date.now() - 15000,
    isSimulated: true,
    isCourierEligible: true,
    forwardedCount: 97,
    isVerified: false,
    isBlocked: false,
  },
  {
    id: 'node_delta_medic',
    name: 'Delta-Medic [Valley]',
    shortFingerprint: 'MT-6B55-E9A0',
    rssi: -89,
    batteryMode: 'saver',
    batteryLevel: 42,
    isDirectNeighbor: false,
    hopDistance: 3,
    viaRelayId: 'node_charlie_courier',
    lastSeen: Date.now() - 42000,
    isSimulated: true,
    isCourierEligible: false,
    forwardedCount: 23,
    isVerified: true,
    isBlocked: false,
  },
];

export class MeshTransportManager {
  private broadcastChannel: BroadcastChannel | null = null;
  private onPacketReceived: PacketCallback | null = null;
  private onNodePresence: NodePresenceCallback | null = null;
  private localNodeId: string = '';
  private localNodeName: string = '';
  private beaconIntervalId: any = null;
  private simulationIntervalId: any = null;

  public status: TransportStatus = {
    webBluetoothAvailable: false,
    bluetoothActive: false,
    broadcastChannelActive: true,
    nostrFallbackActive: false,
    nostrRelayConnected: false,
    totalTxPackets: 0,
    totalRxPackets: 0,
    totalRelayedPackets: 0,
    totalDroppedPackets: 0,
    activeNeighborsCount: 4,
  };

  constructor() {
    if (typeof window !== 'undefined' && 'Bluetooth' in window) {
      this.status.webBluetoothAvailable = true;
    }
  }

  public init(
    localNodeId: string,
    localNodeName: string,
    onPacket: PacketCallback,
    onPresence: NodePresenceCallback
  ) {
    this.localNodeId = localNodeId;
    this.localNodeName = localNodeName;
    this.onPacketReceived = onPacket;
    this.onNodePresence = onPresence;

    // 1. Setup real cross-tab BroadcastChannel mesh
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('meshtalk_ble_channel_v1');
        this.broadcastChannel.onmessage = (event) => {
          const packet: MeshPacket = event.data;
          if (packet && packet.magic === 0x4D54 && packet.senderId !== this.localNodeId) {
            this.status.totalRxPackets++;
            this.onPacketReceived?.(packet, 'broadcast_channel');
          }
        };
        this.status.broadcastChannelActive = true;
      } catch (err) {
        console.warn('BroadcastChannel not supported in this context', err);
      }
    }

    // 2. Start periodical Discovery Beacon (every 10s)
    this.startBeaconing();

    // 3. Start simulated mesh background heartbeat
    this.startSimulationHeartbeat();
  }

  public updateLocalProfile(name: string) {
    this.localNodeName = name;
  }

  public setNostrFallback(enabled: boolean) {
    this.status.nostrFallbackActive = enabled;
    this.status.nostrRelayConnected = enabled;
  }

  public toggleBluetooth(active: boolean) {
    this.status.bluetoothActive = active;
  }

  // Request real Web Bluetooth scan if available
  public async requestRealBluetoothScan(): Promise<{ success: boolean; message: string }> {
    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
      return {
        success: false,
        message: 'Web Bluetooth API is not available on this browser/platform. On iOS and standard desktop, native Bluetooth GATT requires native app build (see Native Specs tab). Using cross-tab mesh and RF radio simulation.',
      };
    }
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'battery_service'],
      });
      if (device) {
        this.status.bluetoothActive = true;
        // Broadcast presence
        const realNode: MeshNode = {
          id: `ble_${device.id || generateRandomHex(6)}`,
          name: device.name || 'Nearby BLE Device',
          shortFingerprint: computeFingerprint(device.id || 'BLE'),
          rssi: -62,
          batteryMode: 'balanced',
          batteryLevel: 85,
          isDirectNeighbor: true,
          hopDistance: 1,
          lastSeen: Date.now(),
          forwardedCount: 0,
          isVerified: false,
          isBlocked: false,
        };
        this.onNodePresence?.(realNode);
        return {
          success: true,
          message: `Connected to BLE Device: ${device.name || 'BLE Mesh Participant'} (${device.id})`,
        };
      }
      return { success: false, message: 'No BLE device chosen.' };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Bluetooth scan cancelled or unavailable.',
      };
    }
  }

  // Transmit a packet across all active transports
  public broadcastPacket(packet: MeshPacket): void {
    this.status.totalTxPackets++;

    // 1. BroadcastChannel (cross-tab real mesh)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch (err) {
        console.warn('Failed to post to BroadcastChannel', err);
      }
    }

    // 2. If Nostr fallback enabled and direct hops > 2 or destination not in immediate range
    if (this.status.nostrFallbackActive && packet.recipientId !== '*') {
      // Simulate Nostr NIP-01 / NIP-04 relay transport
      console.log('[Nostr Relay Fallback] Dispatched encrypted envelope to wss://relay.damus.io / wss://nos.lol');
    }
  }

  private startBeaconing() {
    if (this.beaconIntervalId) clearInterval(this.beaconIntervalId);
    this.beaconIntervalId = setInterval(() => {
      if (!this.localNodeId) return;
      const beaconPacket: MeshPacket = {
        magic: 0x4D54,
        version: 1,
        packetId: `bcn_${generateRandomHex(8)}`,
        packetType: 'DISCOVERY_BEACON',
        senderId: this.localNodeId,
        senderName: this.localNodeName,
        recipientId: '*',
        ttl: 2,
        maxTtl: 2,
        hopCount: 0,
        timestamp: Date.now(),
        payload: JSON.stringify({
          mode: 'balanced',
          battery: 95,
          isRelay: true,
        }),
        relayHistory: [this.localNodeId],
      };
      this.broadcastPacket(beaconPacket);
    }, 12000);
  }

  private startSimulationHeartbeat() {
    if (this.simulationIntervalId) clearInterval(this.simulationIntervalId);
    // Periodically update simulated peer RSSI fluctuations to simulate moving in RF environment
    this.simulationIntervalId = setInterval(() => {
      INITIAL_SIMULATED_NODES.forEach((node) => {
        // Minor RF RSSI jitter (-2 to +2 dBm)
        const jitter = Math.floor(Math.random() * 5) - 2;
        node.rssi = Math.min(-42, Math.max(-95, node.rssi + jitter));
        node.lastSeen = Date.now();
        this.onNodePresence?.({ ...node });
      });
    }, 15000);
  }

  public recordRelay() {
    this.status.totalRelayedPackets++;
  }

  public recordDrop() {
    this.status.totalDroppedPackets++;
  }

  public destroy() {
    if (this.beaconIntervalId) clearInterval(this.beaconIntervalId);
    if (this.simulationIntervalId) clearInterval(this.simulationIntervalId);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
    }
  }
}
