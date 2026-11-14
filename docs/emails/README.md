# Modèles d'e-mails (Supabase Auth)

À coller dans le tableau de bord Supabase, *Authentication → Email Templates* (onglet de chaque modèle :
sujet, puis corps en HTML). Ils sont en français, dans la DA de l'application (trait noir, bouton pastel).

| Modèle Supabase | Fichier | Sujet |
| --------------- | ------- | ----- |
| Confirm signup | `confirmation.html` | Confirme ton compte Halma |
| Change Email Address | `changement-email.html` | Confirme l’adresse de ton compte Halma |
| Reset Password | `reinitialisation.html` | Ton nouveau mot de passe Halma |

## Pourquoi ces liens et pas `{{ .ConfirmationURL }}`

Le lien mène **directement à l'application** : `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=…`.

- `{{ .RedirectTo }}` est l'adresse passée par l'application : `halma://auth/confirmed` ou
  `halma://reset-password` sur mobile, `https://<site>/auth/confirmed` ou `https://<site>/reset-password` sur le
  web. Si elle n'est pas dans la liste des *Redirect URLs*, Supabase la remplace par la *Site URL*.
- L'application vérifie le jeton elle-même (`auth.verifyOtp`). Rien n'est consommé quand un antivirus ou une
  messagerie « visite » le lien pour l'analyser : seule l'application, une fois ouverte, valide le jeton.
- Contrairement au flux PKCE, le lien marche sur n'importe quel appareil, pas seulement celui qui a fait la demande.

Avec les modèles par défaut de Supabase (`{{ .ConfirmationURL }}`), l'application fonctionne aussi (jetons du flux
implicite après « # »), mais le jeton est consommé dès la première visite du lien.

Les paramètres sont séparés par `&amp;` dans le HTML (c'est la façon correcte d'écrire « & » dans un attribut).
