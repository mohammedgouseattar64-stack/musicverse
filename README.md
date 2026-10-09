# MUSICVERSE
Free, legal music player. Node 18+. See DEPLOY.md for hosting and the Android APK.
1. Get a free client id at https://devportal.jamendo.com
2. `cp .env.example .env`, set `JAMENDO_CLIENT_ID`
3. `npm install && JAMENDO_CLIENT_ID=xxxx npm start` then open http://localhost:3000
Deploy to any Node host (Render, Railway, Fly.io); set JAMENDO_CLIENT_ID as an environment variable there.
