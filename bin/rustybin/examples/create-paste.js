#!/usr/bin/env node
/**
 * Rustybin API Example (Node.js)
 * 
 * This script demonstrates how to create an encrypted paste using the Rustybin API.
 * It uses AES-256-GCM encryption to encrypt the paste content before sending it to the server.
 * 
 * Usage:
 *   node create-paste.js "Your paste content here" [language] [--burn-after-read] [--expires-in MINUTES]
 * 
 * Example:
 *   node create-paste.js "console.log('hello');" javascript
 *   node create-paste.js "print('hello')" python --burn-after-read --expires-in 60
 */

import crypto from 'crypto';

const API_URL = process.env.RUSTYBIN_API_URL || 'http://127.0.0.1:3001/v1';
const WEB_URL = process.env.RUSTYBIN_WEB_URL || 'http://localhost:3001';

/**
 * Generate a random 256-bit encryption key
 * @returns {Buffer} 32-byte encryption key
 */
function generateKey() {
  return crypto.randomBytes(32);
}

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - The data to encrypt
 * @param {Buffer} key - 32-byte encryption key
 * @returns {string} Base64-encoded encrypted data (IV + ciphertext + tag)
 */
function encryptData(plaintext, key) {
  // Generate a random 12-byte IV
  const iv = crypto.randomBytes(12);
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  // Encrypt the data
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  // Get the authentication tag (16 bytes)
  const tag = cipher.getAuthTag();
  
  // Combine: IV (12 bytes) + ciphertext + tag (16 bytes)
  const combined = Buffer.concat([iv, encrypted, tag]);
  
  // Return as base64
  return combined.toString('base64');
}

/**
 * Create a paste on Rustybin
 * @param {Object} options - Paste options
 * @param {string} options.data - Encrypted paste content (base64)
 * @param {string} options.language - Syntax highlighting language
 * @param {boolean} options.burnAfterRead - Delete after first view
 * @param {number|null} options.expiresInMinutes - Auto-delete after N minutes
 * @returns {Promise<Object>} API response
 */
async function createPaste({ data, language, burnAfterRead = false, expiresInMinutes = null }) {
  const response = await fetch(`${API_URL}/pastes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data,
      language,
      burn_after_read: burnAfterRead,
      expires_in_minutes: expiresInMinutes,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API Error: ${error.error || response.statusText}`);
  }

  return response.json();
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Rustybin API Example - Create Encrypted Paste

Usage:
  node create-paste.js <content> [language] [options]

Arguments:
  content               The paste content (required)
  language              Syntax highlighting language (default: plaintext)

Options:
  --burn-after-read     Delete the paste after first view
  --expires-in MINUTES  Auto-delete after N minutes (e.g., 60, 1440, 10080)

Environment Variables:
  RUSTYBIN_API_URL      API base URL (default: http://127.0.0.1:3000/v1)
  RUSTYBIN_WEB_URL      Web base URL (default: http://localhost:3000)

Examples:
  node create-paste.js "console.log('hello');" javascript
  node create-paste.js "print('hello')" python --burn-after-read
  node create-paste.js "SELECT * FROM users;" sql --expires-in 60
    `);
    process.exit(0);
  }

  // Parse arguments
  const content = args[0];
  let language = 'plaintext';
  let burnAfterRead = false;
  let expiresInMinutes = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--burn-after-read') {
      burnAfterRead = true;
    } else if (args[i] === '--expires-in') {
      expiresInMinutes = parseInt(args[i + 1], 10);
      i++; // Skip next arg
    } else if (!args[i].startsWith('--')) {
      language = args[i];
    }
  }

  // Step 1: Generate encryption key
  const key = generateKey();
  const keyBase64 = key.toString('base64');

  // Step 2: Encrypt the content
  const encryptedData = encryptData(content, key);

  // Step 3: Create the paste via API
  try {
    const result = await createPaste({
      data: encryptedData,
      language,
      burnAfterRead,
      expiresInMinutes,
    });

    // Construct shareable URL
    const shareUrl = `${WEB_URL}/${result.id}#${keyBase64}`;
    console.log(`${shareUrl}`);
  } catch (error) {
    console.error('Error creating paste:', error.message);
    process.exit(1);
  }
}

main();
