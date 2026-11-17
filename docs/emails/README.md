# Modèles d'e-mails (Supabase Auth)

À coller dans le tableau de bord Supabase, *Authentication → Email Templates* (onglet de chaque modèle :
sujet, puis corps en HTML). Ils sont en français, dans la DA de l'application (trait noir, bouton pastel).

| Modèle Supabase | Fichier | Sujet |
| --------------- | ------- | ----- |
| Confirm signup | `confirmation.html` | Confirme ton compte Halma |
| Change Email Address | `changement-email.html` | Confirme l’adresse de ton compte Halma |
| Reset Password | `reinitialisation.html` | Ton nouveau mot de passe Halma |

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
