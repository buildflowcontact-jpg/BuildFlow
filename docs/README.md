# Documentation technique – Indexation & Maintenance

## Stratégie d’indexation
- Tout index FK doit être conservé, même unused_index, pour garantir la performance et l’intégrité référentielle.
- Les unused_index non FK peuvent être supprimés après vérification advisor immédiate.
- Ne jamais supprimer un index FK sans re-check advisor : si une alerte FK apparaît, restaurer l’index.

## Routine de vérification
1. Lancer les commandes :
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - Snapshot advisors Supabase (via dashboard ou API)
2. Si unused_index : vérifier s’il s’agit d’un index FK (à conserver)
3. Documenter toute suppression d’index ou modification de FK

## Procédure de nettoyage safe
- Supprimer uniquement les unused_index non FK
- Toujours re-checker les advisors après chaque batch
- Restaurer immédiatement tout index FK si une alerte FK apparaît

## Automatisation recommandée
- Intégrer ces checks dans le pipeline CI/CD
- Planifier une vérification mensuelle/trimestrielle

---

Pour toute évolution du schéma, suivre cette routine pour garantir la stabilité et la performance.
