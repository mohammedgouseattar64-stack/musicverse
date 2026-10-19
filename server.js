import express from 'express';
import { routes, sendJson } from './api.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Register the shared API routes (Jamendo + Internet Archive).
for (const [path, handler] of Object.entries(routes)) {
  app.get(path, (req, res) => sendJson(handler, req.query, res));
}

// Serve the static front-end. index.html lives at the project root.
app.use(express.static('.'));

app.listen(PORT, () => console.log('MusicVerse on :' + PORT));
