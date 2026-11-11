# Politique d'archivage

Objectif : maximiser les chances que les contenus d'URITHI restent conservés et lisibles pendant des décennies, idéalement un siècle ou davantage (§50). Aucun système ne le garantit seul : il faut une stratégie technique, documentaire, organisationnelle et financière.

## 1. Originaux et dérivés
- Chaque fichier téléversé est un **original conservé tel quel**, en lecture seule, identifié par une empreinte SHA-256.
- Les versions de consultation (photo redimensionnée, miniature) sont des **fichiers dérivés distincts**, reliés à leur original, avec la description de la transformation.
- Aucun fichier n'est remplacé silencieusement.

## 2. Formats recommandés (§51)
| Type | Original (archive) | Consultation |
|---|---|---|
| Texte | UTF-8 (TXT) | Affichage web |
| Documents | PDF/A si possible | PDF |
| Images | TIFF ou JPEG de la meilleure qualité disponible | WebP généré automatiquement |
| Audio | WAV pour les masters | MP3, WAV ou M4A, lus par tous les navigateurs |
| Vidéo | MP4 encodé en H.264, de la meilleure qualité disponible | Le même fichier, lu par tous les navigateurs |

**Formats acceptés à l'envoi** : JPEG, PNG, WebP, TIFF, MP3, WAV, M4A, MP4 (vidéo H.264), PDF, TXT. Les autres formats (MOV, WebM, MKV, OGG, FLAC, MP4 en HEVC…) sont refusés, parce que tous les navigateurs ne savent pas les lire : il faut les convertir avant l'envoi (par exemple avec HandBrake pour la vidéo).
| Métadonnées | Base SQLite et exports JSON documentés | — |

## 3. Sauvegardes (§52)
- **Automatiques** : toutes les 24 heures par défaut (`AUTO_BACKUP_HOURS`), précédées d'un contrôle d'intégrité.
- **Complètes** : base de données et **tous** les fichiers, avec un manifeste listant chaque fichier, sa taille et son empreinte.
- **Plusieurs copies indépendantes** : une copie miroir automatique peut être envoyée vers un second emplacement (`BACKUP_MIRROR_DIR` : disque externe, serveur distant monté). Une troisième copie hors site est fortement recommandée.
- **Protégées** : les copies sont en lecture seule et aucune sauvegarde n'est supprimée automatiquement. La rotation est une décision humaine.
- **Testées** : un test de restauration doit être réalisé au moins une fois par mois (**Administration → Conservation → Tester la restauration**).

## 4. Contrôles d'intégrité (§54)
- Recalcul périodique des empreintes de tous les fichiers ; les fichiers corrompus ou manquants sont signalés sur le tableau de bord.
- En cas d'anomalie : restaurer le fichier depuis la dernière sauvegarde vérifiée.

## 5. Migration des formats
Lorsqu'un format devient obsolète, on crée de nouveaux fichiers dérivés dans un format actuel, **sans supprimer l'original**, en documentant la transformation.

## 6. Pérennité institutionnelle (§55)
- Documentation technique complète dans le dépôt (`README.md`, `docs/`).
- Exports complets en JSON documenté (**Conservation → Export complet**), sans dépendance à un fournisseur.
- Procédure de passation : transmettre le dépôt du code, la dernière sauvegarde vérifiée, les accès d'hébergement et ce dossier `docs/`.
- Estimation des coûts récurrents à tenir à jour : volume de stockage (les vidéos dominent), copies hors site, hébergement, maintenance.
