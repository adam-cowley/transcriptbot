import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { llm } from "../llm";
import { ChainTool } from "langchain/tools";
import initNeo4jRagRetrieverChain from "./tools/rag";
import initCypherQAChain from "./tools/cypher";
import { loadPromptText } from "./prompts";


const prefix = `You are a Syntax FM chatbot.
Answer questions with the provided context only,  Do not answer any questions that do not relate to the podcast.
Go above and beyond to provide as much information from the context as possible in the answer including links and timestamps where possible.

When mentioning titles provide a link, for example:
The episode that mentions Neo4j is [Title of Episode](https://syntax.fm/show/954/slug-of-episode/transcript).`


export default async function initAgent() {
    const tools = [
        // new ChainTool({
        //     name: 'Neo4jCypherQAChain',
        //     description: 'Useful when answering questions about people, companies, technologies or frameworks',
        //     chain: await initCypherQAChain()
        // }),
        // new ChainTool({
        //     name: 'Neo4jRAGRetrieverChain',
        //     description: 'Useful when you need to identify text using semantic search using the the vector retriever',
        //     chain: await initNeo4jRagRetrieverChain()
        // }),
        new ChainTool({
            name: 'Neo4jCypherQAChain',
            // description: 'Useful when answering questions about people, companies, technologies or frameworks',
            description: 'Useful when answering questions about movies or actors',
            chain: await initCypherQAChain()
        }),
        // new ChainTool({
        //     name: 'Neo4jRAGRetrieverChain',
        //     description: 'Useful when you need to identify text using semantic search using the the vector retriever',
        //     chain: await initNeo4jRagRetrieverChain()
        // }),
    ]

    const executor = await initializeAgentExecutorWithOptions(
        tools,
        llm,
        {
            agentArgs: {
                prefix,
            },
            returnIntermediateSteps: true,
            agentType: "openai-functions",
            verbose: true,
        }
    );

    return executor
}
