# Rustybin API Examples

This directory contains example scripts demonstrating how to use the Rustybin API with client-side encryption.

## Available Examples

### JavaScript/Node.js: [`create-paste.js`](create-paste.js)

Create encrypted pastes using Node.js.

**Requirements:**
- Node.js 16+ (uses ES modules)

**Usage:**
```bash
node create-paste.js "Your content here" [language] [options]
```

**Examples:**
```bash
# Basic paste
node create-paste.js "console.log('hello');" javascript

# With burn after read
node create-paste.js "Sensitive data" plaintext --burn-after-read

# With expiration (60 minutes)
node create-paste.js "Temporary note" plaintext --expires-in 60
```

### Python: [`create-paste.py`](create-paste.py)

Create encrypted pastes using Python.

**Requirements:**
```bash
pip install cryptography requests
```

**Usage:**
```bash
python create-paste.py "Your content here" [language] [options]
```

**Examples:**
```bash
# Basic paste
python create-paste.py "print('hello')" python

# With burn after read
python create-paste.py "Sensitive data" plaintext --burn-after-read

# With expiration (60 minutes)
python create-paste.py "Temporary note" plaintext --expires-in 60
```

## Environment Variables

Both scripts support the following environment variables:

- `RUSTYBIN_API_URL`: API base URL (default: `https://api.rustybin.net/v1`)
- `RUSTYBIN_WEB_URL`: Web base URL (default: `https://rustybin.net`)

**Example:**
```bash
export RUSTYBIN_API_URL=http://localhost:3000/v1
export RUSTYBIN_WEB_URL=http://localhost:3000
node create-paste.js "Test" javascript
```

## How It Works

1. **Generate Key**: Creates a random 256-bit AES key
2. **Encrypt**: Uses AES-256-GCM to encrypt your content
   - Generates a 12-byte random IV
   - Encrypts the data
   - Appends a 16-byte authentication tag
   - Encodes as Base64: `IV + ciphertext + tag`
3. **Upload**: Sends the encrypted data to the API
4. **Share**: Returns a URL with the encryption key in the fragment (`#`)

The server never sees your unencrypted data or the encryption key!

## Learn More

For detailed information about the encryption scheme and API, see [API_ENCRYPTION.md](../API_ENCRYPTION.md).
