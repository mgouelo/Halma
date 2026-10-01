import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { NavBar } from '@/components/nav-bar/nav-bar';
import { NavBarContext } from '@/components/nav-bar/screen-edges';
import { Colors } from '@/constants/theme';

/**
 * Écrans avec la barre de navigation du bas : accueil, jouer en ligne, réglage
 * des parties hors ligne, profil et classements. Les parties, les rooms, les
 * écrans de compte (connexion, inscription, création de compte, avatar) et les
 * pages d'information (crédits, confidentialité, conditions) sont dans la pile
 * principale, par-dessus : pas de barre, seulement un bouton « ‹ Retour ».
 */
export default function MainLayout() {
  return (
    <View style={styles.screen}>
      <NavBarContext.Provider value>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.paper },
          }}>
          <Stack.Screen name="index" options={{ title: 'Halma' }} />
          <Stack.Screen name="online" options={{ title: 'Jouer en ligne' }} />
          <Stack.Screen name="ai-setup" options={{ title: 'Jouer contre l’IA' }} />
          <Stack.Screen name="local-setup" options={{ title: 'Entre amis' }} />
          <Stack.Screen name="profile" options={{ title: 'Profil' }} />
          <Stack.Screen name="leaderboard" options={{ title: 'Classements' }} />
        </Stack>
      </NavBarContext.Provider>
      <NavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
});
