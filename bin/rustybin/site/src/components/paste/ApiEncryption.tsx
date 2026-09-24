import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Key, Lock, Send, Link, Shield, FileCode, Gauge, Loader2, Code } from "lucide-react";
import { highlightWithPrism } from "@/utils/prism-utils";

const CodeBlock = ({ code, language }: { code: string; language: string }) => {
  const html = useMemo(() => highlightWithPrism(code, language), [code, language]);
  return (
    <pre
      className={`language-${language} rounded p-3 text-xs font-mono overflow-x-auto`}
      style={{ background: "var(--prism-bg, #1a1a1a)", color: "var(--prism-text-color, #d4d4d4)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <code
        className={`language-${language}`}
        style={{ color: "inherit" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
};

interface RateLimits {
  reset_interval_secs: number;
  read: number;
  create: number;
  update: number;
  delete: number;
}

interface ApiEncryptionProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const JS_ENCRYPT_EXAMPLE = `import crypto from 'crypto';

// Generate key
const key = crypto.randomBytes(32);
const keyBase64 = key.toString('base64');

// Encrypt data
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

let encrypted = cipher.update('Hello, World!', 'utf8');
encrypted = Buffer.concat([encrypted, cipher.final()]);
const tag = cipher.getAuthTag();

// Combine: IV + encrypted + tag
const combined = Buffer.concat([iv, encrypted, tag]);
const encryptedBase64 = combined.toString('base64');

// Create paste via API
const response = await fetch(
  '__API_URL__/v1/pastes',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: encryptedBase64,
      language: 'javascript'
    })
  }
);

const result = await response.json();
console.log(\`URL: __SITE_URL__/\${result.id}#\${keyBase64}\`);`;

const PY_ENCRYPT_EXAMPLE = `import os, base64, requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Generate key
key = os.urandom(32)
key_base64 = base64.b64encode(key).decode()

# Encrypt data
aesgcm = AESGCM(key)
iv = os.urandom(12)
encrypted = aesgcm.encrypt(iv, b'Hello World!', None)

# Combine: IV + ciphertext + tag
combined = iv + encrypted
encrypted_base64 = base64.b64encode(combined).decode()

# Create paste via API
response = requests.post(
    '__API_URL__/v1/pastes',
    json={
        'data': encrypted_base64,
        'language': 'python'
    }
)

result = response.json()
print(f"URL: __SITE_URL__/{result['id']}#{key_base64}")`;

const JS_DECRYPT_EXAMPLE = `import crypto from 'crypto';

const pasteId = 'abc123';
const keyBase64 = '...'; // from URL fragment

// Fetch encrypted paste
const res = await fetch(
  \`__API_URL__/v1/pastes/\${pasteId}\`
);
const paste = await res.json();

// Decode
const key = Buffer.from(keyBase64, 'base64');
const combined = Buffer.from(paste.data, 'base64');

// Split: IV (12 bytes) | ciphertext | tag (16 bytes)
const iv = combined.subarray(0, 12);
const tag = combined.subarray(combined.length - 16);
const ciphertext = combined.subarray(12, combined.length - 16);

// Decrypt
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);

let decrypted = decipher.update(ciphertext, undefined, 'utf8');
decrypted += decipher.final('utf8');

console.log(decrypted); // "Hello, World!"`;

const PY_DECRYPT_EXAMPLE = `import base64, requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

paste_id = 'abc123'
key_base64 = '...'  # from URL fragment

# Fetch encrypted paste
response = requests.get(
    f'__API_URL__/v1/pastes/{paste_id}'
)
paste = response.json()

# Decode
key = base64.b64decode(key_base64)
combined = base64.b64decode(paste['data'])

# Split: IV (12 bytes) | ciphertext + tag
iv = combined[:12]
ciphertext_and_tag = combined[12:]

# Decrypt
aesgcm = AESGCM(key)
plaintext = aesgcm.decrypt(iv, ciphertext_and_tag, None)

print(plaintext.decode())  # "Hello World!"`;

const REQUEST_EXAMPLE = `POST __API_URL__/v1/pastes
Content-Type: application/json

{
  "data": "<base64_encrypted_data>",
  "language": "javascript",
  "burn_after_read": false,
  "expires_in_minutes": null
}`;

const ApiEncryption: React.FC<ApiEncryptionProps> = ({ trigger, open, onOpenChange }) => {
  const [rateLimits, setRateLimits] = useState<RateLimits | null>(null);
  const [rateLimitsLoading, setRateLimitsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRateLimitsLoading(true);
    const apiOrigin = `${import.meta.env.VITE_API_URL}`;
    fetch(`${apiOrigin}/config`)
      .then((res) => res.json())
      .then((data) => setRateLimits(data.rate_limits))
      .catch(() => setRateLimits(null))
      .finally(() => setRateLimitsLoading(false));
  }, [open]);

  // Derive the documented URLs from the current address bar; the API always
  // lives at the `api.` subdomain of whatever host the app is served from.
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const apiUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//api.${window.location.host}`
      : "";
  const fill = (s: string) =>
    s.split("__API_URL__").join(apiUrl).split("__SITE_URL__").join(siteUrl);

  const content = (
    <DialogContent className="max-w-sm sm:max-w-2xl bg-[#0F1014] border-[1px] border-[#20222a] rounded overflow-y-auto max-h-[90vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <span className="icon-tile h-7 w-7 shrink-0"><Code className="h-4 w-4" /></span>
          API & Encryption Guide
        </DialogTitle>
        <DialogDescription className="text-white/50 text-base">
          How to use the  API with client-side AES-256-GCM encryption.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Lock className="h-4 w-4" />
            <h3>Encryption Overview</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
             uses <span className="text-white font-mono">AES-256-GCM</span> client-side encryption.
            The server never sees your plaintext data. All encryption and decryption happens in the client.
          </p>
          <div className="bg-white/5 border border-white/10 rounded p-3 text-xs font-mono text-white/60 space-y-1">
            <div><span className="text-primary">Algorithm:</span> AES-256-GCM (Galois/Counter Mode)</div>
            <div><span className="text-primary">Key Size:</span> 256 bits (32 bytes)</div>
            <div><span className="text-primary">IV Size:</span> 12 bytes (96 bits)</div>
            <div><span className="text-primary">Auth Tag:</span> 16 bytes (128 bits, appended to ciphertext)</div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Gauge className="h-4 w-4" />
            <h3>Rate Limits</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            All API endpoints are rate-limited per IP address. The API returns{" "}
            <span className="font-mono text-white/80">x-ratelimit-remaining</span> and{" "}
            <span className="font-mono text-white/80">x-ratelimit-reset</span> headers with every response.
          </p>
          {rateLimitsLoading ? (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading rate limits...
            </div>
          ) : rateLimits ? (
            <div className="bg-white/5 border border-white/10 rounded p-3 text-xs font-mono text-white/60 space-y-1">
              <div><span className="text-primary">GET</span> (read): <span className="text-white/80">{rateLimits.read}</span> requests per {rateLimits.reset_interval_secs}s</div>
              <div><span className="text-primary">POST</span> (create): <span className="text-white/80">{rateLimits.create}</span> requests per {rateLimits.reset_interval_secs}s</div>
              <div><span className="text-primary">PUT</span> (update): <span className="text-white/80">{rateLimits.update}</span> requests per {rateLimits.reset_interval_secs}s</div>
              <div><span className="text-primary">DELETE</span> (delete): <span className="text-white/80">{rateLimits.delete}</span> requests per {rateLimits.reset_interval_secs}s</div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded p-3 text-xs font-mono text-white/40">
              Unable to fetch rate limits. The API may be unavailable.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Key className="h-4 w-4" />
            <h3>Step 1: Generate a Key</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            Generate a random 32-byte (256-bit) encryption key, then base64-encode it.
          </p>
          <CodeBlock code={`key = random_bytes(32)\nkey_base64 = base64_encode(key)`} language="python" />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Shield className="h-4 w-4" />
            <h3>Step 2: Encrypt Your Data</h3>
          </div>
          <ol className="text-sm text-white/70 leading-relaxed list-decimal pl-6 space-y-1">
            <li>Generate a random 12-byte IV (initialization vector)</li>
            <li>Encrypt the plaintext using AES-GCM with the key and IV</li>
            <li>Concatenate: <span className="font-mono text-white/80">IV + ciphertext + authentication_tag</span></li>
            <li>Base64-encode the result</li>
          </ol>
          <div className="bg-white/5 border border-white/10 rounded p-2 text-xs font-mono text-primary text-center">
            base64( IV || ciphertext || tag )
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Send className="h-4 w-4" />
            <h3>Step 3: Create a Paste</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            Send a <span className="font-mono text-white/80">POST</span> request to <span className="font-mono text-white/80">/v1/pastes</span>:
          </p>
          <CodeBlock code={fill(REQUEST_EXAMPLE)} language="json" />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Link className="h-4 w-4" />
            <h3>Step 4: Share the URL</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            The API returns a paste ID. Construct the shareable URL with the key in the fragment (never sent to the server):
          </p>
          <div className="bg-white/5 border border-white/10 rounded p-2 text-xs font-mono text-white/70 text-center">
            {siteUrl}/<span className="text-primary">{`{paste_id}`}</span>#<span className="text-green-400">{`{key_base64}`}</span>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <FileCode className="h-4 w-4" />
            <h3>JavaScript Example</h3>
          </div>
          <CodeBlock code={fill(JS_ENCRYPT_EXAMPLE)} language="javascript" />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <FileCode className="h-4 w-4" />
            <h3>Python Example</h3>
          </div>
          <CodeBlock code={fill(PY_ENCRYPT_EXAMPLE)} language="python" />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Lock className="h-4 w-4" />
            <h3>Decryption Process</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            To decrypt a paste without the website, fetch the encrypted data from the API and use the key from the URL fragment:
          </p>
          <ol className="text-sm text-white/70 leading-relaxed list-decimal pl-6 space-y-1">
            <li>Fetch the paste: <span className="font-mono text-white/80">GET /v1/pastes/{`{paste_id}`}</span></li>
            <li>Extract the key from the URL fragment (the part after <span className="font-mono text-white/80">#</span>)</li>
            <li>Base64-decode the <span className="font-mono text-white/80">data</span> field</li>
            <li>Split the decoded bytes: <span className="font-mono text-white/80">IV</span> (first 12 bytes) + <span className="font-mono text-white/80">ciphertext + tag</span> (rest)</li>
            <li>Decrypt using AES-256-GCM with the key and IV</li>
          </ol>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <FileCode className="h-4 w-4" />
            <h3>Decryption - JavaScript</h3>
          </div>
          <CodeBlock code={fill(JS_DECRYPT_EXAMPLE)} language="javascript" />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <FileCode className="h-4 w-4" />
            <h3>Decryption - Python</h3>
          </div>
          <CodeBlock code={fill(PY_DECRYPT_EXAMPLE)} language="python" />
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Shield className="h-4 w-4 icon-rainbow" />
          <h3 className="text-rainbow">Quantum-Resistant Mode</h3>
        </div>
        <p className="text-sm text-white/70 leading-relaxed">
          When enabled under advanced options, pastes use <span className="text-white font-mono">ML-KEM-1024 + AES-256-GCM</span> hybrid
          encryption (NIST FIPS 203). This protects against future quantum computing attacks.
        </p>
        <p className="text-sm text-white/70 leading-relaxed">
          URLs with the <span className="font-mono text-white/80">q:</span> prefix use quantum mode.
          Standard pastes without the prefix continue to use AES-256-GCM only.
        </p>
        <div className="bg-white/5 border border-white/10 rounded p-3 text-xs font-mono text-white/60 space-y-1">
          <div><span className="text-rainbow">Algorithm:</span> ML-KEM-1024 (key encapsulation) + AES-256-GCM (symmetric)</div>
          <div><span className="text-rainbow">Decapsulation Key:</span> 3168 bytes (~4224 chars in URL)</div>
          <div><span className="text-rainbow">KEM Ciphertext:</span> 1568 bytes (prepended to encrypted data)</div>
          <div><span className="text-rainbow">Shared Secret:</span> 32 bytes (used as AES-256-GCM key)</div>
        </div>
        <p className="text-sm text-white/70 leading-relaxed">
          <span className="text-white/80">Stored data format:</span>{" "}
          <span className="font-mono text-white/60 text-xs">base64( KEM_ciphertext[1568] || IV[12] || AES_ciphertext )</span>
        </p>
        <div className="bg-white/5 border border-white/10 rounded p-2 text-xs font-mono text-white/70 text-center">
          {siteUrl}/<span className="text-primary">{`{id}`}</span>#q:<span className="text-green-400">{`{base64url_decapsulation_key}`}</span>
        </div>
        <p className="text-sm text-white/70 leading-relaxed">
          To decrypt a quantum paste programmatically: extract the <span className="font-mono text-white/80">q:</span> prefix
          from the URL fragment, base64-decode the decapsulation key, fetch the encrypted data, extract the KEM ciphertext
          (first 1568 bytes), decapsulate to recover the shared secret, then decrypt the remaining AES-GCM payload (IV + ciphertext)
          using the shared secret as the key.
        </p>
      </section>

      <div className="bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200/80 italic">
        <strong>Security Notes:</strong> The encryption key in the URL fragment is never sent to the server.
        Use <strong>burn after read</strong> for sensitive data. Set an <strong>expiration time</strong> for temporary pastes.
        The server only stores encrypted data and cannot decrypt it.
      </div>
    </DialogContent>
  );

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {content}
    </Dialog>
  );
};

export default ApiEncryption;
