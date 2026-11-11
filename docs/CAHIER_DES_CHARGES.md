# URITHI
## CAHIER DES CHARGES FONCTIONNEL, TECHNIQUE ET ÉDITORIAL
### Plateforme web nationale de documentation, de préservation et de transmission du patrimoine culturel de la République démocratique du Congo

**Nom officiel du projet :** URITHI  
**Signification :** héritage en swahili  
**Pays de lancement :** République démocratique du Congo  
**Nature :** plateforme web, bibliothèque numérique, encyclopédie culturelle et système d'archivage patrimonial  
**Public cible :** tous les habitants de la RDC et toute personne intéressée par les cultures congolaises  
**Accès public :** gratuit, sans obligation de créer un compte  
**Contribution :** réservée aux personnes auxquelles l'administrateur a accordé un compte  
**Première communauté pilote :** Havu  
**Vision à long terme :** préserver et transmettre le patrimoine culturel congolais aux générations futures, notamment en 2100, en 2126 et au-delà.

---

# PARTIE I — INSTRUCTIONS GÉNÉRALES À CODEX

## 1. Ton rôle

Tu es un ingénieur logiciel senior, architecte de systèmes, spécialiste des plateformes documentaires, de la gestion des contenus numériques, de la sécurité informatique et de la conservation des archives numériques.

Ta mission consiste à concevoir et à développer URITHI, une plateforme web complète, évolutive, sécurisée et durable destinée à documenter le patrimoine culturel de la RDC.

Tu dois travailler comme si tu participais à la construction d'une infrastructure numérique culturelle nationale, et non d'un simple site vitrine.

Le résultat attendu est une véritable plateforme fonctionnelle, administrable, extensible et prête à accueillir progressivement les contenus des communautés congolaises.

## 2. Règles de travail obligatoires

Avant toute modification :

1. Examine l'environnement de développement et les fichiers disponibles.
2. Si un projet existe déjà, identifie son architecture, ses technologies, ses fonctionnalités, ses conventions et ses éventuelles contraintes.
3. Si le projet existe, conserve les fonctionnalités opérationnelles et évite toute réécriture inutile.
4. Si aucun projet n'existe, propose une architecture adaptée à une plateforme documentaire de cette ampleur.
5. Identifie les dépendances, les exigences d'hébergement, les besoins de stockage et les risques techniques.
6. Prépare un plan de développement par phases.
7. Implémente les fonctionnalités progressivement, en privilégiant la qualité, la sécurité et la maintenabilité.
8. Écris et exécute les tests nécessaires.
9. Documente les fonctionnalités, les procédures d'installation, la configuration et les sauvegardes.
10. Ne prétends jamais qu'une fonctionnalité est opérationnelle si elle n'a pas été développée et vérifiée.

Ne supprime aucune donnée existante, ne réinitialise aucune base de données et n'effectue aucune migration destructive sans justification technique et autorisation explicite.

Ne remplace pas une fonctionnalité réelle par une simple maquette, des données fictives présentées comme authentiques ou des boutons sans action.

Lorsque des informations techniques manquent, examine d'abord le projet et formule des recommandations. Ne prends pas de décision destructive sur la base d'une supposition.

Le nom officiel à utiliser partout est **URITHI** : interface, titres, documentation, paramètres, identité visuelle et nouveaux éléments du projet.

---

# PARTIE II — VISION ET OBJECTIFS

## 3. Présentation générale

URITHI est une plateforme web dont la mission est de collecter, documenter, organiser, préserver et transmettre le patrimoine culturel des communautés de la République démocratique du Congo.

Le projet part d'un constat : de nombreuses connaissances culturelles sont transmises oralement, parfois uniquement par les anciens. Certaines traditions, histoires, expressions, recettes, danses et techniques risquent de disparaître lorsque les personnes qui les détiennent ne peuvent plus les transmettre.

URITHI doit contribuer à prévenir cette perte en constituant une mémoire numérique structurée, accessible et documentée.

La plateforme ne doit pas se limiter à des descriptions générales. Elle doit permettre de découvrir les cultures en profondeur grâce à des textes détaillés, des photographies, des vidéos, des enregistrements sonores, des témoignages, des documents historiques et des explications pédagogiques.

L'objectif est qu'une personne qui ne connaît absolument rien d'une communauté puisse apprendre progressivement son histoire, ses pratiques, ses langues, ses traditions, sa gastronomie, ses arts et son mode de vie.

## 4. Objectifs principaux

URITHI doit permettre de :

- Préserver le patrimoine culturel matériel et immatériel de la RDC.
- Documenter progressivement les différentes communautés du pays.
- Enregistrer la mémoire des anciens et des personnes détentrices de savoirs.
- Conserver les langues, expressions, contes, récits et traditions orales.
- Expliquer les pratiques culturelles en français accessible.
- Conserver les mots et expressions dans leurs langues d'origine lorsque cela est pertinent.
- Documenter les variantes d'une même pratique selon les localités, les familles, les générations ou les groupes.
- Mettre à disposition des archives photographiques, audiovisuelles et documentaires.
- Permettre aux contenus d'évoluer au fil des recherches et des contributions autorisées.
- Préserver les sources, les droits, les consentements et l'historique des modifications.
- Faciliter les recherches des élèves, étudiants, enseignants, chercheurs et du grand public.
- Constituer une base de travail crédible pour de futurs partenariats avec des universités, des chercheurs, des institutions culturelles et les ministères concernés.

## 5. Principes fondamentaux

Toute la plateforme doit respecter les principes suivants :

**Accessibilité :** les visiteurs consultent gratuitement les contenus publics sans compte.

**Authenticité :** les informations doivent être fondées sur des témoignages, des documents ou des sources identifiables.

**Respect :** les communautés doivent être présentées avec dignité, sans stéréotypes ni généralisation abusive.

**Traçabilité :** chaque contenu doit avoir une provenance documentée.

**Évolution :** les connaissances peuvent être corrigées, complétées ou réinterprétées.

**Conservation :** les documents originaux et leurs métadonnées doivent être préservés aussi durablement que possible.

**Responsabilité :** les contenus sensibles ne doivent pas être rendus publics automatiquement.

**Neutralité :** la plateforme doit distinguer les faits documentés, les traditions orales, les hypothèses et les interprétations.

---

# PARTIE III — NATURE ET ACCÈS À LA PLATEFORME

## 6. Une plateforme exclusivement web

URITHI doit être développé comme un site web accessible depuis un navigateur.

Le projet initial ne doit pas inclure le développement d'applications mobiles natives Android ou iOS.

Le site doit néanmoins fonctionner correctement sur :

- Ordinateurs de bureau.
- Ordinateurs portables.
- Tablettes.
- Téléphones mobiles utilisant un navigateur.

L'interface doit être adaptative, rapide, lisible et facile à utiliser, même sur des appareils modestes.

## 7. Accès public sans inscription

Toute personne doit pouvoir consulter librement les contenus publiés et autorisés à la diffusion.

Aucun compte ne doit être exigé pour :

- Découvrir les communautés.
- Lire les articles.
- Consulter les fiches culturelles.
- Rechercher une information.
- Consulter les photographies autorisées.
- Regarder les vidéos publiques.
- Écouter les enregistrements publics.
- Consulter les sources et références publiques.
- Découvrir les variantes culturelles documentées.
- Consulter les corrections et dates de mise à jour accessibles au public.

Les contenus confidentiels, restreints ou en attente de validation ne doivent jamais être accessibles aux visiteurs.

## 8. Gratuité

La consultation publique est gratuite.

Le prototype ne doit pas intégrer de paiement obligatoire, de publicité imposée ou de restriction commerciale empêchant l'accès aux contenus publics.

Le financement futur pourra reposer sur des subventions, des partenariats, des dons ou d'autres mécanismes compatibles avec la mission patrimoniale.

---

# PARTIE IV — ORGANISATION DU PATRIMOINE CULTUREL

