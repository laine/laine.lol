# API Encryption Guide

This guide explains how to use the Rustybin API with client-side AES-256-GCM encryption in various programming languages.

## Overview

Rustybin uses **client-side encryption** to ensure that the server never sees your paste contents. All encryption and decryption happens in the client, and only encrypted data is transmitted to the server.

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 12 bytes (96 bits)
- **Authentication Tag**: 16 bytes (128 bits, appended to ciphertext)

## Encryption Process

### 1. Generate a Random Encryption Key

Generate a 32-byte (256-bit) random key:

```
key = random_bytes(32)
key_base64 = base64_encode(key)
```

### 2. Encrypt Your Data

Using AES-256-GCM:

1. Generate a random 12-byte IV (initialization vector)
2. Encrypt the plaintext data using AES-GCM with the key and IV
3. The encryption produces: `ciphertext + authentication_tag` (tag is 16 bytes)
4. Concatenate: `IV + ciphertext + authentication_tag`
5. Base64 encode the result

**Format**: `base64(IV || ciphertext || tag)`

### 3. Create a Paste

Send a POST request to `/v1/pastes`:

```json
{
  "data": "<base64_encrypted_data>",
  "language": "javascript",
  "burn_after_read": false,
  "expires_in_minutes": null
}
```

### 4. Share the URL

The API returns a paste ID. Construct the shareable URL:

```
https://rustybin.net/<paste_id>#<key_base64>
```

The encryption key is placed in the URL fragment (`#`) so it's never sent to the server.

## Example Implementations

See the [`examples/`](examples/) directory for complete working examples:

- **JavaScript (Node.js)**: [`examples/create-paste.js`](examples/create-paste.js)
- **Python**: [`examples/create-paste.py`](examples/create-paste.py)

### Quick Examples

#### JavaScript (Node.js)

```javascript
import crypto from 'crypto';

// Generate key
const key = crypto.randomBytes(32);
const keyBase64 = key.toString('base64');

// Encrypt data
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

let encrypted = cipher.update('Hello, World!', 'utf8');
encrypted = Buffer.concat([encrypted, cipher.final()]);
const tag = cipher.getAuthTag(); // 16 bytes

// Combine: IV + encrypted + tag
const combined = Buffer.concat([iv, encrypted, tag]);
const encryptedBase64 = combined.toString('base64');

// Create paste via API
const response = await fetch('https://api.rustybin.net/v1/pastes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: encryptedBase64,
    language: 'javascript'
  })
});

const result = await response.json();
console.log(`Share URL: https://rustybin.net/${result.id}#${keyBase64}`);
```

#### Python

```python
import os
import base64
import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Generate key
key = os.urandom(32)
key_base64 = base64.b64encode(key).decode()

# Encrypt data
aesgcm = AESGCM(key)
iv = os.urandom(12)
plaintext = b'Hello World!'

# encrypt() returns ciphertext + tag (16 bytes appended)
encrypted = aesgcm.encrypt(iv, plaintext, None)

# Combine: IV + ciphertext + tag
combined = iv + encrypted
encrypted_base64 = base64.b64encode(combined).decode()

# Create paste via API
response = requests.post('https://api.rustybin.net/v1/pastes', json={
    'data': encrypted_base64,
    'language': 'python'
})

result = response.json()
print(f"Share URL: https://rustybin.net/{result['id']}#{key_base64}")
```

## Decryption Process

To decrypt data received from the API:

1. Base64 decode the `data` field
2. Extract the IV (first 12 bytes)
3. Extract the ciphertext + tag (remaining bytes)
4. Decrypt using AES-256-GCM with the key from the URL fragment

The Rustybin frontend handles this automatically when you visit a paste URL.

## Security Notes

- **Never share the full URL** if you want to keep the paste private
- The encryption key in the URL fragment is never sent to the server
- Use **burn after read** for sensitive data that should only be viewed once
- Set an **expiration time** for temporary pastes
- The server only stores encrypted data and cannot decrypt it

## API Reference

See the main [README.md](README.md#api-endpoints) for full API documentation.
