import { LegalScreen } from '@/components/legal-screen';
import { useLanguage } from '@/i18n';
import { PRIVACY_DOCS } from '@/legal/privacy';

/** Politique de confidentialité (brouillon à faire relire), dans la langue active. */
export default function PrivacyScreen() {
  return <LegalScreen doc={PRIVACY_DOCS[useLanguage()]} />;
}
