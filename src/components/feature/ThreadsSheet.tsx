import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeleteMyteThread, useMyteThreads, useOpenMyteThread } from '@/api/hooks/ask-myte';
import { EmptyState, ErrorState, IconButton, T, useToast } from '@/components/ui';
import { X } from '@/components/Icon';
import type { Thread, ThreadSummary } from '@/lib/ask-myte/types';
import { dayLabel } from '@/lib/format';
import { radii, useTheme } from '@/theme';

/**
 * Your Ask Myte conversations (core-api `GET /api/v1/myte/threads`, pinned first, then the most
 * recent), in a bottom sheet like the scope picker. Tap opens one; the trailing control deletes
 * it for good after a confirm (the server keeps no copy to undo to).
 */
export function ThreadsSheet({
  visible,
  activeId,
  onClose,
  onOpen,
  onDeleted,
}: {
  visible: boolean;
  activeId: string | null;
  onClose: () => void;
  onOpen: (thread: Thread) => void;
  /** a deleted conversation that is open on screen is closed */
  onDeleted: (id: string) => void;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const threads = useMyteThreads(visible);
  const open = useOpenMyteThread();
  const del = useDeleteMyteThread();
  const [opening, setOpening] = useState<string | null>(null);
  const items: ThreadSummary[] = (threads.data?.pages ?? []).flatMap((pg) => pg.items);

  const openThread = async (t: ThreadSummary) => {
    if (opening) return;
    setOpening(t.id);
    try {
      onOpen(await open(t.id));
      onClose();
    } catch {
      toast({ text: "That conversation couldn't be opened.", tone: 'error' });
    } finally {
      setOpening(null);
    }
  };

  const confirmDelete = (t: ThreadSummary) => {
    Alert.alert('Delete this conversation?', `"${t.title}" and its answers are deleted for good.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          del.mutate(t.id, {
            onSuccess: () => {
              onDeleted(t.id);
              toast({ text: 'Conversation deleted' });
            },
            onError: () => toast({ text: "That conversation couldn't be deleted.", tone: 'error' }),
          });
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: p.scrim }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View
        accessibilityViewIsModal
        style={{ maxHeight: '75%', backgroundColor: p.surface, borderTopLeftRadius: radii.hero, borderTopRightRadius: radii.hero, paddingTop: 18, paddingBottom: insets.bottom + 12 }}
      >
        <T variant="title" style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          Your conversations
        </T>
        {threads.isError && !items.length ? (
          <View style={{ paddingHorizontal: 16 }}>
            <ErrorState title="Your conversations could not be loaded" onRetry={() => void threads.refetch()} />
          </View>
        ) : threads.isPending ? (
          <ActivityIndicator color={p.ink3} accessibilityLabel="Loading" style={{ marginVertical: 24 }} />
        ) : !items.length ? (
          <EmptyState compact title="No conversations yet" body="Questions you ask your Myte are kept here, only for you." />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(t) => t.id}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (threads.hasNextPage && !threads.isFetchingNextPage) void threads.fetchNextPage();
            }}
            ListFooterComponent={threads.isFetchingNextPage ? <ActivityIndicator color={p.ink3} style={{ marginVertical: 12 }} /> : null}
            renderItem={({ item: t, index }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: p.line,
                  backgroundColor: t.id === activeId ? p.surface2 : 'transparent',
                }}
              >
                <Pressable
                  onPress={() => void openThread(t)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open conversation: ${t.title}`}
                  accessibilityState={{ busy: opening === t.id, selected: t.id === activeId }}
                  style={({ pressed }) => ({ flex: 1, minHeight: 56, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}
                >
                  <T variant="body" tone="ink" numberOfLines={2}>
                    {t.title}
                  </T>
                  <T variant="meta">{[t.pinned ? 'Pinned' : null, dayLabel(t.last_message_at)].filter(Boolean).join(', ')}</T>
                </Pressable>
                {opening === t.id ? (
                  <ActivityIndicator color={p.ink3} style={{ marginRight: 16 }} />
                ) : (
                  <View style={{ marginRight: 8 }}>
                    <IconButton icon={X} label={`Delete conversation: ${t.title}`} onPress={() => confirmDelete(t)} />
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
