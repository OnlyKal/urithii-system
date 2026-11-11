# Tests et résultats

Dernière exécution : 27 octobre 2026. **69 tests automatisés, 69 réussis** (`cd server-app && npm test`).

Les tests tournent sur une base jetable (`data/test.db`), recréée à chaque lancement. Ils refusent de démarrer en dehors de `npm test`, pour ne jamais toucher la base de travail.

## Tests automatisés de l'API (cahier des charges §86 à §89)

### Authentification et comptes
- Un visiteur accède au site sans compte, mais pas à l'administration.
- Connexion : cookie `HttpOnly` et `SameSite=Strict`, aucune empreinte de mot de passe dans les réponses.
- Même message d'erreur pour un e-mail inconnu et un mauvais mot de passe.
- Verrouillage après 5 échecs, même si le bon mot de passe est donné ensuite.
- Un compte désactivé ne peut pas se connecter ; sa désactivation ferme immédiatement ses sessions.
- Une requête venant d'une autre origine est refusée.
- La déconnexion révoque la session.
- Le mot de passe temporaire doit être changé avant tout accès aux fonctions protégées.
- Seul un détenteur de `users.manage` crée des comptes ; il n'existe pas d'inscription publique ; un rôle inconnu est refusé.
- Impossible de retirer le dernier super administrateur actif.
- Les changements de rôles sont journalisés avec l'ancien et le nouveau rôle.
- La réinitialisation du mot de passe invalide l'ancien.

### Circuit de validation et publication
- Parcours complet jusqu'à la publication, visible du public sans compte.
- Chaque étape exige la bonne permission ; une transition non prévue est refusée.
- La publication est refusée si les conditions ne sont pas réunies (résumé, source…).
- Une demande de compléments exige un motif et rend la fiche modifiable par son auteur.
- L'auteur ne peut plus modifier sa fiche une fois soumise.
- Fiche sensible : l'auteur ne peut ni la valider ni la publier lui-même.
- La publication programmée est exécutée par le planificateur ; une date passée est refusée.

### Versions et historique
- La modification d'une fiche publiée reste interne jusqu'à sa nouvelle validation ; l'historique public s'enrichit ensuite.
- Restaurer une version crée une nouvelle version sans effacer l'historique.
- Les champs spécialisés doivent correspondre à la catégorie.

### Niveaux d'accès
- Une fiche privée est invisible des autres contributeurs, dans la liste comme en accès direct.
- Accès nominatif à une fiche d'équipe.
- Une fiche publiée devenue restreinte disparaît du site et des résultats de recherche.

### Personnes ressources et données personnelles
- Un témoignage publié n'expose que le pseudonyme autorisé, jamais le nom réel ni les coordonnées.
- Les consentements ne bloquent plus la publication (décision du porteur du projet, octobre 2026) ; une source ou un témoin suffit.
- Un média « Public » est diffusé dès que sa fiche est publiée.
- API collecteur par jeton : jeton délivré (sans cookie), mauvais identifiants refusés, collecte complète sans en-tête Origin (listes, dossier, fichier, soumission), permissions du rôle respectées, cookie du site toujours protégé contre les autres origines, jeton révoqué à la déconnexion.
- Formats acceptés : MP4 en H.264 accepté, MP4 en HEVC refusé, MOV, OGG et FLAC refusés, M4A déclaré `audio/x-m4a` (Mac) accepté.
- Réseau du patrimoine : seules les communautés publiées et les fiches publiques créent des liens (langue, province, fiche partagée, fiches reliées) ; une relation vers un brouillon n'apparaît pas.
- Médiathèque publique : page de consultation avec contexte culturel, média privé introuvable et absent des médias associés, filtres par thème et par date, téléchargement refusé tant que les droits ne sont pas confirmés.
- Pour un mineur, l'accord du représentant légal est exigé.
- La révocation d'un consentement suspend immédiatement la fiche publiée ; un consentement révoqué n'est plus modifiable.
- Les données des personnes ressources et des consentements sont réservées aux permissions dédiées.

### Médias
- Téléversement : original intact, au bit près ; version web et miniature générées et reliées à l'original.
- Un fichier dont le contenu ne correspond pas à son format est refusé ; le SVG est refusé ; rien n'est conservé en cas de refus.
- Un média n'est public que s'il illustre une fiche publiée et que ses droits sont confirmés. Repassé en privé, il n'est plus accessible, même avec son adresse.
- Contrôle d'intégrité d'un média.

### Transcriptions et traductions
- La vérification doit être faite par une autre personne que l'auteur ; une nouvelle révision remet la vérification à zéro ; les permissions par type de texte sont respectées.

