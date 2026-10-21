# Carte interactive PMR — Anglet

## Nouvelle simulation interactive

**[Ouvrir la carte PMR / BD TOPO](https://chafiiabdi.github.io/cartes_danalyse/simulation/)**

Calcul à 300, 600 et 900 secondes depuis un accès prioritaire, réseaux séparés,
motifs des non-conformités, escaliers bloquants et exclus, statistiques par longueur
et export GeoJSON / CSV. [Documentation](docs/simulation/README.md).

La version publiée se trouve dans `docs/` (source GitHub Pages : `main` / `docs`).
Les fichiers à la racine ci-dessous correspondent à la carte précédente et sont conservés.

## Carte précédente

Placez dans `data/` quatre fichiers GeoJSON en EPSG:4326 :
- `iso_300s.geojson`
- `iso_600s.geojson`
- `iso_900s.geojson`
- `stops_quai_PMR.geojson`

Pour tester localement : `python -m http.server 8000`, puis ouvrez http://localhost:8000/.

Pour publier : envoyez le dossier (avec `index.html` à la racine) dans votre dépôt GitHub, puis activez Settings > Pages > Deploy from a branch > main > /(root).

Les fichiers GeoJSON doivent être autorisés à la diffusion publique.