## 9. Organisation nationale

La plateforme doit posséder une structure hiérarchique permettant d'organiser les contenus à l'échelle nationale.

La structure devra pouvoir relier :

- Pays.
- Provinces.
- Territoires.
- Villes et communes.
- Localités et villages.
- Communautés culturelles.
- Groupes et sous-groupes, lorsque cela est pertinent et documenté.
- Langues et variantes linguistiques.
- Thématiques culturelles.
- Articles et dossiers documentaires.
- Documents et médias.
- Sources et témoignages.
- Personnes ressources, avec des niveaux de confidentialité appropriés.

Cette organisation ne doit pas supposer qu'une communauté correspond nécessairement à une seule province ou à une seule localité.

Une communauté peut être présente dans plusieurs provinces, territoires ou pays. Plusieurs communautés peuvent partager certaines pratiques. Le système doit pouvoir représenter ces relations sans imposer des classifications rigides.

Les dénominations, les relations entre groupes et les localisations doivent être documentées avec leurs sources lorsque ces informations sont disponibles.

## 10. Répertoire des communautés

Créer un répertoire national permettant de consulter les communautés documentées.

Chaque fiche de communauté doit pouvoir présenter :

- Nom principal.
- Autres dénominations documentées.
- Présentation générale.
- Localisation et répartition géographique connues.
- Langues et variantes linguistiques.
- Éléments historiques.
- Organisation des contenus culturels.
- Articles et dossiers disponibles.
- Photographies et archives.
- Vidéos et enregistrements sonores.
- Témoignages autorisés.
- Sources bibliographiques et documentaires.
- État d'avancement de la documentation.
- Date de création et de dernière mise à jour.
- Informations complémentaires et variantes régionales.

Ne jamais inventer des informations pour compléter artificiellement une fiche.

Lorsqu'une information manque, indiquer clairement que la documentation est en cours ou que les données disponibles sont insuffisantes.

## 11. Catégories culturelles

Le système doit comporter des catégories initiales, administrables et extensibles.

### A. Identité et présentation
- Origine du nom.
- Autodésignation et dénominations historiques.
- Présentation générale.
- Répartition géographique.
- Relations historiques et culturelles avec d'autres communautés.
- Identités et appartenances, lorsque ces informations sont pertinentes et correctement documentées.

### B. Histoire et mémoire collective
- Origines selon les sources disponibles.
- Traditions orales relatives aux origines.
- Récits historiques.
- Migrations.
- Établissement des villages et localités.
- Personnalités historiques.
- Événements importants.
- Évolution des pratiques au fil du temps.
- Archives historiques.
- Documents et témoignages d'époque.

Les récits traditionnels doivent être identifiés comme tels et ne pas être automatiquement présentés comme des faits historiques établis.

### C. Langues et expressions
- Langue ou langues de la communauté.
- Variantes linguistiques.
- Alphabet et écriture, lorsque documentés.
- Vocabulaire thématique.
- Expressions courantes.
- Proverbes et dictons.
- Traductions et explications.
- Chansons et récitations autorisées.
- Contes dans leur langue originale.
- Transcriptions et traductions françaises.
- Enregistrements de prononciation.
- Glossaires évolutifs.

### D. Gastronomie et alimentation
- Plats traditionnels.
- Ingrédients.
- Noms locaux des aliments.
- Recettes détaillées.
- Quantités et proportions lorsqu'elles sont connues.
- Étapes de préparation.
- Techniques de cuisson.
- Ustensiles.
- Modes de conservation.
- Présentation et service.
- Occasions de consommation.
- Variantes régionales ou familiales.
- Histoires associées aux plats.
- Photos et vidéos de préparation.

Les recettes doivent être documentées avec leurs variantes plutôt que présentées comme des versions universelles lorsqu'il existe plusieurs pratiques.

### E. Danses, musique et expressions artistiques
- Noms des danses.
- Origines documentées ou récits associés.
- Contextes d'exécution.
- Instruments.
- Rythmes.
- Chants.
- Costumes.
- Gestes et mouvements.
- Étapes d'apprentissage.
- Démonstrations vidéo.
- Témoignages de danseurs et musiciens.
- Variantes et évolutions contemporaines.

### F. Contes, légendes et littérature orale
- Contes.
- Légendes.
- Fables.
- Récits transmis oralement.
- Proverbes.
- Énigmes.
- Histoires pour enfants.
- Personnages traditionnels.
- Versions originales.
- Transcriptions.
- Traductions.
- Enregistrements audio et vidéo.
- Identité ou pseudonyme du narrateur, selon son consentement.

Les variantes d'un même récit doivent pouvoir être conservées séparément.

### G. Coutumes, cérémonies et traditions
- Mariage et pratiques associées.
- Naissance et accueil des enfants.
- Passage à l'âge adulte.
- Funérailles et deuil.
- Cérémonies collectives.
- Fêtes et commémorations.
- Hospitalité.
- Traditions familiales.
- Pratiques communautaires.
- Évolutions et variations contemporaines.

Les pratiques sensibles, réservées à certains initiés ou soumises à des restrictions communautaires ne doivent pas être publiées automatiquement.

### H. Famille et organisation sociale
- Relations familiales.
- Parenté.
- Termes de parenté.
- Transmission des noms.
- Rôles sociaux historiquement documentés.
- Autorités traditionnelles.
- Organisation communautaire.
- Solidarité et entraide.
- Évolutions contemporaines.

Ne pas présenter des pratiques anciennes comme si elles étaient nécessairement encore appliquées par tous.

### I. Vêtements, coiffures et parures
- Vêtements traditionnels.
- Matériaux.
- Techniques de fabrication.
- Coiffures.
- Bijoux.
- Ornements.
- Symboles documentés.
- Contextes d'utilisation.
- Variantes historiques et contemporaines.
- Photographies et démonstrations.

### J. Artisanat et savoir-faire
- Poterie.
- Tissage.
- Sculpture.
- Vannerie.
- Fabrication d'instruments.
- Travail du bois.
- Travail des fibres.
- Techniques de construction.
- Objets usuels et décoratifs.
- Étapes de fabrication.
- Outils.
- Matériaux.
- Transmission des savoir-faire.

### K. Habitat et environnement
- Types d'habitation.
- Techniques de construction.
- Matériaux locaux.
- Organisation des espaces.
- Agriculture.
- Pêche.
- Chasse historique ou documentée.
- Cueillette.
- Gestion traditionnelle des ressources.
- Relations entre pratiques culturelles et environnement.

### L. Savoirs traditionnels
- Connaissances agricoles.
- Techniques de conservation des aliments.
- Connaissances écologiques.
- Pratiques artisanales.
- Usages traditionnels des plantes, lorsque leur publication est autorisée.
- Méthodes de transmission des savoirs.

Les informations médicales ou thérapeutiques traditionnelles doivent être présentées avec prudence, contextualisées et distinguées des recommandations médicales validées.

### M. Jeux, sports et divertissements
- Jeux traditionnels.
- Règles.
- Matériel.
- Chants et formules associées.
- Variantes locales.
- Démonstrations.
- Transmission aux enfants.

### N. Vie quotidienne et évolution contemporaine
- Activités quotidiennes.
- Vie communautaire.
- Pratiques actuelles.
- Changements générationnels.
- Urbanisation.
- Diaspora.
- Préservation et renouvellement des traditions.
- Relations entre héritage culturel et modernité.

### O. Patrimoine matériel et archives
- Objets historiques.
- Sites patrimoniaux.
- Monuments.
- Photographies anciennes.
- Cartes.
- Manuscrits.
- Documents d'archives.
- Enregistrements historiques.
- Catalogues et collections documentaires.

Chaque document doit être accompagné, autant que possible, de sa provenance, de sa date, de son auteur et des informations relatives à ses droits.

## 12. Catégories extensibles

Les catégories ci-dessus constituent une base initiale, et non une classification définitive.

