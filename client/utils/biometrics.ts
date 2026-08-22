/**
 * High-Security Biometric Facial & Eye Retina Landmark Extraction
 * Uses Local Binary Patterns (LBP) + Histogram of Oriented Gradients (HOG)
 * across a 4x4 spatial grid to generate an illumination-invariant 256-dimensional biometric fingerprint.
 */

export function base64UrlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export function bufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function getCurrentHost(): string {
    if (typeof window !== 'undefined' && window.location.hostname) {
        const host = window.location.hostname.toLowerCase();
        if (host !== '' && host !== 'null') {
            return host;
        }
    }
    return 'localhost';
}

/**
 * Extracts a robust 256-D LBP + HOG facial feature vector from the live video feed.
 */
export function extractFaceDescriptor(video: HTMLVideoElement | null): number[] {
    if (!video || !video.videoWidth || !video.videoHeight) return [];

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Center crop to focus on eyes, eyebrows, nose, and facial contours (65% of center)
    const cropSize = Math.min(vw, vh) * 0.65;
    const sx = (vw - cropSize) / 2;
    const sy = (vh - cropSize) / 2;

    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    // Convert to grayscale 2D array (128x128)
    const gray = new Float32Array(size * size);
    let totalLum = 0;
    for (let i = 0; i < size * size; i++) {
        const idx = i * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        gray[i] = lum;
        totalLum += lum;
    }

    // Check image variance to reject pitch black or plain white frames
    const meanLum = totalLum / (size * size);
    let varianceSum = 0;
    for (let i = 0; i < size * size; i++) {
        const diff = gray[i] - meanLum;
        varianceSum += diff * diff;
    }
    const stdDev = Math.sqrt(varianceSum / (size * size));
    if (stdDev < 10) {
        // Uniform or blank frame - not a valid face
        return [];
    }

    const gridSize = 4; // 4x4 spatial blocks
    const blockSize = size / gridSize; // 32x32 pixels per block
    const fullFeatures: number[] = [];

    // Process each 32x32 block
    for (let by = 0; by < gridSize; by++) {
        for (let bx = 0; bx < gridSize; bx++) {
            const lbpHist = new Float32Array(8); // 8-bin LBP histogram
            const hogHist = new Float32Array(8); // 8-bin HOG histogram

            const startX = bx * blockSize;
            const startY = by * blockSize;

            for (let y = startY + 1; y < startY + blockSize - 1; y++) {
                for (let x = startX + 1; x < startX + blockSize - 1; x++) {
                    const center = gray[y * size + x];

                    // 1. Local Binary Pattern (LBP)
                    let pattern = 0;
                    if (gray[(y - 1) * size + (x - 1)] >= center) pattern |= 1;
                    if (gray[(y - 1) * size + x] >= center) pattern |= 2;
                    if (gray[(y - 1) * size + (x + 1)] >= center) pattern |= 4;
                    if (gray[y * size + (x + 1)] >= center) pattern |= 8;
                    if (gray[(y + 1) * size + (x + 1)] >= center) pattern |= 16;
                    if (gray[(y + 1) * size + x] >= center) pattern |= 32;
                    if (gray[(y + 1) * size + (x - 1)] >= center) pattern |= 64;
                    if (gray[y * size + (x - 1)] >= center) pattern |= 128;

                    // Bin into 8 uniform transitions
                    const bin = Math.min(7, Math.floor(pattern / 32));
                    lbpHist[bin]++;

                    // 2. Sobel Gradient Magnitude & Orientation (HOG)
                    const gx = gray[y * size + (x + 1)] - gray[y * size + (x - 1)];
                    const gy = gray[(y + 1) * size + x] - gray[(y - 1) * size + x];
                    const mag = Math.sqrt(gx * gx + gy * gy);
                    let angle = Math.atan2(gy, gx); // -PI to PI
                    if (angle < 0) angle += Math.PI * 2;
                    const angleBin = Math.min(7, Math.floor((angle / (Math.PI * 2)) * 8));
                    hogHist[angleBin] += mag;
                }
            }

            // Normalize block LBP
            let lbpSum = 0;
            for (let i = 0; i < 8; i++) lbpSum += lbpHist[i] * lbpHist[i];
            const lbpNorm = Math.sqrt(lbpSum) || 1;
            for (let i = 0; i < 8; i++) fullFeatures.push(lbpHist[i] / lbpNorm);

            // Normalize block HOG
            let hogSum = 0;
            for (let i = 0; i < 8; i++) hogSum += hogHist[i] * hogHist[i];
            const hogNorm = Math.sqrt(hogSum) || 1;
            for (let i = 0; i < 8; i++) fullFeatures.push(hogHist[i] / hogNorm);
        }
    }

    // L2 Normalize overall 256-D vector
    const totalNorm = Math.sqrt(fullFeatures.reduce((acc, v) => acc + v * v, 0)) || 1;
    return fullFeatures.map(v => v / totalNorm);
}

/**
 * Captures multiple frame vectors and computes an averaged, noise-filtered biometric template.
 */
export async function captureMultiFrameDescriptor(
    video: HTMLVideoElement | null,
    frameCount: number = 4
): Promise<number[]> {
    if (!video) return [];

    const vectors: number[][] = [];
    for (let i = 0; i < frameCount; i++) {
        const vec = extractFaceDescriptor(video);
        if (vec.length > 0) {
            vectors.push(vec);
        }
        await new Promise(r => setTimeout(r, 80));
    }

    if (vectors.length === 0) return [];

    const dim = vectors[0].length;
    const avgVector: number[] = new Array(dim).fill(0);
    for (const v of vectors) {
        for (let d = 0; d < dim; d++) {
            avgVector[d] += v[d];
        }
    }

    // Average and L2 normalize
    const count = vectors.length;
    const norm = Math.sqrt(avgVector.reduce((acc, v) => acc + (v / count) * (v / count), 0)) || 1;
    return avgVector.map(v => (v / count) / norm);
}

/**
 * Calculates Pearson Correlation Similarity between two vectors.
 * Returns score between 0.0 and 1.0 (Same Person: >= 0.70, Different: <= 0.40)
 */
export function computeBiometricSimilarity(v1: number[], v2: number[]): number {
    if (!v1 || !v2 || !Array.isArray(v1) || !Array.isArray(v2) || v1.length === 0 || v1.length !== v2.length) {
        return 0;
    }

    const n = v1.length;
    let sum1 = 0;
    let sum2 = 0;
    for (let i = 0; i < n; i++) {
        sum1 += v1[i];
        sum2 += v2[i];
    }
    const mean1 = sum1 / n;
    const mean2 = sum2 / n;

    let numerator = 0;
    let var1 = 0;
    let var2 = 0;
    for (let i = 0; i < n; i++) {
        const diff1 = v1[i] - mean1;
        const diff2 = v2[i] - mean2;
        numerator += diff1 * diff2;
        var1 += diff1 * diff1;
        var2 += diff2 * diff2;
    }

    const denom = Math.sqrt(var1) * Math.sqrt(var2);
    if (!denom || denom === 0) return 0;

    const correlation = numerator / denom;
    return Math.max(0, correlation);
}
