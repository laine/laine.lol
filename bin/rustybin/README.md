<p align="center">
  <img src="site/public/favicon.svg" alt="Rustybin" width="64" height="64" />
</p>

<h1 align="center">Rustybin</h1>

<p align="center">
  A modern, secure pastebin service built with Rust and React. Rustybin allows you to create, view, and share text snippets with automatic syntax highlighting.
</p>

<p align="center">
  <a href="https://rustybin.net">Live demo</a> &middot;
  <a href="https://github.com/EternityX/rustybin/issues">Report a Bug</a>
</p>

## Comparison

See how Rustybin stacks up against other popular paste services:

| Feature | Rustybin | GitHub Gist | Hemmelig | PrivateBin | EnigmaBin |
|---|:---:|:---:|:---:|:---:|:---:|
| **End-to-end encryption** | ✅ AES-256-GCM | ❌ | ✅ AES-256-GCM | ✅ AES-256-GCM | ✅ XChaCha20-Poly1305 |
| **Zero-knowledge server** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Quantum-resistant encryption** | ✅ ML-KEM-1024 | ❌ | ❌ | ❌ | ✅ ML-KEM-1024 |
| **Syntax highlighting** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Auto language detection** | ✅ | ⚠️ File extension | ❌ | ✅ | ❌ |
| **Markdown rendering** | ✅  | ✅ | ❌ | ✅ | ✅ |
| **Workspaces / multi-file** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Burn after read** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Paste expiration** | ✅ 5m - never | ❌ | ✅ 5m – 28d | ✅ 5m – never | ✅ 1h – never |
| **Password protection** | ✅ (via encryption) | ❌ | ✅ | ✅ | ✅ (via encryption) |
| **Edit key / edit support** | ✅ Separate edit URL | ✅ Owner only | ❌ | ❌ | ❌ |
| **Admin dashboard** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Self-hostable** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Open source** | ✅ MIT | ❌ Proprietary | ✅ O'Saasy | ✅ zlib | ⚠️ Source-available |
| **No account required** | ✅ | ❌ | ⚠️ Some features require account | ✅ | ✅ |
| **API** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Drag & drop file import** | ✅ | ✅ | ⚠️ Requires account | ✅ | ❌ |

## Features

