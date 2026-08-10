# Publish ESAT Atlas from GitHub

This repository contains a static GitHub Pages build in addition to the Sites/Vinext build.

1. Create a GitHub repository and upload the contents of the `source/` folder from the export ZIP.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Push to `main` or run the **Deploy ESAT Atlas to GitHub Pages** workflow manually.
5. In Firebase Console, open **Authentication → Settings → Authorized domains** and add your GitHub Pages hostname, for example `your-name.github.io`.
6. In Firebase Authentication, ensure the Google provider is enabled. Deploy `firestore.rules` to the `esat-a6d5d` project if those rules are not already active.

The workflow runs `npm run build:github` and publishes `github-pages-dist`. The static output contains `index.html`, compiled CSS/JavaScript, the full validated question bank, original mocks and all question images. Paths are relative, so repository-name URLs work correctly.

The precompiled `site/` folder in the export ZIP can also be hosted by any static host. Do not open `index.html` with a `file://` URL because browsers block module and Firebase requests there; serve it over HTTPS or a local HTTP server.
