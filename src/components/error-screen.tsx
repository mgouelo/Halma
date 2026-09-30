import { router, type ErrorBoundaryProps } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Colors, MaxContentWidth, playerColor, Spacing, Stroke, Typography } from '@/constants/theme';

import { DrawnButton } from './drawn-button';
import { DrawnCard } from './drawn-card';

/** Pion tombé de travers, au trait : l'illustration de l'écran d'erreur. */
function FallenPion() {
  return (
    <Svg width={96} height={72} viewBox="0 0 96 72" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M8 62 H88" stroke={Colors.ink} strokeWidth={Stroke.bold} strokeLinecap="round" />
      <Circle cx={52} cy={42} r={16} fill={Colors.ink} />
      <Circle cx={48} cy={38} r={16} fill={playerColor(0).piece} stroke={Colors.ink} strokeWidth={Stroke.bold} />
      <Path d="M20 20 l6 6 M26 20 l-6 6 M72 12 l6 6 M78 12 l-6 6" stroke={Colors.ink} strokeWidth={Stroke.regular} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Écran de secours de toute l'application (exporté par src/app/_layout.tsx
 * comme `ErrorBoundary` d'Expo Router) : une erreur inattendue dans un écran
 * n'affiche plus un écran blanc, mais ceci, avec de quoi repartir.
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const goHome = () => {
    try {
      router.replace('/');
    } catch {
      // Navigation indisponible : « Réessayer » suffit.
    }
    retry();
  };
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <DrawnCard contentStyle={styles.card}>
          <FallenPion />
          <Text style={[Typography.title, styles.center]} accessibilityRole="header">
            Oups, un pion est tombé
          </Text>
          <Text style={[Typography.body, styles.center]}>
            Quelque chose s’est mal passé dans l’application. Tes parties en ligne sont enregistrées sur le serveur :
            tu peux réessayer ou revenir à l’accueil.
          </Text>
          {__DEV__ && <Text style={[Typography.caption, styles.center]}>{error.message}</Text>}
          <View style={styles.actions}>
            <DrawnButton label="Réessayer" onPress={() => retry()} color={playerColor(1).piece} />
            <DrawnButton label="Retour à l’accueil" size="small" onPress={goHome} />
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
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
  },
  card: {
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    gap: Spacing.three,
  },
});