### Core
- **End-to-End Encryption**: Client-side AES-256-GCM encryption — the server never sees your paste contents
- **Zero-Knowledge Architecture**: Decryption keys stay in the URL fragment (#) and are never sent to the server
- **Quantum-Resistant Encryption**: Optional ML-KEM-1024 (CRYSTALS-Kyber) hybrid encryption to protect pastes from future quantum computing attacks
- **Syntax Highlighting**: Support for 30+ programming languages using Prism
- **Auto Language Detection**: Automatically detects the programming language as you type
- **Workspaces**: Create workspaces that allow you to store multiple pastes under a single URL
- **Markdown Support**: Full markdown rendering with GFM, syntax highlighting, task lists, footnotes, emoji, and more
- **RESTful API**: Full API for creating, retrieving, updating, and deleting pastes
- **SQLite Database**: Lightweight, file-based database for storing encrypted pastes
- **Modern Design**: Clean, dark-themed UI built with React, TypeScript, and Tailwind CSS

### Advanced Features
Enable advanced options when creating a paste:
- **Burn After Read**: Paste is automatically deleted after being viewed once
- **Expiration**: Set pastes to auto-delete after a specified time (5 min to 1 week)
- **Edit Keys**: Get a separate editable URL to make changes while sharing a read-only link
- **Quantum-Resistant Mode**: Wraps AES-256-GCM with ML-KEM-1024 key encapsulation for post-quantum security

### Admin Dashboard
A built-in admin dashboard for site operators, accessible at `/admin`:
- **Secure Authentication**: Login with a pre-configured admin secret, JWT sessions stored in HTTP-only cookies
- **Dashboard Statistics**: View total pastes, pending expiration, burn-after-read count, and total storage size
- **Time-Series Charts**: Visualize paste creation over selectable time ranges (24h, 7d, 30d, 1y, all time, custom)
- **Language Distribution**: See which programming languages are most popular
- **Paste Management**: Browse, search, filter, and sort all pastes with a paginated table
- **Bulk Operations**: Delete individual pastes or bulk delete up to 100 at once with confirmation dialogs
- **Audit Logging**: All admin actions (login, logout, deletions) are logged server-side
- **Separate Rate Limiting**: Admin endpoints have independent rate limits from the public API
- **Auto-Disable**: Dashboard is completely disabled when `ADMIN_SECRET` is not configured

## Getting Started

### Prerequisites

- Rust (latest stable)
- Node.js (v18+)
- npm

### Backend Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/EternityX/rustybin.git
   cd rustybin
   ```

2. (Optional) Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Build and run the Rust backend:
   ```bash
   cargo run
   ```

The backend server will start on http://localhost:3000 (or the port specified in your .env file).

#### Backend Environment Variables

The backend can be configured using the following environment variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `RUST_ENV` | Environment mode (`development` or `production`) | `development` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `https://rustybin.net,http://localhost:8080,http://localhost:5173,https://api.rustybin.net` |
| `READ_RATE_LIMIT` | Read operations per minute per IP | `45` |
| `CREATE_RATE_LIMIT` | Create operations per minute per IP | `15` |
| `UPDATE_RATE_LIMIT` | Update operations per minute per IP | `15` |
| `DELETE_RATE_LIMIT` | Delete operations per minute per IP | `15` |
| `RUST_LOG` | Logging level (error, warn, info, debug, trace) | `info` |
| `ADMIN_SECRET` | Admin dashboard password (dashboard disabled if unset) | *(none)* |
| `ADMIN_SESSION_HOURS` | Admin session duration in hours | `24` |
| `ADMIN_LOGIN_RATE_LIMIT` | Admin login attempts per minute per IP | `5` |
| `ADMIN_READ_RATE_LIMIT` | Admin read operations per minute | `60` |
| `ADMIN_DELETE_RATE_LIMIT` | Admin delete operations per minute | `20` |

**Example .env file:**

```env
PORT=3000
RUST_ENV=development
CORS_ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:5173
READ_RATE_LIMIT=45
CREATE_RATE_LIMIT=15
UPDATE_RATE_LIMIT=15
DELETE_RATE_LIMIT=15
RUST_LOG=info

# Admin dashboard (omit ADMIN_SECRET to disable)
ADMIN_SECRET=your-secure-admin-secret
ADMIN_SESSION_HOURS=24
```

**CORS Configuration:**
To allow your frontend to connect to the backend, make sure to include your frontend's URL in the `CORS_ALLOWED_ORIGINS` environment variable. For local development, this typically includes `http://localhost:5173` (Vite's default port) or whichever port your frontend runs on.

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd site
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   The `.env` file should contain:

   ```env
   # For development - update the port to match your backend configuration
   VITE_API_URL=http://localhost:3000/v1

   # For production
   # VITE_API_URL=https://yourdomain.com/v1
   ```

   **Note**: Make sure the port in `VITE_API_URL` matches the port your Rust backend is running on (configured in the backend's `.env` file) and the port has been changed in `vite.config.ts`.

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm dev
   ```

The frontend development server will start on http://localhost:3000.

## API Endpoints

All endpoints are prefixed with `/v1`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/health` | Health check |
| `POST` | `/v1/pastes` | Create a new paste |
| `GET` | `/v1/pastes/:id` | Get a specific paste |
| `PUT` | `/v1/pastes/:id` | Update a paste (requires edit key) |
| `DELETE` | `/v1/pastes/:id` | Delete a paste (requires edit key) |

#### Admin Endpoints

These endpoints are only available when `ADMIN_SECRET` is configured.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/admin/login` | Authenticate with admin secret |
| `POST` | `/v1/admin/logout` | Clear admin session |
| `GET` | `/v1/admin/stats` | Dashboard statistics (with time range query params) |
| `GET` | `/v1/admin/pastes` | Filtered, paginated paste list |
| `DELETE` | `/v1/admin/pastes/:id` | Delete a single paste |
| `DELETE` | `/v1/admin/pastes` | Bulk delete pastes (IDs in request body) |

### Request/Response Details

**Create Paste (`POST /v1/pastes`)**
```json
{
  "data": "encrypted_content",
  "language": "javascript",
  "burn_after_read": false,
  "expires_in_minutes": null
}
```

> **Note**: The `data` field must contain **AES-256-GCM encrypted content**, not plaintext. 
> The encryption happens client-side, and the server never sees your unencrypted data.
> 
> **See [API_ENCRYPTION.md](API_ENCRYPTION.md)** for detailed encryption instructions and working examples in Python and JavaScript.

**Update/Delete** requires an `edit_key` in the request body for authorization.

### Rate Limiting

All endpoints include rate limit headers:
- `x-ratelimit-remaining`: Requests remaining in the current window
- `x-ratelimit-reset`: Seconds until the rate limit resets

## Deployment

### Backend

Build the Rust application for production:

```bash
cargo build --release
```

### Frontend

Build the React application for production:

```bash
cd site
pnpm build
```

The built files will be in the `site/dist` directory, which can be served by the Rust backend.

### Docker

Rustybin runs as a single container — the backend serves the built SPA same-origin, so one image
provides the API, UI, and SQLite storage.

See **[DOCKER.md](DOCKER.md)** for the Docker / Docker Compose quickstart, GHCR images, and configuration.

## Cloudflare

Please see the `site/DEPLOYMENT.md` to deploy on Cloudflare pages.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
