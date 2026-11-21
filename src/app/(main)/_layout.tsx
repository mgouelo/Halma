import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NavBar } from '@/components/nav-bar/nav-bar';
import { NavBarContext } from '@/components/nav-bar/screen-edges';
import { Colors } from '@/constants/theme';
import { useT } from '@/i18n';

/**
 * Écrans avec la barre de navigation du bas : accueil, amis et classements.
 * Tout le reste est dans la pile principale, par-dessus : jouer en ligne, le
 * réglage des parties hors ligne, les parties, les rooms, le profil, les
 * écrans de compte (connexion, inscription, création de compte, avatar) et les
 * pages d'information (crédits, confidentialité, conditions) n'ont pas de
 * barre, seulement un bouton « ‹ Retour » ou « ‹ Accueil ».
 */
export default function MainLayout() {
  const t = useT();
  const [barHeight, setBarHeight] = useState(0);
  return (
    <View style={styles.screen}>
      <NavBarContext.Provider value={barHeight}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.paper },
          }}>
          <Stack.Screen name="index" options={{ title: t('common.appName') }} />
          <Stack.Screen name="friends" options={{ title: t('page.friends') }} />
          <Stack.Screen name="leaderboard" options={{ title: t('page.leaderboard') }} />
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
