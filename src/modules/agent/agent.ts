import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { llm } from "../llm";
import { ChainTool } from "langchain/tools";
import initNeo4jRagRetrieverChain from "./tools/rag";

import { Calculator } from "langchain/tools/calculator";
import initCypherQAChain from "./tools/cypher";


export default async function initAgent() {
    const tools = [
        new ChainTool({
            name: 'Neo4jCypherQAChain',
            description: 'Useful when answering questions about people, companies, technologies or frameworks',
            chain: await initCypherQAChain()
        }),
        new ChainTool({
            name: 'Neo4jRAGRetrieverChain',
            description: 'Useful when you need to identify text using semantic search using the the vector retriever',
            chain: await initNeo4jRagRetrieverChain()
        }),
    ]


    const executor = await initializeAgentExecutorWithOptions(
        tools,
        llm,
        {
            agentArgs: {
                prefix: 'You are a Syntax FM chatbot. Answer questions with the provided context only,  Do not answer any questions that do not relate to the podcast.',
            },
            agentType: "openai-functions",
            verbose: true,
        }
    );

    return executor
}
