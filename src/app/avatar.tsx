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
import { colorLabel, partLabel, slotLabel } from '@/avatar/labels';
import { useAuth } from '@/auth/auth-context';
import { updateAvatar } from '@/auth/auth-service';
import { useAuthAction } from '@/auth/use-auth-action';
import { Avatar } from '@/components/avatar';
import { BackButton } from '@/components/back-button';
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
import { useT, type Translator } from '@/i18n';
import { getSupabase } from '@/lib/supabase';
import { goBack } from '@/navigation/back';

type Tab = (typeof EDITABLE_SLOTS)[number] | 'colors';
const TABS: readonly Tab[] = [...EDITABLE_SLOTS, 'colors'];
const tabLabel = (t: Translator, tab: Tab) => (tab === 'colors' ? t('avatar.colors') : slotLabel(t, tab));
const COLOR_ROWS = [...EDITABLE_COLOR_SLOTS, 'background'] as const;

const THUMB = 72;

/** Création de l'avatar : morceaux, couleurs, puis enregistrement dans le profil. */
export default function AvatarScreen() {
  const t = useT();
  const { configured, loading, session, profile, profileError, refreshProfile } = useAuth();
  if (!configured) {
    return (
      <AuthScreen header="back" title={t('avatar.title')} subtitle={t('avatar.unavailable')}>
        <NotConfiguredCard />
      </AuthScreen>
    );
  }
  if (session && !profile && profileError) {
    return (
      <AuthScreen header="back" title={t('avatar.title')} subtitle={t('avatar.profileUnavailable')}>
        <ErrorState message={t('profile.readFailed')} onRetry={refreshProfile} />
      </AuthScreen>
    );
  }
  if (loading || (session && !profile)) {
    return (
      <AuthScreen header="back" title={t('avatar.title')} subtitle={t('avatar.subtitle')}>
        <LoadingState />
      </AuthScreen>
    );
  }
  if (!session || !profile) {
    return (
      <AuthScreen header="back" title={t('avatar.title')} subtitle={t('avatar.signIn')}>
        <DrawnButton label={t('common.signIn')} onPress={() => router.push('/sign-in')} color={playerColor(1).piece} />
      </AuthScreen>
    );
  }
  return <AvatarEditor key={profile.id} userId={profile.id} saved={profile.avatar} />;
}

function AvatarEditor({ userId, saved }: { userId: string; saved: string | null }) {
  const t = useT();
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
      goBack('/profile');
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={[styles.content, wide && styles.wideContent]}>
        <BackButton />
        <Text style={Typography.title} accessibilityRole="header">
          {t('avatar.title')}
        </Text>

        <View style={[styles.body, wide && styles.wideBody]}>
          <View style={[styles.previewColumn, wide && styles.widePreviewColumn]}>
            <View style={styles.preview}>
              <Avatar value={avatar} seed={userId} size={168} accessibilityLabel={t('avatar.preview')} />
              <View style={styles.previewActions}>
                <DrawnButton label={t('avatar.random')} size="small" onPress={() => setAvatar(randomAvatar(AvatarPalettes))} />
                <DrawnButton label={t('avatar.default')} size="small" onPress={() => setAvatar(seededAvatar(userId))} />
              </View>
            </View>
          </View>
          <View style={styles.optionsColumn}>
            <View style={styles.tabs} accessibilityRole="tablist">
              {TABS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setTab(option)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: option === tab }}
                  style={[styles.tab, option === tab && styles.tabSelected]}>
                  <Text style={[Typography.caption, styles.tabLabel, option === tab && styles.tabLabelSelected]}>
                    {tabLabel(t, option)}
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
                      <Text style={Typography.heading}>{colorLabel(t, slot)}</Text>
                      <View
                        style={styles.swatches}
                        accessibilityRole="radiogroup"
                        accessibilityLabel={colorLabel(t, slot)}>
                        {AvatarPalettes[slot].map((color) => (
                          <Pressable
                            key={color}
                            onPress={() => chooseColor(slot, color)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: color === current }}
                            accessibilityLabel={t('avatar.colorSwatch', { slot: colorLabel(t, slot), color })}
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
                <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={slotLabel(t, tab)}>
                  {partsForSlot(tab).map((part) => {
                    const selected = avatar.selections[tab] === part.id;
                    const label = partLabel(t, tab, part.id);
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
          label={pending ? t('common.saving') : t('common.save')}
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
