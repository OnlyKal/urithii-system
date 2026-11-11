# Guide d'utilisation de l'espace contributeur

L'espace contributeur est accessible depuis le site (`/connexion`, puis `/admin`). Le menu n'affiche que les espaces autorisés par vos rôles. L'interface est disponible en français, anglais, lingala et swahili (sélecteur en haut à droite).

## Deux types de comptes
| Compte | Rôle technique | Ce qu'il voit et fait |
|---|---|---|
| **Administrateur** | `SUPER_ADMIN` | Tout : comptes, communautés, dossiers de collecte, vérification, validation, publication, médias, sources, archives, paramètres |
| **Collecteur** | `COLLECTEUR` | Son tableau de bord, ses collectes et les communautés. Il remplit le formulaire de collecte et soumet ses dossiers ; il ne publie pas |

Les comptes se créent dans **Collecteurs › Comptes** (choix « Type de compte »). Les rôles plus anciens (éditeur, validateur…) restent reconnus pour les comptes existants, mais ne sont plus proposés.

## Organisation de l'administration
| Espace | Administrateur | Collecteur |
|---|---|---|
| **Tableau de bord** | Dossiers à vérifier, à publier, en correction ; chiffres clés ; conservation | Ses dossiers à reprendre, corrections demandées, avancement |
| **Collectes** (« Mes collectes ») | Tous les dossiers, filtres par statut, communauté et collecteur | Ses dossiers |
| **Validations** | Dossiers à valider, fiches culturelles, signalements du public | — |
| **Communautés** | Dossier central : présentation, collectes, contenus, personnes ressources, missions | Consultation, « Nouvelle collecte pour cette communauté » |
| **Collecteurs** | Suivi des collecteurs, comptes, missions, questionnaires | — |
| **Médiathèque** | Tous les fichiers | (dans le formulaire) |
| **Sources et archives** | Sources, transcriptions et traductions, personnes ressources, sauvegardes | (dans le formulaire) |
| **Paramètres** | Formulaire de collecte, catégories, lieux, langues, rôles et permissions, journal d'audit | — |

## Le dossier de collecte
Un dossier rassemble, pour une communauté, tout ce qu'un collecteur a recueilli, dans un **formulaire en 20 étapes** (identification, histoire, langue, organisation sociale, gastronomie, vêtements, artisanat, musique, cérémonies, croyances, médecine traditionnelle et nature, éducation, économie, territoire, personnalités, témoignages, sources, médias, état actuel, vérification).
- **Enregistrement automatique**, barre d'avancement générale et état de chaque étape.
- Chaque champ peut être marqué **inconnu**, **non documenté** ou **à confirmer** : on n'invente jamais une réponse.
- **Éléments répétables** (plats, danses, lieux, personnalités, témoignages…), à dupliquer ou réordonner.
- **Médias et sources** attachés à l'étape ou à l'élément concerné ; un fichier téléversé une fois peut servir à plusieurs étapes. Les sources, personnes et fichiers se créent sur place.
- **Témoignages** reliés à plusieurs étapes, avec témoin et fichier original. Le témoin suffit à étayer les étapes concernées.
- Contenus **sensibles** signalés : ils ne sont jamais publiés automatiquement.
- **Récapitulatif** avant soumission : étapes complètes, partielles ou vides, points à vérifier, aperçu complet.

Statuts : Brouillon → En cours de collecte → Soumis → En cours de vérification → Corrections demandées / Validé → Publié ; Archivé (sans suppression).

