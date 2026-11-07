/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  createNewIdentity,
  UserIdentity,
  encryptPayload,
  decryptPayload,
  EncryptedEnvelope,
} from './utils/crypto';
import {
  MeshNode,
  MeshPacket,
  PacketRouter,
  BatteryPowerMode,
  StoredCourierMail,
  EmergencyPayload,
  VoiceNotePayload,
} from './utils/meshProtocol';
import {
  MeshTransportManager,
  INITIAL_SIMULATED_NODES,
  TransportStatus,
} from './utils/meshTransports';
import { FileTransferManager } from './utils/fileTransfer';
import { parseIrcCommand } from './utils/ircCommands';

import { HeaderBar } from './components/HeaderBar';
import { NavigationTabs, MainTab } from './components/NavigationTabs';
import { NearbyPeersView } from './components/NearbyPeersView';
import { ChatsView, ChatMessage } from './components/ChatsView';
import { ChannelsView, ChannelMessage } from './components/ChannelsView';
import { NetworkTopologyView } from './components/NetworkTopologyView';
import { SettingsView } from './components/SettingsView';
import { IdentityVerifyModal } from './components/IdentityVerifyModal';
import { EmergencySosModal } from './components/EmergencySosModal';
import { PanicWipeModal } from './components/PanicWipeModal';
import { NativeSpecsModal } from './components/NativeSpecsModal';

const IDENTITY_STORAGE_KEY = 'meshtalk_identity_v1';
const CHATS_STORAGE_KEY = 'meshtalk_chats_v1';
const CHANNELS_STORAGE_KEY = 'meshtalk_channels_v1';

