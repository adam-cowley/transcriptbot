// Set topic text from utterances
MATCH (t:Topic)-[:HAS_UTTERANCE]->(u)
WITH t, u ORDER BY u.order ASC
WITH t, collect(u) AS utterances

CALL {
    WITH t, utterances
    SET t.text =reduce(r = '', u in utterances | r + u.speaker + ': '+ u.text + '\n')

} IN TRANSACTIONS OF 100 ROWS
;