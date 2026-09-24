#!/usr/bin/env python3
"""
Rustybin API Example (Python)

This script demonstrates how to create an encrypted paste using the Rustybin API.
It uses AES-256-GCM encryption to encrypt the paste content before sending it to the server.

Usage:
    python create-paste.py "Your paste content here" [language] [--burn-after-read] [--expires-in MINUTES]

Example:
    python create-paste.py "console.log('hello');" javascript
    python create-paste.py "print('hello')" python --burn-after-read --expires-in 60

Requirements:
    pip install cryptography requests
"""

import os
import sys
import base64
import argparse
import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

API_URL = os.getenv('RUSTYBIN_API_URL', 'http://127.0.0.1:3001/v1')
WEB_URL = os.getenv('RUSTYBIN_WEB_URL', 'http://localhost:3001')


def generate_key():
    """Generate a random 256-bit encryption key.
    
    Returns:
        bytes: 32-byte encryption key
    """
    return os.urandom(32)


def encrypt_data(plaintext, key):
    """Encrypt data using AES-256-GCM.
    
    Args:
        plaintext (str): The data to encrypt
        key (bytes): 32-byte encryption key
    
    Returns:
        str: Base64-encoded encrypted data (IV + ciphertext + tag)
    """
    # Generate a random 12-byte IV
    iv = os.urandom(12)
    
    # Create AESGCM cipher
    aesgcm = AESGCM(key)
    
    # Encrypt the data (automatically appends 16-byte authentication tag)
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext.encode('utf-8'), None)
    
    # Combine: IV (12 bytes) + ciphertext + tag (16 bytes)
    combined = iv + ciphertext_with_tag
    
    # Return as base64
    return base64.b64encode(combined).decode('ascii')


def create_paste(data, language='plaintext', burn_after_read=False, expires_in_minutes=None):
    """Create a paste on Rustybin.
    
    Args:
        data (str): Encrypted paste content (base64)
        language (str): Syntax highlighting language
        burn_after_read (bool): Delete after first view
        expires_in_minutes (int|None): Auto-delete after N minutes
    
    Returns:
        dict: API response
    
    Raises:
        requests.HTTPError: If API request fails
    """
    response = requests.post(
        f'{API_URL}/pastes',
        json={
            'data': data,
            'language': language,
            'burn_after_read': burn_after_read,
            'expires_in_minutes': expires_in_minutes,
        },
        headers={'Content-Type': 'application/json'}
    )
    
    response.raise_for_status()
    return response.json()


def main():
    parser = argparse.ArgumentParser(
        description='Create an encrypted paste on Rustybin',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "console.log('hello');" javascript
  %(prog)s "print('hello')" python --burn-after-read
  %(prog)s "SELECT * FROM users;" sql --expires-in 60

Environment Variables:
  RUSTYBIN_API_URL    API base URL (default: http://127.0.0.1:3000/v1)
  RUSTYBIN_WEB_URL    Web base URL (default: http://localhost:3000)
        """
    )
    
    parser.add_argument('content', help='The paste content')
    parser.add_argument('language', nargs='?', default='plaintext',
                        help='Syntax highlighting language (default: plaintext)')
    parser.add_argument('--burn-after-read', action='store_true',
                        help='Delete the paste after first view')
    parser.add_argument('--expires-in', type=int, metavar='MINUTES',
                        help='Auto-delete after N minutes')
    
    args = parser.parse_args()
    
    # Step 1: Generate encryption key
    key = generate_key()
    key_base64 = base64.b64encode(key).decode('ascii')
    
    # Step 2: Encrypt the content
    encrypted_data = encrypt_data(args.content, key)

    # Step 3: Create the paste via API
    try:
        result = create_paste(
            data=encrypted_data,
            language=args.language,
            burn_after_read=args.burn_after_read,
            expires_in_minutes=args.expires_in
        )

        # Construct shareable URL
        share_url = f'{WEB_URL}/{result["id"]}#{key_base64}'
        print(f'  {share_url}')
        
    except requests.HTTPError as e:
        print(f'Error creating paste: {e}', file=sys.stderr)
        if e.response is not None:
            try:
                error_data = e.response.json()
                print(f'API Error: {error_data.get("error", "Unknown error")}', file=sys.stderr)
            except:
                pass
        sys.exit(1)
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