export default function App() {
  // 1. Identity state
  const [myIdentity, setMyIdentity] = useState<UserIdentity>(() => {
    try {
      const saved = localStorage.getItem(IDENTITY_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    const fresh = createNewIdentity('Nomad');
    try {
      localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(fresh));
    } catch {}
    return fresh;
  });

  // 2. Navigation & active view
  const [activeTab, setActiveTab] = useState<MainTab>('nearby');
  const [activePeer, setActivePeer] = useState<MeshNode | null>(null);
  const [activeChannel, setActiveChannel] = useState<string>('#general');

  // 3. Network state
  const [nodes, setNodes] = useState<MeshNode[]>(INITIAL_SIMULATED_NODES);
  const [powerMode, setPowerMode] = useState<BatteryPowerMode>('balanced');
  const [transportStatus, setTransportStatus] = useState<TransportStatus>({
    webBluetoothAvailable: typeof window !== 'undefined' && 'Bluetooth' in window,
    bluetoothActive: false,
    broadcastChannelActive: true,
    nostrFallbackActive: false,
    nostrRelayConnected: false,
    totalTxPackets: 18,
    totalRxPackets: 24,
    totalRelayedPackets: 14,
    totalDroppedPackets: 2,
    activeNeighborsCount: 4,
  });
  const [lastTxTimestamp, setLastTxTimestamp] = useState<number>(Date.now() - 4000);
  const [ephemeralTimer, setEphemeralTimer] = useState<number>(0);

  // 4. Messages state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHATS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'msg_welcome_seed',
        senderId: 'node_alpha_base',
        senderName: 'Alpha-Command',
        recipientId: myIdentity.id,
        timestamp: Date.now() - 120000,
        text: 'Mesh node initialized. Connected via direct BLE link (RSSI -58 dBm). All communications are peer-to-peer and end-to-end encrypted.',
        status: 'delivered',
        hopCount: 1,
        isEncrypted: true,
      },
    ];
  });

  const [channelMessages, setChannelMessages] = useState<ChannelMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHANNELS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'chan_seed_1',
        channel: '#general',
        senderId: 'node_bravo_repeater',
        senderName: 'Relay-Bravo [Hilltop]',
        timestamp: Date.now() - 360000,
        text: 'Hilltop BLE repeater active on RF channel 37/38/39. Relaying for valley basin nodes.',
        hopCount: 1,
      },
      {
        id: 'chan_seed_2',
        channel: '#general',
        senderId: 'node_delta_medic',
        senderName: 'Delta-Medic [Valley]',
        timestamp: Date.now() - 180000,
        text: 'Copy that. Monitoring #emergency and #general frequencies. Battery duty cycle balanced.',
        hopCount: 2,
      },
      {
        id: 'chan_seed_3',
        channel: '#emergency',
        senderId: 'node_bravo_repeater',
        senderName: 'Relay-Bravo [Hilltop]',
        timestamp: Date.now() - 90000,
        text: 'Civil Defense Beacon: Heavy squall approaching northern pass. Offline mesh repeater operating on solar backup.',
        hopCount: 1,
        isEmergencyAlert: true,
      },
    ];
  });

  // 5. Modals
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyTargetPeer, setVerifyTargetPeer] = useState<MeshNode | null>(null);
  const [showSosModal, setShowSosModal] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showNativeSpecsModal, setShowNativeSpecsModal] = useState(false);

  // 6. Router & Managers references
  const routerRef = useRef<PacketRouter>(new PacketRouter(myIdentity.id));
  const transportMgrRef = useRef<MeshTransportManager>(new MeshTransportManager());
  const fileTransferMgrRef = useRef<FileTransferManager>(new FileTransferManager());

  // Save messages to storage
  useEffect(() => {
    try {
      localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chatMessages));
    } catch {}
  }, [chatMessages]);

  useEffect(() => {
    try {
      localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(channelMessages));
    } catch {}
  }, [channelMessages]);

  // Setup Transports and Packet Ingestion
  useEffect(() => {
    const transportMgr = transportMgrRef.current;
    routerRef.current.setLocalNodeId(myIdentity.id);

    transportMgr.init(
      myIdentity.id,
      myIdentity.displayName,
      (packet, via) => {
        handleIncomingPacket(packet, via);
      },
      (nodePresence) => {
        setNodes((prev) => {
          const index = prev.findIndex((n) => n.id === nodePresence.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = { ...next[index], ...nodePresence };
            return next;
          }
          return [...prev, nodePresence];
        });
      }
    );

    return () => {
      transportMgr.destroy();
    };
  }, [myIdentity.id, myIdentity.displayName]);

  // Handle incoming packet logic
  const handleIncomingPacket = (packet: MeshPacket, via: string) => {
    const router = routerRef.current;
    const blockedIds = new Set(nodes.filter((n) => n.isBlocked).map((n) => n.id));
    const activeNeighborIds = new Set(nodes.filter((n) => n.isDirectNeighbor).map((n) => n.id));

    const evaluation = router.evaluatePacket(packet, blockedIds, activeNeighborIds);

    if (evaluation.decision === 'DROP_DUPLICATE' || evaluation.decision === 'DROP_BLOCKED' || evaluation.decision === 'DROP_EXPIRED') {
      transportMgrRef.current.recordDrop();
      return;
    }

    if (evaluation.decision === 'RELAY' && evaluation.forwardPacket) {
      transportMgrRef.current.recordRelay();
      transportMgrRef.current.broadcastPacket(evaluation.forwardPacket);
      // Play subtle tick if available
      return;
    }

    if (evaluation.decision === 'ACCEPT_BROADCAST') {
      if (packet.channel) {
        const chanMsg: ChannelMessage = {
          id: packet.packetId,
          channel: packet.channel,
          senderId: packet.senderId,
          senderName: packet.senderName,
          timestamp: packet.timestamp,
          text: typeof packet.payload === 'string' ? packet.payload : JSON.stringify(packet.payload),
          hopCount: packet.hopCount,
          isEmergencyAlert: packet.packetType === 'EMERGENCY_SOS',
        };
        setChannelMessages((prev) => {
          if (prev.some((m) => m.id === chanMsg.id)) return prev;
          return [...prev, chanMsg];
        });
      }

      // If hop limit allows, also relay broadcast to neighboring nodes
      if (evaluation.forwardPacket) {
        transportMgrRef.current.recordRelay();
        transportMgrRef.current.broadcastPacket(evaluation.forwardPacket);
      }
      return;
    }

    if (evaluation.decision === 'ACCEPT_FOR_ME') {
      // Direct message for me!
      if (packet.packetType === 'ENCRYPTED_DIRECT') {
        const envelope = packet.payload as EncryptedEnvelope;
        const decrypted = decryptPayload(envelope, myIdentity.privateKeySeed, packet.senderId);

        const newMsg: ChatMessage = {
          id: packet.packetId,
          senderId: packet.senderId,
          senderName: packet.senderName,
          recipientId: myIdentity.id,
          timestamp: packet.timestamp,
          text: decrypted || '[Decryption failed: corrupted envelope or unverified key]',
          status: 'delivered',
          hopCount: packet.hopCount,
          relayNodes: packet.relayHistory,
          isEncrypted: true,
        };

        setChatMessages((prev) => [...prev, newMsg]);

        // Send DELIVERY_ACK back
        const ackPacket = router.createPacket(
          'DELIVERY_ACK',
          myIdentity.displayName,
          packet.senderId,
          packet.packetId,
          undefined,
          powerMode
        );
        transportMgrRef.current.broadcastPacket(ackPacket);
      } else if (packet.packetType === 'DELIVERY_ACK') {
        // Mark message as delivered
        const targetMsgId = packet.payload as string;
        setChatMessages((prev) =>
          prev.map((m) => (m.id === targetMsgId ? { ...m, status: 'delivered' } : m))
        );
      } else if (packet.packetType === 'VOICE_NOTE') {
        const voicePayload = packet.payload as VoiceNotePayload;
        const newMsg: ChatMessage = {
          id: packet.packetId,
          senderId: packet.senderId,
          senderName: packet.senderName,
          recipientId: myIdentity.id,
          timestamp: packet.timestamp,
          voiceNote: voicePayload,
          status: 'delivered',
          hopCount: packet.hopCount,
          isEncrypted: true,
        };
        setChatMessages((prev) => [...prev, newMsg]);
      } else if (packet.packetType === 'FILE_FRAGMENT') {
        const fragment = packet.payload as any;
        const assembled = fileTransferMgrRef.current.ingestFragment(fragment);
        if (assembled.isComplete) {
          const newMsg: ChatMessage = {
            id: packet.packetId,
            senderId: packet.senderId,
            senderName: packet.senderName,
            recipientId: myIdentity.id,
            timestamp: packet.timestamp,
            file: {
              fileName: assembled.fileName,
              fileSize: assembled.fileSize,
              mimeType: assembled.mimeType,
              dataUrl: assembled.dataUrl,
              checksum: assembled.checksumSha256,
            },
            status: 'delivered',
            hopCount: packet.hopCount,
            isEncrypted: true,
          };
          setChatMessages((prev) => [...prev, newMsg]);
        }
      }
    }
  };

  // 1-on-1 Message Sending
  const handleSendMessage = (recipientId: string, text: string, replyToText?: string) => {
    const envelope = encryptPayload(text, recipientId, myIdentity.privateKeySeed);
    const packet = routerRef.current.createPacket(
      'ENCRYPTED_DIRECT',
      myIdentity.displayName,
      recipientId,
      envelope,
      undefined,
      powerMode
    );

    const localMsg: ChatMessage = {
      id: packet.packetId,
      senderId: myIdentity.id,
      senderName: myIdentity.displayName,
      recipientId,
      timestamp: Date.now(),
      text,
      status: 'sending',
      hopCount: 0,
      isEncrypted: true,
      replyToText,
    };

    setChatMessages((prev) => [...prev, localMsg]);
    setLastTxTimestamp(Date.now());
    transportMgrRef.current.broadcastPacket(packet);

    // Simulate hop progression if sending to simulated node
    setTimeout(() => {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === packet.packetId ? { ...m, status: 'relayed' } : m))
      );
    }, 600);
    setTimeout(() => {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === packet.packetId ? { ...m, status: 'delivered' } : m))
      );
    }, 1400);
  };

  // Voice Note Sending
  const handleSendVoiceNote = (recipientId: string, voiceNote: VoiceNotePayload) => {
    const packet = routerRef.current.createPacket(
      'VOICE_NOTE',
      myIdentity.displayName,
      recipientId,
      voiceNote,
      undefined,
      powerMode
    );

    const localMsg: ChatMessage = {
      id: packet.packetId,
      senderId: myIdentity.id,
      senderName: myIdentity.displayName,
      recipientId,
      timestamp: Date.now(),
      voiceNote,
      status: 'sending',
      hopCount: 0,
      isEncrypted: true,
    };

    setChatMessages((prev) => [...prev, localMsg]);
    setLastTxTimestamp(Date.now());
    transportMgrRef.current.broadcastPacket(packet);

    setTimeout(() => {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === packet.packetId ? { ...m, status: 'delivered' } : m))
      );
    }, 1200);
  };

  // File Transfer
  const handleSendFile = async (recipientId: string, file: File) => {
    try {
      const { fileId, fragments, checksum } = await fileTransferMgrRef.current.fragmentFile(file);

      // Read as base64 for local preview
      const reader = new FileReader();
      reader.onload = () => {
        const localMsg: ChatMessage = {
          id: fileId,
          senderId: myIdentity.id,
          senderName: myIdentity.displayName,
          recipientId,
          timestamp: Date.now(),
          file: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            dataUrl: reader.result as string,
            checksum,
          },
          status: 'sending',
          hopCount: 0,
          isEncrypted: true,
        };
        setChatMessages((prev) => [...prev, localMsg]);
      };
      reader.readAsDataURL(file);

      // Transmit fragments
      fragments.forEach((frag, idx) => {
        setTimeout(() => {
          const pkt = routerRef.current.createPacket(
            'FILE_FRAGMENT',
            myIdentity.displayName,
            recipientId,
            frag,
            undefined,
            powerMode
          );
          transportMgrRef.current.broadcastPacket(pkt);
        }, idx * 60);
      });

      setTimeout(() => {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === fileId ? { ...m, status: 'delivered' } : m))
        );
      }, fragments.length * 60 + 800);
    } catch (err: any) {
      alert(err.message || 'Failed to fragment file');
    }
  };

  // Channel Message Sending
  const handleSendChannelMessage = (channelName: string, text: string) => {
    const packet = routerRef.current.createPacket(
      'PUBLIC_BROADCAST',
      myIdentity.displayName,
      '*',
      text,
      channelName,
      powerMode
    );

    const localMsg: ChannelMessage = {
      id: packet.packetId,
      channel: channelName,
      senderId: myIdentity.id,
      senderName: myIdentity.displayName,
      timestamp: Date.now(),
      text,
      hopCount: 0,
    };

    setChannelMessages((prev) => [...prev, localMsg]);
    setLastTxTimestamp(Date.now());
    transportMgrRef.current.broadcastPacket(packet);
  };

  // Emergency SOS Broadcast
  const handleBroadcastSos = (payload: EmergencyPayload) => {
    const packet = routerRef.current.createPacket(
      'EMERGENCY_SOS',
      myIdentity.displayName,
      '*',
      payload,
      '#emergency',
      'performance' // High priority overrides power saving
    );

    const chanMsg: ChannelMessage = {
      id: packet.packetId,
      channel: '#emergency',
      senderId: myIdentity.id,
      senderName: `${myIdentity.displayName} [SOS-BEACON]`,
      timestamp: Date.now(),
      text: `🚨 DISTRESS ALERT: ${payload.distressLevel}\n${payload.message}${
        payload.coarseLocation ? `\nLocation: ${payload.coarseLocation.description}` : ''
      }`,
      hopCount: 0,
      isEmergencyAlert: true,
    };

    setChannelMessages((prev) => [...prev, chanMsg]);
    setActiveTab('channels');
    setActiveChannel('#emergency');
    setLastTxTimestamp(Date.now());
    transportMgrRef.current.broadcastPacket(packet);
  };

  // IRC Command Execution
  const handleExecuteIrcCommand = (commandStr: string) => {
    const res = parseIrcCommand(commandStr);
    if (!res.isCommand) return;

    if (res.feedbackMessage) {
      // Append feedback as local system message
      const sysMsg: ChannelMessage = {
        id: `sys_${Date.now()}`,
        channel: activeChannel,
        senderId: 'SYSTEM',
        senderName: 'MeshTalk-Daemon',
        timestamp: Date.now(),
        text: res.feedbackMessage,
        hopCount: 0,
      };
      setChannelMessages((prev) => [...prev, sysMsg]);
      return;
    }

    switch (res.action) {
      case 'NICK':
        if (res.params?.[0]) {
          const newName = res.params[0];
          setMyIdentity((prev) => {
            const updated = { ...prev, displayName: newName };
            localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });
          transportMgrRef.current.updateLocalProfile(newName);
        }
        break;

      case 'WHO':
        const peerList = nodes.map((n) => `• ${n.name} (${n.shortFingerprint}) - ${n.hopDistance}H [${n.rssi}dBm]`).join('\n');
        const whoMsg: ChannelMessage = {
          id: `sys_${Date.now()}`,
          channel: activeChannel,
          senderId: 'SYSTEM',
          senderName: 'MeshTalk-Daemon',
          timestamp: Date.now(),
          text: `Nearby Mesh Nodes (${nodes.length}):\n${peerList}`,
          hopCount: 0,
        };
        setChannelMessages((prev) => [...prev, whoMsg]);
        break;

      case 'JOIN':
        if (res.params?.[0]) {
          setActiveTab('channels');
          setActiveChannel(res.params[0]);
        }
        break;

      case 'CLEAR':
        setChannelMessages((prev) => prev.filter((m) => m.channel !== activeChannel));
        break;

      case 'STATUS':
        const statusReport =
          `RF Telemetry Status:\n` +
          `• Power Mode: ${powerMode.toUpperCase()}\n` +
          `• Total TX: ${transportStatus.totalTxPackets} pkts\n` +
          `• Total RX: ${transportStatus.totalRxPackets} pkts\n` +
          `• Total Relayed: ${transportStatus.totalRelayedPackets} pkts\n` +
          `• Active Links: ${nodes.length} nodes\n` +
          `• Cross-Tab Mesh: Active\n` +
          `• Nostr Relay Fallback: ${transportStatus.nostrFallbackActive ? 'Enabled' : 'Disabled'}`;
        const statMsg: ChannelMessage = {
          id: `sys_${Date.now()}`,
          channel: activeChannel,
          senderId: 'SYSTEM',
          senderName: 'MeshTalk-Daemon',
          timestamp: Date.now(),
          text: statusReport,
          hopCount: 0,
        };
        setChannelMessages((prev) => [...prev, statMsg]);
        break;

      case 'SOS':
        if (res.params?.[0]) {
          handleBroadcastSos({
            distressLevel: 'CRITICAL_SOS',
            message: res.params[0],
            urgencyTimestamp: Date.now(),
          });
        }
        break;

      case 'MODE':
        if (res.params?.[0]) {
          setPowerMode(res.params[0] as BatteryPowerMode);
        }
        break;
    }
  };

  // Panic Wipe: Zeroize all data
  const handlePanicWipe = () => {
    localStorage.clear();
    routerRef.current.clearAll();
    fileTransferMgrRef.current.clearAll();
    const fresh = createNewIdentity('Reborn-Nomad');
    setMyIdentity(fresh);
    setChatMessages([]);
    setChannelMessages([]);
    setActivePeer(null);
    setShowPanicModal(false);
  };

  // Verify peer fingerprint
  const handleVerifyPeer = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, isVerified: true } : n))
    );
  };

  // Block/Unblock peer
  const handleToggleBlockPeer = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, isBlocked: !n.isBlocked } : n))
    );
  };

  // Web Bluetooth Scan Trigger
  const handleRequestBleScan = async () => {
    const res = await transportMgrRef.current.requestRealBluetoothScan();
    alert(res.message);
  };

  // Add Simulated Field Node
  const handleAddSimulatedNode = (name: string, hopDistance: number, rssi: number) => {
    const newNode: MeshNode = {
      id: `node_sim_${Date.now()}`,
      name,
      shortFingerprint: `MT-${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
      rssi,
      batteryMode: 'balanced',
      batteryLevel: 92,
      isDirectNeighbor: hopDistance === 1,
      hopDistance,
      viaRelayId: hopDistance > 1 ? 'node_bravo_repeater' : undefined,
      lastSeen: Date.now(),
      isSimulated: true,
      isCourierEligible: true,
      forwardedCount: 0,
      isVerified: false,
      isBlocked: false,
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const cyclePowerMode = () => {
    const next: BatteryPowerMode =
      powerMode === 'balanced' ? 'performance' : powerMode === 'performance' ? 'saver' : 'balanced';
    setPowerMode(next);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Top Header */}
      <HeaderBar
        myIdentity={myIdentity}
        powerMode={powerMode}
        peerCount={nodes.length}
        transportStatus={transportStatus}
        onUpdateNickname={(newName) => {
          setMyIdentity((prev) => {
            const updated = { ...prev, displayName: newName };
            localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });
          transportMgrRef.current.updateLocalProfile(newName);
        }}
        onOpenSos={() => setShowSosModal(true)}
        onOpenPanicWipe={() => setShowPanicModal(true)}
        onOpenNativeSpecs={() => setShowNativeSpecsModal(true)}
        onCyclePowerMode={cyclePowerMode}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden relative">
        {/* Navigation Sidebar / Bottom Bar */}
        <NavigationTabs
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          peerCount={nodes.length}
          unreadChatCount={0}
        />

        {/* Dynamic View Panel */}
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {activeTab === 'nearby' && (
            <NearbyPeersView
              myIdentity={myIdentity}
              nodes={nodes}
              onStartChat={(peer) => {
                setActivePeer(peer);
                setActiveTab('chats');
              }}
              onVerifyPeer={(peer) => {
                setVerifyTargetPeer(peer);
                setShowVerifyModal(true);
              }}
              onToggleBlockPeer={handleToggleBlockPeer}
              onRequestBleScan={handleRequestBleScan}
              onAddSimulatedNode={handleAddSimulatedNode}
            />
          )}

          {activeTab === 'chats' && (
            <ChatsView
              myIdentity={myIdentity}
              nodes={nodes}
              activePeer={activePeer}
              messages={chatMessages}
              onSelectPeer={setActivePeer}
              onSendMessage={handleSendMessage}
              onSendFile={handleSendFile}
              onSendVoiceNote={handleSendVoiceNote}
              onVerifyPeer={(peer) => {
                setVerifyTargetPeer(peer);
                setShowVerifyModal(true);
              }}
              onExecuteIrcCommand={handleExecuteIrcCommand}
            />
          )}

          {activeTab === 'channels' && (
            <ChannelsView
              myIdentity={myIdentity}
              nodes={nodes}
              messages={channelMessages}
              activeChannel={activeChannel}
              onSelectChannel={setActiveChannel}
              onSendMessage={handleSendChannelMessage}
              onExecuteIrcCommand={handleExecuteIrcCommand}
            />
          )}

          {activeTab === 'network' && (
            <NetworkTopologyView
              myIdentity={myIdentity}
              nodes={nodes}
              transportStatus={transportStatus}
              powerMode={powerMode}
              courierMailbox={routerRef.current.getCourierMailbox()}
              lastTxTimestamp={lastTxTimestamp}
              onToggleNostrFallback={(enabled) => {
                transportMgrRef.current.setNostrFallback(enabled);
                setTransportStatus((prev) => ({
                  ...prev,
                  nostrFallbackActive: enabled,
                  nostrRelayConnected: enabled,
                }));
              }}
              onSetPowerMode={setPowerMode}
              onRefreshScan={() => {
                setLastTxTimestamp(Date.now());
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              myIdentity={myIdentity}
              transportStatus={transportStatus}
              ephemeralTimer={ephemeralTimer}
              onUpdateIdentity={(newName) => {
                setMyIdentity((prev) => {
                  const updated = { ...prev, displayName: newName };
                  localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(updated));
                  return updated;
                });
                transportMgrRef.current.updateLocalProfile(newName);
              }}
              onSetEphemeralTimer={setEphemeralTimer}
              onToggleNostrFallback={(enabled) => {
                transportMgrRef.current.setNostrFallback(enabled);
                setTransportStatus((prev) => ({
                  ...prev,
                  nostrFallbackActive: enabled,
                }));
              }}
              onOpenIdentityQr={() => {
                setVerifyTargetPeer(null);
                setShowVerifyModal(true);
              }}
              onOpenPanicWipe={() => setShowPanicModal(true)}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {showVerifyModal && (
        <IdentityVerifyModal
          myIdentity={myIdentity}
          targetPeer={verifyTargetPeer}
          onVerifyPeer={handleVerifyPeer}
          onClose={() => {
            setShowVerifyModal(false);
            setVerifyTargetPeer(null);
          }}
        />
      )}

      {showSosModal && (
        <EmergencySosModal
          onBroadcastSos={handleBroadcastSos}
          onClose={() => setShowSosModal(false)}
        />
      )}

      {showPanicModal && (
        <PanicWipeModal
          onConfirmWipe={handlePanicWipe}
          onClose={() => setShowPanicModal(false)}
        />
      )}

      {showNativeSpecsModal && (
        <NativeSpecsModal onClose={() => setShowNativeSpecsModal(false)} />
      )}
    </div>
  );
}
