import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const API_KEY = process.env.YOUTUBE_API_KEY;
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

async function ytFetch(endpoint, params) {
  const base = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  params.key = API_KEY;
  for (const [k, v] of Object.entries(params)) base.searchParams.set(k, v);
  const res = await fetch(base.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API error: ${res.status} — ${text}`);
  }
  return res.json();
}

// Proxy endpoint: /api/search?query=lofi+beats
app.get("/api/search", async (req, res) => {
  try {
    const q = req.query.query;
    if (!q) return res.status(400).json({ error: "Missing query" });

    // 1️⃣ Search videos
    const searchData = await ytFetch("search", {
      part: "snippet",
      type: "video",
      q,
      maxResults: 8,
    });

    // 2️⃣ Get details for durations + view counts
    const videoIds = (searchData.items || []).map(i => i.id.videoId).filter(Boolean);
    let videosData = { items: [] };
    if (videoIds.length) {
      videosData = await ytFetch("videos", {
        part: "contentDetails,statistics",
        id: videoIds.join(","),
      });
    }

    // Merge data
    const metaMap = {};
    videosData.items.forEach(v => {
      metaMap[v.id] = {
        duration: v.contentDetails?.duration,
        viewCount: v.statistics?.viewCount,
      };
    });

    res.json({ items: searchData.items, meta: metaMap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
