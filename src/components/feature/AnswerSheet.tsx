import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnswerStatus } from '@/api/hooks/work';
import { Field } from '@/components/Field';
import { Button, T, useToast } from '@/components/ui';
import type { StatusRequestView } from '@/lib/inbox';
import { dayLabel } from '@/lib/format';
import { radii, useTheme } from '@/theme';

/**
 * Answer "How is it going?" for one open action. The answer rides into the follow-up meeting's
 * carry-forward (ADR-0039 B7), so the room hears it even if you are not there.
 */
export function AnswerSheet({ request, onClose }: { request: StatusRequestView | null; onClose: () => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const answer = useAnswerStatus();
  const [text, setText] = useState('');
  useEffect(() => setText(''), [request?.id]);

  const send = async () => {
    if (!request) return;
    try {
      await answer.run({ id: request.id, text: text.trim() });
      toast({ text: 'Update sent' });
      onClose();
    } catch {
      toast({ text: 'Your update could not be sent. Try again.', tone: 'error' });
    }
  };

  return (
    <Modal visible={!!request} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: p.scrim }} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: p.surface,
            borderTopLeftRadius: radii.hero,
            borderTopRightRadius: radii.hero,
            padding: 20,
            paddingBottom: insets.bottom + 20,
            gap: 14,
          }}
        >
          {request ? (
            <>
              <T variant="title">How is it going?</T>
              <T variant="quote">{request.actionTitle}</T>
              <T variant="secondary">
                For {request.meetingTitle}
                {request.meetingStart ? `, ${dayLabel(request.meetingStart)}` : ''}. Your answer is shared in that meeting.
              </T>
              <Field
                label="Your update"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
                placeholder="Done, blocked, or what is left"
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Send update" busy={answer.isPending} disabled={!text.trim()} onPress={() => void send()} />
                <Button label="Cancel" variant="ghost" onPress={onClose} />
              </View>
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