L'administrateur doit pouvoir ajouter, modifier, désactiver ou réorganiser les catégories sans nécessiter une reconstruction complète de la plateforme.

Une catégorie peut contenir des sous-catégories, des champs spécifiques et des types de médias adaptés.

---

# PARTIE V — FONCTIONNALITÉS DU SITE PUBLIC

## 13. Page d'accueil

La page d'accueil doit présenter clairement la mission d'URITHI.

Elle doit permettre d'accéder rapidement :

- Au répertoire des communautés.
- À la recherche générale.
- À l'exploration par province ou localité.
- Aux catégories culturelles.
- Aux photographies, vidéos et enregistrements.
- Aux nouveaux contenus publiés.
- Aux dossiers documentaires approfondis.
- Aux contenus récemment actualisés.
- Aux collections historiques.
- À la présentation du projet et de sa mission de préservation.

Les contenus mis en avant doivent provenir de données réellement présentes dans la plateforme.

## 14. Recherche générale

Développer un moteur de recherche permettant de rechercher :

- Une communauté.
- Une langue.
- Un lieu.
- Une personne publique ou une personnalité historique documentée.
- Un plat.
- Une danse.
- Un conte.
- Une cérémonie.
- Un objet.
- Une expression.
- Un article.
- Un document.
- Une photographie.
- Une vidéo.
- Un enregistrement audio.

La recherche doit prendre en compte les titres, les descriptions, les mots-clés et les textes publiés.

Lorsque cela est techniquement possible, elle doit gérer les accents, les variantes orthographiques et les synonymes documentés.

Les résultats doivent être filtrables par catégorie, communauté, localité, langue, période, type de média et statut de publication accessible au public.

Aucun résultat ne doit révéler l'existence ou le contenu d'archives privées ou confidentielles.

## 15. Navigation transversale

Un visiteur doit pouvoir passer d'un contenu à un autre grâce aux relations documentées.

Exemple : depuis une recette, il peut découvrir les ingrédients, leur nom dans une langue locale, la communauté concernée, une vidéo de préparation et les témoignages associés.

Depuis une danse, il peut accéder aux instruments, aux costumes, aux chants et aux contextes culturels documentés.

Ces relations doivent être administrables et ne pas être créées automatiquement lorsqu'elles ne sont pas établies.

## 16. Consultation des contenus

Les articles publics doivent offrir :

- Une présentation claire.
- Un titre et une introduction.
- Une description détaillée.
- Des sections structurées.
- Des photos et médias autorisés.
- Des sources et références.
- Les dates de publication et de mise à jour.
- Les variantes connues.
- Le contexte géographique et linguistique.
- Les mentions de traduction ou de transcription.
- L'historique public pertinent, lorsqu'il peut être publié.
- Des liens vers des contenus associés.

L'interface doit distinguer visuellement les informations documentées, les témoignages, les interprétations et les éléments encore incertains.

## 17. Photographies, vidéos et audios

La plateforme doit proposer une médiathèque consultable et filtrable.

Elle doit permettre, selon les droits et les capacités techniques :

- L'affichage des photographies.
- La lecture des vidéos.
- L'écoute des enregistrements sonores.
- L'affichage des légendes et transcriptions.
- La consultation des métadonnées.
- L'accès aux descriptions des personnes, lieux et événements documentés, lorsque leur identification est autorisée.
- La consultation des crédits et conditions de réutilisation.

Les médias privés, soumis à restriction ou non autorisés à la diffusion ne doivent pas être accessibles par une simple URL devinable.

---

# PARTIE VI — FICHE CULTURELLE ET MODÈLE DE DONNÉES

## 18. Principe général

Le modèle de données doit être commun à toutes les communautés, mais suffisamment souple pour accueillir des contenus très différents.

Une recette, une photographie ancienne, un témoignage, une danse, un proverbe et une cérémonie ne doivent pas être contraints d'utiliser exactement les mêmes champs spécifiques.

Le système doit donc associer :

1. Des champs communs à tous les contenus.
2. Des champs spécialisés selon la catégorie.
3. Des relations entre contenus.
4. Des métadonnées de provenance.
5. Des informations de consentement et de droits.
6. Un historique des versions.
7. Des règles de publication et d'accès.

## 19. Champs communs d'un contenu culturel

Chaque contenu doit pouvoir comprendre :

- Identifiant unique.
- Titre principal.
- Titre original éventuel.
- Résumé.
- Description détaillée.
- Catégorie.
- Sous-catégorie.
- Communauté ou communautés concernées.
- Localisation géographique documentée.
- Langue originale.
- Langue de transcription.
- Langue de traduction.
- Mots-clés.
- Période ou date de référence, si connue.
- Auteur ou responsable de la documentation.
- Personne ressource, selon les règles de confidentialité.
- Type de contenu.
- Sources.
- Témoignages associés.
- Médias associés.
- Consentements et droits applicables.
- Niveau d'accès.
- Niveau de validation.
- Date de création.
- Date de dernière modification.
- Auteur de chaque modification.
- Numéro de version.
- Relations avec d'autres contenus.
- Historique des décisions éditoriales.

Les dates approximatives doivent pouvoir être indiquées comme telles. Le système ne doit pas obliger à inventer une date exacte lorsqu'elle est inconnue.

## 20. Fiche spécialisée pour une recette

Prévoir notamment :

- Nom du plat.
- Dénominations locales.
- Communauté et localité concernées.
- Ingrédients.
- Quantités connues.
- Ustensiles.
- Étapes de préparation.
- Techniques de cuisson.
- Durée approximative, si connue.
- Modes de conservation.
- Manière de servir.
- Occasions de consommation.
- Variantes régionales ou familiales.
- Témoignage de la personne ressource.
- Photos.
- Vidéos étape par étape.
- Sources et dates de collecte.

## 21. Fiche spécialisée pour une danse ou une pratique artistique

Prévoir notamment :

- Nom de la danse ou de la pratique.
- Appellations locales.
- Description.
- Origines connues et niveau de certitude.
- Contextes de pratique.
- Étapes et gestes documentés.
- Instruments et costumes.
- Rythmes et chants associés.
- Variantes.
- Témoignages.
- Photos et vidéos.
- Restrictions culturelles éventuelles.
- Conditions de consultation et de réutilisation.

## 22. Fiche spécialisée pour un conte ou un témoignage

Prévoir notamment :

- Titre ou sujet.
- Type de récit.
- Langue originale.
- Nom ou pseudonyme autorisé du narrateur.
- Date et lieu de collecte.
- Contexte du témoignage.
- Fichier original.
- Transcription.
- Traduction.
- Résumé en français.
- Informations sur les variantes.
- Sources complémentaires.
- Consentement.
- Conditions de diffusion.
- Restrictions éventuelles.

## 23. Fiche spécialisée pour une photographie ou une archive ancienne

Prévoir notamment :

- Fichier original.
- Description.
- Auteur ou photographe, si connu.
- Date exacte ou approximative.
- Lieu.
- Personnes représentées, si leur identification est fiable et autorisée.
- Contexte historique.
- Provenance.
- Propriétaire ou détenteur du document, si pertinent.
- Droits et conditions de réutilisation.
- Qualité de la numérisation.
- Versions restaurées ou dérivées.
- Historique des modifications.
- Restrictions de diffusion.

---

# PARTIE VII — COLLECTE DU PATRIMOINE SUR LE TERRAIN

## 24. Système de missions de collecte

Créer un module permettant d'organiser les missions de collecte culturelle.

Chaque mission doit pouvoir comprendre :

- Identifiant.
- Titre.
- Objectif.
- Communauté ciblée.
- Province, territoire et localité.
- Catégories à documenter.
- Période prévue.
- Responsable.
- Collecteurs autorisés.
- Personnes ressources identifiées.
- Questions et questionnaires associés.
- Documents nécessaires.
- Consignes de sécurité et de respect culturel.
- Budget prévisionnel facultatif.
- Résultats attendus.
- Rapports de mission.
- Statut d'avancement.
- Difficultés rencontrées.
- Pièces justificatives et archives.

