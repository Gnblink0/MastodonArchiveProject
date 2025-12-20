
import { useActor, usePostsCount } from '../hooks/usePosts'
import { Calendar, MessageSquare } from 'lucide-react'

export function ProfilePage() {
  const actor = useActor()
  const postsCount = usePostsCount()

  if (!actor) {
    return (
      <div className="flex items-center justify-center h-full text-mastodon-text-secondary">
        <p>Profile not found</p>
      </div>
    )
  }

  // Format date
  const joinDate = new Intl.DateTimeFormat('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  }).format(actor.createdAt)

  return (
    <div className="max-w-4xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="h-48 md:h-64 bg-mastodon-surface relative overflow-hidden rounded-b-lg">
        {actor.headerUrl ? (
          <img 
            src={actor.headerUrl} 
            alt="Header" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-mastodon-primary to-purple-600 opacity-30" />
        )}
      </div>

      <div className="px-6 relative">
        {/* Avatar */}
        <div className="-mt-16 md:-mt-20 mb-4 inline-block relative">
          <div className="p-1.5 bg-mastodon-bg rounded-full">
            {actor.avatarUrl ? (
              <img 
                src={actor.avatarUrl} 
                alt={actor.displayName} 
                className="w-32 h-32 md:w-36 md:h-36 rounded-full object-cover border-4 border-mastodon-bg"
              />
            ) : (
              <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-mastodon-surface border-4 border-mastodon-bg" />
            )}
          </div>
        </div>

        {/* Profile Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">{actor.displayName}</h1>
            <p className="text-mastodon-text-secondary text-lg">@{actor.preferredUsername}</p>
          </div>

          {/* Bio */}
          <div 
            className="prose prose-invert max-w-none text-mastodon-text-primary"
            dangerouslySetInnerHTML={{ __html: actor.summary }}
          />

          {/* Metadata Fields */}
          {actor.fields && actor.fields.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-mastodon-border py-4">
              {actor.fields.map((field, index) => (
                <div key={index} className="flex flex-col">
                  <span className="text-mastodon-text-secondary text-sm uppercase font-bold text-xs">{field.name}</span>
                  <span className="text-white font-medium" dangerouslySetInnerHTML={{ __html: field.value }} />
                </div>
              ))}
            </div>
          )}

          {/* Stats Bar */}
          <div className="flex flex-wrap gap-6 md:gap-12 border-t border-mastodon-border py-6 text-mastodon-text-secondary">
             <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <span className="font-bold text-white text-lg">{postsCount ?? 0}</span>
                <span>Posts</span>
             </div>
             <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>Joined {joinDate}</span>
             </div>
             {/* Note: Following/Followers are usually not in the actor export object or are in metadata sometimes. 
                 If we don't have them in types, we skip. */}
          </div>
        </div>
      </div>
    </div>
  )
}