### Site public, signalements, exports
- Recherche insensible aux accents et aux majuscules ; filtres par thème et par communauté.
- Une communauté non publiée n'apparaît pas.
- L'accueil et les statistiques reposent sur les données réelles.
- Signalement public, puis suspension du contenu ; la fiche et ses versions restent conservées.
- L'export public ne contient que des contenus publiés ; l'export complet est réservé et ne contient aucun mot de passe.

### Permissions, missions, conservation
- Retirer une permission à un rôle prend effet immédiatement ; le super administrateur n'est pas modifiable.
- Un collecteur ne voit que ses missions ; un rapport soumis n'est plus modifiable ; seul le responsable gère la mission.
- Journal d'audit : la chaîne est valide, puis toute modification ou suppression d'une entrée est détectée.
- Stockage : l'empreinte est conservée et une corruption est détectée.
- Sauvegarde complète, vérification, test de restauration réussi, puis détection d'un fichier altéré dans la sauvegarde.

## Test de bout en bout dans un navigateur

Réalisé le 25 octobre 2026 avec Chromium (Playwright), sur une base temporaire, via l'interface réelle. **Résultat : aucune erreur JavaScript, aucune requête en échec.**

Parcours couvert : accueil public → connexion → changement du mot de passe temporaire → ouverture des 17 pages d'administration → création d'une source → publication de la communauté Havu → téléversement d'une photo, confirmation des droits et contrôle d'intégrité → création d'une fiche (champ spécialisé « Ingrédients », communauté, source, média) → six étapes de validation jusqu'à « Publié » → modification après publication et comparaison des versions → page publique (affiche toujours la version publiée), communauté, recherche, exploration par lieu, thèmes, médiathèque, à propos → envoi d'un signalement → sauvegarde et test de restauration depuis l'interface → affichage sur téléphone (sans débordement horizontal).

Deux anomalies relevées pendant ce test ont été corrigées :
- les listes déroulantes laissées vides empêchaient l'enregistrement de certains formulaires ;
- le navigateur conservait l'accueil en cache pendant 60 secondes. Les réponses publiques sont désormais revalidées à chaque requête, ce qui garantit aussi qu'un contenu retiré cesse aussitôt d'être servi (§47).

### Nouvelle interface (25 octobre 2026)
Le même parcours a été rejoué après la refonte de l'interface, complété par : le formulaire de fiche en étapes, la recherche (types de résultats, filtre par thème, absence de résultat, réinitialisation des filtres), la page Validations, la suspension d'un contenu via la boîte de dialogue de l'application, et les affichages mobile (390 px), tablette (820 px) et grand écran (1600 px). **Résultat : aucune erreur JavaScript, aucune requête en échec, aucun débordement horizontal sur mobile.**

Anomalies corrigées pendant ce test :
- une erreur sur la page de recherche lors du changement de type de résultat (données de la requête précédente réutilisées). Le chargement des données ne renvoie désormais que la réponse correspondant à la requête en cours ;
- l'icône du bouton de recherche était invisible sur mobile ;
- un avertissement React lié aux propriétés des cartes de collection.

### Audit responsive (25 octobre 2026)
40 pages, publiques et d'administration, chargées à 6 largeurs : 320, 375, 768, 1024, 1440 et 1920 px, soit 240 affichages. Contrôles automatiques : débordement horizontal, éléments sortant de l'écran hors des zones prévues pour défiler, cibles tactiles de moins de 24 px (critère WCAG 2.5.8) jusqu'à 1024 px, erreurs JavaScript. **Résultat final : 0 débordement, 0 cible trop petite, 0 erreur.**

Corrections issues de l'audit :
- à 1024 px, la barre de navigation publique dépassait de 35 px. Elle est désormais compacte entre 960 et 1199 px ;
- à 320 px, le champ de téléversement débordait ;
- sur téléphone, les tableaux de l'administration deviennent des cartes, une par ligne, chaque valeur précédée de son intitulé de colonne (composant `TableWrap`) ;
- certains liens d'action isolés et des éléments « Voir » mesuraient moins de 24 px de haut ;
- sur tablette portrait et téléphone, le panneau « Contexte » d'un contenu s'affiche avant le texte.