L'administrateur ou les responsables autorisés doivent pouvoir créer, affecter, modifier et clôturer les missions.

## 25. Déroulement standard d'une mission

Le protocole national de collecte doit suivre les étapes suivantes.

### Étape 1 : préparation

- Définir l'objectif de la mission.
- Identifier la communauté et les thèmes recherchés.
- Étudier les sources déjà disponibles.
- Identifier les interlocuteurs potentiels.
- Préparer les questionnaires adaptés.
- Préparer les formulaires de consentement.
- Définir les restrictions éventuelles.
- Préparer le matériel d'enregistrement.
- Organiser les fichiers et les métadonnées.

### Étape 2 : prise de contact

Le collecteur explique la mission, son objectif, l'utilisation envisagée des informations et les conditions de publication.

La personne interrogée doit pouvoir poser des questions, refuser certaines réponses ou limiter les usages autorisés.

### Étape 3 : consentement

Avant toute collecte identifiable, obtenir les autorisations nécessaires pour les enregistrements, les photographies, les témoignages et les usages envisagés.

Les autorisations doivent distinguer, autant que nécessaire :

- La participation à l'entretien.
- L'enregistrement audio.
- L'enregistrement vidéo.
- La photographie.
- La transcription.
- La traduction.
- La publication sur le site.
- La réutilisation par des tiers.
- Les conditions d'attribution du nom.
- Les restrictions de diffusion.

Le consentement doit être compréhensible, traçable et révocable dans les limites prévues par les engagements applicables.

Pour les mineurs, prévoir les autorisations du représentant légal et des mesures adaptées à leur âge. Le consentement des personnes ne remplace pas les autorisations communautaires éventuellement nécessaires pour les savoirs collectifs ou sensibles.

### Étape 4 : entretien et documentation

Le collecteur utilise des questions ouvertes et permet à la personne de raconter avec ses propres mots.

Il doit documenter les réponses sans imposer son interprétation.

Il peut réaliser, selon les autorisations :

- Entretiens audio.
- Vidéos.
- Photographies.
- Descriptions écrites.
- Démonstrations pratiques.
- Collecte de documents.
- Notes de terrain.

### Étape 5 : vérification sur le terrain

Avant de terminer la mission, le collecteur vérifie les noms, les lieux, les dates et les informations factuelles disponibles.

Il demande des précisions lorsque des éléments sont ambigus et note les informations qu'il n'a pas pu vérifier.

### Étape 6 : transfert et archivage initial

Les fichiers originaux sont conservés sans modification destructive.

Le collecteur transfère les fichiers vers un espace sécurisé et associe à chaque fichier ses métadonnées, son consentement et son contexte de collecte.

### Étape 7 : traitement documentaire

Les contenus sont transcrits, traduits, décrits, classés et reliés aux sources.

### Étape 8 : vérification culturelle et éditoriale

Les informations sont examinées par les personnes compétentes, puis soumises au processus de validation.

### Étape 9 : publication

Seuls les contenus autorisés et approuvés peuvent être publiés.

### Étape 10 : suivi

Les informations pourront être corrigées ou complétées après publication, sans effacer les versions précédentes.

## 26. Questionnaires de collecte

Le système doit permettre de créer des questionnaires généraux et spécialisés.

Le questionnaire général peut comprendre :

- Comment la communauté se désigne-t-elle ?
- Quelles langues sont utilisées ?
- Quels sont les lieux historiquement associés à la communauté ?
- Quels récits sont transmis entre générations ?
- Quels plats et savoir-faire sont importants ?
- Quelles danses, musiques et expressions artistiques sont pratiquées ?
- Quelles traditions familiales ou collectives sont documentées ?
- Comment ces pratiques ont-elles évolué ?
- Quelles différences existe-t-il entre les localités ou les générations ?
- Quelles sources permettent de compléter le témoignage ?
- Quels éléments ne doivent pas être publiés ?
- Qui pourrait apporter un témoignage complémentaire ?

Ces questions constituent une base. Elles doivent être adaptées aux pratiques, aux langues et aux particularités de chaque communauté.

## 27. Formulaires numériques de collecte

Prévoir des formulaires pour :

- L'identification d'une mission.
- L'identification d'une personne ressource.
- Le consentement.
- La description d'un entretien.
- La collecte d'une photographie.
- La collecte d'une vidéo.
- La collecte d'un enregistrement audio.
- La description d'un objet ou document.
- La transcription.
- La traduction.
- La vérification des informations.
- La validation culturelle.
- Le rapport de mission.

Les formulaires doivent comporter des champs obligatoires pertinents, des champs facultatifs et des contrôles de cohérence.

Le système ne doit pas empêcher de sauvegarder un brouillon parce qu'une information historique demeure inconnue.

---

# PARTIE VIII — MÉDIAS, TRANSCRIPTION ET TRADUCTION

## 28. Gestion des fichiers originaux

Les originaux audio, vidéo, photographiques et documentaires doivent être conservés séparément des versions éditées.

Prévoir :

- Identifiant unique.
- Nom de fichier.
- Type MIME.
- Taille.
- Date de collecte.
- Date d'importation.
- Auteur ou responsable.
- Source.
- Consentement applicable.
- Empreinte cryptographique du fichier, lorsque possible.
- Emplacement de stockage.
- Relations avec les contenus.
- Historique des opérations.
- Statut d'intégrité.

Les fichiers ne doivent pas être remplacés silencieusement.

## 29. Transcription

Les témoignages audio et vidéo doivent pouvoir être associés à une transcription.

La transcription peut être :

- Réalisée manuellement.
- Préparée avec un outil automatique, si celui-ci est disponible.
- Corrigée par un transcripteur autorisé.
- Vérifiée par une personne compétente dans la langue concernée.

Les transcriptions automatiques doivent être identifiées comme non vérifiées jusqu'à leur contrôle.

Conserver, lorsque c'est utile, les repères temporels permettant de retrouver les passages dans l'enregistrement original.

## 30. Traduction

Le français est la langue principale de consultation et d'explication.

Les contenus peuvent conserver des mots, expressions, proverbes, chants ou récits dans leur langue originale.

Pour les contenus multilingues, prévoir :

- Langue originale.
- Transcription originale.
- Traduction française.
- Autres traductions éventuelles.
- Nom ou rôle du traducteur.
- Date de traduction.
- Statut de vérification.
- Notes explicatives.
- Variantes possibles.
- Liens vers le fichier original.

La traduction ne doit pas effacer le sens culturel d'un terme simplement parce qu'il ne possède pas d'équivalent exact en français.

Les traductions doivent pouvoir être corrigées et versionnées indépendamment du témoignage original.

---

# PARTIE IX — UTILISATEURS, RÔLES ET PERMISSIONS

## 31. Principe de gestion des comptes

La création des comptes de contribution est contrôlée par l'administration.

Il n'existe pas d'inscription publique donnant automatiquement le droit de publier ou de contribuer.

L'administrateur peut créer lui-même un compte et transmettre les informations d'accès à son titulaire.

Il peut également créer un processus de demande d'accès, si cette fonctionnalité est activée. Une demande ne donne jamais automatiquement accès aux fonctions de contribution.

Chaque utilisateur doit disposer uniquement des permissions nécessaires à son travail.

## 32. Super administrateur

Le super administrateur dispose des pouvoirs de gestion générale :

- Créer, modifier, désactiver et réactiver les comptes.
- Attribuer les rôles et permissions.
- Gérer les communautés et les catégories.
- Gérer les missions.
- Accéder aux tableaux de bord.
- Consulter les journaux d'audit.
- Gérer les règles de publication.
- Gérer les paramètres généraux.
- Contrôler les archives et les autorisations.
- Gérer les signalements et demandes de retrait.
- Gérer les paramètres de sauvegarde.
- Superviser la sécurité.
- Gérer les intégrations et configurations autorisées.

