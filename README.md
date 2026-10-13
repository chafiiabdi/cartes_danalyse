# Carte interactive PMR – Anglet

## Préparation des données
Exporter trois résultats PostGIS au format GeoJSON EPSG:4326, sous les noms :
- data/iso_300s.geojson
- data/iso_600s.geojson
- data/iso_900s.geojson

Les fichiers doivent contenir les géométries linéaires de cheminements atteignables (sans escaliers) et peuvent contenir les attributs `stop_id`, `quai_id`, `duree_sec`.

Dans QGIS : clic droit sur chaque couche de résultat → Exporter → Sauvegarder les entités sous → GeoJSON → SCR EPSG:4326.

## Test local
Dans le dossier : `python -m http.server 8000`, puis ouvrir http://localhost:8000 (ne pas ouvrir index.html directement en file://).

## Publication GitHub Pages
Créer un dépôt, envoyer `index.html` et le dossier `data`, puis Settings → Pages → Deploy from a branch → main / (root).

**Important :** Ne publier que des données autorisées à la diffusion publique. GitHub Pages est public. Les GeoJSON doivent être produits par l'analyse pgRouting ; cette application ne recalcule pas les itinéraires.
