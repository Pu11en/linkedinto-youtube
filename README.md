# YouTube to LinkedIn Carousel App

Transform AI-focused YouTube videos into engaging LinkedIn carousels with optimized captions automatically.

## What It Does

1. **Input**: Paste a YouTube URL (AI/tech content works best)
2. **Extract**: Automatically pulls the video transcript
3. **Analyze**: Uses Perplexity AI to extract key insights and create LinkedIn-optimized content
4. **Generate**: Creates visual carousel slides using Blotato templates
5. **Caption**: Generates LinkedIn-optimized captions with hook, CTA, and hashtags
6. **Post**: Optionally post directly to LinkedIn, or copy the carousel and caption manually

## LinkedIn Caption Structure

The app generates captions optimized for LinkedIn's algorithm:

- **Hook**: The crucial first line that appears before "...see more" - designed to stop the scroll
- **Body**: Brief context about the carousel value
- **CTA**: Engagement-driving call-to-action (repost, follow, comment prompts)
- **Hashtags**: Mix of popular and niche hashtags for discoverability

## Flow Diagram

```
YouTube URL 
    ↓
Extract Transcript (YouTube API)
    ↓
Analyze & Create Content (Perplexity AI)
    ↓
Review & Edit Slides + Caption
    ↓
Select Template
    ↓
Generate Carousel (Blotato API)
    ↓
[Optional] Post to LinkedIn
    ↓
Ready!
```

## Prerequisites

You'll need API keys from:

1. **Perplexity AI** - For content analysis
   - Sign up at: https://www.perplexity.ai/
   - Get API key from settings

2. **Blotato** - For carousel generation
   - Sign up at: https://blotato.com
   - Go to Settings > API > Generate API Key (paid feature)

## Setup

### Option 1: Local Development

```bash
# Clone/download the project
cd youtube-carousel-app

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

### Option 2: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Usage

1. **Configure API Keys**
   - Click the ⚙️ Settings button in the top right
   - Enter your Perplexity API key
   - Enter your Blotato API key
   - Optionally add LinkedIn Account ID (from Blotato) for direct posting
   - Customize author name, handle, theme, font, etc.

2. **Process a Video**
   - Paste a YouTube URL (e.g., `https://www.youtube.com/watch?v=...`)
   - Click "Process Video"
   - Wait for transcript extraction and AI analysis

3. **Review Content**
   - Edit the carousel title and slides
   - Customize the LinkedIn caption components:
     - **Hook**: The attention-grabbing first line
     - **CTA**: Call-to-action for engagement
     - **Hashtags**: Relevant tags for reach
   - Review the full caption preview
   - Select your preferred visual template

4. **Generate Carousel**
   - Click "Generate Carousel"
   - Optionally enable "Post directly to LinkedIn"
   - Wait for Blotato to render the images

5. **Post to LinkedIn**
   - If direct posting is enabled, it's automatic!
   - Otherwise, download images from Blotato
   - Copy the optimized caption
   - Post manually to LinkedIn

## Available Templates

- **Professional Quote Cards** - Clean paper background, great for insights
- **Highlighted Insights** - Paper style with highlight markers
- **Minimal Cards** - Clean monochrome X/Twitter style
- **Photo Background** - Cards with custom image backgrounds

## API Endpoints

The app includes these internal API routes:

- `GET /api/transcript?videoId=xxx` - Extract YouTube transcript
- `POST /api/perplexity` - Analyze content with Perplexity (generates LinkedIn-optimized content)
- `POST /api/blotato` - Create carousel
- `GET /api/blotato/status?id=xxx` - Check carousel status
- `POST /api/blotato/post` - Post to LinkedIn via Blotato

## Project Structure

```
youtube-carousel-app/
├── app/
│   ├── page.jsx          # Main UI component
│   ├── layout.jsx        # Root layout
│   └── api/
│       ├── transcript/   # YouTube transcript extraction
│       ├── perplexity/   # AI content analysis (LinkedIn-optimized)
│       └── blotato/      # Carousel generation & posting
│           ├── route.js       # Create carousel
│           ├── status/        # Check status
│           └── post/          # Post to LinkedIn
├── package.json
├── next.config.js
└── README.md
```

## Customization

### Adding More Templates

Edit the `templates` array in `app/page.jsx`:

```javascript
const templates = [
  { 
    id: 'your-template-id', 
    name: 'Your Template Name', 
    templateId: '/base/v2/your-template-path' 
  },
  // ...
];
```

Find template IDs at: https://my.blotato.com/videos/new

### Modifying the AI Prompt

Edit the `systemPrompt` in `app/api/perplexity/route.js` to change how content is analyzed and formatted.

## Troubleshooting

### "No captions available"
- The video must have captions enabled
- Try a different video with auto-generated or manual captions

### Perplexity errors
- Check your API key is valid
- Ensure you have API credits available

### Blotato errors
- Verify your API key in Blotato dashboard
- Check carousel limits on your plan
- View error details at: https://my.blotato.com/api-dashboard

## Credits

Based on the n8n workflow "Automate Instagram Carousels with AI Chat" by Sabrina Ramonov.

Converted to a standalone Next.js app for easier deployment and customization.

## License

MIT
