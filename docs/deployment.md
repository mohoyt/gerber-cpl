# Deploying to Cloudflare Pages

This project is set up to be easily deployed to Cloudflare Pages.

## Prerequisites

1.  A [Cloudflare account](https://dash.cloudflare.com/sign-up).
2.  Your code pushed to a GitHub or GitLab repository.

## Deployment Steps

1.  Log in to your Cloudflare Dashboard.
2.  Go to **Workers & Pages** in the left sidebar.
3.  Click **Create Application** and select the **Pages** tab.
4.  Click **Connect to Git** and authorize Cloudflare to access your GitHub/GitLab account.
5.  Select this repository (`gerber-cpl`).
6.  Click **Begin setup**.
7.  Configure the build settings as follows:
    *   **Project name**: (Choose a name, e.g., `gerber-cpl`)
    *   **Production branch**: `main` (or your primary branch)
    *   **Framework preset**: **Vite**
    *   **Build command**: `npm run build`
    *   **Build output directory**: `dist`
8.  Click **Save and Deploy**.

### Advanced: Custom Domain

Once deployed, you can assign a custom domain to your Pages project:
1.  Go to your project in the Cloudflare Dashboard.
2.  Click the **Custom Domains** tab.
3.  Click **Set up a custom domain** and follow the prompts.

### Technical Details
- **Routing**: This uses a `public/_redirects` file to handle frontend SPA routing properly on Cloudflare's edge network.
- **Node Version**: A `.nvmrc` file specifies Node v20 for compatibility with Vite.
