# Deploying to Cloudflare Pages

This guide provides detailed instructions for deploying the Rustybin frontend to Cloudflare Pages while connecting to a backend running on a Linux server.

## Overview

Our architecture consists of:

- Frontend: Deployed on Cloudflare Pages (global edge network)
- Backend: Deployed on a Linux server

## Prerequisites

- Cloudflare account
- Access to your Linux server
- Git repository (GitHub, GitLab, etc.) for continuous deployments

## Setting up Environment Variables

### 1. Create an Environment File

Copy the example environment file:

```bash
cp .env.example .env.production
```

Edit `.env.production` to set:

```
VITE_API_URL=https://api.your-backend-domain.com
```

Replace `https://api.your-backend-domain.com` with your actual backend URL.

### 2. Add Environment Variables in Cloudflare Dashboard

When setting up your Pages project, add the following environment variables:

- `VITE_API_URL`: Your backend API URL
- `NODE_VERSION`: 18

## Deployment Methods

### Option 1: Continuous Deployment from Git (Recommended)

1. Push your code to a Git repository
2. Log in to your Cloudflare dashboard
3. Go to Pages > Create a project
4. Connect your Git repository
5. Configure build settings:
   - Framework preset: None (custom build)
   - Build command: `cd site && npm install && npm run build`
   - Build output directory: `site/dist`
   - Environment variables:
     - `NODE_VERSION`: 18
     - `VITE_API_URL`: Your backend URL
6. Click "Save and Deploy"

With this setup, every push to your repository will trigger a new deployment.

### Option 2: Manual Deployment

If you prefer to deploy without Git integration:

1. Build your site locally:

   ```bash
   cd site
   # You can use pnpm locally
   pnpm install
   VITE_API_URL=https://api.your-backend-domain.com pnpm build

   # Or use npm
   npm install
   VITE_API_URL=https://api.your-backend-domain.com npm run build
   ```

2. Use the Cloudflare Pages Direct Upload feature:
   - Log in to your Cloudflare dashboard
   - Go to Pages > Create a project > Direct Upload
   - Enter a project name and click "Create project"
   - Upload your `dist` folder
   - Set any required environment variables in the Settings tab

## CORS Configuration

For your backend to accept requests from your Cloudflare Pages site, you'll need to configure CORS on your Linux server.

Add the following headers to your Rust backend responses:

```rust
.header("Access-Control-Allow-Origin", "https://your-pages-domain.pages.dev")
.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
```

Replace `https://your-pages-domain.pages.dev` with your actual Cloudflare Pages domain.

## Custom Domain Setup

To use a custom domain with your Cloudflare Pages site:

1. Go to your Pages project in the Cloudflare dashboard
2. Navigate to the "Custom domains" tab
3. Click "Set up a custom domain"
4. Follow the instructions to add your domain

## Troubleshooting

If you encounter issues:

1. **API Connection Issues**:

   - Verify your CORS configuration on the backend
   - Check that your environment variables are correctly set in Cloudflare Pages

2. **Build Failures**:

   - Review the build logs in the Cloudflare dashboard
   - Make sure your repository structure is correct

3. **Routing Issues**:
   - Verify that the `_redirects` file is correctly configured
   - Check that your frontend router is properly set up for client-side routing

For more details, see the [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/).
