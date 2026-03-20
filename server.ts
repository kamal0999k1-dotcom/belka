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
  const { username: rawUsername } = req.body;
  const APIFY_TOKEN = process.env.APIFY_TOKEN;

  if (!rawUsername) {
    return res.status(400).json({ error: 'Username is required' });
  }

  // Clean username: remove @ if present
  const username = rawUsername.startsWith('@') ? rawUsername.substring(1) : rawUsername;

  // Demo mode fallback
  if (username.toLowerCase() === 'demo') {
    return res.json({
      profilePicture: 'https://picsum.photos/seed/tiktok/200',
      username: 'demo_user',
      displayName: 'Demo TikTok User',
      followerCount: 1250000
    });
  }

  if (!APIFY_TOKEN) {
    console.warn('APIFY_TOKEN is missing. Please set it in AI Studio Secrets.');
    return res.status(500).json({ 
      error: 'TikTok Search is not configured. Please add APIFY_TOKEN to Secrets.',
      setupRequired: true 
    });
  }

  try {
    console.log(`Searching TikTok profile for: ${username}`);
    
    // Using a more robust actor or ensuring the current one is called correctly
    // We use run-sync with a longer timeout to ensure it returns data
    const response = await axios.post(
      `https://api.apify.com/v2/acts/apify~tiktok-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60`,
      {
        usernames: [username],
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false,
        maxProfilesPerQuery: 1
      },
      {
        timeout: 65000 // Slightly longer than Apify timeout
      }
    );

    console.log('Apify response received, items count:', response.data?.length);

    // The scraper returns an array of items.
    const profile = response.data && response.data.length > 0 ? response.data[0] : null;

    if (!profile || (!profile.username && !profile.userMeta)) {
      console.log('Profile not found in Apify response');
      return res.status(404).json({ error: 'User not found. Please check the username.' });
    }

    // Return only the requested fields, with fallbacks for different scraper versions
    const result = {
      profilePicture: profile.userMeta?.avatar || profile.avatar || profile.avatarThumb || profile.avatarLarger || `https://ui-avatars.com/api/?name=${username}&background=random`,
      username: profile.userMeta?.username || profile.username || username,
      displayName: profile.userMeta?.nickname || profile.nickname || profile.userMeta?.name || username,
      followerCount: profile.stats?.followerCount || profile.userMeta?.fans || profile.followerCount || 0
    };

    console.log('Returning profile data for:', result.username);
    res.json(result);
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('Error calling Apify:', errorMsg);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Search timed out. TikTok is taking too long to respond.' });
    }

    res.status(500).json({ error: `Failed to fetch TikTok profile: ${errorMsg}` });
  }
});

// For all other routes, serve the Angular index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