### Réorganisation de l'administration et multilinguisme (26 octobre 2026)
Base de test isolée (`data/e2e.db`), serveurs dédiés (API 4100, site 5190), navigateur Chromium automatisé.
- **Parcours complet rejoué** sur la nouvelle organisation : connexion, toutes les pages d'administration, source, publication de la communauté, média et intégrité, fiche créée par le parcours en étapes, circuit de validation jusqu'à la publication, révision et comparaison de versions, pages publiques, recherche, signalement et suspension, sauvegarde et test de restauration, affichages mobile, tablette et grand écran. **0 problème.**
- **Parcours administrateur** : création d'une communauté, « Documenter pour cette communauté » (communauté pré-remplie), création sur place d'une source, d'une personne ressource et d'un média, liste de contrôle, « Enregistrer et soumettre », dossier et onglets, files « À traiter », redirection de `/admin/validations`, recherche rapide, signalements dans l'espace Contenus, onglets Ressources et Paramètres, dossier de communauté.
- **Parcours contributeur (collecteur)** : la soumission reste bloquée tant que les éléments requis manquent ; après une demande de compléments de l'administrateur, la demande apparaît sur l'accueil et en tête de la fiche, le bouton principal devient « Compléter la fiche », et la fiche corrigée est resoumise. Le collecteur ne voit ni la file « À traiter » ni l'espace Paramètres.
- **Langues** : site public et administration parcourus en anglais, lingala et swahili : aucune clé manquante ; `<html lang>` et le titre suivent la langue. Les seuls textes restés en français sont des contenus saisis (noms de catégories), qui ne sont pas traduits automatiquement.
- **Audit responsive** : 43 pages à 6 largeurs, 0 débordement. Seuls les marqueurs de la carte de l'accueil sont signalés comme trop petits, parce qu'ils sont mesurés pendant leur animation d'apparition (28 px une fois affichés).

Anomalies corrigées pendant ces tests :
- la mention « Obligatoire » des champs restait en français dans les autres langues ;
- dans la barre de l'administration, la loupe recouvrait le texte de recherche et le fil d'Ariane était écrasé ;
- trop d'actions mises en avant dans le dossier d'une fiche : seule l'action qui fait avancer la fiche reste en bleu plein ;
- la liste de contrôle n'indiquait pas que la personne ressource doit avoir un consentement valide pour publier.

### Deux rôles et dossiers de collecte (26 octobre 2026)
Tests automatisés de l'API (`test/dossiers.test.js`) : étapes de référence créées et lisibles ; un collecteur ne voit que ses dossiers ; refus d'une étape inconnue ou d'un média inexistant ; communauté proposée en double refusée, création par l'administrateur seulement ; circuit complet (soumission impossible à vide, collecteur bloqué après soumission, correction ciblée avec motif obligatoire, resoumission qui remet l'étape à examiner, validation, publication réservée à l'administrateur, fiches publiées visibles du public et attribuées au collecteur, élément sensible non publié, élément sans source en attente, présentation de la communauté mise à jour, versions et historique, republication qui met à jour les mêmes fiches) ; étapes personnalisées réservées à l'administrateur.

Parcours dans le navigateur (base isolée) : l'administrateur crée un compte collecteur (type par défaut : Collecteur) ; le collecteur, avec un menu réduit à trois espaces, crée une collecte (le doublon « havu » est signalé), remplit l'identification avec un champ « inconnu », ajoute un plat, une source et une photo créées sur place, un témoignage avec personne et consentement créés sur place, consulte la bibliothèque et le récapitulatif, soumet ; l'administrateur demande une correction ciblée sur la gastronomie ; le collecteur la voit sur son accueil et dans le dossier, corrige, resoumet ; l'administrateur valide et publie (2 fiches publiées, 1 en attente faute de source, avec la raison) ; la fiche est visible sur le site public ; suivi des collecteurs et formulaire vérifiés ; affichage mobile sans débordement. **Aucune erreur.** Le parcours complet existant (fiches, médias, versions, signalements, sauvegardes) a été rejoué : **0 problème**.

Anomalie corrigée : le brouillon du commentaire de vérification d'une étape est désormais conservé par la page, d'une étape à l'autre.

### Import de communautés (26 octobre 2026)
Tests automatisés (`test/community-import.test.js`) : import réservé à l'administrateur ; l'analyse n'écrit rien ; une communauté déjà présente (même par un autre nom, sans tenir compte des majuscules) est ignorée ; entrée invalide signalée ; lieu inconnu signalé et ignoré ; langue retrouvée par son code ISO ; communauté créée non publiée, avec ses noms, lieux et langues ; import tracé dans le journal ; relancer le même import ne crée rien ; mode « compléter » qui remplit les champs vides sans rien remplacer ; fichier mal formé refusé ; doublon interne au fichier refusé.

## Ce qui n'est pas encore testé
- La charge (nombreux utilisateurs simultanés, gros volumes vidéo).
- L'analyse antivirus (ClamAV non installé sur la machine de développement).
- Le comportement sur des connexions lentes réelles et des appareils modestes.
- L'accessibilité avec un lecteur d'écran (la structure respecte les bonnes pratiques, mais aucun audit n'a été mené).
