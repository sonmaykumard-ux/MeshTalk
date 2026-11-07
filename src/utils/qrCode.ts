/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Offline self-contained SVG QR code matrix generator for cryptographic key verification

export function generateSimpleQrSvg(text: string, size: number = 200): string {
  // Generate a deterministic 21x21 QR-like matrix pattern based on hash of text
  const dimension = 21;
  const matrix: boolean[][] = Array(dimension).fill(false).map(() => Array(dimension).fill(false));

  // 1. Draw standard Finder Patterns at 3 corners (top-left, top-right, bottom-left)
  function drawFinderPattern(startX: number, startY: number) {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        if (
          x === 0 || x === 6 || y === 0 || y === 6 || // Outer ring
          (x >= 2 && x <= 4 && y >= 2 && y <= 4)      // Inner square
        ) {
          matrix[startY + y][startX + x] = true;
        } else {
          matrix[startY + y][startX + x] = false;
        }
      }
    }
  }

  drawFinderPattern(0, 0); // Top-Left
  drawFinderPattern(dimension - 7, 0); // Top-Right
  drawFinderPattern(0, dimension - 7); // Bottom-Left

  // Timing patterns
  for (let i = 8; i < dimension - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Populate data area deterministically with text hash
  let seed = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 0x01000193);
  }

  for (let y = 0; y < dimension; y++) {
    for (let x = 0; x < dimension; x++) {
      // Skip finder corners
      const inFinderTL = x < 8 && y < 8;
      const inFinderTR = x >= dimension - 8 && y < 8;
      const inFinderBL = x < 8 && y >= dimension - 8;
      const inTiming = x === 6 || y === 6;

      if (!inFinderTL && !inFinderTR && !inFinderBL && !inTiming) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        matrix[y][x] = (seed % 3) === 0 || (seed % 7) === 0;
      }
    }
  }

  // Render SVG elements
  const cellSize = size / dimension;
  const rects: string[] = [];

  for (let y = 0; y < dimension; y++) {
    for (let x = 0; x < dimension; x++) {
      if (matrix[y][x]) {
        rects.push(
          `<rect x="${(x * cellSize).toFixed(2)}" y="${(y * cellSize).toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#10b981" />`
        );
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="#090d16" rx="12" />
    <g>${rects.join('')}</g>
  </svg>`;
}
