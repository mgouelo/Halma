<!-- FICHIER GÉNÉRÉ par scripts/email-templates.cjs : ne pas le modifier à la main. -->

# Sujets des e-mails multilingues

À coller dans le champ *Subject* de chaque modèle (*Authentication → Email Templates*). Si l’e-mail reçu
affiche ce code au lieu du texte, utiliser le sujet de secours, en deux langues. Voir docs/emails/README.md.

## Confirm signup (confirmation.html)

```
{{ if eq (printf "%v" .Data.language) "en" }}Confirm your Halma account{{ else if eq (printf "%v" .Data.language) "de" }}Bestätige dein Halma-Konto{{ else if eq (printf "%v" .Data.language) "es" }}Confirma tu cuenta de Halma{{ else }}Confirme ton compte Halma{{ end }}
```

Secours : Confirme ton compte Halma · Confirm your Halma account

## Change Email Address (changement-email.html)

```
{{ if eq (printf "%v" .Data.language) "en" }}Confirm the address of your Halma account{{ else if eq (printf "%v" .Data.language) "de" }}Bestätige die Adresse deines Halma-Kontos{{ else if eq (printf "%v" .Data.language) "es" }}Confirma la dirección de tu cuenta de Halma{{ else }}Confirme l’adresse de ton compte Halma{{ end }}
```

Secours : Confirme l’adresse de ton compte Halma · Confirm the address of your Halma account

## Reset Password (reinitialisation.html)

```
{{ if eq (printf "%v" .Data.language) "en" }}Your new Halma password{{ else if eq (printf "%v" .Data.language) "de" }}Dein neues Halma-Passwort{{ else if eq (printf "%v" .Data.language) "es" }}Tu nueva contraseña de Halma{{ else }}Ton nouveau mot de passe Halma{{ end }}
```

Secours : Ton nouveau mot de passe Halma · Your new Halma password
