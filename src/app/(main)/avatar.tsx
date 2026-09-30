import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  EDITABLE_COLOR_SLOTS,
  EDITABLE_SLOTS,
  parseAvatar,
  partsForSlot,
  randomAvatar,
  renderOptionSvg,
  seededAvatar,
  serializeAvatar,
  type AvatarConfig,
  type AvatarSlot,
} from '@/avatar/avatar';
import { COLOR_LABELS, partLabel, SLOT_LABELS } from '@/avatar/labels';
import { useAuth } from '@/auth/auth-context';
import { updateAvatar } from '@/auth/auth-service';
import { useAuthAction } from '@/auth/use-auth-action';
import { Avatar } from '@/components/avatar';
import { AuthScreen, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { DrawnCard } from '@/components/drawn-card';
import { useScreenEdges } from '@/components/nav-bar/screen-edges';
import { ErrorState, LoadingState } from '@/components/state-view';
import {
  AvatarPalettes,
  Colors,
  Fonts,
  MaxContentWidth,
  MaxWideContentWidth,
  playerColor,
  Radius,
  Spacing,
  Stroke,
  TouchTarget,
  Typography,
} from '@/constants/theme';
import { useWideLayout } from '@/hooks/use-wide-layout';
import { getSupabase } from '@/lib/supabase';

type Tab = (typeof EDITABLE_SLOTS)[number] | 'colors';
const TABS: readonly Tab[] = [...EDITABLE_SLOTS, 'colors'];
const TAB_LABELS: Record<Tab, string> = { ...SLOT_LABELS, colors: 'Couleurs' };
const COLOR_ROWS = [...EDITABLE_COLOR_SLOTS, 'background'] as const;

const THUMB = 72;

/** Création de l'avatar : morceaux, couleurs, puis enregistrement dans le profil. */
export default function AvatarScreen() {
  const { configured, loading, session, profile, profileError, refreshProfile } = useAuth();
  if (!configured) {
    return (
      <AuthScreen title="Ton avatar" subtitle="Avatars indisponibles.">
        <NotConfiguredCard />
      </AuthScreen>
    );
  }
  if (session && !profile && profileError) {
    return (
      <AuthScreen title="Ton avatar" subtitle="Profil indisponible.">
        <ErrorState message="Impossible de lire ton profil. Vérifie ta connexion." onRetry={refreshProfile} />
      </AuthScreen>
    );
  }
  if (loading || (session && !profile)) {
    return (
      <AuthScreen title="Ton avatar" subtitle="Crée le personnage que verront les autres joueurs.">
        <LoadingState />
      </AuthScreen>
    );
  }
  if (!session || !profile) {
    return (
      <AuthScreen title="Ton avatar" subtitle="Connecte-toi (ou joue en invité) pour créer ton avatar.">
        <DrawnButton label="Se connecter" onPress={() => router.push('/sign-in')} color={playerColor(1).piece} />
      </AuthScreen>
    );
  }
  return <AvatarEditor key={profile.id} userId={profile.id} saved={profile.avatar} />;
}

function AvatarEditor({ userId, saved }: { userId: string; saved: string | null }) {
  const { refreshProfile } = useAuth();
  const [avatar, setAvatar] = useState<AvatarConfig>(() => parseAvatar(saved, userId));
  const [tab, setTab] = useState<Tab>('head');
  const wide = useWideLayout();
  const { pending, error, run } = useAuthAction();
  const edges = useScreenEdges();

  const choosePart = (slot: AvatarSlot, id: string) =>
    setAvatar((prev) => ({ ...prev, selections: { ...prev.selections, [slot]: id } }));
  const chooseColor = (slot: (typeof COLOR_ROWS)[number], color: string) =>
    setAvatar((prev) =>
      slot === 'background' ? { ...prev, background: color } : { ...prev, colors: { ...prev.colors, [slot]: color } },
    );

  const save = async () => {
    const ok = await run(() => updateAvatar(getSupabase(), userId, serializeAvatar(avatar)));
    if (ok) {
      refreshProfile();
      if (router.canGoBack()) router.back();
      else router.replace('/profile');
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={[styles.content, wide && styles.wideContent]}>
        <View style={styles.header}>
          <DrawnButton
            label="‹ Retour"
            size="small"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>
        <Text style={Typography.title} accessibilityRole="header">
          Ton avatar
        </Text>

        <View style={[styles.body, wide && styles.wideBody]}>
          <View style={[styles.previewColumn, wide && styles.widePreviewColumn]}>
            <View style={styles.preview}>
              <Avatar value={avatar} seed={userId} size={168} accessibilityLabel="Aperçu de ton avatar" />
              <View style={styles.previewActions}>
                <DrawnButton label="Au hasard" size="small" onPress={() => setAvatar(randomAvatar(AvatarPalettes))} />
                <DrawnButton label="Par défaut" size="small" onPress={() => setAvatar(seededAvatar(userId))} />
              </View>
            </View>
          </View>
          <View style={styles.optionsColumn}>
            <View style={styles.tabs} accessibilityRole="tablist">
              {TABS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: t === tab }}
                  style={[styles.tab, t === tab && styles.tabSelected]}>
                  <Text style={[Typography.caption, styles.tabLabel, t === tab && styles.tabLabelSelected]}>
                    {TAB_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <DrawnCard contentStyle={styles.card}>
              {tab === 'colors' ? (
                COLOR_ROWS.map((slot) => {
                  const current = slot === 'background' ? avatar.background : avatar.colors[slot];
                  return (
                    <View key={slot} style={styles.colorRow}>
                      <Text style={Typography.heading}>{COLOR_LABELS[slot]}</Text>
                      <View
                        style={styles.swatches}
                        accessibilityRole="radiogroup"
                        accessibilityLabel={COLOR_LABELS[slot]}>
                        {AvatarPalettes[slot].map((color) => (
                          <Pressable
                            key={color}
                            onPress={() => chooseColor(slot, color)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: color === current }}
                            accessibilityLabel={`${COLOR_LABELS[slot]} #${color}`}
                            style={[
                              styles.swatch,
                              { backgroundColor: `#${color}` },
                              color === current && styles.swatchSelected,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={SLOT_LABELS[tab]}>
                  {partsForSlot(tab).map((part) => {
                    const selected = avatar.selections[tab] === part.id;
                    const label = partLabel(tab, part.id);
                    return (
                      <Pressable
                        key={part.id}
                        onPress={() => choosePart(tab, part.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={label}
                        style={[styles.thumb, selected && styles.thumbSelected]}>
                        <SvgXml xml={renderOptionSvg(avatar, tab, part.id)} width={THUMB - 8} height={THUMB - 8} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </DrawnCard>
            {error && <Notice>{error}</Notice>}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, wide && styles.wideFooter]}>
        <DrawnButton
          label={pending ? 'Enregistrement…' : 'Enregistrer'}
          onPress={save}
          color={playerColor(0).piece}
          busy={pending}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
  },
  body: {
    gap: Spacing.four,
  },
  wideBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.five,
  },
  previewColumn: {
    gap: Spacing.four,
  },
  // Grand écran : l'aperçu reste à gauche, les options défilent à droite.
  widePreviewColumn: {
    width: 280,
    paddingTop: Spacing.four,
  },
  optionsColumn: {
    flex: 1,
    gap: Spacing.four,
  },
  wideContent: {
    maxWidth: MaxWideContentWidth,
  },
  wideFooter: {
    maxWidth: MaxWideContentWidth,
    alignItems: 'flex-end',
  },
  preview: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tab: {
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    borderRadius: Radius.round,
    backgroundColor: Colors.paper,
  },
  tabSelected: {
    backgroundColor: Colors.ink,
  },
  tabLabel: {
    color: Colors.ink,
    fontFamily: Fonts.semibold,
  },
  tabLabelSelected: {
    color: Colors.paper,
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: Stroke.thin,
    borderColor: Colors.line,
    borderRadius: Radius.small,
    backgroundColor: Colors.paper,
  },
  thumbSelected: {
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
    backgroundColor: playerColor(0).tint,
  },
  colorRow: {
    gap: Spacing.two,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  // Le contour noir distingue aussi les pastilles claires (blanc, crème) du fond.
  swatch: {
    width: TouchTarget,
    height: TouchTarget,
    borderRadius: TouchTarget / 2,
    borderWidth: Stroke.thin,
    borderColor: Colors.ink,
  },
  swatchSelected: {
    borderWidth: Stroke.bold + 2,
  },

  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: Stroke.regular,
    borderTopColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
});