Les opérations sensibles doivent être journalisées.

## 33. Responsable de collecte

Peut :

- Préparer les missions qui lui sont confiées.
- Affecter les tâches dans les limites de ses permissions.
- Consulter les formulaires nécessaires.
- Suivre l'avancement de la collecte.
- Vérifier les dossiers de mission.
- Soumettre les rapports.

Il ne peut pas publier librement des contenus publics.

## 34. Collecteur

Peut :

- Consulter ses missions.
- Identifier les personnes ressources.
- Recueillir les témoignages.
- Ajouter des photos, vidéos, audios et documents.
- Remplir les formulaires.
- Joindre les consentements.
- Ajouter les notes de terrain.
- Soumettre les contenus pour traitement.

Il ne peut pas modifier les droits globaux ni publier sans autorisation.

## 35. Transcripteur et traducteur

Peut accéder aux contenus nécessaires à son travail, dans les limites de confidentialité définies.

Peut créer et modifier des transcriptions et traductions.

Les changements doivent être versionnés et attribués à leur auteur.

## 36. Validateur culturel ou scientifique

Peut examiner les informations dans son domaine de compétence.

Peut :

- Confirmer les éléments qu'il estime correctement documentés.
- Signaler les erreurs.
- Demander des précisions.
- Proposer des corrections.
- Documenter les désaccords et variantes.
- Recommander une restriction ou un retrait.

La validation ne doit pas permettre à une seule personne d'imposer comme universelle une interprétation contestée ou propre à un seul groupe.

## 37. Éditeur

Peut préparer les contenus pour publication, corriger la présentation, vérifier les références et contrôler les métadonnées.

Il peut approuver ou rejeter un contenu dans les limites des règles de gouvernance.

Les permissions de publication doivent être configurables.

## 38. Règles de séparation des rôles

Le système doit permettre à une même personne d'assumer plusieurs fonctions lorsque cela est justifié, sans supprimer les contrôles nécessaires.

Pour les contenus sensibles, litigieux ou soumis à des restrictions, prévoir une validation renforcée et, si nécessaire, une séparation entre collecte, validation et publication.

Chaque action importante doit conserver l'identité du responsable et la date de l'opération.

---

# PARTIE X — CYCLE DE VIE ET VALIDATION DES CONTENUS

## 39. Statuts de contenu

Prévoir un workflow comprenant les statuts suivants, adaptables par l'administration :

1. Brouillon.
2. En préparation.
3. Soumis.
4. À compléter.
5. En transcription.
6. En traduction.
7. En vérification documentaire.
8. En validation culturelle.
9. En validation éditoriale.
10. En attente d'autorisation complémentaire.
11. Validé.
12. Programmé pour publication.
13. Publié.
14. En cours de révision.
15. Publication suspendue.
16. Retiré de la publication.
17. Archivé.

Ces statuts doivent être accompagnés de règles de transition et de permissions.

Le système doit empêcher la publication d'un contenu lorsque les autorisations requises sont absentes, expirées ou incompatibles avec la diffusion envisagée.

## 40. Décisions et commentaires

Chaque validation ou refus doit pouvoir comporter :

- Auteur de la décision.
- Date.
- Motif.
- Commentaires.
- Modifications demandées.
- Pièces justificatives éventuelles.
- Étape suivante.

Les contributeurs doivent pouvoir consulter les retours qui les concernent et soumettre une nouvelle version.

## 41. Vérification des informations

Les vérificateurs doivent pouvoir distinguer :

- Information étayée par une source identifiable.
- Témoignage personnel.
- Tradition orale.
- Information corroborée par plusieurs sources.
- Information contestée.
- Hypothèse.
- Information dont la vérification est incomplète.

Une tradition orale peut constituer un contenu culturel valable sans devoir être transformée artificiellement en fait historique prouvé. Son statut et son contexte doivent simplement être explicites.

## 42. Désaccords et variantes culturelles

Lorsque deux personnes ou localités donnent des versions différentes d'une pratique :

- Conserver les deux versions si les conditions de publication le permettent.
- Identifier leur provenance.
- Documenter les contextes.
- Expliquer les différences connues.
- Éviter de supprimer une version uniquement parce qu'une autre est plus répandue.
- Prévoir un mécanisme de signalement et de réexamen.

---

# PARTIE XI — ÉVOLUTION, VERSIONS ET HISTORIQUE

## 43. Contenus dynamiques

URITHI ne doit pas être une bibliothèque statique.

Les connaissances doivent pouvoir être enrichies, corrigées et actualisées par les personnes autorisées.

Un contenu publié peut recevoir :

- De nouvelles sources.
- Des témoignages complémentaires.
- De nouvelles photographies.
- Des vidéos.
- Une meilleure transcription.
- Une nouvelle traduction.
- Des précisions historiques.
- Des corrections factuelles.
- Des variantes locales.
- Des explications supplémentaires.
- Une révision de son interprétation.

## 44. Gestion des versions

Chaque modification importante doit produire une version traçable.

Le système doit conserver :

- Le contenu antérieur.
- Le contenu modifié.
- L'auteur de la modification.
- La date.
- Le motif.
- Le statut de validation.
- Les éventuelles références associées.

Il doit être possible de comparer deux versions et, pour les utilisateurs autorisés, de restaurer une version antérieure.

Une restauration ne doit pas effacer l'historique.

## 45. Historique public et historique interne

L'historique public peut afficher les dates de publication, les dates de mise à jour et les modifications éditoriales pertinentes.

L'historique interne doit conserver davantage de détails, notamment les décisions de validation et les opérations administratives.

Les informations personnelles, les données confidentielles et les contenus sensibles ne doivent pas être révélés dans l'historique public.

---

# PARTIE XII — PROTECTION DES DONNÉES ET RESPECT CULTUREL

## 46. Consentement et droits

Chaque média et chaque témoignage doivent être associés à des informations sur leurs droits et autorisations.

Le système doit distinguer :

- Le droit de conserver un document.
- Le droit de le traiter.
- Le droit de le publier.
- Le droit de le traduire.
- Le droit de le réutiliser.
- Les conditions d'attribution.
- Les restrictions géographiques ou temporelles éventuelles.
- Les conditions d'accès.

La possession d'un fichier ne signifie pas automatiquement que sa publication ou sa réutilisation est autorisée.

## 47. Contenus sensibles

Certains savoirs, cérémonies, récits, lieux ou objets peuvent être considérés comme confidentiels ou réservés.

Prévoir des niveaux d'accès configurables :

- Public.
- Accessible uniquement aux utilisateurs autorisés.
- Accès restreint à une équipe ou à un groupe désigné.
- Accès soumis à autorisation particulière.
- Conservation privée sans publication.

Les restrictions doivent s'appliquer aux fichiers originaux, aux miniatures, aux aperçus, aux résultats de recherche, aux caches et aux liens de téléchargement.

## 48. Demandes de correction ou de retrait

Prévoir un mécanisme permettant aux personnes concernées ou aux représentants légitimes de signaler :

- Une erreur.
- Une mauvaise attribution.
- Un problème de consentement.
- Une atteinte à la vie privée.
- Une restriction culturelle non respectée.
- Une utilisation non autorisée.
- Une information devenue trompeuse.

La demande doit être enregistrée, examinée et suivie.

Lorsqu'un risque sérieux est signalé, la diffusion peut être suspendue provisoirement pendant l'examen.

Le retrait d'un contenu public ne doit pas automatiquement entraîner la destruction de toutes les traces documentaires ou des obligations légales de conservation. La décision doit respecter les droits des personnes, les engagements pris et les règles applicables.

## 49. Protection des données personnelles

Collecter uniquement les données personnelles nécessaires.

Protéger les coordonnées, les documents d'identité, les consentements et les informations confidentielles.

Limiter les accès, sécuriser les transferts et définir des règles de conservation.

