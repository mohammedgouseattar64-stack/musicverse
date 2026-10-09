# Deploy and build the APK (all free)

## 1. Website (Render free plan)
1. Create a free GitHub account and a new repository; upload this whole folder (keep `.github` and `mobile`).
2. Create a free Jamendo client ID at https://devportal.jamendo.com
3. On https://render.com sign in with GitHub, choose New > Blueprint, pick the repository. It reads `render.yaml`.
4. When asked, paste your Jamendo client ID as `JAMENDO_CLIENT_ID`. Deploy.
5. Your site is at `https://<name>.onrender.com`. The free plan sleeps after idle, so the first load can take about a minute.

## 2. Android APK (GitHub Actions, free)
1. In your GitHub repository open Actions > "Build Android APK" > Run workflow.
2. Enter your Render URL (must start with https://).
3. When it finishes, open the run and download the `MUSICVERSE-apk` artifact (a zip containing `app-debug.apk`).

## 3. Install on Android
1. Unzip the download on your phone (or transfer the APK).
2. Open the APK file. When Android asks, allow "Install unknown apps" for your file manager or Chrome.
3. Tap Install, then open MUSICVERSE.
