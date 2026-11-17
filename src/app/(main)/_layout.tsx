import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NavBar } from '@/components/nav-bar/nav-bar';
import { NavBarContext } from '@/components/nav-bar/screen-edges';
import { Colors } from '@/constants/theme';

/**
 * Écrans avec la barre de navigation du bas : accueil, jouer en ligne, réglage
 * des parties hors ligne, amis et classements. Les parties, les rooms, le
 * profil, les écrans de compte (connexion, inscription, création de compte,
 * avatar) et les pages d'information (crédits, confidentialité, conditions)
 * sont dans la pile principale, par-dessus : pas de barre, seulement un bouton
 * « ‹ Retour ».
 */
export default function MainLayout() {
  const [barHeight, setBarHeight] = useState(0);
  return (
    <View style={styles.screen}>
      <NavBarContext.Provider value={barHeight}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.paper },
          }}>
          <Stack.Screen name="index" options={{ title: 'Halma' }} />
          <Stack.Screen name="online" options={{ title: 'Jouer en ligne' }} />
          <Stack.Screen name="ai-setup" options={{ title: 'Jouer contre l’IA' }} />
          <Stack.Screen name="local-setup" options={{ title: 'Entre amis' }} />
          <Stack.Screen name="friends" options={{ title: 'Amis' }} />
          <Stack.Screen name="leaderboard" options={{ title: 'Classements' }} />
        </Stack>
      </NavBarContext.Provider>
      {/* Posée par-dessus le contenu, fond transparent : on voit défiler les écrans dessous. */}
      <NavBar onHeight={setBarHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
});
