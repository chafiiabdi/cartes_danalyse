# Observatoire territorial PMR — Anglet (nouveau WebSIG)

Application **indépendante** : https://chafiiabdi.github.io/cartes_danalyse/websig/

⚠️ **Ne pas modifier** l'application historique `docs/simulation/` ni ses données. Ce nouveau WebSIG est isolé dans `docs/websig/`.

## Fonctionnalités disponibles
- Carte OpenLayers responsive, zoom, inspection, recherche et légendes ;
- 6 thématiques : priorité, densité INSEE, desserte à 15 min, quartiers, offre de transports, travaux ;
- Filtres de dates pour travaux, affichage facultatif des couches et KPI ;
- Mode présentation, impression/PDF navigateur et exports GeoJSON/CSV ;
- Navigation clavier partielle, structure sémantique et textes alternatifs.

## Origine des données
Exports GeoJSON statiques effectués le 28 octobre 2026 depuis Supabase `pmr` :
- `analyses.indicateur_carreau_5_3` et `analyses.indicateur_quartier_5_3`, scénario **BDTOPO_PRUDENT / PRIORITAIRES** ;
- `analyses.offre_arret_5_3` (offre jour type, pas du temps réel) ;
- `travaux.chantier` (emprises et dates prévisionnelles).
Géométries reprojetées en EPSG:4326. Le fichier CSV d'export ne contient pas de géométrie. L'export GeoJSON comprend tous les objets de la couche, ou les travaux filtrés.

## Sécurité et portée
Aucune clé de base de données dans le code. Le site public sert uniquement des exports statiques. Ne pas y déposer de données confidentielles. Authentification/gestion des permissions, backoffice d'édition, actualisation automatisée, catalogage avancé et calcul de nouveaux itinéraires ne sont **pas encore implémentés**. La conformité RGAA > 85 % nécessite un audit réel ; elle n'est pas revendiquée ici.

## Déploiement
Dépôt GitHub Pages configuré sur `main/docs` : ouvrir `/websig/`. Le répertoire `docs/simulation/` reste inchangé.

Licence du code à définir avant réutilisation externe ; respecter les licences des données et d'OpenStreetMap.
