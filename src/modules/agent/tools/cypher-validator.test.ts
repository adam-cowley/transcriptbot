import { Schema, CypherQueryCorrector, RelationshipExistsDecision } from './cypher-validator'

describe('Cypher Validator', () => {
    const schemas: Schema[] = [
        new Schema("Person", "FRIEND_OF", "Person"),
        new Schema("Person", "ENEMY_OF", "Person"),
        new Schema("Person", "HAS_ENROLMENT", "Enrolment"),
        new Schema("Enrolment", "FOR_COURSE", "Course"),
        new Schema("Enrolment", "HAS_ATTEMPT", "Attempt"),
    ];

    const queryCorrector = new CypherQueryCorrector(schemas);

    describe('extractLabels', () => {
        it('should identify a single label', () => {
            expect(queryCorrector['extractLabels']('(a:Person)')).toEqual(['Person'])
        })

        it('should identify multiple labels', () => {
            expect(queryCorrector['extractLabels']('(a:Person:Student)')).toEqual(['Person', 'Student'])
        })
    })

    describe('extractRelationshipTypes', () => {
        it('should identify a single relationship type', () => {
            expect(queryCorrector['extractRelationshipTypes']('[:FRIEND_OF]')).toEqual(['FRIEND_OF'])
        })

        it('should identify multiple relationship types', () => {
            expect(queryCorrector['extractRelationshipTypes']('-[:FRIEND_OF|ENEMY_OF]->')).toEqual(['FRIEND_OF', 'ENEMY_OF'])
        })

        it('should identify multiple relationship types in variable length path', () => {
            expect(queryCorrector['extractRelationshipTypes']('[:FRIEND_OF|ENEMY_OF*2..]')).toEqual(['FRIEND_OF', 'ENEMY_OF'])
        })

        it('should ignore the variable', () => {
            expect(queryCorrector['extractRelationshipTypes']('[r:FRIEND_OF|ENEMY_OF*2..]')).toEqual(['FRIEND_OF', 'ENEMY_OF'])
        })
    })

    describe('relationshipExists', () => {
        it('should return true if the relationship exists', () => {
            expect(queryCorrector['relationshipExists']('Person', 'FRIEND_OF', 'Person')).toEqual(true)
            expect(queryCorrector['relationshipExists']('Person', 'ENEMY_OF', 'Person')).toEqual(true)
        })

        it('should return false if relationship does not exist', () => {
            expect(queryCorrector['relationshipExists']('Person', 'FRIEND_OF', 'Enrolment')).toEqual(false)
        })
    })

    describe('anyRelationshipExists', () => {
        it('should return true if any relationship exists', () => {
            expect(queryCorrector['anyRelationshipExists'](['Person', 'Student'], ['FRIEND_OF'], ['Person'])).toEqual(RelationshipExistsDecision.FOUND)
            expect(queryCorrector['anyRelationshipExists'](['Person'], ['ENEMY_OF'], ['Person', 'Student'])).toEqual(RelationshipExistsDecision.FOUND)
        })

        it('should return false if no relationship exists', () => {
            expect(queryCorrector['anyRelationshipExists'](['Person'], ['FRIEND_OF'], ['Enrolment'])).toEqual(RelationshipExistsDecision.NOT_FOUND)
        })
    })

    describe('validate', () => {
        it('should identify a valid query', () => {
            expect(queryCorrector.validate("MATCH (a:Person)-[:HAS_ENROLMENT]->(b:Enrolment) RETURN a, b")).toEqual({
                query: "MATCH (a:Person)-[:HAS_ENROLMENT]->(b:Enrolment) RETURN a, b",
                errors: []
            })
        })

        it('should identify an invalid outgoing label', () => {
            const { errors } = queryCorrector.validate("MATCH (a:Foo)-[:HAS_ENROLMENT]->(b:Person) RETURN a, b")

            expect(errors).toEqual(expect.arrayContaining([
                queryCorrector['noLabelError']('Foo')
            ]))
        })

        it('should identify an invalid incoming label', () => {
            const { errors } = queryCorrector.validate("MATCH (a:Person)-[:HAS_ENROLMENT]->(b:Foo) RETURN a, b")

            expect(errors).toEqual(expect.arrayContaining([
                queryCorrector['noLabelError']('Foo')
            ]))
        })

        it('should identify a single invalid outgoing relationship', () => {
            const { errors } = queryCorrector.validate("MATCH (a:Person)-[:HAS_FOO]->(b:Foo) RETURN a, b")

            expect(errors).toEqual(expect.arrayContaining([
                queryCorrector['noLabelError']('Foo')
            ]))
        })

        it('should redirect an outgoing relationship going in the wrong direction', () => {
            const { query, errors } = queryCorrector.validate("MATCH (a:Enrolment)-[:HAS_ENROLMENT]->(b:Person) RETURN a, b")

            expect(query).toEqual("MATCH (a:Enrolment)<-[:HAS_ENROLMENT]-(b:Person) RETURN a, b")
            expect(errors.length).toEqual(0)
        })

        it('should redirect an incoming relationship going in the wrong direction', () => {
            const { query, errors } = queryCorrector.validate("MATCH (a:Person)<-[:HAS_ENROLMENT]-(b:Enrolment) RETURN a, b")

            expect(query).toEqual("MATCH (a:Person)-[:HAS_ENROLMENT]->(b:Enrolment) RETURN a, b")
            expect(errors.length).toEqual(0)
        })
    })
})
