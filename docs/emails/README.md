# Modèles d'e-mails (Supabase Auth)

À coller dans le tableau de bord Supabase, *Authentication → Email Templates* (onglet de chaque modèle :
sujet, puis corps en HTML). Dans la DA de l'application (trait noir, bouton pastel), en quatre langues :
français, anglais, allemand et espagnol.

**À coller dans Supabase : les fichiers de `multilingue/`** (un seul modèle par type d'e-mail, qui contient les
quatre langues), et les sujets de `multilingue/sujets.md`.

| Modèle Supabase | À coller | Sources (une par langue) |
| --------------- | -------- | ------------------------ |
| Confirm signup | `multilingue/confirmation.html` | `confirmation.html` (fr), `confirmation.en.html`, `.de.html`, `.es.html` |
| Change Email Address | `multilingue/changement-email.html` | `changement-email.html` (fr), `changement-email.en.html`, `.de.html`, `.es.html` |
| Reset Password | `multilingue/reinitialisation.html` | `reinitialisation.html` (fr), `reinitialisation.en.html`, `.de.html`, `.es.html` |

Le sujet de chaque langue est noté dans le commentaire de tête de sa source (`Sujet : « … »`).

## Une langue par joueur, avec un seul modèle

Supabase n'a qu'un modèle par type d'e-mail, sans réglage de langue. La solution retenue, la plus simple qui
reste fiable :

1. **L'application garde la langue du joueur dans les métadonnées de son compte** (`user_metadata.language` :
   `fr`, `en`, `de` ou `es`), les seules données du compte que les modèles savent lire (`{{ .Data }}`) :
   - à l'inscription (`signUp`, `options.data.language`) et à la connexion invité (`signInAnonymously`) :
     l'e-mail de confirmation part déjà dans la bonne langue ;
   - ensuite, chaque fois que la langue affichée diffère de celle du compte (choix dans le sélecteur, ou
     langue de l'appareil) : `auth.updateUser({ data: { language } })`, plus la colonne `profiles.language`
     (fonction `set_my_language`, migration `profile_language`). Voir `AuthProvider` (src/auth/auth-context.tsx).
2. **Le modèle choisit la branche de la langue** avec les Go templates de Supabase :

   ```
   {{- $lang := printf "%v" .Data.language -}}
   {{- if eq $lang "en" }} … anglais … {{- else if eq $lang "de" }} … {{- else if eq $lang "es" }} …
   {{- else }} … français … {{- end }}
   ```

   `printf "%v"` transforme toujours la valeur en texte : une métadonnée absente (compte créé avant cette
   version, application pas à jour) ne casse pas le modèle et donne le **français**, la langue par défaut.
3. **Les fichiers `multilingue/` sont générés** à partir des sources : après une modification d'une source,
   lancer `node scripts/email-templates.cjs` puis recoller le modèle dans Supabase. Un test
   (`src/i18n/__tests__/email-templates.test.ts`) vérifie qu'ils sont à jour et que les quatre langues ont les
   mêmes liens et les mêmes variables.

### Limites (à connaître)

- **Le sujet.** Le champ *Subject* accepte les variables d'après la documentation de Supabase (son exemple :
  `{{ .Token }} is your verification code`) : `multilingue/sujets.md` donne un sujet multilingue sur le même
  principe. Ce n'est pas documenté pour `.Data` en particulier : **envoyer un e-mail de test** après l'avoir
  collé. Si le sujet reçu montre le code, utiliser le sujet de secours bilingue (« … · … ») du même fichier.
- **La langue enregistrée est la dernière vue par le joueur** sur un appareil connecté (choix explicite ou
  langue de l'appareil). Un joueur qui change de langue sans être connecté (« Mot de passe oublié » depuis
  l'écran de connexion) reçoit l'e-mail dans la langue de son compte, pas forcément celle de l'écran.
- **Comptes existants** : tant que le joueur n'a pas ouvert la nouvelle version de l'application connecté,
  ses e-mails restent en français.
- **Pas vérifié en local** : les modèles ne passent pas par le moteur de Supabase dans les tests (pas de Go
  dans le projet). La syntaxe est volontairement minimale (`printf`, `eq`, `if / else if / else / end`), mais
  **tester les quatre langues** une fois collés (compte de test, langue choisie dans le profil, puis « Mot de
  passe oublié »).
- Le nom de l'expéditeur (réglage SMTP, Brevo) n'est pas traduit : « Halma » convient à toutes les langues.

## Pourquoi ces liens et pas `{{ .ConfirmationURL }}`

Le lien mène **directement à l'écran du lien** : `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=…`.

- `{{ .RedirectTo }}` est l'adresse passée par l'application : la page du site,
  `https://halma-game.com/auth/confirmed` ou `https://halma-game.com/reset-password` (sur mobile avec
  `EXPO_PUBLIC_SITE_URL`, et sur le web) ; `halma://auth/confirmed` ou `halma://reset-password` sur mobile sans
  cette variable (développement). Si elle n'est pas dans la liste des *Redirect URLs*, Supabase la remplace par
  la *Site URL*.
- La page vérifie le jeton elle-même (`auth.verifyOtp`), dans le navigateur, sans l'application. Rien n'est
  consommé quand un antivirus ou une messagerie « visite » le lien pour l'analyser : seule la page, une fois
  son JavaScript exécuté, valide le jeton.
- Contrairement au flux PKCE, le lien marche sur n'importe quel appareil, pas seulement celui qui a fait la demande.

Avec les modèles par défaut de Supabase (`{{ .ConfirmationURL }}`), l'application fonctionne aussi (jetons du flux
implicite après « # »), mais le jeton est consommé dès la première visite du lien.

Les paramètres sont séparés par `&amp;` dans le HTML (c'est la façon correcte d'écrire « & » dans un attribut).
