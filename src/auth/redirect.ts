import { Platform } from 'react-native';

import { authRedirectUrl, type AuthLinkPath } from './auth-links';

/** Adresse de redirection des e-mails pour cette plateforme : halma://… sur mobile, la route web sur le web. */
export function redirectUrl(path: AuthLinkPath): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null;
  return authRedirectUrl(path, Platform.OS === 'web' ? 'web' : 'native', origin);
}
