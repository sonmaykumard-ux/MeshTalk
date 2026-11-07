/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateRandomHex, EncryptedEnvelope } from './crypto';

export type PacketType =
  | 'DISCOVERY_BEACON'
  | 'PUBLIC_BROADCAST'
  | 'ENCRYPTED_DIRECT'
  | 'GROUP_MESSAGE'
  | 'STORE_FORWARD_COURIER'
  | 'FILE_FRAGMENT'
  | 'VOICE_NOTE'
  | 'DELIVERY_ACK'
  | 'EMERGENCY_SOS'
  | 'ROUTING_EXCHANGE';

export type BatteryPowerMode = 'performance' | 'balanced' | 'saver';

export interface MeshPacket {
  magic: number; // 0x4D54 ('MT')
  version: number; // 1
  packetId: string; // Unique hex ID (16 bytes)
  packetType: PacketType;
  senderId: string; // Origin node ID
  senderName: string;
  recipientId: string; // Target node ID or '*' for broadcast
  channel?: string; // e.g. "#general", "#emergency"
  ttl: number; // Time-to-live, decremented at each hop
  maxTtl: number; // Initial TTL (typically 5 to 7)
  hopCount: number; // Incremented at each hop (0 = origin)
  timestamp: number; // UTC ms
  payload: string | EncryptedEnvelope | FileFragmentPayload | VoiceNotePayload | EmergencyPayload;
  relayHistory: string[]; // Node IDs that forwarded this packet (loop avoidance)
  signature?: string;
  isCourierCarried?: boolean; // If carried by DTN store-and-forward relay
}

export interface FileFragmentPayload {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkIndex: number;
  totalChunks: number;
  chunkData: string; // Base64
  checksumSha256: string;
}

export interface VoiceNotePayload {
  voiceId: string;
  durationMs: number;
  audioBlobBase64: string;
  waveform: number[];
  compressed: boolean;
}

export interface EmergencyPayload {
  distressLevel: 'CRITICAL_SOS' | 'MEDICAL' | 'RESOURCE_NEED' | 'HAZARD_ALERT';
  message: string;
  coarseLocation?: {
    latApprox: number;
    lngApprox: number;
    description: string;
  };
  urgencyTimestamp: number;
}

export interface MeshNode {
  id: string;
  name: string;
  shortFingerprint: string;
  rssi: number; // dBm e.g. -45 (strong) to -90 (weak)
  batteryMode: BatteryPowerMode;
  batteryLevel: number; // 0-100%
  isDirectNeighbor: boolean;
  hopDistance: number; // Estimated hops from current device
  viaRelayId?: string;
  lastSeen: number;
  isSimulated?: boolean;
  isCourierEligible?: boolean;
  forwardedCount: number;
  isVerified?: boolean;
  isBlocked?: boolean;
}

export interface StoredCourierMail {
  id: string;
  targetRecipientId: string;
  packet: MeshPacket;
  storedAt: number;
  expiresAt: number;
  attempts: number;
}

// Maximum packet deduplication cache size
const MAX_SEEN_CACHE = 1000;
// Default TTL limits
export const DEFAULT_TTL_PERFORMANCE = 7;
export const DEFAULT_TTL_BALANCED = 5;
export const DEFAULT_TTL_SAVER = 3;

export class PacketRouter {
  private localNodeId: string;
  private seenPacketIds: Map<string, number> = new Map();
  private courierStorage: Map<string, StoredCourierMail> = new Map();
  private maxCourierStorage: number = 50;

  constructor(localNodeId: string) {
    this.localNodeId = localNodeId;
  }

  public setLocalNodeId(id: string) {
    this.localNodeId = id;
  }

  // Check if packet was already processed
  public isDuplicate(packetId: string): boolean {
    return this.seenPacketIds.has(packetId);
  }

  // Mark packet as processed
  public markSeen(packetId: string): void {
    if (this.seenPacketIds.size >= MAX_SEEN_CACHE) {
      // Evict oldest 20%
      const keys = Array.from(this.seenPacketIds.keys()).slice(0, 200);
      keys.forEach(k => this.seenPacketIds.delete(k));
    }
    this.seenPacketIds.set(packetId, Date.now());
  }

  // Create an outgoing packet
  public createPacket(
    packetType: PacketType,
    senderName: string,
    recipientId: string,
    payload: MeshPacket['payload'],
    channel?: string,
    powerMode: BatteryPowerMode = 'balanced'
  ): MeshPacket {
    const maxTtl = powerMode === 'performance' ? DEFAULT_TTL_PERFORMANCE :
                   powerMode === 'saver' ? DEFAULT_TTL_SAVER : DEFAULT_TTL_BALANCED;
    const packet: MeshPacket = {
      magic: 0x4D54,
      version: 1,
      packetId: `pkt_${generateRandomHex(8)}`,
      packetType,
      senderId: this.localNodeId,
      senderName,
      recipientId,
      channel,
      ttl: maxTtl,
      maxTtl,
      hopCount: 0,
      timestamp: Date.now(),
      payload,
      relayHistory: [this.localNodeId],
    };
    this.markSeen(packet.packetId);
    return packet;
  }

