import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { AuthProvider } from '@/auth/auth-context';
import { PageHead } from '@/components/page-head';
import { Colors } from '@/constants/theme';
import { useAppFonts } from '@/hooks/use-app-fonts';
import { loadLanguagePreference, refreshDeviceLanguage, useLanguage, useLanguageReady, useT } from '@/i18n';
// Avant le routeur : garde du retour du navigateur pendant une partie locale (web).
import '@/navigation/web-back-guard';

// L'écran de démarrage reste affiché jusqu'au chargement de la police et de la langue choisie.
SplashScreen.preventAutoHideAsync().catch(() => {});
void loadLanguagePreference();

/** Écran de secours en cas d'erreur inattendue dans n'importe quel écran. */
export { ErrorScreen as ErrorBoundary } from '@/components/error-screen';

/**
 * Web : `<html lang>` suit la langue active (le HTML exporté est en français),
 * pour les lecteurs d'écran et la traduction automatique du navigateur.
 * Mobile : la langue de l'appareil est relue au retour au premier plan
 * (Android permet de la changer sans relancer l'application).
 */
function useDocumentLanguage() {
  const language = useLanguage();
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshDeviceLanguage();
    });
    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  const t = useT();
  const fontsReady = useAppFonts();
  const languageReady = useLanguageReady();
  const ready = fontsReady && languageReady;
  useDocumentLanguage();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;

  return (
    <AuthProvider>
      {/* Titre et description par défaut des pages web (chaque écran peut les remplacer). */}
      <PageHead />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.paper },
        }}>
        {/* Accueil, amis, classements : avec la barre de navigation du bas. */}
        <Stack.Screen name="(main)" options={{ title: t('common.appName') }} />
        {/* Par-dessus, sans la barre : lancer une partie (en ligne, contre l'IA, entre amis), parties et rooms. */}
        <Stack.Screen name="online" options={{ title: t('page.online') }} />
        <Stack.Screen name="ai-setup" options={{ title: t('page.aiSetup') }} />
        <Stack.Screen name="local-setup" options={{ title: t('page.localSetup') }} />
        <Stack.Screen name="game" options={{ title: t('page.game') }} />
        <Stack.Screen name="room/[id]" options={{ title: t('page.room') }} />
        <Stack.Screen name="matchmaking" options={{ title: t('page.matchmaking') }} />
        {/* Par-dessus aussi, sans la barre, avec un bouton « ‹ Retour » : profils, comptes, avatar, informations. */}
        <Stack.Screen name="profile" options={{ title: t('page.profile') }} />
        <Stack.Screen name="player/[id]" options={{ title: t('page.player') }} />
        <Stack.Screen name="sign-in" options={{ title: t('page.signIn') }} />
        <Stack.Screen name="sign-up" options={{ title: t('page.signUp') }} />
        <Stack.Screen name="upgrade" options={{ title: t('page.upgrade') }} />
        <Stack.Screen name="forgot-password" options={{ title: t('page.forgotPassword') }} />
        <Stack.Screen name="reset-password" options={{ title: t('page.resetPassword') }} />
        <Stack.Screen name="auth/confirmed" options={{ title: t('page.confirmed') }} />
        <Stack.Screen name="avatar" options={{ title: t('page.avatar') }} />
        <Stack.Screen name="credits" options={{ title: t('page.credits') }} />
        <Stack.Screen name="privacy" options={{ title: t('page.privacy') }} />
        <Stack.Screen name="terms" options={{ title: t('page.terms') }} />
        <Stack.Screen name="delete-account" options={{ title: t('page.deleteAccount') }} />
      </Stack>
    </AuthProvider>
  );
}
