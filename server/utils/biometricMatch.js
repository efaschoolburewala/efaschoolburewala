/**
 * Server-side biometric descriptor matching utility.
 * Mirrors the LBP+HOG descriptor similarity logic from client/utils/biometrics.ts
 *
 * Uses Pearson Correlation Coefficient for comparing two numeric feature vectors.
 * Score: 0.0 (different) → 1.0 (identical)
 *   >= 0.70  → Same person (High confidence)
 *   >= 0.55  → Possible match (Medium confidence, use with caution)
 *   <  0.55  → Different person → REJECT
 */

/**
 * Computes Pearson Correlation Similarity between two equal-length numeric arrays.
 * @param {number[]} v1 - Live scan descriptor
 * @param {number[]} v2 - Stored (enrolled) descriptor
 * @returns {number} Similarity score between 0.0 and 1.0
 */
function pearsonSimilarity(v1, v2) {
    if (
        !v1 || !v2 ||
        !Array.isArray(v1) || !Array.isArray(v2) ||
        v1.length === 0 || v1.length !== v2.length
    ) {
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
    return Math.max(0, Math.min(1, correlation));
}

/**
 * Cosine similarity fallback (used for fingerprint numeric descriptors).
 * @param {number[]} v1
 * @param {number[]} v2
 * @returns {number} Similarity between 0.0 and 1.0
 */
function cosineSimilarity(v1, v2) {
    if (
        !v1 || !v2 ||
        !Array.isArray(v1) || !Array.isArray(v2) ||
        v1.length === 0 || v1.length !== v2.length
    ) {
        return 0;
    }

    let dot = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < v1.length; i++) {
        dot += v1[i] * v2[i];
        mag1 += v1[i] * v1[i];
        mag2 += v2[i] * v2[i];
    }
    const denom = Math.sqrt(mag1) * Math.sqrt(mag2);
    if (!denom) return 0;
    return Math.max(0, Math.min(1, dot / denom));
}

/**
 * Primary exported matching function.
 * Tries Pearson first; falls back to cosine if Pearson returns 0 (e.g., constant vector).
 * @param {number[]} liveDescriptor - Descriptor from the live biometric scan
 * @param {number[]} storedDescriptor - Descriptor retrieved from the DB
 * @returns {number} Best similarity score between 0.0 and 1.0
 */
function computeBiometricSimilarity(liveDescriptor, storedDescriptor) {
    const pearson = pearsonSimilarity(liveDescriptor, storedDescriptor);
    if (pearson > 0) return pearson;
    // fallback to cosine if pearson is degenerate
    return cosineSimilarity(liveDescriptor, storedDescriptor);
}

module.exports = { computeBiometricSimilarity, pearsonSimilarity, cosineSimilarity };
