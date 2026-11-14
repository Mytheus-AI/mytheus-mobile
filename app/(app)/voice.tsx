import React from 'react';
import { useUser } from '@clerk/expo';
import { useMe } from '@/api/hooks/identity';
import { Screen } from '@/components/ui';
import { VoicePicker } from '@/components/feature/VoicePicker';

/** Your Myte's voice (ADR-0050), opened from Settings. */
export default function VoiceScreen() {
  const me = useMe();
  const { user } = useUser();
  const agentName = me.data?.agent_name?.trim() || (user?.firstName ? `${user.firstName}'s Myte` : 'Your Myte');
  return (
    <Screen back title="Voice" context={`How ${agentName} sounds when it speaks to you, here and on the web.`}>
      <VoicePicker agentName={agentName} />
    </Screen>
  );
}
