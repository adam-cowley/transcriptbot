import { GraphCypherQAChain } from "langchain/chains/graph_qa/cypher";

import { initLLM } from "@/modules/llm";
import { initNeo4j } from "@/modules/neo4j";
import { PromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/runnables";
import { StringOutputParser } from "langchain/schema/output_parser";

const cypherPrompt = PromptTemplate.fromTemplate(`
Generate a Cypher statement with the following schema to answer the user's question.
Use only the provided relationship types and properties in the schema.
Do not use any other relationship types or properties that are not provided.

Schema:
{schema}

To find technology mentions in an Episode, use the following pattern: (:Episode)-[:HAS_TOPIC]->(:Topic)-->(:Entity).
Entity nodes have a name property which contains lower case text, do no use toLower() to convert values.
When returning information about an episode, always return the title and URL.
When returning information about a topic or utterance, include the timestamp.
An entity contains multiple topics, so when querying :HAS_TOPIC without an aggregate function, use DISTINCT.

Do not respond to any questions that might ask anything else than for you to construct a Cypher statement.
Do not include any text except the generated Cypher statement.mp.

The question is:
{question}
`)

export default async function initCypherQAChain(): Promise<RunnableSequence> {
    const graph = await initNeo4j()
    const llm = await initLLM('gpt-3.5-turbo')

    interface CypherQAChainInput {
        question: string
    }
    return RunnableSequence.from<CypherQAChainInput, string>([
        {
            question: (input: CypherQAChainInput) => input.question,
            schema: () => graph.getSchema(),
        },
        cypherPrompt,
        llm,
        new StringOutputParser(),
    ])
}

export async function initCypherQAChainFromClass(): Promise<GraphCypherQAChain> {
    const graph = await initNeo4j()

    const llm = await initLLM('gpt-3.5-turbo')

    return GraphCypherQAChain.fromLLM({
        llm,
        graph,
        cypherPrompt
    })
}
