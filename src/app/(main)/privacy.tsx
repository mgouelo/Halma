import { LegalScreen } from '@/components/legal-screen';
import { PRIVACY } from '@/legal/privacy';

/** Politique de confidentialité (brouillon à faire relire). */
export default function PrivacyScreen() {
  return <LegalScreen doc={PRIVACY} />;
}
