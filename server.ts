import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

console.log('APIFY_TOKEN present:', !!process.env.APIFY_TOKEN);

app.use(cors());
app.use(express.json());

// Serve static files from the Angular build directory
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/tiktok-profile', async (req, res) => {
  const { username } = req.body;
  const APIFY_TOKEN = process.env.APIFY_TOKEN;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: 'APIFY_TOKEN is not configured' });
  }

  try {
    console.log(`Searching TikTok profile for: ${username}`);
    const response = await axios.post(
      `https://api.apify.com/v2/acts/apify~tiktok-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        usernames: [username],
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false
      }
    );

    console.log('Apify response received');

    // The scraper returns an array of items. We want the first one.
    const profile = response.data[0];

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Return only the requested fields
    res.json({
      profilePicture: profile.userMeta?.avatar || profile.avatar,
      username: profile.userMeta?.username || profile.username,
      displayName: profile.userMeta?.nickname || profile.nickname
    });
  } catch (error: any) {
    console.error('Error calling Apify:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch TikTok profile' });
  }
});

// For all other routes, serve the Angular index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