Les données personnelles ne doivent jamais être exposées publiquement par défaut.

Prévoir une politique de confidentialité et des procédures de gestion des demandes relatives aux données personnelles.

---

# PARTIE XIII — ARCHIVAGE ET PRÉSERVATION À LONG TERME

## 50. Objectif de conservation

URITHI doit être conçu pour maximiser les chances de conservation et de consultation des contenus pendant plusieurs décennies et, autant que possible, un siècle ou davantage.

Aucun système informatique ne peut garantir à lui seul qu'un site restera disponible pendant cent ans. Il faut donc mettre en place une stratégie technique, documentaire, organisationnelle et financière de préservation.

## 51. Formats de conservation

Privilégier les formats ouverts, largement documentés et adaptés à l'archivage, selon le type de contenu.

Étudier notamment :

- Texte : UTF-8, TXT, XML ou formats documentaires ouverts.
- Documents : PDF/A lorsque cela convient.
- Images : TIFF pour certaines archives maîtresses et JPEG ou WebP pour la diffusion.
- Audio : WAV pour les masters lorsque cela est approprié, avec des formats de diffusion dérivés.
- Vidéo : conserver un original de qualité et des versions de consultation adaptées.
- Métadonnées : formats documentés, exportables et interopérables.

Les choix définitifs doivent tenir compte de la qualité des sources, des coûts de stockage et des besoins d'accès.

## 52. Stratégie de sauvegarde

Mettre en place :

- Des sauvegardes automatiques.
- Plusieurs copies indépendantes.
- Des copies situées dans des environnements distincts.
- Une protection contre les suppressions accidentelles.
- Des contrôles d'intégrité.
- Des journaux de sauvegarde.
- Des tests réguliers de restauration.
- Une procédure de reprise après incident.
- Une documentation de récupération.

La sauvegarde de la base de données ne suffit pas : les fichiers multimédias, les métadonnées, les consentements, les versions et les configurations indispensables doivent également être couverts.

## 53. Préservation des originaux

Les fichiers maîtres doivent être conservés séparément des fichiers optimisés pour le web.

Toute opération de compression, restauration ou conversion doit produire une nouvelle version et laisser l'original intact.

Les transformations doivent être documentées.

## 54. Contrôle d'intégrité et migration

Prévoir des contrôles périodiques pour détecter les fichiers corrompus ou manquants.

Documenter les formats, les logiciels et les procédures nécessaires à la lecture des archives.

Lorsque les formats deviennent obsolètes, préparer leur migration en conservant les originaux et les informations sur les transformations réalisées.

## 55. Pérennité institutionnelle

La plateforme doit pouvoir être maintenue par de futures équipes.

Prévoir :

- Une documentation technique complète.
- Une documentation éditoriale.
- Des procédures de passation.
- Des exports complets des données.
- Une stratégie de continuité en cas de changement d'hébergeur.
- Des procédures de transfert de responsabilité.
- Des formats évitant l'enfermement dans un fournisseur.
- Une estimation des coûts récurrents de stockage et de maintenance.

Les partenariats institutionnels pourront être développés ultérieurement pour renforcer la conservation et la légitimité du projet.

---

# PARTIE XIV — ADMINISTRATION ET TABLEAU DE BORD

## 56. Tableau de bord général

Créer un tableau de bord protégé par authentification.

Il doit permettre aux utilisateurs autorisés de visualiser les informations correspondant à leurs permissions.

Prévoir notamment :

- Nombre de communautés documentées.
- Nombre de fiches culturelles.
- Nombre de contenus publiés.
- Nombre de contenus en attente.
- Nombre de missions en cours.
- Nombre de témoignages collectés.
- Nombre de médias archivés.
- Nombre de transcriptions et traductions.
- Nombre de contenus à réviser.
- Nombre de demandes de correction ou de retrait.
- État des sauvegardes et des contrôles d'intégrité, lorsque ces données sont disponibles.

Les statistiques doivent être calculées à partir des données réelles.

## 57. Gestion des communautés

L'administration doit pouvoir :

- Créer une communauté.
- Modifier ses informations.
- Ajouter des dénominations documentées.
- Associer des langues.
- Définir des relations géographiques.
- Ajouter des catégories de documentation.
- Relier des contenus.
- Consulter les statistiques.
- Gérer son état de documentation.
- Préparer son extension documentaire.

Les suppressions doivent être encadrées afin d'éviter la perte des contenus associés.

## 58. Gestion éditoriale

Le tableau de bord doit permettre de :

- Créer et modifier les contenus.
- Consulter les brouillons.
- Suivre les validations.
- Gérer les médias.
- Consulter les sources.
- Gérer les traductions.
- Comparer les versions.
- Programmer une publication.
- Suspendre une publication.
- Traiter les signalements.
- Consulter l'historique des actions.

## 59. Gestion des comptes

Prévoir :

- Création de compte.
- Modification des rôles.
- Activation et désactivation.
- Réinitialisation du mot de passe.
- Révocation des sessions si nécessaire.
- Consultation des dernières activités pertinentes.
- Affectation aux missions.
- Gestion des permissions.
- Journalisation des opérations sensibles.

Les mots de passe doivent être gérés par des mécanismes d'authentification sécurisés. Ils ne doivent jamais être stockés en clair.

---

# PARTIE XV — RECHERCHE DOCUMENTAIRE ET SOURCES

## 60. Gestion des sources

Créer un registre des sources pouvant comprendre :

- Livres.
- Articles scientifiques.
- Thèses et mémoires.
- Archives.
- Rapports.
- Photographies.
- Témoignages.
- Enregistrements.
- Documents administratifs historiques.
- Sites web.
- Collections patrimoniales.
- Entretiens et observations de terrain.

Pour chaque source, enregistrer les métadonnées disponibles : titre, auteur, date, éditeur, provenance, référence bibliographique, lien, droits et conditions d'utilisation.

## 61. Relations entre sources et contenus

Un contenu peut être soutenu par plusieurs sources.

Une source peut être liée à plusieurs contenus.

Le système doit permettre d'indiquer précisément quelles informations une source vient étayer.

Lorsqu'une source est contestée, indisponible ou remplacée, les contenus concernés doivent pouvoir être identifiés.

## 62. Importation documentaire

L'architecture peut prévoir ultérieurement des outils d'importation de métadonnées et de documents depuis des catalogues ou collections autorisés.

Aucun import automatisé ne doit publier directement un contenu culturel sans vérification, sans contrôle des droits et sans validation éditoriale.

---

# PARTIE XVI — EXPÉRIENCE UTILISATEUR ET ACCESSIBILITÉ

## 63. Ergonomie

L'interface doit être simple, claire et cohérente.

Un visiteur ne connaissant aucune communauté doit pouvoir comprendre rapidement :

- Ce qu'est URITHI.
- Comment découvrir une communauté.
- Comment rechercher une information.
- Comment accéder aux contenus multimédias.
- Comment distinguer une source, un témoignage et une interprétation.

Le contenu doit être organisé de manière à favoriser la découverte progressive, sans imposer une connaissance préalable de l'histoire ou des langues locales.

## 64. Langue d'interface

Le français est la langue principale de l'interface et des explications.

L'architecture doit néanmoins permettre l'ajout futur d'autres langues d'interface.

Les contenus culturels peuvent être multilingues indépendamment de la langue de navigation du site.

## 65. Accessibilité

Respecter les bonnes pratiques d'accessibilité web :

- Contraste suffisant.
- Navigation au clavier.
- Libellés explicites.
- Structure logique des titres.
- Textes alternatifs pour les images.
- Sous-titres ou transcriptions lorsque disponibles.
- Contrôles accessibles pour les lecteurs audio et vidéo.
- Messages d'erreur compréhensibles.
- Affichage lisible sur petits écrans.

## 66. Performances

Optimiser :

