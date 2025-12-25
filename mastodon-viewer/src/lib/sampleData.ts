import { db } from './db'
import type { Account, Post, Media } from '../types'

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

export async function loadSampleData(): Promise<void> {
  try {
    // Create sample account
    const accountId = 'https://mastodon.social/users/sample_user'
    const now = new Date()

    // Generate avatar and header images
    const avatarBlob = await createColoredImageBlob('#6364FF', 200, 200)
    const headerBlob = await createColoredImageBlob('#4F46E5', 1500, 500)

    const sampleAccount: Account = {
      id: accountId,
      preferredUsername: 'sample_user',
      displayName: 'Sample User',
      summary: '<p>This is a sample account for preview. 这是一个示例账户，用于预览应用功能。</p><p>✨ Welcome to Mastodon Archive Viewer!</p>',
      avatarBlob,
      headerBlob,
      fields: [
        { name: 'Location', value: 'Internet' },
        { name: 'Interests', value: 'Open Source, Privacy, Web Development' }
      ],
      createdAt: new Date('2020-01-01'),
      importedAt: now,
      lastUpdatedAt: now,
      postsCount: 0, // Will be updated after adding posts
      likesCount: 0,
      bookmarksCount: 0
    }

    // Create sample posts
    const samplePosts: Omit<Post, 'id'>[] = [
      {
        accountId,
        activityId: `${accountId}/statuses/1`,
        type: 'post',
        content: '<p>Welcome to Mastodon Archive Viewer! 🎉</p><p>This is a sample post to help you preview the app before uploading your own archive.</p>',
        contentText: 'Welcome to Mastodon Archive Viewer! 🎉\n\nThis is a sample post to help you preview the app before uploading your own archive.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 7,
        tags: ['welcome', 'mastodon'],
        emojis: [],
        mentions: [],
        mediaIds: [],
        sensitive: false,
        visibility: 'public'
      },
      {
        accountId,
        activityId: `${accountId}/statuses/2`,
        type: 'post',
        content: '<p>Just discovered this amazing archive viewer. It stores everything locally in your browser - no server needed! 🔒</p><p>Your data stays private and secure. 🛡️</p>',
        contentText: 'Just discovered this amazing archive viewer. It stores everything locally in your browser - no server needed! 🔒\n\nYour data stays private and secure. 🛡️',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 5,
        tags: ['privacy', 'security', 'opensource'],
        emojis: [],
        mentions: [],
        mediaIds: [],
        sensitive: false,
        visibility: 'public'
      },
      {
        accountId,
        activityId: `${accountId}/statuses/3`,
        type: 'post',
        content: '<p>Check out these beautiful sample images! 📸</p><p>The viewer supports multiple media attachments with a nice gallery view.</p>',
        contentText: 'Check out these beautiful sample images! 📸\n\nThe viewer supports multiple media attachments with a nice gallery view.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 3,
        tags: ['photography', 'gallery'],
        emojis: [],
        mentions: [],
        mediaIds: ['media-1', 'media-2', 'media-3'],
        sensitive: false,
        visibility: 'public'
      },
      {
        accountId,
        activityId: `${accountId}/statuses/4`,
        type: 'post',
        content: '<p>Threading works great too! This is the main post...</p>',
        contentText: 'Threading works great too! This is the main post...',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
        tags: ['threads'],
        emojis: [],
        mentions: [],
        mediaIds: [],
        sensitive: false,
        visibility: 'public'
      },
      {
        accountId,
        activityId: `${accountId}/statuses/5`,
        type: 'post',
        content: '<p>And this is a reply to the previous post! You can see the full thread by clicking on any post.</p>',
        contentText: 'And this is a reply to the previous post! You can see the full thread by clicking on any post.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 30), // 2 days ago + 30 min
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 30,
        tags: ['threads'],
        emojis: [],
        mentions: [],
        mediaIds: [],
        inReplyTo: `${accountId}/statuses/4`,
        sensitive: false,
        visibility: 'public'
      },
      {
        accountId,
        activityId: `${accountId}/statuses/6`,
        type: 'post',
        content: '<p>Features I love about this viewer:</p><p>✅ Multi-account support<br>✅ Search & filter<br>✅ Statistics dashboard<br>✅ Google Drive sync<br>✅ Dark mode<br>✅ Responsive design</p>',
        contentText: 'Features I love about this viewer:\n\n✅ Multi-account support\n✅ Search & filter\n✅ Statistics dashboard\n✅ Google Drive sync\n✅ Dark mode\n✅ Responsive design',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        timestamp: Date.now() - 1000 * 60 * 60 * 24,
        tags: ['features', 'list'],
        emojis: [],
        mentions: [],
        mediaIds: [],
        sensitive: false,
        visibility: 'public'
      },
      {
        accountId,
        activityId: `${accountId}/statuses/7`,
        type: 'post',
        content: '<p>Content warning example</p>',
        contentText: 'Content warning example',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
        timestamp: Date.now() - 1000 * 60 * 60 * 12,
        tags: ['cw', 'example'],
        emojis: [],
        mentions: [],
        mediaIds: [],
        sensitive: true,
        visibility: 'public',
        summary: 'Spoiler Alert'
      },
      {
        accountId,
        activityId: `${accountId}/statuses/8`,
        type: 'post',
        content: '<p>You can also mention users like <span class="h-card"><a href="https://mastodon.social/@someone" class="u-url mention">@<span>someone</span></a></span> in your posts!</p>',
        contentText: 'You can also mention users like @someone in your posts!',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
        timestamp: Date.now() - 1000 * 60 * 60 * 6,
        tags: ['mentions'],
        emojis: [],
        mentions: [{ name: '@someone', url: 'https://mastodon.social/@someone' }],
        mediaIds: [],
        sensitive: false,
        visibility: 'public'
      },
      {
        accountId,
        activityId: `${accountId}/statuses/9`,
        type: 'post',
        content: '<p>Ready to explore your own Mastodon history? 🚀</p><p>Click "Select File" or drag and drop your archive to get started!</p>',
        contentText: 'Ready to explore your own Mastodon history? 🚀\n\nClick "Select File" or drag and drop your archive to get started!',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        timestamp: Date.now() - 1000 * 60 * 60,
        tags: ['getstarted'],
        emojis: [],
        mentions: [],
        mediaIds: [],
        sensitive: false,
        visibility: 'public'
      },
      {
        accountId,
        activityId: `${accountId}/statuses/10`,
        type: 'post',
        content: '<p>This sample preview gives you a taste of what your archive will look like. Navigate through different sections using the sidebar! 🎨</p>',
        contentText: 'This sample preview gives you a taste of what your archive will look like. Navigate through different sections using the sidebar! 🎨',
        publishedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        timestamp: Date.now() - 1000 * 60 * 30,
        tags: ['preview', 'demo'],
        emojis: [],
        mentions: [],
        mediaIds: [],
        sensitive: false,
        visibility: 'public'
      }
    ]

    // Create sample media
    const media1Blob = await createColoredImageBlob('#F59E0B', 800, 600)
    const media2Blob = await createColoredImageBlob('#10B981', 800, 600)
    const media3Blob = await createColoredImageBlob('#EF4444', 800, 600)

    const sampleMedia: Media[] = [
      {
        id: 'media-1',
        accountId,
        filename: 'sample-image-1.png',
        type: 'image',
        blob: media1Blob,
        url: '', // Will be generated when queried
        width: 800,
        height: 600
      },
      {
        id: 'media-2',
        accountId,
        filename: 'sample-image-2.png',
        type: 'image',
        blob: media2Blob,
        url: '', // Will be generated when queried
        width: 800,
        height: 600
      },
      {
        id: 'media-3',
        accountId,
        filename: 'sample-image-3.png',
        type: 'image',
        blob: media3Blob,
        url: '', // Will be generated when queried
        width: 800,
        height: 600
      }
    ]

    // Save to database
    await db.transaction('rw', [db.accounts, db.posts, db.media, db.metadata], async () => {
      // Add account
      await db.accounts.add({
        ...sampleAccount,
        postsCount: samplePosts.length,
        likesCount: 0,
        bookmarksCount: 0
      })

      // Add posts with generated IDs
      for (const post of samplePosts) {
        await db.posts.add({
          ...post,
          id: post.activityId
        })
      }

      // Add media
      await db.media.bulkAdd(sampleMedia)

      // Add metadata
      await db.metadata.add({
        id: accountId,
        accountId,
        uploadedAt: now,
        totalPosts: samplePosts.length,
        totalLikes: 0,
        totalBookmarks: 0,
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
