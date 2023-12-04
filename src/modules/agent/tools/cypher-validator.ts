export class Schema {
    constructor(public from: string, public relationship: string, public to: string) { }
}

export enum RelationshipExistsDecision {
    NOT_FOUND,
    FOUND,
    REVERSE_DIRECTION,
}

export class CypherQueryCorrector {

    private nodePattern: string = '\\(([^()]*?)\\)'
    private relationshipPattern: string = '(\<)?-(.*)-(\>)?'

    constructor(private readonly schema: Schema[]) { }

    private verifyNodeLabel(label: string): boolean {
        return this.schema.some(schema => schema.from == label || schema.to == label)
    }

    private extractLabels(pattern: string): string[] {
        // Strip brackets
        if (pattern.endsWith(')')) {
            pattern = pattern.substring(0, pattern.length - 1)
        }
        if (pattern.startsWith('(')) {
            pattern = pattern.substring(1)
        }

        // Split labels
        if (pattern.includes(':')) {
            const labels = pattern.split(':')

            // Remove variable or empty string
            labels.splice(0, 1)

            return labels
        }

        return [pattern]

    }

    private extractRelationshipTypes(pattern: string): string[] {
        // Strip brackets
        let cleaned = pattern.split(']')[0].split('[')[1]

        //  Strip variable
        if (cleaned.includes(':')) {
            const parts = cleaned.split(':')
            cleaned = parts[parts.length - 1]
        }
        // Strip variable length path
        if (cleaned.includes('*')) {
            const parts = cleaned.split('*')
            cleaned = parts[0]
        }

        return cleaned.split('|')
    }


    private anyRelationshipExists(from: string[], rel: string[], to: string[]) {
        for (const f of from) {
            for (const t of to) {
                for (const r of rel) {
                    if (this.relationshipExists(f, r, t)) {
                        return RelationshipExistsDecision.FOUND
                    }
                    else if (this.relationshipExists(t, r, f)) {
                        return RelationshipExistsDecision.REVERSE_DIRECTION
                    }
                }
            }
        }
        return RelationshipExistsDecision.NOT_FOUND
    }

    private anyRelationshipTypeExists(rels: string[]): boolean {
        for (const rel of rels) {
            if (this.relationshipTypeExists(rel)) {
                return true
            }
        }
        return false
    }

    private relationshipTypeExists(rel: string): boolean {
        return this.schema.some(schema => schema.relationship == rel)
    }

    private relationshipExists(from: string, rel: string, to: string): boolean {
        return this.schema.some(schema => schema.from == from && schema.relationship == rel && schema.to == to)
    }

    private noLabelError(label: string): string {
        return `Node label not found: ${label}`
    }

    private noRelationshipTypeError(types: string[]): string {
        return `Relationship type(s) not found: ${types.join('|')}`
    }

    private noRelationshipError(from: string[], rel: string[], to: string[]): string {
        return `Relationship combination not found: (:${from.join(':')})-[:${rel.join("|")}]->(:${to.join(':')})`
    }

    validate(query: string): { query: string, errors: string[] } {
        // Given a query string: MATCH (a:Person)-[:ACTED_IN]->(b:Movie) RETURN a, b)
        // Extract the pattern: (a:Person)-[:ACTED_IN]->(b:Movie)
        const errors = []

        // Verify labels
        const nodePattern = new RegExp(this.nodePattern, 'g')
        for (const node of query.matchAll(nodePattern)) {
            const labels = this.extractLabels(node[1])

            for (const label of labels) {
                if (!this.verifyNodeLabel(label)) {
                    errors.push(this.noLabelError(label))
                }
            }
        }

        const patternRegex = new RegExp(`${this.nodePattern}${this.relationshipPattern}${this.nodePattern}`, 'g')
        const matches = query.matchAll(patternRegex);

        for (const match of matches) {
            const [
                pattern, left, incoming, rel, outgoing, right
            ] = match

            const leftLabels = this.extractLabels(left)
            const rightLabels = this.extractLabels(right)
            const relationshipTypes = this.extractRelationshipTypes(rel)


            if (!this.anyRelationshipTypeExists(relationshipTypes)) {
                errors.push(this.noRelationshipTypeError(relationshipTypes))
            }
            // - If direction is OUTGOING, find schema items where `from` is the same as the first node label and `relationship` is the same as the relationship type
            else if (outgoing !== undefined) {
                const exists = this.anyRelationshipExists(leftLabels, relationshipTypes, rightLabels)

                if (exists === RelationshipExistsDecision.NOT_FOUND) {
                    errors.push(this.noRelationshipError(leftLabels, relationshipTypes, rightLabels))
                }
                else if (exists === RelationshipExistsDecision.REVERSE_DIRECTION) {
                    query = query.replace(pattern, `(${left})<-${rel}-(${right})`)
                }
            }
            // - if direction is incomingm find schema items where `to` is the same as the first node label and `relationship` is the same as the relationship type
            else if (incoming !== undefined) {
                const exists = this.anyRelationshipExists(rightLabels, relationshipTypes, leftLabels)

                if (exists === RelationshipExistsDecision.NOT_FOUND) {
                    errors.push(this.noRelationshipError(rightLabels, relationshipTypes, leftLabels))
                }
                else if (exists === RelationshipExistsDecision.REVERSE_DIRECTION) {
                    query = query.replace(pattern, `(${left})-${rel}->(${right})`)
                }
            }
        }

        return { query, errors }
    }
}
