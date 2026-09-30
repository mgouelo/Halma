import { LegalScreen } from '@/components/legal-screen';
import { TERMS } from '@/legal/terms';

/** Conditions d'utilisation (brouillon à faire relire). */
export default function TermsScreen() {
  return <LegalScreen doc={TERMS} />;
}
