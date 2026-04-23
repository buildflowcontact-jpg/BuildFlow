# Front - SQL Error Test Scenarios

Objectif: valider les erreurs applicatives attendues cote UI apres durcissement SQL.

## Perimetre

- Page projet taches
- Actions: creation de dependance, modification de dependance, suppression de tache, transition de statut
- Verification: message utilisateur non bloquant, comprehensible, et coherent avec la regle SQL

## Scenarios prioritaires

1. Cycle de dependance
- Action: creer A -> B puis tenter B -> A
- Attendu SQL: rejection cycle
- Attendu UI: message explicite indiquant cycle interdit

2. Dependance inter-projets
- Action: lier une tache projet X vers une tache projet Y
- Attendu SQL: rejection source/cible projet different
- Attendu UI: message explicite inter-projets interdit

3. Doublon de dependance
- Action: creer deux fois la meme dependance A -> B
- Attendu SQL: unique violation
- Attendu UI: message indiquant que le lien existe deja

4. Auto-dependance
- Action: tenter A -> A
- Attendu SQL: rejection auto-dependance
- Attendu UI: message explicite

5. Suppression tache parent
- Action: supprimer une tache qui a des sous-taches
- Attendu SQL: suppression bloquee
- Attendu UI: message orientant vers suppression/reassignation des sous-taches

6. Suppression tache avec dependances
- Action: supprimer une tache reliee en dependance
- Attendu SQL: suppression bloquee
- Attendu UI: message orientant vers retrait des dependances

7. Transition statut invalide
- Action: tenter une transition hors workflow
- Attendu SQL: transition invalide
- Attendu UI: message rappelant la transition autorisee

8. Passage a done sans role privilegie
- Action: utilisateur standard tente de passer une tache a done
- Attendu SQL: interdit
- Attendu UI: message role insuffisant

## Traces a conserver

- Capture ecran UI avant/apres action
- Message utilisateur exact
- Erreur SQL brute (console/devtools) si accessible
- Identifiant projet/tache teste

## Verdict

- PASS si tous les scenarios remontent un message utilisateur explicite et sans blocage de l'interface
- FAIL si message absent, incomprehensible, ou incoherent avec la regle SQL
