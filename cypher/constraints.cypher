CREATE CONSTRAINT FOR (e:Episode) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT FOR (e:Topic) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT FOR (e:Utterance) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT FOR (e:Person) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT FOR (e:Entity) REQUIRE e.name IS UNIQUE;

CALL db.index.vector.createNodeIndex(
    'utterances',
    'Utterance',
    'embedding',
    1536,
    'cosine'
);
