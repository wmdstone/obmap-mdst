import React, { useEffect, useState } from 'react';
import { supabase } from '@/global/api/supabaseClient';
import { useAuth } from '@/domains/auth/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/global/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/global/ui/tooltip';
import { DocumentCoPresenceUser } from '@/domains/vcs/types/vcs';

interface VcsCoPresenceAvatarsProps {
  vaultId: string;
  noteId: string;
}

export const VcsCoPresenceAvatars: React.FC<VcsCoPresenceAvatarsProps> = ({ vaultId, noteId }) => {
  const { user, profile } = useAuth();
  const [activeUsers, setActiveUsers] = useState<DocumentCoPresenceUser[]>([]);

  useEffect(() => {
    if (!vaultId || !noteId || !user) return;

    const channelName = `vault:${vaultId}:doc:${noteId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: DocumentCoPresenceUser[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((p) => {
            if (p.userId && p.userId !== user.id) {
              users.push({
                userId: p.userId,
                displayName: p.displayName || 'Kolaborator',
                avatarUrl: p.avatarUrl,
                lastActive: p.lastActive || Date.now(),
              });
            }
          });
        });

        setActiveUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            displayName: profile?.display_name || user.email?.split('@')[0] || 'Saya',
            avatarUrl: profile?.avatar_url,
            lastActive: Date.now(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [vaultId, noteId, user?.id, profile?.display_name, profile?.avatar_url]);

  if (activeUsers.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center -space-x-1.5 overflow-hidden pl-1 pr-1.5 py-0.5">
        {activeUsers.slice(0, 3).map((u) => (
          <Tooltip key={u.userId}>
            <TooltipTrigger asChild>
              <Avatar className="w-5 h-5 ring-1.5 ring-background rounded-full border border-primary/30 transition-transform hover:scale-110">
                {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.displayName} />}
                <AvatarFallback className="text-[9px] font-medium bg-primary/20 text-primary">
                  {u.displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span className="font-semibold">{u.displayName}</span> sedang melihat catatan ini
            </TooltipContent>
          </Tooltip>
        ))}

        {activeUsers.length > 3 && (
          <span className="text-[10px] font-medium text-muted-foreground pl-1">
            +{activeUsers.length - 3}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
};