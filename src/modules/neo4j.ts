import { Neo4jVectorStore } from "langchain/vectorstores/neo4j_vector";
import { embeddings } from "./llm";
import { VectorStoreRetriever } from "langchain/vectorstores/base";
import { Neo4jGraph } from "langchain/graphs/neo4j_graph";
import neo4j, { Driver } from "neo4j-driver";

let driver: Driver
let graph: Neo4jGraph
let vectorStore: Neo4jVectorStore
let retriever: VectorStoreRetriever


export async function initDriver(): Promise<Driver> {
    if (!driver) {
        driver = neo4j.driver(
            process.env.NEO4J_URI as string,
            neo4j.auth.basic(
                process.env.NEO4J_USERNAME as string,
                process.env.NEO4J_PASSWORD as string,
            )
        )
    }

    return driver
}

export async function initNeo4j(): Promise<Neo4jGraph> {
    if (!graph) {
        graph = await Neo4jGraph.initialize({
            url: process.env.NEO4J_URI as string,
            username: process.env.NEO4J_USERNAME as string,
            password: process.env.NEO4J_PASSWORD as string,
        })
    }

    return graph
}

export async function initNeo4jVectorStore(): Promise<{ vectorStore: Neo4jVectorStore, retriever: VectorStoreRetriever }> {
    if (!vectorStore) {
        vectorStore = await Neo4jVectorStore.initialize(embeddings, {
            url: process.env.NEO4J_URI as string,
            username: process.env.NEO4J_USERNAME as string,
            password: process.env.NEO4J_PASSWORD as string,
            indexName: 'utterances',
            embeddingNodeProperty: 'embedding',
            textNodeProperty: 'text',
            retrievalQuery: `
            MATCH (node)<-[:HAS_UTTERANCE]-(topic)<-[:HAS_TOPIC]-(episode)
            RETURN DISTINCT
                topic.text AS text,
                score,
                topic {
                    .title, .number, .timestamp,
                    episode: episode {
                        .title, .description, .url, link: episode.url
                    }
                } AS metadata
            `
            // retrievalQuery: `
            // MATCH (node)<-[:HAS_UTTERANCE]-(topic)<-[:HAS_TOPIC]-(episode)
            // RETURN DISTINCT
            //     node.text AS text,
            //     score,
            //     node {
            //         .speaker, .timestamp,
            //         topic: topic {
            //             .title, .number, .timestamp
            //         },
            //         episode: episode {
            //             .title, .description, .url, link: episode.url
            //         }
            //     } AS metadata
            // `
        })

        retriever = vectorStore.asRetriever(4)
    }

    return { vectorStore, retriever }
}
