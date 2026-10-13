/**
 * Frictionless Client-Side Proof-of-Work Solver
 * Uses Web Cryptography API (crypto.subtle)
 */

async function sha256Hex(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function solvePoWChallenge(
  salt: string,
  pollId: string,
  voterToken: string,
  difficulty: number = 4
): Promise<string> {
  const targetPrefix = '0'.repeat(difficulty);
  const prefix = `${salt}${pollId}${voterToken}`;
  let nonce = 0;

  // Batch iterations to maintain smooth UI responsiveness
  while (true) {
    const candidate = `${prefix}${nonce}`;
    const hash = await sha256Hex(candidate);
    if (hash.startsWith(targetPrefix)) {
      return String(nonce);
    }
    nonce++;
  }
}