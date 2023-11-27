import { GraphCypherQAChain } from "langchain/chains/graph_qa/cypher";

import { llm } from "@/modules/llm";
import { initNeo4j } from "@/modules/neo4j";
import { PromptTemplate } from "langchain/prompts";

/*
Task:Generate Cypher statement to query a graph database.
Instructions:
Use only the provided relationship types and properties in the schema.
Do not use any other relationship types or properties that are not provided.
Schema:
{schema}
Note: Do not include any explanations or apologies in your responses.
Do not respond to any questions that might ask anything else than for you to construct a Cypher statement.
Do not include any text except the generated Cypher statement.

The question is:
{question}
*/

const cypherPrompt = PromptTemplate.fromTemplate(`
Generate a Cypher statement with the following schema to answer the user's question.
To look up people,  companies, technologies or framework use the Entity label and name property.  For example: MATCH (t:Entity) WHERE toLower(t.name) CONTAINS 'React'
To find mentions in an Episode, use the following pattern: (:Episode)-[:HAS_TOPIC]->(:Topic)-->(:Entity)

Schema:
{schema}

The question is:
{question}
`)

export default async function initCypherQAChain(): Promise<GraphCypherQAChain> {
    const graph = await initNeo4j()

    return GraphCypherQAChain.fromLLM({
        llm,
        graph,
        cypherPrompt
    })
}
