import type { NextApiRequest, NextApiResponse } from "next";
import { PromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/runnables";
import { llm } from "@/modules/llm";
import { StringOutputParser } from "langchain/schema/output_parser";
import { initNeo4j } from "@/modules/neo4j";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<any>
) {
    const prompt = PromptTemplate.fromTemplate(`
        Summarize the following topic from a tech podcast, identifying people,
        places, technologies, companies and products.
        Return only a JSON object of items containing the mentions, the start
        and end characters of the text and the sentiment represented as a float
        between 0.0 and 1.0 - 1.0 is an extremely positive mention.

        Example output:
        {{
            "products": [
                {{
                    "name": "Neo4j",
                    "mentionedBy": "Adam Cowley",
                    "start": 20,
                    "end": 35,
                    "sentiment": 0.976
                }}
            ]m
            "people": [
                {{
                    "name": Wes Bos",
                    "mentionedBy": "Scott Tolinski",
                    "start": 20,
                    "end": 35,
                    "sentiment": 0.976
                }}
            ]
        }}

        Episode ID: {id}
        Episode Title: {episode}
        Topic ID: {topicId}
        Topic Title: {topic}
        Text: {text}

        Valid JSON:
    `)

    const graph = await initNeo4j()

    const rows = await graph.query(`
        MATCH (e:Episode)
        WHERE e.updatedAt IS NULL
        WITH e ORDER BY e.id DESC SKIP 1 LIMIT 1

        MATCH (e)-[:HAS_TOPIC]->(t)

        RETURN e.id AS id, e.title AS episode,
        collect({
            topicId: t.id,
            topic: t.title,
            text: t.text
        }) AS topics

    `)

    interface ChainInput {
        id: number;
        title: string;
        topicId: number;
        topic: string;
        text: string;
    }

    interface Mention {
        name: string;
        start: number;
        end: number;
    }

    interface ChainOutput {
        [key: string]: Mention[]
    }



    const chain = RunnableSequence.from<ChainInput, string>([
        (row) => ({ ...row }),
        prompt,
        llm,
        new StringOutputParser(),
    ])

    if (rows) {
        for (const row of rows) {
            console.log(row)
            for (const topic of row.topics) {

                const result = await chain.invoke({ id: row.id, episode: row.episodeTitle, ...topic })

                const json = JSON.parse(result)

                await graph.query(`
                    MATCH (t:Topic {id: $topicId})<-[:HAS_TOPIC]-(ep)
                    SET ep.updatedAt = datetime()
                    FOREACH (row in $json.people |
                        MERGE (p:Entity {name: row.name})
                        SET p:Persib
                        MERGE (t)-[r:MENTIONS]->(p)
                        SET r += row {
                            .start,
                            .end,
                            .sentiment,
                            .mentionedBy
                        }
                    )
                    FOREACH (row in $json.companies |
                        MERGE (c:Entity {name: row.name})
                        SET c:Company
                        MERGE (t)-[r:MENTIONS]->(c)
                        SET r += row {
                            .start,
                            .end,
                            .sentiment,
                            .mentionedBy
                        }
                    )
                    FOREACH (row in $json.technologies |
                        MERGE (c:Entity {name: row.name})
                        SET c:Technology
                        MERGE (t)-[r:MENTIONS]->(c)
                        SET r += row {
                            .start,
                            .end,
                            .sentiment,
                            .mentionedBy
                        }
                    )
                    FOREACH (row in $json.products |
                        MERGE (p:Entity {name: row.name})
                        SET p:Product
                        MERGE (t)-[r:MENTIONS]->(p)
                        SET r += row {
                            .start,
                            .end,
                            .sentiment,
                            .mentionedBy
                        }
                    )
                `, { json, topicId: topic.topicId })
            }
        }
    }

    res.status(201).json({ status: 'ok', rows: rows?.length })
}