**Vérification par l'administrateur** : pour chaque étape, *Approuver*, *Demander une correction* (avec commentaire) ou *Rejeter*. « Demander des corrections » renvoie le dossier au collecteur, qui voit les étapes concernées. L'administrateur peut aussi corriger directement (tracé dans l'historique). Une communauté proposée par un collecteur est créée ou associée à une communauté existante avant la validation.

**Publication** : chaque étape approuvée devient une fiche culturelle (dans la catégorie de publication de l'étape), chaque élément répété une fiche à part. Les fiches suivent les règles habituelles : une fiche qui ne remplit pas les conditions de publication (source ou témoignage avec consentement, droits des médias…) reste validée en attente ; une fiche sensible n'est pas publiée. Un dossier publié est verrouillé : l'administrateur le rouvre (**Rouvrir pour modification**) ou le renvoie au collecteur (**Demander des corrections**) ; republier met à jour les mêmes fiches (nouvelle version).

**Adapter le formulaire** : **Paramètres › Formulaire de collecte** — modifier une étape, ses champs et ses éléments répétables, choisir sa catégorie de publication, la désactiver, ou ajouter une nouvelle étape. Le code d'une étape et de ses champs existants ne change plus, pour préserver les données saisies.

Pour un parcours complet pas à pas, voir le [guide](../GUIDE.md).

## Importer des communautés
**Communautés › Importer (JSON)** : choisissez un fichier, analysez-le (rien n'est enregistré), puis importez. Pas de doublon, pas de publication automatique, rien d'effacé ; les lieux et langues inconnus sont signalés. Format et règles : [IMPORT_COMMUNAUTES.md](IMPORT_COMMUNAUTES.md).

## Premiers pas (administrateur)
1. **Collecteurs › Comptes** : créez les comptes des collecteurs. Le mot de passe temporaire s'affiche **une seule fois** : transmettez-le par un canal sûr. Il devra être changé à la première connexion.
2. **Paramètres** : vérifiez les lieux, langues et catégories, et au besoin le formulaire de collecte.
3. **Communautés** : complétez la fiche de la communauté pilote Havu.
4. **Sources et archives › Archives et sauvegardes** : lancez une première sauvegarde et un test de restauration.

## Rôles techniques (comptes existants)
| Rôle | Ce qu'il fait |
|---|---|
| Super administrateur | Tout, y compris comptes, permissions, conservation, exports |
| Responsable de collecte | Crée et suit ses missions, collecte, gère les personnes ressources |
| Collecteur | Collecte, téléverse, crée des fiches et les soumet |
| Transcripteur, Traducteur | Rédige et vérifie les textes |
| Validateur culturel | Approuve ou renvoie les fiches en validation culturelle |
| Éditeur | Vérification documentaire, validation éditoriale, publication, suspension |

## Le cycle d'une fiche
```
Brouillon → Soumis → (Transcription → Traduction) → Vérification documentaire
→ Validation culturelle → Validation éditoriale → Validé → Publié (ou Programmé)
```
À chaque étape, une fiche peut repartir **à compléter** (avec motif), passer **en attente d'autorisation complémentaire** ou être **archivée**. Une fiche publiée peut être mise **en révision**, **suspendue** ou **retirée**. Toutes les décisions sont conservées dans « Décisions et commentaires ».

Le dossier d'une fiche réunit tout au même endroit :
- **Avancement du dossier** : les étapes du parcours (complètes ou à reprendre), les traductions, l'étape de validation, et ce qu'il reste à faire.
- **Modifications demandées** : quand un validateur renvoie la fiche, sa demande s'affiche en haut, et le bouton principal devient « Compléter la fiche ».
- **Prochaine étape** : les actions proposées dépendent de vos permissions (« Soumettre pour validation », « Valider », « Publier », « Demander des compléments »…). L'action qui fait avancer la fiche est mise en avant. Un bouton grisé indique une règle de séparation des rôles (fiche sensible). Les **conditions de publication non remplies** s'affichent juste dessous.
- Onglets **Contenu**, **Médias et traductions**, **Liens et accès** (relations entre fiches, accès nominatifs pour les niveaux « Équipe désignée » et « Autorisation particulière ») et **Historique et échanges** (commentaires, décisions, versions : cochez deux versions pour les comparer ; « Restaurer » crée une nouvelle version identique à l'ancienne).

Les fiches à traiter se trouvent dans **Validations › Fiches culturelles › À traiter**, que l'on peut affiner par étape (vérification documentaire, validation culturelle…).

## Niveaux d'accès
| Niveau | Qui voit |
|---|---|
| Public | Tout le monde, **une fois la fiche publiée** |
| Utilisateurs autorisés | Tous les contributeurs connectés |
| Équipe désignée, Autorisation particulière | L'auteur, le super administrateur et les personnes ayant un accès nominatif |
| Conservation privée | L'auteur et le super administrateur |

## Médias
- Téléversez toujours l'**original**. Les photos reçoivent automatiquement une version web et une miniature.
- Un média apparaît sur le site dès qu'il est « Public » et qu'il illustre une fiche publiée. La case « droits de diffusion confirmés » est une information facultative.
- « Vérifier l'intégrité » recalcule l'empreinte des fichiers.

## Signalements
Chaque demande reçue par le formulaire public apparaît dans **Validations › Signalements du public**. « Suspendre la diffusion » retire immédiatement le contenu du site, sans rien supprimer. Indiquez toujours la décision prise et sa justification.

## Conservation
- **Lancer une sauvegarde** : copie complète de la base et des fichiers, avec manifeste d'empreintes (dossier `server-app/backups/`).
- **Tester la restauration** : restaure la dernière sauvegarde dans un dossier temporaire et vérifie la base et chaque fichier.
- **Contrôler l'intégrité** : vérifie l'empreinte de tous les fichiers conservés.
- **Export complet** : toutes les données en JSON (sans mots de passe), pour une migration ou une passation.

Les mêmes opérations existent en ligne de commande (voir le [README](../README.md)).
