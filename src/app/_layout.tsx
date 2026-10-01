import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider } from '@/auth/auth-context';
import { Colors } from '@/constants/theme';
import { useAppFonts } from '@/hooks/use-app-fonts';
// Avant le routeur : garde du retour du navigateur pendant une partie locale (web).
import '@/navigation/web-back-guard';

// L'écran de démarrage reste affiché jusqu'au chargement de la police.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Écran de secours en cas d'erreur inattendue dans n'importe quel écran. */
export { ErrorScreen as ErrorBoundary } from '@/components/error-screen';

export default function RootLayout() {
  const fontsReady = useAppFonts();
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);
  if (!fontsReady) return null;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.paper },
        }}>
        {/* Accueil, jouer en ligne, profil, classements : avec la barre de navigation du bas. */}
        <Stack.Screen name="(main)" options={{ title: 'Halma' }} />
        {/* Par-dessus, sans la barre : parties et rooms. */}
        <Stack.Screen name="game" options={{ title: 'Partie' }} />
        <Stack.Screen name="room/[id]" options={{ title: 'Room' }} />
        {/* Par-dessus aussi, sans la barre, avec un bouton « ‹ Retour » : comptes, avatar, informations. */}
        <Stack.Screen name="sign-in" options={{ title: 'Connexion' }} />
        <Stack.Screen name="sign-up" options={{ title: 'Inscription' }} />
        <Stack.Screen name="upgrade" options={{ title: 'Créer mon compte' }} />
        <Stack.Screen name="avatar" options={{ title: 'Ton avatar' }} />
        <Stack.Screen name="credits" options={{ title: 'Crédits et licences' }} />
        <Stack.Screen name="privacy" options={{ title: 'Politique de confidentialité' }} />
        <Stack.Screen name="terms" options={{ title: 'Conditions d’utilisation' }} />
      </Stack>
    </AuthProvider>
  );
}
