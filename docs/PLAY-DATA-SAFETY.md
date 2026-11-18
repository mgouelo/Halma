# Play Console : formulaire « Sécurité des données »

Récapitulatif établi à partir de la politique de confidentialité (`src/legal/privacy.ts`, version du
18 novembre 2026) et du code. À remplir dans Play Console → Contenu de l'appli → Sécurité des données.
Les réponses doivent rester identiques à la politique : si l'une des deux change, mettre l'autre à jour.

## 1. Collecte et partage

| Question | Réponse |
|---|---|
| Votre appli collecte-t-elle ou partage-t-elle des types de données utilisateur obligatoires ? | **Oui** |
| Toutes les données collectées sont-elles chiffrées en transit ? | **Oui** (HTTPS/TLS vers Supabase, le site et les Edge Functions) |
| Proposez-vous aux utilisateurs un moyen de demander la suppression de leurs données ? | **Oui** : bouton « Supprimer mon compte » dans le profil (immédiat, définitif) et demande par e-mail à contact@halma-game.com |

**Partage** : à répondre **Non** pour tous les types. Pour Google, « partager » veut dire transmettre à un
tiers pour son propre usage. Supabase (hébergement) et Brevo (e-mails du service) agissent pour ton
compte comme prestataires techniques : ce n'est pas du partage. Les autres joueurs voient ton pseudo et
ton avatar dans l'app, mais ce n'est pas non plus un partage avec un tiers. Il n'y a ni publicité, ni
revente, ni outil de mesure d'audience (voir la politique, « Ce que nous ne faisons pas »).

**Traitement éphémère** : non (les données sont conservées tant que le compte existe).

## 2. Types de données à cocher

| Catégorie Google | Type | Collecté | Partagé | Facultatif ou obligatoire | Finalités |
|---|---|---|---|---|---|
| Informations personnelles | **Adresse e-mail** | Oui | Non | Facultatif (jeu en invité possible) | Fonctionnalités de l'appli, Gestion du compte |
| Informations personnelles | **Nom** (le pseudo : pour Google, « Nom » inclut le surnom) | Oui | Non | Facultatif | Fonctionnalités de l'appli, Gestion du compte |
| Informations personnelles | **ID utilisateur** (identifiant technique du compte, y compris celui d'un invité) | Oui | Non | Facultatif | Fonctionnalités de l'appli, Gestion du compte |
| Activité dans l'appli | **Interactions avec l'appli** (parties en ligne, coups, victoires, série de connexion, amis, présence en room) | Oui | Non | Facultatif | Fonctionnalités de l'appli |
| Activité dans l'appli | **Autre contenu généré par les utilisateurs** (avatar composé dans l'éditeur ; la langue de l'appli y est rattachée, car elle sert à écrire les e-mails du compte) | Oui | Non | Facultatif | Fonctionnalités de l'appli, Personnalisation |
| Identifiants de l'appareil ou autres | **Adresse IP** (journaux techniques de Supabase, mentionnés dans la politique) | Oui | Non | Obligatoire (inhérent à toute connexion) | Sécurité, prévention de la fraude et conformité |

Tout le reste est à laisser **non coché** : position, contacts, photos et vidéos, fichiers, audio,
messages (il n'y a ni chat ni message libre), informations financières, santé et forme, historique de
navigation web, plantages et diagnostics (aucun outil de rapport de plantage), identifiant publicitaire.

## 3. Sécurité

- Données chiffrées en transit : **oui**.
- Suppression possible : **oui** (voir plus haut).
- Examen de sécurité indépendant : **non**.
- Respect de la politique Familles de Google Play : **non applicable** (public cible 16 ans et plus).

## 4. Autres formulaires qui doivent rester cohérents

- **URL de la politique de confidentialité** : `https://halma-game.com/privacy`.
- **Suppression de compte** (Contenu de l'appli → Suppression des données) : l'app permet la suppression
  dans le profil. Google demande aussi une adresse web qui explique comment faire :
  `https://halma-game.com/privacy` (section « Vos droits ») convient, ou une page dédiée si tu en crées une.
- **Public cible** : 16-17 et 18 ans et plus (politique : 15 ans minimum pour créer un compte).
- **Annonces** : aucune. **Achats intégrés** : aucun.

## Points à vérifier

1. **Adresse IP** : elle apparaît dans les journaux de Supabase et dans les journaux de Cloudflare (site). La
   déclarer est la réponse la plus sûre, puisque la politique la mentionne. L'ôter ne serait justifiable que si
   tu estimes que Google ne l'exige pas pour ce cas ; en cas de doute, déclare-la.
2. **Statut de prestataire** : Supabase, Brevo et Cloudflare doivent rester des prestataires qui traitent les
   données uniquement pour toi. Si tu ajoutes un jour un outil de mesure d'audience ou de la publicité,
   il faudra repasser sur ce formulaire.
3. **Comptes invités** : ils reçoivent un identifiant technique automatique, d'où « ID utilisateur » même sans
   e-mail. Le pseudo, lui, relève de « Nom » (définition de Google : prénom, nom ou surnom).
