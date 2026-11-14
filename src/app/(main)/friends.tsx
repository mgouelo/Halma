import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawnCard } from '@/components/drawn-card';
import { FriendsIcon } from '@/components/nav-bar/icons';
import { useScreenEdges } from '@/components/nav-bar/screen-edges';
import { ProfileButton } from '@/components/profile-button';
import { Colors, Fonts, MaxContentWidth, playerColor, Spacing, Typography } from '@/constants/theme';

/** Ce que l'écran des amis proposera (affiché en attendant, sans promesse de date). */
const COMING = [
  'Ajouter tes amis par leur pseudo',
  'Les inviter directement dans ta room',
  'Un classement rien qu’entre vous',
];

/**
 * Amis : écran provisoire, dans la DA, en attendant le système d'amis
 * (demandes, liste, invitation dans une room, classement entre amis).
 */
export default function FriendsScreen() {
  const edges = useScreenEdges();
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titles}>
            <Text style={Typography.title} accessibilityRole="header">
              Amis
            </Text>
            <Text style={styles.tagline}>Seul on va vite, entre amis on saute plus loin.</Text>
          </View>
          <ProfileButton />
        </View>
        <DrawnCard contentStyle={styles.card}>
          <FriendsIcon size={88} />
          <Text style={[Typography.heading, styles.center]} accessibilityRole="header">
            Les amis arrivent bientôt
          </Text>
          <Text style={[Typography.body, styles.center]}>
            Encore un peu de patience : bientôt, tu retrouveras ici les joueurs avec qui tu aimes partager le plateau.
          </Text>
          <View style={styles.list} accessibilityRole="list">
            {COMING.map((item, index) => (
              <View key={item} style={styles.item}>
                <View style={[styles.bullet, { backgroundColor: playerColor(index).piece }]} />
                <Text style={[Typography.body, styles.flex]}>{item}</Text>
              </View>
            ))}
          </View>
        </DrawnCard>
      </ScrollView>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  titles: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  tagline: {
    ...Typography.body,
    fontFamily: Fonts.semibold,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
  list: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Puce : un petit pion pastel au trait noir.
  bullet: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.ink,
  },
  flex: {
    flex: 1,
  },
});
