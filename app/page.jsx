'use client';

import { useState } from 'react';

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [step, setStep] = useState('input'); // input, processing, review, generating, complete
  const [transcript, setTranscript] = useState('');
  const [enrichedContent, setEnrichedContent] = useState('');
  const [carouselSlides, setCarouselSlides] = useState([]);
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [hook, setHook] = useState('');
  const [cta, setCta] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [error, setError] = useState('');
  const [carouselResult, setCarouselResult] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('quote-cards-paper');
  const [processingStatus, setProcessingStatus] = useState('');
  const [postToLinkedIn, setPostToLinkedIn] = useState(false);

  // Config state
  const [config, setConfig] = useState({
    perplexityKey: '',
    blotatoKey: '',
    linkedinAccountId: '',
    linkedinPageId: '',
    authorName: '',
    handle: '',
    profileImage: '',
    theme: 'light',
    aspectRatio: '1:1',
    font: 'Montserrat'
  });
  const [showConfig, setShowConfig] = useState(false);

  // LinkedIn-optimized templates
  const templates = [
    { id: 'quote-cards-paper', name: 'Professional Quote Cards', templateId: '/base/v2/quote-card/77f65d2b-48cc-4adb-bfbb-5bc86f8c01bd/v1', desc: 'Clean paper background' },
    { id: 'quote-highlight-paper', name: 'Highlighted Insights', templateId: '/base/v2/quote-card/f941e306-76f7-45da-b3d9-7463af630e91/v1', desc: 'Paper with highlights' },
    { id: 'tweet-cards-monocolor', name: 'Minimal Cards', templateId: '/base/v2/tweet-card/ba413be6-a840-4e60-8fd6-0066d3b427df/v1', desc: 'Clean monochrome' },
    { id: 'tweet-cards-photo', name: 'Photo Background', templateId: '/base/v2/tweet-card/9714ae5c-7e6b-4878-be4a-4b1ba5d0cd66/v1', desc: 'Custom image bg' },
  ];

  const fonts = [
    'Montserrat', 'Inter', 'Poppins', 'Raleway', 'Open Sans', 'Lato',
    'Roboto', 'DM Sans', 'Work Sans', 'Nunito', 'Quicksand', 'Philosopher'
  ];

  const extractVideoId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const fetchTranscript = async (videoId) => {
    setProcessingStatus('Fetching YouTube transcript...');
    const response = await fetch(`/api/transcript?videoId=${videoId}`);
    if (!response.ok) throw new Error('Failed to fetch transcript');
    const data = await response.json();
    return data.transcript;
  };

  const enrichWithPerplexity = async (transcriptText) => {
    setProcessingStatus('Creating LinkedIn carousel content with AI...');
    const response = await fetch('/api/perplexity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: transcriptText,
        apiKey: config.perplexityKey
      })
    });
    if (!response.ok) throw new Error('Failed to enrich content');
    const data = await response.json();
    return data;
  };

  const handleProcess = async () => {
    if (!youtubeUrl) {
      setError('Please enter a YouTube URL');
      return;
    }
    // API keys are now handled server-side via env vars if not provided here
    // So we don't strict check for them anymore


    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      setError('Invalid YouTube URL');
      return;
    }

    setError('');
    setStep('processing');

    try {
      const transcriptText = await fetchTranscript(videoId);
      setTranscript(transcriptText);

      const enriched = await enrichWithPerplexity(transcriptText);
      setEnrichedContent(enriched.analysis);
      setCarouselSlides(enriched.slides);
      setTitle(enriched.title);
      setHook(enriched.hook);
      setCta(enriched.cta);
      setHashtags(enriched.hashtags);
      setCaption(enriched.fullCaption);

      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('input');
    }
  };

  const handleGenerateCarousel = async () => {
    setStep('generating');
    setProcessingStatus('Creating carousel with Blotato...');

    try {
      const template = templates.find(t => t.id === selectedTemplate);

      const response = await fetch('/api/blotato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.blotatoKey,
          templateId: template.templateId,
          quotes: carouselSlides,
          title: title,
          authorName: config.authorName,
          handle: config.handle,
          profileImage: config.profileImage,
          theme: config.theme,
          aspectRatio: config.aspectRatio,
          font: config.font
        })
      });

      if (!response.ok) throw new Error('Failed to create carousel');

      const data = await response.json();

      setProcessingStatus('Waiting for carousel to render...');
      let carousel = await pollForCarousel(data.id);

      // Post to LinkedIn if enabled
      if (postToLinkedIn && config.linkedinAccountId) {
        setProcessingStatus('Posting to LinkedIn...');
        await postToLinkedInApi(carousel.imageUrls);
      }

      setCarouselResult(carousel);
      setStep('complete');
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  const pollForCarousel = async (carouselId) => {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));

      const response = await fetch(`/api/blotato/status?id=${carouselId}&apiKey=${config.blotatoKey}`);
      const data = await response.json();

      if (data.status === 'done') {
        return data;
      }
      setProcessingStatus(`Rendering carousel... (${i + 1}/${maxAttempts})`);
    }
    throw new Error('Carousel generation timed out');
  };

  const postToLinkedInApi = async (imageUrls) => {
    const response = await fetch('/api/blotato/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: config.blotatoKey,
        platform: 'linkedin',
        accountId: config.linkedinAccountId,
        pageId: config.linkedinPageId,
        text: caption,
        mediaUrls: imageUrls
      })
    });
    if (!response.ok) {
      const err = await response.json();
      console.error('LinkedIn post error:', err);
    }
  };

  const updateSlide = (index, value) => {
    const newSlides = [...carouselSlides];
    newSlides[index] = value;
    setCarouselSlides(newSlides);
  };

  const addSlide = () => {
    setCarouselSlides([...carouselSlides, '']);
  };

  const removeSlide = (index) => {
    setCarouselSlides(carouselSlides.filter((_, i) => i !== index));
  };

  const copyCaption = () => {
    navigator.clipboard.writeText(caption);
  };

  return (
    <div className="app">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #f8fafc;
          color: #1e293b;
          min-height: 100vh;
        }
        
        .app {
          min-height: 100vh;
          background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
        }
        
        .container {
          max-width: 960px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .header {
          text-align: center;
          margin-bottom: 2.5rem;
          padding-top: 1.5rem;
        }
        
        .logo {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #0077b5;
          margin-bottom: 1rem;
          padding: 0.5rem 1rem;
          background: rgba(0, 119, 181, 0.1);
          border-radius: 20px;
        }
        
        .logo svg {
          width: 18px;
          height: 18px;
        }
        
        .title {
          font-size: 2.25rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 0.5rem;
        }
        
        .subtitle {
          color: #64748b;
          font-size: 1rem;
        }
        
        .card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 1.75rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          margin-bottom: 1.25rem;
        }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }
        
        .card-title {
          font-size: 1rem;
          font-weight: 600;
          color: #0f172a;
        }
        
        .card-subtitle {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 0.25rem;
        }
        
        .input-group {
          margin-bottom: 1.25rem;
        }
        
        .input-group:last-child {
          margin-bottom: 0;
        }
        
        .label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #475569;
          margin-bottom: 0.5rem;
        }
        
        .input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          color: #1e293b;
          font-size: 0.9375rem;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: all 0.2s;
        }
        
        .input:focus {
          outline: none;
          border-color: #0077b5;
          box-shadow: 0 0 0 3px rgba(0, 119, 181, 0.1);
          background: #fff;
        }
        
        .input::placeholder {
          color: #94a3b8;
        }
        
        .input-mono {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
        }
        
        .textarea {
          min-height: 100px;
          resize: vertical;
          line-height: 1.6;
        }
        
        .textarea-large {
          min-height: 180px;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        
        .btn-primary {
          background: #0077b5;
          color: #fff;
        }
        
        .btn-primary:hover {
          background: #005f8f;
        }
        
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        
        .btn-secondary:hover {
          background: #e2e8f0;
        }
        
        .btn-ghost {
          background: transparent;
          color: #64748b;
          padding: 0.5rem 0.75rem;
        }
        
        .btn-ghost:hover {
          color: #0f172a;
          background: #f1f5f9;
        }
        
        .btn-danger {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        
        .btn-danger:hover {
          background: #fee2e2;
        }
        
        .btn-full {
          width: 100%;
        }
        
        .btn-sm {
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
        }
        
        .error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 1rem;
          border-radius: 10px;
          margin-bottom: 1.25rem;
          font-size: 0.875rem;
        }
        
        .processing {
          text-align: center;
          padding: 3rem 2rem;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: #0077b5;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 1.25rem;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .processing-text {
          color: #64748b;
          font-size: 0.9375rem;
        }
        
        .slides-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .slide-item {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
        }
        
        .slide-number {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          background: #0077b5;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: #fff;
          margin-top: 0.75rem;
        }
        
        .slide-input {
          flex: 1;
        }
        
        .slide-actions {
          margin-top: 0.75rem;
        }
        
        .template-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        
        .template-option {
          padding: 1rem;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .template-option:hover {
          border-color: #94a3b8;
        }
        
        .template-option.selected {
          border-color: #0077b5;
          background: rgba(0, 119, 181, 0.05);
        }
        
        .template-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 0.25rem;
        }
        
        .template-desc {
          font-size: 0.75rem;
          color: #64748b;
        }
        
        .config-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }
        
        .config-full {
          grid-column: span 2;
        }
        
        .result-images {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        
        .result-image {
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          aspect-ratio: 1;
        }
        
        .result-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        
        .actions-row {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }
        
        .step-indicator {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 2rem;
        }
        
        .step-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #e2e8f0;
          transition: all 0.3s;
        }
        
        .step-dot.active {
          background: #0077b5;
          box-shadow: 0 0 8px rgba(0, 119, 181, 0.4);
        }
        
        .step-dot.completed {
          background: #10b981;
        }
        
        .config-toggle {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 100;
        }
        
        .config-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        
        .config-content {
          background: #fff;
          border-radius: 16px;
          padding: 1.75rem;
          max-width: 540px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .select {
          width: 100%;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          color: #1e293b;
          font-size: 0.9375rem;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        
        .select:focus {
          outline: none;
          border-color: #0077b5;
        }
        
        .divider {
          border: none;
          border-top: 1px solid #e2e8f0;
          margin: 1.25rem 0;
        }
        
        .section-title {
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 1rem;
        }
        
        .success-icon {
          width: 56px;
          height: 56px;
          background: #dcfce7;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.25rem;
          color: #16a34a;
          font-size: 1.5rem;
        }
        
        .caption-preview {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 1rem;
          white-space: pre-wrap;
          font-size: 0.875rem;
          line-height: 1.6;
          color: #334155;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .caption-section {
          margin-bottom: 1rem;
        }
        
        .caption-section:last-child {
          margin-bottom: 0;
        }
        
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: #f8fafc;
          border-radius: 10px;
          margin-top: 1rem;
        }
        
        .checkbox {
          width: 20px;
          height: 20px;
          accent-color: #0077b5;
        }
        
        .checkbox-label {
          font-size: 0.875rem;
          color: #475569;
        }
        
        .char-count {
          font-size: 0.75rem;
          color: #94a3b8;
          text-align: right;
          margin-top: 0.5rem;
        }
        
        .char-count.warning {
          color: #f59e0b;
        }
        
        .char-count.error {
          color: #dc2626;
        }
      `}</style>

      <button className="btn btn-secondary config-toggle" onClick={() => setShowConfig(true)}>
        ⚙️ Settings
      </button>

      {showConfig && (
        <div className="config-modal" onClick={() => setShowConfig(false)}>
          <div className="config-content" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <div>
                <h2 className="card-title">Settings</h2>
                <p className="card-subtitle">Configure your API keys and preferences</p>
              </div>
              <button className="btn btn-ghost" onClick={() => setShowConfig(false)}>✕</button>
            </div>

            <div className="section-title">API Keys</div>

            <div className="input-group">
              <label className="label">Perplexity API Key</label>
              <input
                type="password"
                className="input input-mono"
                placeholder="pplx-..."
                value={config.perplexityKey}
                onChange={e => setConfig({ ...config, perplexityKey: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label className="label">Blotato API Key</label>
              <input
                type="password"
                className="input input-mono"
                placeholder="Your Blotato API key"
                value={config.blotatoKey}
                onChange={e => setConfig({ ...config, blotatoKey: e.target.value })}
              />
            </div>

            <hr className="divider" />
            <div className="section-title">LinkedIn (Optional - for direct posting)</div>

            <div className="config-grid">
              <div className="input-group">
                <label className="label">LinkedIn Account ID</label>
                <input
                  type="text"
                  className="input input-mono"
                  placeholder="From Blotato"
                  value={config.linkedinAccountId}
                  onChange={e => setConfig({ ...config, linkedinAccountId: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label className="label">LinkedIn Page ID (optional)</label>
                <input
                  type="text"
                  className="input input-mono"
                  placeholder="For company pages"
                  value={config.linkedinPageId}
                  onChange={e => setConfig({ ...config, linkedinPageId: e.target.value })}
                />
              </div>
            </div>

            <hr className="divider" />
            <div className="section-title">Carousel Style</div>

            <div className="config-grid">
              <div className="input-group">
                <label className="label">Author Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Your name"
                  value={config.authorName}
                  onChange={e => setConfig({ ...config, authorName: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label className="label">Handle</label>
                <input
                  type="text"
                  className="input"
                  placeholder="yourhandle"
                  value={config.handle}
                  onChange={e => setConfig({ ...config, handle: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label className="label">Theme</label>
                <select className="select" value={config.theme} onChange={e => setConfig({ ...config, theme: e.target.value })}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="input-group">
                <label className="label">Font</label>
                <select className="select" value={config.font} onChange={e => setConfig({ ...config, font: e.target.value })}>
                  {fonts.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="input-group config-full">
                <label className="label">Profile Image URL (optional)</label>
                <input
                  type="text"
                  className="input input-mono"
                  placeholder="https://..."
                  value={config.profileImage}
                  onChange={e => setConfig({ ...config, profileImage: e.target.value })}
                />
              </div>
            </div>

            <button className="btn btn-primary btn-full" style={{ marginTop: '1rem' }} onClick={() => setShowConfig(false)}>
              Save Settings
            </button>
          </div>
        </div>
      )}

      <div className="container">
        <header className="header">
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" /></svg>
            LinkedIn Carousel Generator
          </div>
          <h1 className="title">YouTube → LinkedIn Carousel</h1>
          <p className="subtitle">Transform AI videos into engaging LinkedIn carousels with optimized captions</p>
        </header>

        <div className="step-indicator">
          <div className={`step-dot ${step === 'input' ? 'active' : ['processing', 'review', 'generating', 'complete'].includes(step) ? 'completed' : ''}`}></div>
          <div className={`step-dot ${step === 'processing' ? 'active' : ['review', 'generating', 'complete'].includes(step) ? 'completed' : ''}`}></div>
          <div className={`step-dot ${step === 'review' ? 'active' : ['generating', 'complete'].includes(step) ? 'completed' : ''}`}></div>
          <div className={`step-dot ${step === 'generating' ? 'active' : step === 'complete' ? 'completed' : ''}`}></div>
          <div className={`step-dot ${step === 'complete' ? 'active' : ''}`}></div>
        </div>

        {error && <div className="error">{error}</div>}

        {step === 'input' && (
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>Enter YouTube Video URL</h2>
            <p className="card-subtitle" style={{ marginBottom: '1.25rem' }}>Paste a link to an AI or tech video you want to repurpose</p>
            <div className="input-group">
              <input
                type="text"
                className="input input-mono"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-full" onClick={handleProcess}>
              🚀 Process Video
            </button>
          </div>
        )}

        {step === 'processing' && (
          <div className="card">
            <div className="processing">
              <div className="spinner"></div>
              <p className="processing-text">{processingStatus}</p>
            </div>
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="card">
              <h2 className="card-title">Carousel Slides</h2>
              <p className="card-subtitle" style={{ marginBottom: '1rem' }}>Edit your carousel content - each slide should be punchy and scannable</p>

              <div className="input-group">
                <label className="label">Carousel Title (appears on slide 1)</label>
                <input
                  type="text"
                  className="input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div className="card-header" style={{ marginTop: '1rem' }}>
                <label className="label" style={{ margin: 0 }}>Slides ({carouselSlides.length})</label>
                <button className="btn btn-secondary btn-sm" onClick={addSlide}>+ Add Slide</button>
              </div>

              <div className="slides-list">
                {carouselSlides.map((slide, index) => (
                  <div key={index} className="slide-item">
                    <div className="slide-number">{index + 1}</div>
                    <textarea
                      className="input textarea slide-input"
                      value={slide}
                      onChange={e => updateSlide(index, e.target.value)}
                      rows={2}
                    />
                    <div className="slide-actions">
                      <button className="btn btn-danger btn-sm" onClick={() => removeSlide(index)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">LinkedIn Caption</h2>
              <p className="card-subtitle" style={{ marginBottom: '1rem' }}>Optimized for LinkedIn engagement with hook, body, CTA, and hashtags</p>

              <div className="caption-section">
                <div className="input-group">
                  <label className="label">🪝 Hook (First line - what people see before "...see more")</label>
                  <textarea
                    className="input textarea"
                    value={hook}
                    onChange={e => setHook(e.target.value)}
                    rows={2}
                    placeholder="A compelling hook that stops the scroll..."
                  />
                </div>
              </div>

              <div className="caption-section">
                <div className="input-group">
                  <label className="label">📣 Call to Action</label>
                  <textarea
                    className="input textarea"
                    value={cta}
                    onChange={e => setCta(e.target.value)}
                    rows={2}
                    placeholder="Follow for more AI insights..."
                  />
                </div>
              </div>

              <div className="caption-section">
                <div className="input-group">
                  <label className="label"># Hashtags</label>
                  <input
                    type="text"
                    className="input"
                    value={hashtags}
                    onChange={e => setHashtags(e.target.value)}
                    placeholder="#AI #Technology #Innovation"
                  />
                </div>
              </div>

              <hr className="divider" />

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="label" style={{ margin: 0 }}>Full Caption Preview</label>
                  <button className="btn btn-ghost btn-sm" onClick={copyCaption}>📋 Copy</button>
                </div>
                <textarea
                  className="input textarea textarea-large"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  style={{ marginTop: '0.5rem' }}
                />
                <div className={`char-count ${caption.length > 2800 ? 'error' : caption.length > 2500 ? 'warning' : ''}`}>
                  {caption.length} / 3000 characters
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">Select Template</h2>
              <p className="card-subtitle" style={{ marginBottom: '1rem' }}>Choose a visual style for your carousel</p>

              <div className="template-grid">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className={`template-option ${selectedTemplate === template.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <div className="template-name">{template.name}</div>
                    <div className="template-desc">{template.desc}</div>
                  </div>
                ))}
              </div>

              {config.linkedinAccountId && (
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    className="checkbox"
                    id="postLinkedIn"
                    checked={postToLinkedIn}
                    onChange={e => setPostToLinkedIn(e.target.checked)}
                  />
                  <label htmlFor="postLinkedIn" className="checkbox-label">
                    Post directly to LinkedIn after generating
                  </label>
                </div>
              )}

              <button className="btn btn-primary btn-full" style={{ marginTop: '1rem' }} onClick={handleGenerateCarousel}>
                ✨ Generate Carousel
              </button>
            </div>
          </>
        )}

        {step === 'generating' && (
          <div className="card">
            <div className="processing">
              <div className="spinner"></div>
              <p className="processing-text">{processingStatus}</p>
            </div>
          </div>
        )}

        {step === 'complete' && carouselResult && (
          <>
            <div className="card">
              <div className="success-icon">✓</div>
              <h2 className="card-title" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Carousel Ready!</h2>
              <p className="card-subtitle" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                {postToLinkedIn ? 'Posted to LinkedIn successfully' : 'Download the images and copy the caption to post'}
              </p>

              {carouselResult.imageUrls && (
                <div className="result-images">
                  {carouselResult.imageUrls.map((url, index) => (
                    <div key={index} className="result-image">
                      <img src={url} alt={`Slide ${index + 1}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label className="label" style={{ margin: 0 }}>Caption (copy for posting)</label>
                <button className="btn btn-secondary btn-sm" onClick={copyCaption}>📋 Copy Caption</button>
              </div>
              <div className="caption-preview">{caption}</div>
            </div>

            <div className="actions-row">
              <button className="btn btn-secondary" onClick={() => {
                setStep('input');
                setYoutubeUrl('');
                setCarouselResult(null);
                setCarouselSlides([]);
                setCaption('');
                setHook('');
                setCta('');
                setHashtags('');
              }}>
                Create Another
              </button>
              <a
                href="https://my.blotato.com/videos"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                View in Blotato →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
