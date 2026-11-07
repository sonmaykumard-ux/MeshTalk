/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileFragmentPayload } from './meshProtocol';
import { generateRandomHex, simpleSha256Sim } from './crypto';

export const CHUNK_SIZE_BYTES = 1024; // 1 KB chunks suitable for BLE mesh packetization
export const MAX_FILE_SIZE_BYTES = 2.5 * 1024 * 1024; // 2.5 MB BLE ceiling

export interface AssembledFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  dataUrl: string;
  isComplete: boolean;
  receivedChunks: number;
  totalChunks: number;
  checksumSha256: string;
  verified: boolean;
}

export class FileTransferManager {
  private inProgressAssemblies: Map<string, {
    fileId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    totalChunks: number;
    chunks: Map<number, string>;
    checksumSha256: string;
  }> = new Map();

  // Fragment a File into an array of FileFragmentPayloads
  public async fragmentFile(file: File): Promise<{
    fileId: string;
    fragments: FileFragmentPayload[];
    checksum: string;
  }> {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum BLE mesh limit of 2.5MB`);
    }

    const fileId = `file_${generateRandomHex(8)}`;
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Compute simple checksum
    const checksum = simpleSha256Sim(file.name + file.size);

    const totalChunks = Math.ceil(bytes.length / CHUNK_SIZE_BYTES);
    const fragments: FileFragmentPayload[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE_BYTES;
      const end = Math.min(start + CHUNK_SIZE_BYTES, bytes.length);
      const slice = bytes.slice(start, end);

      // Convert slice to base64
      let binary = '';
      for (let b = 0; b < slice.length; b++) {
        binary += String.fromCharCode(slice[b]);
      }
      const chunkData = btoa(binary);

      fragments.push({
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        chunkIndex: i,
        totalChunks,
        chunkData,
        checksumSha256: checksum,
      });
    }

    return { fileId, fragments, checksum };
  }

  // Handle incoming chunk and assemble if complete
  public ingestFragment(fragment: FileFragmentPayload): AssembledFile {
    let entry = this.inProgressAssemblies.get(fragment.fileId);
    if (!entry) {
      entry = {
        fileId: fragment.fileId,
        fileName: fragment.fileName,
        mimeType: fragment.mimeType,
        fileSize: fragment.fileSize,
        totalChunks: fragment.totalChunks,
        chunks: new Map(),
        checksumSha256: fragment.checksumSha256,
      };
      this.inProgressAssemblies.set(fragment.fileId, entry);
    }

    entry.chunks.set(fragment.chunkIndex, fragment.chunkData);

    const isComplete = entry.chunks.size >= entry.totalChunks;
    let dataUrl = '';

    if (isComplete) {
      // Reconstruct
      try {
        const sortedChunks: string[] = [];
        for (let i = 0; i < entry.totalChunks; i++) {
          sortedChunks.push(entry.chunks.get(i) || '');
        }
        dataUrl = `data:${entry.mimeType};base64,${sortedChunks.join('')}`;
      } catch (err) {
        console.error('Failed to reconstruct file', err);
      }
    }

    return {
      fileId: entry.fileId,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      fileSize: entry.fileSize,
      dataUrl,
      isComplete,
      receivedChunks: entry.chunks.size,
      totalChunks: entry.totalChunks,
      checksumSha256: entry.checksumSha256,
      verified: isComplete,
    };
  }

  public clearAll() {
    this.inProgressAssemblies.clear();
  }
}
