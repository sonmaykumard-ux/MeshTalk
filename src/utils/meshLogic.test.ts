/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewIdentity,
  computeFingerprint,
  encryptPayload,
  decryptPayload,
  deriveChannelKey,
} from './crypto';
import { PacketRouter, MeshPacket } from './meshProtocol';
import { parseIrcCommand } from './ircCommands';

test('Identity generation and fingerprint computation', () => {
  const identity = createNewIdentity('Falcon');
  assert.equal(identity.displayName, 'Falcon');
  assert.ok(identity.id.startsWith('node_'));
  assert.ok(identity.shortFingerprint.startsWith('MT-'));
  assert.ok(identity.privateKeySeed.length >= 32);

  const testFp = computeFingerprint('abcdef0123456789');
  assert.ok(testFp.startsWith('MT-ABCD-EF01'));
});

test('Authenticated encryption envelope roundtrip', () => {
  const alice = createNewIdentity('Alice');
  const bob = createNewIdentity('Bob');

  const secretMessage = 'Coordinates: 37.7749 N, 122.4194 W. Rendezvous at 1800h.';
  const envelope = encryptPayload(secretMessage, bob.id, alice.privateKeySeed);

  assert.equal(envelope.version, 1);
  assert.equal(envelope.algorithm, 'ChaCha20-Poly1305');
  assert.ok(envelope.cipherText.length > 0);
  assert.notEqual(envelope.cipherText, secretMessage);

  const decrypted = decryptPayload(envelope, bob.privateKeySeed, alice.id);
  assert.equal(decrypted, secretMessage);

  // Derivation of channel password keys
  const k1 = deriveChannelKey('#offgrid', 'hunter2');
  const k2 = deriveChannelKey('#offgrid', 'hunter2');
  const k3 = deriveChannelKey('#offgrid', 'wrong');
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
});

test('Packet router deduplication and loop prevention', () => {
  const router = new PacketRouter('node_alice');
  const blocked = new Set<string>();
  const neighbors = new Set<string>(['node_bob', 'node_carol']);

  const pkt: MeshPacket = router.createPacket(
    'PUBLIC_BROADCAST',
    'Alice',
    '*',
    'Hello Mesh network!',
    '#general',
    'balanced'
  );

  assert.equal(pkt.hopCount, 0);
  assert.equal(pkt.ttl, 5);

  // Receiving same packet again should be dropped as duplicate
  const evalDup = router.evaluatePacket(pkt, blocked, neighbors);
  assert.equal(evalDup.decision, 'DROP_DUPLICATE');

  // Receiving packet with local node in relay history should be dropped as loop
  const loopPkt: MeshPacket = {
    ...pkt,
    packetId: 'pkt_loop_test',
    relayHistory: ['node_bob', 'node_alice'],
  };
  const evalLoop = router.evaluatePacket(loopPkt, blocked, neighbors);
  assert.equal(evalLoop.decision, 'DROP_EXPIRED');
});

test('Multi-hop relaying and TTL decrement', () => {
  const routerBob = new PacketRouter('node_bob');
  const blocked = new Set<string>();
  const neighbors = new Set<string>(['node_carol']);

  const incomingPkt: MeshPacket = {
    magic: 0x4D54,
    version: 1,
    packetId: 'pkt_alice_to_carol',
    packetType: 'ENCRYPTED_DIRECT',
    senderId: 'node_alice',
    senderName: 'Alice',
    recipientId: 'node_carol',
    ttl: 4,
    maxTtl: 5,
    hopCount: 1,
    timestamp: Date.now(),
    payload: 'opaque-ciphertext',
    relayHistory: ['node_alice'],
  };

  const evalResult = routerBob.evaluatePacket(incomingPkt, blocked, neighbors);
  assert.equal(evalResult.decision, 'RELAY');
  assert.ok(evalResult.forwardPacket);
  assert.equal(evalResult.forwardPacket.ttl, 3);
  assert.equal(evalResult.forwardPacket.hopCount, 2);
  assert.deepEqual(evalResult.forwardPacket.relayHistory, ['node_alice', 'node_bob']);
});

test('Store-and-forward courier delay-tolerant buffering and flush', () => {
  const routerCourier = new PacketRouter('node_courier');
  const blocked = new Set<string>();
  // Destination node_dave is NOT currently in direct neighbors
  const neighbors = new Set<string>(['node_bob']);

  const pktForDave: MeshPacket = {
    magic: 0x4D54,
    version: 1,
    packetId: 'pkt_for_offline_dave',
    packetType: 'ENCRYPTED_DIRECT',
    senderId: 'node_alice',
    senderName: 'Alice',
    recipientId: 'node_dave',
    ttl: 5,
    maxTtl: 5,
    hopCount: 1,
    timestamp: Date.now(),
    payload: 'store-for-dave',
    relayHistory: ['node_alice'],
  };

  const evalCourier = routerCourier.evaluatePacket(pktForDave, blocked, neighbors);
  assert.equal(evalCourier.decision, 'STORE_COURIER');

  const mailbox = routerCourier.getCourierMailbox();
  assert.equal(mailbox.length, 1);
  assert.equal(mailbox[0].targetRecipientId, 'node_dave');

  // Dave comes online / is encountered:
  const flushed = routerCourier.checkAndFlushCourier('node_dave');
  assert.equal(flushed.length, 1);
  assert.equal(flushed[0].packetId, 'pkt_for_offline_dave');
  assert.equal(flushed[0].isCourierCarried, true);
  assert.equal(routerCourier.getCourierMailbox().length, 0);
});

test('IRC command parsing', () => {
  assert.equal(parseIrcCommand('hello world').isCommand, false);

  const help = parseIrcCommand('/help');
  assert.equal(help.isCommand, true);
  assert.equal(help.action, 'HELP');

  const nick = parseIrcCommand('/nick GhostRider');
  assert.equal(nick.action, 'NICK');
  assert.deepEqual(nick.params, ['GhostRider']);

  const msg = parseIrcCommand('/msg Scout_4 rendezvous point reached');
  assert.equal(msg.action, 'MSG');
  assert.equal(msg.params?.[0], 'Scout_4');
  assert.equal(msg.params?.[1], 'rendezvous point reached');

  const join = parseIrcCommand('/join emergency');
  assert.equal(join.action, 'JOIN');
  assert.equal(join.params?.[0], '#emergency');

  const sos = parseIrcCommand('/sos Flash flood near river crossing');
  assert.equal(sos.action, 'SOS');
  assert.equal(sos.params?.[0], 'Flash flood near river crossing');

  const mode = parseIrcCommand('/mode saver');
  assert.equal(mode.action, 'MODE');
  assert.equal(mode.params?.[0], 'saver');
});