- Le chargement des pages.
- La taille des images.
- La lecture des vidéos.
- La pagination.
- Les résultats de recherche.
- La mise en cache des contenus publics.
- La consommation de données mobiles.

Ne pas charger systématiquement tous les médias d'une page.

Prévoir des miniatures et des fichiers de consultation adaptés, tout en conservant les originaux dans l'archive.

---

# PARTIE XVII — SÉCURITÉ ET FIABILITÉ TECHNIQUE

## 67. Authentification et autorisations

Mettre en place une authentification sécurisée pour l'administration et la contribution.

Appliquer les permissions côté serveur, et non uniquement dans l'interface.

Empêcher l'accès direct aux ressources privées par modification d'une URL ou d'un identifiant.

Prévoir une protection contre les tentatives répétées de connexion, les injections, les attaques XSS, les falsifications de requêtes et les téléversements malveillants.

## 68. Téléversement des fichiers

Contrôler les types de fichiers, les tailles, les extensions et les formats acceptés.

Stocker les fichiers de manière sécurisée.

Ne pas exécuter les fichiers téléversés.

Prévoir une analyse antimalware lorsque l'infrastructure le permet.

Vérifier les autorisations avant tout accès aux fichiers.

## 69. Journaux et audit

Journaliser les événements importants :

- Connexions administratives pertinentes.
- Création et désactivation des comptes.
- Changements de permissions.
- Création et modification des contenus.
- Décisions de validation.
- Publications et retraits.
- Changements de confidentialité.
- Opérations sur les archives.
- Restaurations.
- Modifications des paramètres critiques.

Les journaux doivent être protégés contre les modifications non autorisées et ne pas exposer inutilement les données personnelles.

## 70. Fiabilité

Prévoir des tests automatisés et des procédures de contrôle pour les fonctionnalités critiques.

Documenter les erreurs, surveiller les services essentiels et définir des procédures de reprise après incident.

Les opérations de maintenance doivent être réalisées de façon à limiter les interruptions et les risques de perte de données.

---

# PARTIE XVIII — EXIGENCES TECHNIQUES

## 71. Architecture

L'architecture doit séparer clairement :

- Le site public.
- Le système d'administration.
- Les services métier.
- La gestion des comptes et permissions.
- La gestion documentaire.
- Le stockage des médias.
- La recherche.
- Le système de validation.
- La gestion des versions.
- Les sauvegardes et archives.

L'architecture peut être monolithique et modulaire au départ si cela permet un développement plus simple et fiable. Il n'est pas nécessaire d'introduire une architecture distribuée complexe sans justification.

Le choix des technologies doit dépendre de l'environnement réel du projet, des compétences disponibles, du coût d'hébergement et des besoins de conservation.

Ne pas imposer arbitrairement un framework ou une base de données avant l'analyse de l'environnement existant.

## 72. Modèle de données

Prévoir un modèle permettant de relier au minimum :

- Communautés.
- Dénominations.
- Localisations.
- Langues.
- Catégories.
- Contenus culturels.
- Versions.
- Sources.
- Témoignages.
- Personnes ressources.
- Médias.
- Consentements.
- Droits.
- Missions.
- Utilisateurs.
- Rôles et permissions.
- Validations.
- Traductions.
- Transcriptions.
- Relations entre contenus.
- Journaux d'audit.
- Demandes de correction ou de retrait.
- Opérations de sauvegarde.

Utiliser des relations cohérentes et des identifiants stables. Prévoir les contraintes d'intégrité et les index nécessaires aux recherches.

## 73. Exportation et interopérabilité

Prévoir des mécanismes permettant d'exporter les données et les métadonnées dans des formats documentés.

L'exportation doit respecter les droits et les restrictions d'accès.

Il doit être possible de migrer les contenus vers un autre environnement sans perdre les liens entre les fiches, les sources, les versions et les médias.

## 74. Documentation technique

Fournir :

- Guide d'installation.
- Configuration de l'environnement.
- Liste des dépendances.
- Procédures de déploiement.
- Procédures de migration.
- Description du modèle de données.
- Documentation des rôles et permissions.
- Documentation des API si elles existent.
- Procédures de sauvegarde et restauration.
- Procédures de maintenance.
- Guide d'utilisation de l'administration.
- Guide de collecte et de validation.
- Liste des tests et résultats.

Ne jamais intégrer de secrets, mots de passe ou clés privées dans le dépôt du projet.

---

# PARTIE XIX — COMMUNAUTÉ PILOTE HAVU

## 75. Objectif du pilote

La première communauté pilote sera la communauté Havu.

Cette phase permettra de tester la méthode de collecte, les formulaires, les catégories, la structure documentaire et le processus de validation avant de généraliser la démarche aux autres communautés de la RDC.

Le pilote ne doit pas prétendre représenter toute la diversité Havu à partir de quelques témoignages.

## 76. Contenus à rechercher

Le dossier Havu devra progressivement documenter :

- Présentation générale.
- Dénominations et localisation documentées.
- Histoire et traditions orales.
- Langues et variantes.
- Expressions et proverbes.
- Gastronomie et recettes.
- Danses et musiques.
- Contes et récits.
- Coutumes et cérémonies.
- Organisation familiale et sociale.
- Vêtements et artisanat.
- Habitat et savoir-faire.
- Jeux et activités traditionnelles.
- Photographies historiques.
- Témoignages des anciens.
- Évolutions contemporaines.
- Sources écrites et audiovisuelles.

Cette liste est un objectif de collecte, pas une autorisation de publier automatiquement tous les sujets.

## 77. Validation du pilote

Avant d'étendre la méthode à d'autres communautés, évaluer :

- La facilité d'utilisation des formulaires.
- La qualité des données collectées.
- La clarté des traductions.
- La traçabilité des sources.
- La gestion des consentements.
- La pertinence des catégories.
- La capacité à documenter plusieurs variantes.
- La qualité des validations.
- La conservation des fichiers originaux.
- La performance du site.
- La facilité de mise à jour.
- La compréhension des contenus par un visiteur non spécialiste.

Les enseignements du pilote doivent permettre d'améliorer le protocole national.

---

# PARTIE XX — PHASES DE DÉVELOPPEMENT

## 78. Phase 1 : analyse et conception

- Examiner le projet et son environnement.
- Identifier les contraintes techniques.
- Définir l'architecture.
- Définir le modèle de données.
- Définir les rôles et permissions.
- Définir les workflows.
- Définir les règles de sécurité.
- Définir la stratégie d'archivage.
- Établir les critères de réussite.

**Livrable :** documentation de conception et plan de développement validable.

## 79. Phase 2 : socle technique

- Mettre en place l'architecture.
- Configurer la base de données.
- Créer l'authentification.
- Créer les rôles et permissions.
- Mettre en place les journaux d'audit.
- Préparer le stockage des fichiers.
- Mettre en place les premiers tests.
- Documenter l'installation.

**Livrable :** socle sécurisé et fonctionnel.

## 80. Phase 3 : gestion documentaire

- Créer les communautés.
- Créer les catégories.
- Créer les fiches culturelles.
- Gérer les sources.
- Gérer les médias.
- Gérer les transcriptions et traductions.
- Gérer les relations entre contenus.
- Gérer les versions.

**Livrable :** système documentaire utilisable.

## 81. Phase 4 : administration et validation

- Créer le tableau de bord.
- Gérer les utilisateurs.
- Gérer les missions.
- Gérer les formulaires.
- Gérer les statuts.
- Gérer les validations.
- Gérer les consentements.
- Gérer les signalements.
- Gérer les droits d'accès.

**Livrable :** système complet de contribution contrôlée.

## 82. Phase 5 : site public

- Créer la page d'accueil.
- Créer le répertoire des communautés.
- Créer les pages de communautés.
- Créer les pages de contenus.
- Créer la médiathèque.
- Développer la recherche.
- Ajouter les filtres.
- Ajouter les relations entre contenus.
- Optimiser l'accessibilité et les performances.

