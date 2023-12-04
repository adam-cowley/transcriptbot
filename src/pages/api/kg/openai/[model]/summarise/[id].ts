import type { NextApiRequest, NextApiResponse } from "next";
import { PromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/runnables";
import { initLLM } from "@/modules/llm";
import { StringOutputParser } from "langchain/schema/output_parser";
import { initNeo4j } from "@/modules/neo4j";
import { loadPrompt } from "@/modules/agent/prompts";
import { JSONOutputParser } from "@/utils/json";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<any>
) {
    const prompt = PromptTemplate.fromTemplate(`
Role: You are summarising a podcast on web development.
Task: Identify all the tech topics, companies and people in the following text.

Return a JSON array of objects with a name, who it was mentioned by, the type of entity and a sentiment score.

Example Output:
[
    {{
        "name": "Neo4j",
        "mentionedBy": "Adam Cowley",
        "type": "Product",
        "sentiment": 0.976
    }},
    {{
        "name": "React",
        "mentionedBy": "Wes Bos",
        "type": "Framework",
        "sentiment": 0.976
    }},
    {{
        "name": Wes Bos",
        "mentionedBy": "Scott Tolinski",
        "type": "Person",
        "sentiment": 0.976
    }}
]

Episode ID: {episodeId}
Episode Title: {episodeTitle}
Topic ID: {topicId}
Topic Title: {topicTitle}
Text: {text}
    `)

    const llm = await initLLM(req.query.model as string)
    const graph = await initNeo4j()

    const rows = await graph.query(`
        MATCH (e:Episode)
        WHERE e.id = toInteger($id)
        WITH e ORDER BY e.id DESC LIMIT 1

        MATCH (e)-[:HAS_TOPIC]->(t)

        RETURN
            e.id AS episodeId,
            e.title AS episodeTitle,
            t.id AS topicId,
            t.title AS topicTitle,
            t.text AS text
        ORDER BY t.id ASC
    `, { id: req.query.id })

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
        new JSONOutputParser(),
    ])

    if (rows) {
        const output = []
        for (const topic of rows.slice(2, 3)) {
            const summary = await chain.invoke(topic)

            output.push({
                topic,
                summary,
            })
        }

        return res.json(output)
    }

    return res.json([])
}