  // Evaluates how an incoming packet should be processed:
  // Returns:
  // - 'ACCEPT_FOR_ME': packet reached destination
  // - 'ACCEPT_BROADCAST': public message accepted and eligible for relay
  // - 'RELAY': forward to neighbors
  // - 'STORE_COURIER': hold packet for later store-and-forward
  // - 'DROP_DUPLICATE': already processed
  // - 'DROP_EXPIRED': TTL expired or loop detected
  // - 'DROP_BLOCKED': sender is blocked
  public evaluatePacket(
    packet: MeshPacket,
    blockedIds: Set<string>,
    activeNeighborIds: Set<string>
  ): {
    decision: 'ACCEPT_FOR_ME' | 'ACCEPT_BROADCAST' | 'RELAY' | 'STORE_COURIER' | 'DROP_DUPLICATE' | 'DROP_EXPIRED' | 'DROP_BLOCKED';
    forwardPacket?: MeshPacket;
    reason?: string;
  } {
    // 1. Check duplicate
    if (this.isDuplicate(packet.packetId)) {
      return { decision: 'DROP_DUPLICATE', reason: 'Packet already processed' };
    }
    this.markSeen(packet.packetId);

    // 2. Check blocked sender
    if (blockedIds.has(packet.senderId)) {
      return { decision: 'DROP_BLOCKED', reason: 'Sender is blocked' };
    }

    // 3. Loop detection
    if (packet.relayHistory.includes(this.localNodeId)) {
      return { decision: 'DROP_EXPIRED', reason: 'Loop detected: local node in relay history' };
    }

    // 4. Destination is directly local node
    const isForMe = packet.recipientId === this.localNodeId;
    const isBroadcast = packet.recipientId === '*' || packet.packetType === 'EMERGENCY_SOS' || packet.packetType === 'PUBLIC_BROADCAST' || packet.packetType === 'DISCOVERY_BEACON';

    if (isForMe) {
      return { decision: 'ACCEPT_FOR_ME' };
    }

    // Check TTL for relaying
    if (packet.ttl <= 1) {
      if (isBroadcast) {
        return { decision: 'ACCEPT_BROADCAST' };
      }
      return { decision: 'DROP_EXPIRED', reason: 'TTL exhausted' };
    }

    // Create decremented forward copy
    const forwardPacket: MeshPacket = {
      ...packet,
      ttl: packet.ttl - 1,
      hopCount: packet.hopCount + 1,
      relayHistory: [...packet.relayHistory, this.localNodeId],
    };

    if (isBroadcast) {
      return { decision: 'ACCEPT_BROADCAST', forwardPacket };
    }

    // Not for me, unicast packet.
    // Check if recipient is an active neighbor or if we should act as store-and-forward courier
    const targetIsNeighbor = activeNeighborIds.has(packet.recipientId);
    if (!targetIsNeighbor && this.courierStorage.size < this.maxCourierStorage) {
      // Store in courier mailbox
      this.storeCourierMail(packet.recipientId, forwardPacket);
      return { decision: 'STORE_COURIER', forwardPacket, reason: 'Stored in delay-tolerant courier cache for offline delivery' };
    }

    return { decision: 'RELAY', forwardPacket };
  }

  // Store-and-Forward courier storage
  public storeCourierMail(targetRecipientId: string, packet: MeshPacket): void {
    const id = `mail_${packet.packetId}`;
    this.courierStorage.set(id, {
      id,
      targetRecipientId,
      packet,
      storedAt: Date.now(),
      expiresAt: Date.now() + 48 * 3600 * 1000, // 48 hour DTN expiry
      attempts: 0,
    });
  }

  public getCourierMailbox(): StoredCourierMail[] {
    // Filter expired
    const now = Date.now();
    for (const [key, item] of this.courierStorage.entries()) {
      if (item.expiresAt < now) {
        this.courierStorage.delete(key);
      }
    }
    return Array.from(this.courierStorage.values());
  }

  public checkAndFlushCourier(targetRecipientId: string): MeshPacket[] {
    const toDeliver: MeshPacket[] = [];
    for (const [key, item] of this.courierStorage.entries()) {
      if (item.targetRecipientId === targetRecipientId && item.expiresAt > Date.now()) {
        toDeliver.push({
          ...item.packet,
          isCourierCarried: true,
        });
        this.courierStorage.delete(key);
      }
    }
    return toDeliver;
  }

  public clearAll(): void {
    this.seenPacketIds.clear();
    this.courierStorage.clear();
  }
}
