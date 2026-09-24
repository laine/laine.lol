export async function generateEncryptionKey(): Promise<string> {
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  const exportedKey = await window.crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
}

async function importKey(key: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));

  return window.crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(
  data: string,
  keyString: string
): Promise<string> {
  const key = await importKey(keyString);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Generate a random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    dataBuffer
  );

  // Combine IV and encrypted data
  const result = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encryptedBuffer), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...result));
}

// ML-KEM-1024 constants
const KEM_CT_BYTES = 1568;
const KEM_SK_BYTES = 3168;

export type QuantumKeyPair = {
  encapsulationKey: Uint8Array;
  decapsulationKey: string; // base64
};

async function loadMlKem() {
  const { MlKem1024 } = await import("crystals-kyber-js");
  return new MlKem1024();
}

export async function generateQuantumEncryptionKey(): Promise<QuantumKeyPair> {
  const kem = await loadMlKem();
  const [encapsulationKey, decapsulationKey] = await kem.generateKeyPair();
  return {
    encapsulationKey,
    decapsulationKey: btoa(String.fromCharCode(...decapsulationKey)),
  };
}

export async function quantumEncryptData(
  data: string,
  encapsulationKey: Uint8Array,
): Promise<{ encryptedData: string; }> {
  const kem = await loadMlKem();
  const [kemCiphertext, sharedSecret] = await kem.encap(encapsulationKey);

  // Use shared secret as AES-256-GCM key
  const aesKey = await window.crypto.subtle.importKey(
    "raw", sharedSecret, { name: "AES-GCM", length: 256 }, false, ["encrypt"],
  );

  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const aesCiphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, aesKey, encoder.encode(data),
  );

  // Combine: kemCiphertext (1568) || iv (12) || aesCiphertext
  const combined = new Uint8Array(
    KEM_CT_BYTES + iv.length + aesCiphertext.byteLength,
  );
  combined.set(kemCiphertext, 0);
  combined.set(iv, KEM_CT_BYTES);
  combined.set(new Uint8Array(aesCiphertext), KEM_CT_BYTES + iv.length);

  return { encryptedData: btoa(String.fromCharCode(...combined)) };
}

export async function quantumDecryptData(
  encryptedData: string,
  decapsulationKeyB64: string,
): Promise<string> {
  if (!encryptedData || !decapsulationKeyB64) {
    throw new Error("Missing encrypted data or decapsulation key");
  }

  const kem = await loadMlKem();
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

  if (combined.length < KEM_CT_BYTES + 12 + 1) {
    throw new Error("Quantum encrypted data is too short");
  }

  const kemCiphertext = combined.slice(0, KEM_CT_BYTES);
  const iv = combined.slice(KEM_CT_BYTES, KEM_CT_BYTES + 12);
  const aesCiphertext = combined.slice(KEM_CT_BYTES + 12);

  const decapsulationKey = Uint8Array.from(
    atob(decapsulationKeyB64), (c) => c.charCodeAt(0),
  );

  if (decapsulationKey.length !== KEM_SK_BYTES) {
    throw new Error("Invalid decapsulation key length");
  }

  const sharedSecret = await kem.decap(kemCiphertext, decapsulationKey);

  const aesKey = await window.crypto.subtle.importKey(
    "raw", sharedSecret, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
  );

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, aesKey, aesCiphertext,
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    if (error instanceof DOMException && error.name === "OperationError") {
      throw new Error("Quantum decryption failed: Invalid key or corrupted data");
    }
    throw error;
  }
}

export async function decryptData(
  encryptedData: string,
  keyString: string
): Promise<string> {
  try {
    // Validate inputs
    if (!encryptedData || !keyString) {
      throw new Error("Missing encrypted data or key");
    }

    // Check if the encrypted data is long enough to contain an IV (12 bytes) plus some data
    // Base64 encoding increases size by ~33%, so we need at least ~16 chars for IV plus some data
    if (encryptedData.length < 20) {
      throw new Error("Encrypted data is too short to be valid");
    }

    // Validate base64 format with a regex check
    if (!/^[A-Za-z0-9+/=]+$/.test(encryptedData)) {
      throw new Error("Invalid base64 format in encrypted data");
    }

    const key = await importKey(keyString);

    // Convert from base64 to array buffer
    let encryptedBytes;
    try {
      encryptedBytes = Uint8Array.from(atob(encryptedData), (c) =>
        c.charCodeAt(0)
      );
    } catch (error) {
      throw new Error("Invalid base64 data format");
    }

    // Check if we have enough data for IV and ciphertext
    if (encryptedBytes.length <= 12) {
      throw new Error(
        "Encrypted data is too small to contain both IV and ciphertext"
      );
    }

    // Extract IV (first 12 bytes)
    const iv = encryptedBytes.slice(0, 12);
    const ciphertext = encryptedBytes.slice(12);

    // Attempt to decrypt
    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
        },
        key,
        ciphertext
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      if (error instanceof DOMException && error.name === "OperationError") {
        throw new Error("Decryption failed: Invalid key or corrupted data");
      }
      throw error;
    }
  } catch (error) {
    console.error("Decryption error:", error);
    throw error;
  }
}
