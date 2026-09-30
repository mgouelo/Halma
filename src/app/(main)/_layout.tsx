import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { NavBar } from '@/components/nav-bar/nav-bar';
import { NavBarContext } from '@/components/nav-bar/screen-edges';
import { Colors } from '@/constants/theme';

/**
 * Écrans avec la barre de navigation du bas (accueil, profil, classements et
 * leurs sous-écrans). Les parties, les rooms et les écrans de connexion sont
 * dans la pile principale, par-dessus : la barre n'y apparaît pas.
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
          <Stack.Screen name="profile" options={{ title: 'Profil' }} />
          <Stack.Screen name="avatar" options={{ title: 'Ton avatar' }} />
          <Stack.Screen name="leaderboard" options={{ title: 'Classements' }} />
          <Stack.Screen name="credits" options={{ title: 'Crédits et licences' }} />
          <Stack.Screen name="privacy" options={{ title: 'Politique de confidentialité' }} />
          <Stack.Screen name="terms" options={{ title: 'Conditions d’utilisation' }} />
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
