import { LegalScreen } from '@/components/legal-screen';
import { useLanguage } from '@/i18n';
import { TERMS_DOCS } from '@/legal/terms';

/** Conditions d'utilisation, dans la langue active. */
export default function TermsScreen() {
  return <LegalScreen doc={TERMS_DOCS[useLanguage()]} />;
}
