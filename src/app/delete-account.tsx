import { LegalScreen } from '@/components/legal-screen';
import { useLanguage } from '@/i18n';
import { DELETE_ACCOUNT_DOCS } from '@/legal/delete-account';

/** Comment supprimer son compte et ses données, dans la langue active (adresse demandée par Google Play). */
export default function DeleteAccountScreen() {
  return <LegalScreen doc={DELETE_ACCOUNT_DOCS[useLanguage()]} />;
}