**Livrable :** site web public fonctionnel.

## 83. Phase 6 : pilote Havu

- Créer le dossier Havu.
- Préparer les formulaires de collecte.
- Importer uniquement les contenus dont la provenance et les droits sont connus.
- Tester le workflow.
- Vérifier les traductions.
- Tester les variantes culturelles.
- Tester les médias.
- Tester les sauvegardes.
- Recueillir les retours des personnes concernées.
- Corriger les problèmes identifiés.

**Livrable :** première collection pilote documentée.

Ne jamais inventer des témoignages ou des traditions pour donner artificiellement l'impression que le dossier Havu est complet.

## 84. Phase 7 : archivage et renforcement

- Automatiser les sauvegardes.
- Tester la restauration.
- Vérifier les empreintes des fichiers.
- Documenter les procédures de conservation.
- Tester les exports.
- Préparer la migration future des formats.
- Renforcer la sécurité.

**Livrable :** stratégie de conservation testée et documentée.

## 85. Phase 8 : extension nationale

Après évaluation du pilote, préparer l'intégration progressive d'autres communautés.

La méthode commune doit être conservée, tout en autorisant des catégories, langues, variantes et restrictions particulières.

**Livrable :** une plateforme nationale capable d'accueillir de nouvelles collections sans reconstruction de son architecture.

---

# PARTIE XXI — TESTS ET CRITÈRES D'ACCEPTATION

## 86. Tests fonctionnels

Vérifier notamment que :

- Le visiteur consulte les contenus publics sans compte.
- Un visiteur ne peut pas accéder à l'administration.
- Un compte non autorisé ne peut pas contribuer.
- L'administrateur peut créer et désactiver les comptes.
- Les rôles appliquent les permissions prévues.
- Les contenus suivent les étapes de validation.
- Un contenu non autorisé ne peut pas être publié.
- Les fichiers privés ne sont pas accessibles publiquement.
- Les recherches et filtres fonctionnent.
- Les traductions peuvent être versionnées.
- Les modifications sont historisées.
- Les demandes de retrait peuvent être suivies.
- Les relations entre contenus sont correctement conservées.

## 87. Tests de conservation

Vérifier que :

- Les fichiers originaux sont préservés.
- Les sauvegardes incluent les données et les médias.
- Les restaurations fonctionnent.
- Les exports conservent les métadonnées essentielles.
- Les versions précédentes restent disponibles pour les utilisateurs autorisés.
- Les suppressions et retraits suivent les règles prévues.
- Les restrictions d'accès sont respectées après une restauration.

## 88. Tests de sécurité

Tester :

- Les permissions.
- L'authentification.
- Les tentatives d'accès direct.
- Les téléversements.
- Les formulaires.
- La protection des données.
- La gestion des sessions.
- Les journaux d'audit.
- Les accès aux archives restreintes.

## 89. Tests de qualité documentaire

Vérifier que :

- Chaque contenu publié possède les métadonnées requises.
- Les sources peuvent être retrouvées.
- Les traductions sont identifiables.
- Les variantes ne sont pas écrasées.
- Les incertitudes peuvent être documentées.
- Les consentements sont associés aux contenus concernés.
- Les auteurs et dates de modification sont conservés.

## 90. Critères de réussite du prototype

Le prototype sera considéré comme fonctionnel lorsque :

1. Le site public est accessible et consultable gratuitement.
2. Les communautés peuvent être créées et documentées.
3. Les fiches culturelles peuvent accueillir différents types de contenus.
4. Les médias et sources peuvent être associés.
5. Les comptes sont contrôlés par l'administration.
6. Le workflow de validation fonctionne.
7. Les versions et modifications sont traçables.
8. Les restrictions de publication sont respectées.
9. Les sauvegardes et restaurations ont été testées.
10. Le pilote Havu peut être documenté sans modifier l'architecture fondamentale.
11. La documentation technique permet à une autre équipe de reprendre le projet.

---

# PARTIE XXII — LIVRABLES ATTENDUS DE CODEX

## 91. Livrables techniques

Produire progressivement :

- Le code source fonctionnel.
- Le modèle de données.
- Les migrations nécessaires.
- Les interfaces publiques.
- Le tableau de bord d'administration.
- Le système de rôles et permissions.
- Le système de collecte.
- Le workflow éditorial.
- Le système de versions.
- La gestion des médias.
- Le système de recherche.
- Les fonctions d'archivage.
- Les tests automatisés.
- La configuration de déploiement adaptée au projet.
- La documentation technique.
- Les procédures de sauvegarde et de restauration.

## 92. Livrables éditoriaux

Produire également :

- Le protocole national de collecte.
- Le guide du collecteur.
- Les formulaires de consentement.
- Les questionnaires de terrain.
- Le guide de transcription.
- Le guide de traduction.
- Le guide de validation culturelle.
- Le guide de validation éditoriale.
- La politique de publication.
- La politique de correction et de retrait.
- La politique de confidentialité.
- La politique d'archivage.
- Le modèle de dossier communautaire.
- Le modèle de fiche culturelle.

Les formulaires juridiques et les politiques devront être adaptés et vérifiés avant utilisation réelle.

---

# PARTIE XXIII — INSTRUCTIONS FINALES

## 93. Ordre de priorité

Ne commence pas par développer toutes les fonctionnalités simultanément.

Procède dans l'ordre suivant :

1. Analyse du projet existant et de son environnement.
2. Identification des risques et des dépendances.
3. Architecture fonctionnelle et technique.
4. Modèle de données.
5. Rôles et permissions.
6. Workflow de validation.
7. Gestion documentaire.
8. Gestion des médias, sources et consentements.
9. Historique et versions.
10. Administration.
11. Site public.
12. Recherche.
13. Pilote Havu.
14. Sauvegardes et conservation.
15. Tests, documentation et préparation au déploiement.

Les phases peuvent être adaptées selon les dépendances techniques, mais aucune exigence fondamentale de sécurité, de consentement ou de conservation ne doit être supprimée simplement pour aller plus vite.

## 94. Gestion des décisions manquantes

Lorsqu'une décision n'est pas précisée :

- Identifie le point manquant.
- Propose une solution adaptée.
- Explique brièvement les conséquences.
- Choisis une option prudente et réversible lorsque c'est possible.
- Documente les décisions.
- Demande une confirmation avant toute action irréversible ou décision importante touchant aux droits, aux données ou à l'architecture existante.

N'invente pas les données culturelles, les sources, les autorisations ou les résultats de tests.

## 95. Première action à effectuer

Commence par analyser l'environnement de développement disponible.

Présente ensuite un rapport comprenant :

- L'état du projet.
- Les technologies identifiées.
- Les fonctionnalités existantes.
- Les éléments manquants.
- Les risques techniques.
- Les besoins de stockage et d'archivage.
- Les premières décisions d'architecture.
- Le plan de réalisation proposé.

Si le projet existe déjà, travaille à partir de sa structure réelle. Si aucun projet n'existe, prépare le socle nécessaire avant de développer les fonctionnalités.

Ne considère pas le travail terminé après avoir produit le plan : poursuis l'implémentation par phases, exécute les tests et documente les résultats, dans les limites de l'environnement disponible.

## 96. Vision finale

URITHI doit devenir une mémoire numérique culturelle de référence pour la RDC.

Sa réussite ne se mesurera pas uniquement au nombre de pages ou de communautés répertoriées, mais à la qualité, à la profondeur, à la fiabilité, à la diversité et à la pérennité des connaissances conservées.

Chaque contenu doit aider une personne à comprendre une culture, son histoire, ses pratiques, ses langues et son évolution.

Le projet commence avec la communauté Havu comme pilote, puis s'étend progressivement aux autres communautés du pays, selon une méthode cohérente, respectueuse et adaptable.

**Construis URITHI pour aujourd'hui, mais pense dès le départ aux personnes qui voudront encore consulter cet héritage en 2100, en 2126 et au-delà.**