# Carte interactive des cheminements à Anglet

Choisissez le réseau PMR ou BD TOPO, puis un accès prioritaire et une durée de 5, 10 ou 15 minutes. Les réseaux sont calculés séparément.

Cliquez sur un tronçon pour consulter sa classe et les motifs associés. Vous pouvez afficher les classes ou les tranches de temps et exporter les portions atteintes en GeoJSON ou CSV. Les statistiques représentent les longueurs atteintes.

## Règles de simulation

- Conforme : vitesse de 6 km/h.
- Non conforme : vitesse de 3 km/h, avec conservation des motifs. Les anciens blocages autres que les escaliers sont regroupés dans cette classe.
- Inconnu : informations insuffisantes, signalées dans le détail du tronçon.
- Escalier : bloquant et exclu du calcul.

Il s’agit d’une simulation exploratoire. Les non-conformités sont franchissables dans le modèle et peuvent rester impraticables sur le terrain. Les raccords de départ sont supposés praticables et inclus dans le temps. Les travaux ne sont pas intégrés.

Un accès sans raccord valable ne produit pas de résultat ; la carte en indique la raison. Un tronçon hors résultat peut être trop éloigné ou déconnecté, sans être bloquant.

Les données publiées sont une copie statique. Leur date figure dans les règles de calcul de l’interface. Les mises à jour ne sont pas automatiques.

Fond de carte : OpenStreetMap. Moteur cartographique : OpenLayers, distribué avec sa licence.
