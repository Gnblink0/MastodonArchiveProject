import { db } from './db'
import type { Account, Post, Media, Like, Bookmark } from '../types'

// Helper function to create a colored image blob
async function createColoredImageBlob(color: string, width: number = 400, height: number = 300): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (ctx) {
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, shadeColor(color, -30))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Add some decorative elements
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.beginPath()
    ctx.arc(width * 0.3, height * 0.3, 50, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(width * 0.7, height * 0.7, 80, 0, Math.PI * 2)
    ctx.fill()
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob || new Blob())
    }, 'image/png')
  })
}

// Helper to shade a color
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.max(0, Math.min(255, (num >> 16) + amt))
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt))
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt))
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`
}

// Helper to create a date N days ago
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000)
}

export async function loadSampleData(): Promise<void> {
  try {
    const accountId = 'https://mastodon.social/users/sample_user'
    const now = new Date()

    // Generate avatar and header images
    const avatarBlob = await createColoredImageBlob('#6364FF', 200, 200)
    const headerBlob = await createColoredImageBlob('#4F46E5', 1500, 500)

    const sampleAccount: Account = {
      id: accountId,
      preferredUsername: 'sample_user',
      displayName: 'Mastodon Explorer',
      summary: '<p>Open-source enthusiast & Fediverse advocate. 🌐</p><p>This is a sample account for preview. 这是一个示例账户，用于预览应用功能。</p><p>✨ Welcome to Pastodon!</p>',
      avatarBlob,
      headerBlob,
      fields: [
        { name: 'Website', value: '<a href="https://github.com/Gnblink0/MastodonArchiveProject">Pastodon</a>' },
        { name: 'Location', value: 'The Fediverse' },
        { name: 'Interests', value: 'Open Source, Privacy, Decentralization' },
        { name: 'Pronouns', value: 'they/them' }
      ],
      createdAt: new Date('2023-03-15'),
      importedAt: now,
      lastUpdatedAt: now,
      postsCount: 0,
      likesCount: 0,
      bookmarksCount: 0
    }

    // --- Media generation ---
    const mediaColors = [
      '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899',
      '#06B6D4', '#F97316', '#84CC16', '#6366F1', '#14B8A6'
    ]
    const sampleMedia: Media[] = []
    for (let i = 0; i < mediaColors.length; i++) {
      const w = i % 2 === 0 ? 800 : 600
      const h = i % 2 === 0 ? 600 : 800
      const blob = await createColoredImageBlob(mediaColors[i], w, h)
      sampleMedia.push({
        id: `media-${i + 1}`,
        accountId,
        filename: `sample-image-${i + 1}.png`,
        type: 'image',
        blob,
        url: '',
        width: w,
        height: h
      })
    }

    // --- Posts ---
    const samplePosts: Omit<Post, 'id'>[] = [
      // === 6+ months ago - early posts ===
      {
        accountId, activityId: `${accountId}/statuses/101`, type: 'post',
        content: '<p>Just joined Mastodon! Excited to be part of the Fediverse. 🐘</p><p>Coming from Twitter and already loving the vibe here.</p>',
        contentText: 'Just joined Mastodon! Excited to be part of the Fediverse. 🐘\n\nComing from Twitter and already loving the vibe here.',
        publishedAt: daysAgo(365), timestamp: daysAgo(365).getTime(),
        tags: ['introduction', 'mastodon', 'fediverse', 'newhere'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/102`, type: 'post',
        content: '<p>First photo post! Testing how media works on Mastodon. The gallery view is quite nice. 📸</p>',
        contentText: 'First photo post! Testing how media works on Mastodon. The gallery view is quite nice. 📸',
        publishedAt: daysAgo(350), timestamp: daysAgo(350).getTime(),
        tags: ['photography', 'test'],
        emojis: [], mentions: [], mediaIds: ['media-1'], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/103`, type: 'post',
        content: '<p>I love how Mastodon respects your privacy. No algorithms pushing ads, no tracking. Just pure chronological timeline. 🔒</p>',
        contentText: 'I love how Mastodon respects your privacy. No algorithms pushing ads, no tracking. Just pure chronological timeline. 🔒',
        publishedAt: daysAgo(340), timestamp: daysAgo(340).getTime(),
        tags: ['privacy', 'mastodon'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/104`, type: 'post',
        content: '<p>TIL you can export your entire Mastodon archive! All your posts, media, likes, bookmarks... everything in one download. 🤯</p>',
        contentText: 'TIL you can export your entire Mastodon archive! All your posts, media, likes, bookmarks... everything in one download. 🤯',
        publishedAt: daysAgo(320), timestamp: daysAgo(320).getTime(),
        tags: ['TIL', 'mastodon', 'dataportability'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },

      // === ~8-9 months ago ===
      {
        accountId, activityId: `${accountId}/statuses/105`, type: 'post',
        content: '<p>Weekend hike vibes! Nature is the best antidote to screen fatigue. 🏔️🌲</p>',
        contentText: 'Weekend hike vibes! Nature is the best antidote to screen fatigue. 🏔️🌲',
        publishedAt: daysAgo(280), timestamp: daysAgo(280).getTime(),
        tags: ['hiking', 'nature', 'weekend'],
        emojis: [], mentions: [], mediaIds: ['media-2', 'media-3'], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/106`, type: 'post',
        content: '<p>Hot take: RSS feeds are still the best way to follow content. Decentralized, no algorithm, user-controlled. Sounds familiar? 😏</p>',
        contentText: 'Hot take: RSS feeds are still the best way to follow content. Decentralized, no algorithm, user-controlled. Sounds familiar? 😏',
        publishedAt: daysAgo(270), timestamp: daysAgo(270).getTime(),
        tags: ['RSS', 'decentralization', 'hottake'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/107`, type: 'post',
        content: '<p>Followers-only post: Working on something cool related to Mastodon archives. Stay tuned! 🤫</p>',
        contentText: 'Followers-only post: Working on something cool related to Mastodon archives. Stay tuned! 🤫',
        publishedAt: daysAgo(260), timestamp: daysAgo(260).getTime(),
        tags: ['wip', 'teaser'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'private'
      },

      // === ~6 months ago ===
      {
        accountId, activityId: `${accountId}/statuses/108`, type: 'post',
        content: '<p>Coffee + code = perfect Saturday morning ☕💻</p><p>Building an open-source tool for the Fediverse community.</p>',
        contentText: 'Coffee + code = perfect Saturday morning ☕💻\n\nBuilding an open-source tool for the Fediverse community.',
        publishedAt: daysAgo(200), timestamp: daysAgo(200).getTime(),
        tags: ['coding', 'opensource', 'coffee', 'saturday'],
        emojis: [], mentions: [], mediaIds: ['media-4'], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/109`, type: 'post',
        content: '<p>The ActivityPub protocol is really well designed. It\'s like email but for social media. Each server is independent but can talk to all others. 📬</p>',
        contentText: 'The ActivityPub protocol is really well designed. It\'s like email but for social media. Each server is independent but can talk to all others. 📬',
        publishedAt: daysAgo(190), timestamp: daysAgo(190).getTime(),
        tags: ['ActivityPub', 'protocol', 'fediverse'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/110`, type: 'post',
        content: '<p>Unpopular opinion: Not every app needs to be a SaaS. Sometimes a static site that works entirely in the browser is the best approach. 🌐</p>',
        contentText: 'Unpopular opinion: Not every app needs to be a SaaS. Sometimes a static site that works entirely in the browser is the best approach. 🌐',
        publishedAt: daysAgo(180), timestamp: daysAgo(180).getTime(),
        tags: ['webdev', 'opinion', 'frontend'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },

      // === ~4-5 months ago ===
      {
        accountId, activityId: `${accountId}/statuses/111`, type: 'post',
        content: '<p>Just learned about IndexedDB - it\'s like having a full database in your browser! Perfect for offline-first apps. 🗄️</p>',
        contentText: 'Just learned about IndexedDB - it\'s like having a full database in your browser! Perfect for offline-first apps. 🗄️',
        publishedAt: daysAgo(150), timestamp: daysAgo(150).getTime(),
        tags: ['IndexedDB', 'webdev', 'browser', 'TIL'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/112`, type: 'post',
        content: '<p>Beautiful sunset from my balcony today. Some moments just need to be shared. 🌅</p>',
        contentText: 'Beautiful sunset from my balcony today. Some moments just need to be shared. 🌅',
        publishedAt: daysAgo(140), timestamp: daysAgo(140).getTime(),
        tags: ['sunset', 'photography', 'nature'],
        emojis: [], mentions: [], mediaIds: ['media-5', 'media-6'], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/113`, type: 'post',
        content: '<p>Reading list for this month:</p><p>📖 "The Pragmatic Programmer"<br>📖 "Designing Data-Intensive Applications"<br>📖 "Clean Code"</p><p>Any other recommendations?</p>',
        contentText: 'Reading list for this month:\n\n📖 "The Pragmatic Programmer"\n📖 "Designing Data-Intensive Applications"\n📖 "Clean Code"\n\nAny other recommendations?',
        publishedAt: daysAgo(130), timestamp: daysAgo(130).getTime(),
        tags: ['books', 'reading', 'programming'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/114`, type: 'post',
        content: '<p>Unlisted thought: I wonder how many people actually export their Mastodon archives. It\'s such an underused feature. 🤔</p>',
        contentText: 'Unlisted thought: I wonder how many people actually export their Mastodon archives. It\'s such an underused feature. 🤔',
        publishedAt: daysAgo(125), timestamp: daysAgo(125).getTime(),
        tags: ['mastodon', 'thoughts'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'unlisted'
      },

      // === ~3 months ago ===
      {
        accountId, activityId: `${accountId}/statuses/115`, type: 'post',
        content: '<p>Milestone: 100 posts on Mastodon! 🎉 The journey of a thousand toots begins with a single toot.</p>',
        contentText: 'Milestone: 100 posts on Mastodon! 🎉 The journey of a thousand toots begins with a single toot.',
        publishedAt: daysAgo(100), timestamp: daysAgo(100).getTime(),
        tags: ['milestone', 'mastodon', 'celebration'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/116`, type: 'post',
        content: '<p>Pro tip: Use content warnings (CW) generously. It\'s not censorship, it\'s consent. Let people choose what they want to see. 💡</p>',
        contentText: 'Pro tip: Use content warnings (CW) generously. It\'s not censorship, it\'s consent. Let people choose what they want to see. 💡',
        publishedAt: daysAgo(95), timestamp: daysAgo(95).getTime(),
        tags: ['mastodon', 'protip', 'CW', 'etiquette'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/117`, type: 'post',
        content: '<p>Art experiment with generative patterns 🎨</p>',
        contentText: 'Art experiment with generative patterns 🎨',
        publishedAt: daysAgo(90), timestamp: daysAgo(90).getTime(),
        tags: ['art', 'generative', 'creative'],
        emojis: [], mentions: [], mediaIds: ['media-7', 'media-8', 'media-9', 'media-10'], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/118`, type: 'post',
        content: '<p>Food post (CW because food pics)</p><p>Made homemade ramen from scratch! Took 6 hours but totally worth it. 🍜</p>',
        contentText: 'Made homemade ramen from scratch! Took 6 hours but totally worth it. 🍜',
        publishedAt: daysAgo(85), timestamp: daysAgo(85).getTime(),
        tags: ['food', 'cooking', 'ramen'],
        emojis: [], mentions: [], mediaIds: [], sensitive: true, visibility: 'public',
        summary: 'Food post'
      },

      // === ~2 months ago ===
      {
        accountId, activityId: `${accountId}/statuses/119`, type: 'post',
        content: '<p>Thread time! Let me explain why data portability matters for social media. 🧵👇</p>',
        contentText: 'Thread time! Let me explain why data portability matters for social media. 🧵👇',
        publishedAt: daysAgo(60), timestamp: daysAgo(60).getTime(),
        tags: ['thread', 'dataportability', 'fediverse'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/120`, type: 'post',
        content: '<p>1/ Your social media data is YOUR data. You created it, you should own it. But most platforms make it nearly impossible to leave with your content.</p>',
        contentText: '1/ Your social media data is YOUR data. You created it, you should own it. But most platforms make it nearly impossible to leave with your content.',
        publishedAt: new Date(daysAgo(60).getTime() + 60000), timestamp: daysAgo(60).getTime() + 60000,
        tags: ['thread', 'dataportability'],
        emojis: [], mentions: [], mediaIds: [], inReplyTo: `${accountId}/statuses/119`, sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/121`, type: 'post',
        content: '<p>2/ Mastodon gets this right with built-in export. You can download everything: posts, media, likes, bookmarks. In standard formats. That\'s how it should be. ✅</p>',
        contentText: '2/ Mastodon gets this right with built-in export. You can download everything: posts, media, likes, bookmarks. In standard formats. That\'s how it should be. ✅',
        publishedAt: new Date(daysAgo(60).getTime() + 120000), timestamp: daysAgo(60).getTime() + 120000,
        tags: ['thread', 'dataportability', 'mastodon'],
        emojis: [], mentions: [], mediaIds: [], inReplyTo: `${accountId}/statuses/120`, sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/122`, type: 'post',
        content: '<p>3/ That\'s why tools like Pastodon exist — to make your exported data actually *useful*. Browse it, search it, relive your memories. Your archive, your way. 🎯</p>',
        contentText: '3/ That\'s why tools like Pastodon exist — to make your exported data actually *useful*. Browse it, search it, relive your memories. Your archive, your way. 🎯',
        publishedAt: new Date(daysAgo(60).getTime() + 180000), timestamp: daysAgo(60).getTime() + 180000,
        tags: ['thread', 'dataportability', 'pastodon'],
        emojis: [], mentions: [], mediaIds: [], inReplyTo: `${accountId}/statuses/121`, sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/123`, type: 'post',
        content: '<p>Had a great conversation with <span class="h-card"><a href="https://mastodon.social/@fossdev" class="u-url mention">@<span>fossdev</span></a></span> about open-source sustainability. The Fediverse shows that community-driven projects can thrive! 💚</p>',
        contentText: 'Had a great conversation with @fossdev about open-source sustainability. The Fediverse shows that community-driven projects can thrive! 💚',
        publishedAt: daysAgo(50), timestamp: daysAgo(50).getTime(),
        tags: ['opensource', 'fediverse', 'community'],
        emojis: [], mentions: [{ name: '@fossdev', url: 'https://mastodon.social/@fossdev' }], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/124`, type: 'post',
        content: '<p>Interesting stats: I\'ve been on Mastodon for almost a year now and posted more here than I ever did on Twitter. The community makes all the difference. 📊</p>',
        contentText: 'Interesting stats: I\'ve been on Mastodon for almost a year now and posted more here than I ever did on Twitter. The community makes all the difference. 📊',
        publishedAt: daysAgo(45), timestamp: daysAgo(45).getTime(),
        tags: ['mastodon', 'stats', 'reflection'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },

      // === ~1 month ago ===
      {
        accountId, activityId: `${accountId}/statuses/125`, type: 'post',
        content: '<p>DM to self: Remember to export your Mastodon archive regularly! 📦</p>',
        contentText: 'DM to self: Remember to export your Mastodon archive regularly! 📦',
        publishedAt: daysAgo(35), timestamp: daysAgo(35).getTime(),
        tags: ['reminder'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'direct'
      },
      {
        accountId, activityId: `${accountId}/statuses/126`, type: 'post',
        content: '<p>Updated my blog with a new post about building browser-first applications. No backend needed, just HTML/JS and IndexedDB. Link in bio! 📝</p>',
        contentText: 'Updated my blog with a new post about building browser-first applications. No backend needed, just HTML/JS and IndexedDB. Link in bio! 📝',
        publishedAt: daysAgo(30), timestamp: daysAgo(30).getTime(),
        tags: ['blog', 'webdev', 'IndexedDB', 'frontend'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/127`, type: 'post',
        content: '<p>Appreciation post for all the open-source maintainers out there. You make the internet a better place. 🫶</p><p>Special shoutout to <span class="h-card"><a href="https://mastodon.social/@Gargron" class="u-url mention">@<span>Gargron</span></a></span> for creating Mastodon!</p>',
        contentText: 'Appreciation post for all the open-source maintainers out there. You make the internet a better place. 🫶\n\nSpecial shoutout to @Gargron for creating Mastodon!',
        publishedAt: daysAgo(25), timestamp: daysAgo(25).getTime(),
        tags: ['opensource', 'appreciation', 'mastodon'],
        emojis: [], mentions: [{ name: '@Gargron', url: 'https://mastodon.social/@Gargron' }], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/128`, type: 'post',
        content: '<p>New desk setup! Working from home has its perks. 🖥️✨</p>',
        contentText: 'New desk setup! Working from home has its perks. 🖥️✨',
        publishedAt: daysAgo(20), timestamp: daysAgo(20).getTime(),
        tags: ['desksetup', 'wfh', 'workspace'],
        emojis: [], mentions: [], mediaIds: ['media-3', 'media-4'], sensitive: false, visibility: 'public'
      },

      // === Recent - 2 weeks ===
      {
        accountId, activityId: `${accountId}/statuses/129`, type: 'post',
        content: '<p>Things I wish I knew when I started programming:</p><p>1. Read other people\'s code<br>2. Don\'t over-engineer<br>3. Tests save time, not waste it<br>4. Documentation is a gift to your future self<br>5. Perfect is the enemy of done</p>',
        contentText: 'Things I wish I knew when I started programming:\n\n1. Read other people\'s code\n2. Don\'t over-engineer\n3. Tests save time, not waste it\n4. Documentation is a gift to your future self\n5. Perfect is the enemy of done',
        publishedAt: daysAgo(14), timestamp: daysAgo(14).getTime(),
        tags: ['programming', 'advice', 'dev'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/130`, type: 'post',
        content: '<p>Fun fact: The Mastodon mascot is an elephant because mastodons were elephant-like creatures. And like the Fediverse, they were big, diverse, and distributed across many regions! 🐘🌍</p>',
        contentText: 'Fun fact: The Mastodon mascot is an elephant because mastodons were elephant-like creatures. And like the Fediverse, they were big, diverse, and distributed across many regions! 🐘🌍',
        publishedAt: daysAgo(12), timestamp: daysAgo(12).getTime(),
        tags: ['funfact', 'mastodon', 'fediverse'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/131`, type: 'post',
        content: '<p>Currently reading about WebAssembly. The future of the web is going to be wild. Imagine running native-speed apps entirely in the browser... oh wait, we already can! 🚀</p>',
        contentText: 'Currently reading about WebAssembly. The future of the web is going to be wild. Imagine running native-speed apps entirely in the browser... oh wait, we already can! 🚀',
        publishedAt: daysAgo(10), timestamp: daysAgo(10).getTime(),
        tags: ['WebAssembly', 'wasm', 'webdev', 'future'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },

      // === Last week ===
      {
        accountId, activityId: `${accountId}/statuses/132`, type: 'post',
        content: '<p>Friday evening playlist recommendations? I\'m in the mood for lo-fi beats and ambient music. 🎵🎧</p>',
        contentText: 'Friday evening playlist recommendations? I\'m in the mood for lo-fi beats and ambient music. 🎵🎧',
        publishedAt: daysAgo(7), timestamp: daysAgo(7).getTime(),
        tags: ['music', 'friday', 'lofi', 'playlist'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/133`, type: 'post',
        content: '<p>Just discovered this amazing archive viewer. It stores everything locally in your browser - no server needed! 🔒</p><p>Your data stays private and secure. 🛡️</p>',
        contentText: 'Just discovered this amazing archive viewer. It stores everything locally in your browser - no server needed! 🔒\n\nYour data stays private and secure. 🛡️',
        publishedAt: daysAgo(5), timestamp: daysAgo(5).getTime(),
        tags: ['privacy', 'security', 'opensource', 'pastodon'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/134`, type: 'post',
        content: '<p>Check out these beautiful sample images! 📸</p><p>The viewer supports multiple media attachments with a nice gallery view.</p>',
        contentText: 'Check out these beautiful sample images! 📸\n\nThe viewer supports multiple media attachments with a nice gallery view.',
        publishedAt: daysAgo(3), timestamp: daysAgo(3).getTime(),
        tags: ['photography', 'gallery', 'media'],
        emojis: [], mentions: [], mediaIds: ['media-5', 'media-6', 'media-7'], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/135`, type: 'post',
        content: '<p>Features I love about Pastodon:</p><p>✅ Multi-account support<br>✅ Full-text search<br>✅ Statistics dashboard<br>✅ Google Drive sync<br>✅ Memories / On This Day<br>✅ Dark mode<br>✅ Responsive design<br>✅ Bilingual (EN/中文)</p>',
        contentText: 'Features I love about Pastodon:\n\n✅ Multi-account support\n✅ Full-text search\n✅ Statistics dashboard\n✅ Google Drive sync\n✅ Memories / On This Day\n✅ Dark mode\n✅ Responsive design\n✅ Bilingual (EN/中文)',
        publishedAt: daysAgo(2), timestamp: daysAgo(2).getTime(),
        tags: ['features', 'pastodon', 'opensource'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },

      // === Today / very recent ===
      {
        accountId, activityId: `${accountId}/statuses/136`, type: 'post',
        content: '<p>Morning coffee ritual. Some things are sacred. ☕</p>',
        contentText: 'Morning coffee ritual. Some things are sacred. ☕',
        publishedAt: hoursAgo(18), timestamp: hoursAgo(18).getTime(),
        tags: ['coffee', 'morning'],
        emojis: [], mentions: [], mediaIds: ['media-8'], sensitive: false, visibility: 'unlisted'
      },
      {
        accountId, activityId: `${accountId}/statuses/137`, type: 'post',
        content: '<p>Content warning example</p><p>Sometimes you need to hide spoilers or sensitive content. Mastodon makes this easy with CW (Content Warnings). Very thoughtful feature! 💡</p>',
        contentText: 'Sometimes you need to hide spoilers or sensitive content. Mastodon makes this easy with CW (Content Warnings). Very thoughtful feature! 💡',
        publishedAt: hoursAgo(12), timestamp: hoursAgo(12).getTime(),
        tags: ['cw', 'mastodon', 'etiquette'],
        emojis: [], mentions: [], mediaIds: [], sensitive: true, visibility: 'public',
        summary: 'Mastodon etiquette tip'
      },
      {
        accountId, activityId: `${accountId}/statuses/138`, type: 'post',
        content: '<p>You can also mention users like <span class="h-card"><a href="https://mastodon.social/@someone" class="u-url mention">@<span>someone</span></a></span> and <span class="h-card"><a href="https://fosstodon.org/@dev" class="u-url mention">@<span>dev@fosstodon.org</span></a></span> in your posts!</p><p>Cross-instance mentions work seamlessly in the Fediverse. 🌐</p>',
        contentText: 'You can also mention users like @someone and @dev@fosstodon.org in your posts!\n\nCross-instance mentions work seamlessly in the Fediverse. 🌐',
        publishedAt: hoursAgo(6), timestamp: hoursAgo(6).getTime(),
        tags: ['mentions', 'fediverse'],
        emojis: [], mentions: [
          { name: '@someone', url: 'https://mastodon.social/@someone' },
          { name: '@dev@fosstodon.org', url: 'https://fosstodon.org/@dev' }
        ], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/139`, type: 'post',
        content: '<p>Ready to explore your own Mastodon history? 🚀</p><p>Export your archive from Mastodon, then upload it here to get started. All processing happens locally in your browser!</p>',
        contentText: 'Ready to explore your own Mastodon history? 🚀\n\nExport your archive from Mastodon, then upload it here to get started. All processing happens locally in your browser!',
        publishedAt: hoursAgo(2), timestamp: hoursAgo(2).getTime(),
        tags: ['getstarted', 'pastodon'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
      {
        accountId, activityId: `${accountId}/statuses/140`, type: 'post',
        content: '<p>This sample preview gives you a taste of what your archive will look like. Navigate through the sidebar to explore Stats, Favourites, Bookmarks, and Memories! 🎨</p>',
        contentText: 'This sample preview gives you a taste of what your archive will look like. Navigate through the sidebar to explore Stats, Favourites, Bookmarks, and Memories! 🎨',
        publishedAt: hoursAgo(1), timestamp: hoursAgo(1).getTime(),
        tags: ['preview', 'demo', 'pastodon'],
        emojis: [], mentions: [], mediaIds: [], sensitive: false, visibility: 'public'
      },
    ]

    // --- Likes ---
    const sampleLikes: Like[] = [
      { id: 'like-1', accountId, activityId: 'like-activity-1', likedPostId: 'liked-1', targetUrl: 'https://mastodon.social/@alice/12345', likedAt: daysAgo(300), postPreview: 'The Fediverse is growing every day! So excited to see more people joining.' },
      { id: 'like-2', accountId, activityId: 'like-activity-2', likedPostId: 'liked-2', targetUrl: 'https://fosstodon.org/@dev/67890', likedAt: daysAgo(250), postPreview: 'Just released v2.0 of my open-source project. Huge thanks to all contributors!' },
      { id: 'like-3', accountId, activityId: 'like-activity-3', likedPostId: 'liked-3', targetUrl: 'https://mastodon.social/@tech/11111', likedAt: daysAgo(200), postPreview: 'IndexedDB is incredibly powerful for client-side storage. Here\'s a deep dive...' },
      { id: 'like-4', accountId, activityId: 'like-activity-4', likedPostId: 'liked-4', targetUrl: 'https://hachyderm.io/@infosec/22222', likedAt: daysAgo(150), postPreview: 'Privacy tip: Always review app permissions before granting access.' },
      { id: 'like-5', accountId, activityId: 'like-activity-5', likedPostId: 'liked-5', targetUrl: 'https://mastodon.social/@art/33333', likedAt: daysAgo(120), postPreview: 'New digital art piece: "Decentralized Dreams" 🎨' },
      { id: 'like-6', accountId, activityId: 'like-activity-6', likedPostId: 'liked-6', targetUrl: 'https://mastodon.online/@writer/44444', likedAt: daysAgo(90), postPreview: 'The best code is the code you don\'t have to write.' },
      { id: 'like-7', accountId, activityId: 'like-activity-7', likedPostId: 'liked-7', targetUrl: 'https://mstdn.social/@music/55555', likedAt: daysAgo(60), postPreview: 'Released a new album on Bandcamp! All tracks are CC-BY licensed. 🎵' },
      { id: 'like-8', accountId, activityId: 'like-activity-8', likedPostId: 'liked-8', targetUrl: 'https://mastodon.social/@science/66666', likedAt: daysAgo(30), postPreview: 'Fascinating paper on distributed systems and consensus algorithms.' },
      { id: 'like-9', accountId, activityId: 'like-activity-9', likedPostId: 'liked-9', targetUrl: 'https://fosstodon.org/@rust/77777', likedAt: daysAgo(14), postPreview: 'Rust continues to be the most loved programming language. Here\'s why...' },
      { id: 'like-10', accountId, activityId: 'like-activity-10', likedPostId: 'liked-10', targetUrl: 'https://mastodon.social/@news/88888', likedAt: daysAgo(7), postPreview: 'Great news for the open web: another major platform adopts ActivityPub!' },
      { id: 'like-11', accountId, activityId: 'like-activity-11', likedPostId: 'liked-11', targetUrl: 'https://mastodon.social/@design/99999', likedAt: daysAgo(3), postPreview: 'UI design tip: Dark mode isn\'t just about inverting colors. Here\'s how to do it right.' },
      { id: 'like-12', accountId, activityId: 'like-activity-12', likedPostId: 'liked-12', targetUrl: 'https://hachyderm.io/@golang/10101', likedAt: daysAgo(1), postPreview: 'Go 1.22 is out with some amazing new features for concurrent programming.' },
    ]

    // --- Bookmarks ---
    const sampleBookmarks: Bookmark[] = [
      { id: 'bm-1', accountId, activityId: 'bm-activity-1', bookmarkedPostId: 'bm-post-1', targetUrl: 'https://mastodon.social/@tutorial/aaa', bookmarkedAt: daysAgo(280), postPreview: 'Complete guide to setting up your own Mastodon instance in 2024' },
      { id: 'bm-2', accountId, activityId: 'bm-activity-2', bookmarkedPostId: 'bm-post-2', targetUrl: 'https://fosstodon.org/@webdev/bbb', bookmarkedAt: daysAgo(220), postPreview: 'The ultimate CSS Grid cheatsheet - bookmarking this for reference' },
      { id: 'bm-3', accountId, activityId: 'bm-activity-3', bookmarkedPostId: 'bm-post-3', targetUrl: 'https://mastodon.social/@security/ccc', bookmarkedAt: daysAgo(180), postPreview: 'How to audit your online privacy in 10 steps. Essential reading.' },
      { id: 'bm-4', accountId, activityId: 'bm-activity-4', bookmarkedPostId: 'bm-post-4', targetUrl: 'https://hachyderm.io/@devops/ddd', bookmarkedAt: daysAgo(140), postPreview: 'Docker compose best practices for local development environments' },
      { id: 'bm-5', accountId, activityId: 'bm-activity-5', bookmarkedPostId: 'bm-post-5', targetUrl: 'https://mastodon.online/@cooking/eee', bookmarkedAt: daysAgo(100), postPreview: 'The perfect sourdough bread recipe - tried and tested 100 times 🍞' },
      { id: 'bm-6', accountId, activityId: 'bm-activity-6', bookmarkedPostId: 'bm-post-6', targetUrl: 'https://mastodon.social/@typescript/fff', bookmarkedAt: daysAgo(70), postPreview: 'Advanced TypeScript patterns every developer should know' },
      { id: 'bm-7', accountId, activityId: 'bm-activity-7', bookmarkedPostId: 'bm-post-7', targetUrl: 'https://fosstodon.org/@linux/ggg', bookmarkedAt: daysAgo(40), postPreview: 'My terminal setup: zsh + starship + tmux. Config files included!' },
      { id: 'bm-8', accountId, activityId: 'bm-activity-8', bookmarkedPostId: 'bm-post-8', targetUrl: 'https://mastodon.social/@accessibility/hhh', bookmarkedAt: daysAgo(15), postPreview: 'Web accessibility checklist for 2025 - make your apps usable by everyone' },
    ]

    // Save to database
    await db.transaction('rw', [db.accounts, db.posts, db.media, db.likes, db.bookmarks, db.metadata], async () => {
      await db.accounts.add({
        ...sampleAccount,
        postsCount: samplePosts.length,
        likesCount: sampleLikes.length,
        bookmarksCount: sampleBookmarks.length
      })

      for (const post of samplePosts) {
        await db.posts.add({ ...post, id: post.activityId })
      }

      await db.media.bulkAdd(sampleMedia)
      await db.likes.bulkAdd(sampleLikes)
      await db.bookmarks.bulkAdd(sampleBookmarks)

      await db.metadata.add({
        id: accountId,
        accountId,
        uploadedAt: now,
        totalPosts: samplePosts.length,
        totalLikes: sampleLikes.length,
        totalBookmarks: sampleBookmarks.length,
        totalMedia: sampleMedia.length,
        originalFilename: 'sample-data',
        fileSize: 0
      })
    })

    console.log('Sample data loaded successfully!')
  } catch (error) {
    console.error('Error loading sample data:', error)
    throw error
  }
}

// Function to check if sample data already exists
export async function hasSampleData(): Promise<boolean> {
  const sampleAccount = await db.accounts.get('https://mastodon.social/users/sample_user')
  return !!sampleAccount
}

// Function to remove sample data
export async function removeSampleData(): Promise<void> {
  const sampleAccountId = 'https://mastodon.social/users/sample_user'
  await db.clearAccount(sampleAccountId)
  console.log('Sample data removed successfully!')
}
