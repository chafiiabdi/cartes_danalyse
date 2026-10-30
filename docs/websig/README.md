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

## Comparaison exploratoire PMR / OpenStreetMap
La commande « Comparer les réseaux PMR et OSM » permet de visualiser simultanément les cheminements relevés (PMR, en bleu-vert) et le réseau OSM (gris pointillé), sans fusion des graphes ni modification des simulations. Une option repère les extrémités topologiques apparentes du réseau PMR à moins de 25 m d'un axe OSM, sous forme de points rouges. Cette distance est un critère indicatif de voisinage, non une norme d'accessibilité. Les impasses et limites de relevé peuvent produire des faux positifs. Les escaliers déclarés sont exclus des axes proposés ; l'absence de déclaration ne garantit pas la praticabilité.

La comparaison repose sur les instantanés des fichiers `docs/simulation/data/pmr.geojson` et `docs/simulation/data/osm_graph_01.json` à `osm_graph_06.json`, et se charge seulement à l'activation. Les calculs PMR et OSM de l'ancienne application ne sont pas affectés. Une validation terrain reste obligatoire pour confirmer une connexion utilisable en fauteuil roulant. L'analyse porte sur la proximité géométrique et les extrémités ; elle ne prouve ni que l'interruption est réelle, ni que la continuité OSM est accessible.
