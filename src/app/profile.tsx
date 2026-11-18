import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { useSignOut } from '@/auth/use-sign-out';
import { AboutLinks } from '@/components/about-links';
import { Avatar } from '@/components/avatar';
import { ChangePseudo } from '@/components/change-pseudo';
import { AuthScreen, authStyles, Notice, NotConfiguredCard } from '@/components/auth-screen';
import { DrawnButton } from '@/components/drawn-button';
import { SignOutDialog } from '@/components/sign-out-dialog';
import { DeleteAccount } from '@/components/delete-account';
import { DrawnCard } from '@/components/drawn-card';
import { ProfileStats } from '@/components/profile-stats';
import { ResendEmailButton } from '@/components/resend-email-button';
import { ErrorState, LoadingState } from '@/components/state-view';
import { LanguagePicker } from '@/components/language-picker';
import { playerColor, Typography } from '@/constants/theme';
import { useT } from '@/i18n';

/**
 * Profil du joueur connecté, invité compris : avatar, pseudo (et son
 * changement), type de compte, statistiques, suppression du compte. Un invité y
 * trouve aussi l'invitation à créer son compte (même identifiant : sa
 * progression est conservée). Ouvert par l'avatar en haut à droite des écrans
 * de la barre : écran sans barre, avec un seul bouton « ‹ Retour ».
 */
export default function ProfileScreen() {
  const t = useT();
  const { configured, loading, session, profile, isGuest, pendingEmail, profileError, refreshProfile } = useAuth();
  const signOut = useSignOut(isGuest);

  if (!configured) {
    return (
      <AuthScreen header="back" title={t('profile.title')} subtitle={t('common.accountsUnavailable')}>
        <NotConfiguredCard />
        <LanguagePicker />
        <AboutLinks />
      </AuthScreen>
    );
  }
  if (!loading && !session) {
    return (
      <AuthScreen header="back" title={t('profile.title')} subtitle={t('common.notSignedIn')}>
        <DrawnButton label={t('common.signIn')} onPress={() => router.push('/sign-in')} />
        <LanguagePicker />
        <AboutLinks />
      </AuthScreen>
    );
  }
  return (
    <AuthScreen
      header="back"
      title={t('profile.title')}
      subtitle={isGuest ? t('profile.guestAccount') : t('profile.emailAccount')}>
      {profile ? (
        <DrawnCard contentStyle={[authStyles.card, styles.card]}>
          <Avatar value={profile.avatar} seed={profile.id} size={144} accessibilityLabel={t('profile.avatarOf', { name: profile.pseudo })} />
          <Text style={Typography.title}>{profile.pseudo}</Text>
          <ChangePseudo profile={profile} onChanged={refreshProfile} />
          <DrawnButton
            label={profile.avatar ? t('profile.editAvatar') : t('profile.createAvatar')}
            onPress={() => router.push('/avatar')}
            color={playerColor(0).piece}
          />
          {!profile.avatar && (
            <Text style={[Typography.caption, authStyles.center]}>{t('profile.randomAvatar')}</Text>
          )}
        </DrawnCard>
      ) : profileError ? (
        <ErrorState
          title={t('profile.unavailable')}
          message={t('profile.readFailed')}
          onRetry={refreshProfile}
        />
      ) : (
        <LoadingState label={t('profile.loading')} />
      )}
      {isGuest && (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.heading} accessibilityRole="header">
            {t('profile.keepProgress')}
          </Text>
          {pendingEmail ? (
            <>
              <Text style={Typography.body}>{t('profile.confirmationSent', { email: pendingEmail })}</Text>
              <ResendEmailButton type="email_change" email={pendingEmail} />
            </>
          ) : (
            <>
              <Text style={Typography.body}>{t('profile.guestText')}</Text>
              <DrawnButton
                label={t('common.createMyAccount')}
                onPress={() => router.push('/upgrade')}
                color={playerColor(1).piece}
              />
            </>
          )}
        </DrawnCard>
      )}
      {session && <ProfileStats userId={session.user.id} />}
      {session && (
        <DrawnCard contentStyle={authStyles.card}>
          <Text style={Typography.heading} accessibilityRole="header">
            {t('profile.account')}
          </Text>
          {signOut.error && <Notice>{signOut.error}</Notice>}
          <DrawnButton
            label={signOut.pending ? t('profile.signingOut') : t('profile.signOut')}
            busy={signOut.pending}
            onPress={signOut.request}
            accessibilityHint={isGuest ? t('profile.guestSignOutHint') : undefined}
          />
          {profile && <DeleteAccount pseudo={profile.pseudo} isGuest={isGuest} />}
        </DrawnCard>
      )}
      <LanguagePicker />
      <SignOutDialog controller={signOut} />
      <AboutLinks />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
  },
});
