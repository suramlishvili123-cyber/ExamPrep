# Publish ESAT Atlas on GitHub Pages

ESAT Atlas is one static site with one build. Push the repository and the included
workflow does the rest.

## One-time setup

Complete the legal/privacy/accessibility launch gates in `README.md` before enabling a
public Pages deployment.

1. Push this repository to GitHub (the `main` branch).
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set the source to **GitHub Actions**.
4. In the [Firebase console](https://console.firebase.google.com/), open
   **Authentication → Sign-in method** and make sure the **Google** provider is enabled.
5. Still in Firebase, open **Authentication → Settings → Authorized domains** and add your
   Pages hostname, for example `your-name.github.io`. Sign-in fails with
   `auth/unauthorized-domain` until this is done.
6. Deploy `firestore.rules` to the `esat-a6d5d` project if those rules are not already
   active, so each signed-in user can only read and write their own data.
7. After recording the evidence described in `PRODUCTION-CHECKLIST.md`, create these
   GitHub Actions repository variables with the exact value `true`:
   `CONTENT_RIGHTS_CONFIRMED`, `PRIVACY_NOTICE_COMPLETE`, and
   `AUTHENTICATED_A11Y_REVIEW_COMPLETE`. The deploy job intentionally stops without them.

## Deploying

Every push to `main` runs the **Deploy ESAT Atlas to GitHub Pages** workflow, which runs
`npm ci`, `npm run build` and publishes `dist/`. You can also start it manually from the
**Actions** tab.

The build output contains `index.html`, a `404.html` fallback, compiled CSS/JavaScript,
a compact runtime projection of the validated question bank, the original mocks, every
runtime question image, the web app manifest, the application icons and `sw.js`. Internal
QA/provenance manifests are deliberately excluded. All paths are relative, so
`https://your-name.github.io/your-repo/` works without extra configuration.

## The installed application

Pages serves over HTTPS, which is what the service worker needs, so ESAT Atlas is
installable from a Pages deployment with no extra configuration. The worker registers at
`./sw.js`, so its scope is the repository sub-path and it can never claim pages belonging
to another project on the same `github.io` hostname.

A deployment does not disturb anyone mid-session. The new worker installs in the
background and waits; the application offers a reload, and only then does the new bundle
take over and the previous shell cache get removed. The 33 MB question-image cache is keyed
by the question bank rather than by the build, so a routine redeploy does not make anyone
download the archive again.

## Hosting the built folder somewhere else

`dist/` is a plain static folder and works on any static host. Serve it over HTTP(S) —
opening `index.html` from a `file://` URL will not work, because browsers block ES module
and Firebase requests from that origin.
