# Carte interactive PMR — Anglet

Placez dans `data/` quatre fichiers GeoJSON en EPSG:4326 :
- `iso_300s.geojson`
- `iso_600s.geojson`
- `iso_900s.geojson`
- `stops_quai_PMR.geojson`

Pour tester localement : `python -m http.server 8000`, puis ouvrez http://localhost:8000/.

Pour publier : envoyez le dossier (avec `index.html` à la racine) dans votre dépôt GitHub, puis activez Settings > Pages > Deploy from a branch > main > /(root).

Les fichiers GeoJSON doivent être autorisés à la diffusion publique.
