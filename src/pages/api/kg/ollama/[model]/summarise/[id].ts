import { loadPrompt } from "@/modules/agent/prompts";
import { initNeo4j } from "@/modules/neo4j";
import { JSONOutputParser } from "@/utils/json";
import { ChatOllama } from "langchain/chat_models/ollama";
import { PromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/runnables";
import { BaseMessage } from "langchain/schema";
import { StringOutputParser } from "langchain/schema/output_parser";
import { NextApiRequest, NextApiResponse } from "next";



export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<any>
) {
    const { id } = req.query

    const llm = new ChatOllama({
        model: req.query.model as string,
        temperature: 0
    })

    const prompt = PromptTemplate.fromTemplate(
        // `
        // Identify the tech topics, companies and people in the following text.
        // Return a JSON array containing objects.
        // Each object must have a:
        // - name: name of the topic converted to lower case
        // - type: the type of entity
        // - mentionedBy: the person who mentioned the topic
        // - sentiment: a float between 0.0 and 1.0 where a higher number correlates with higher positive mention.

        // Return as many as possible.

        // Example output:
        // [{{
        //     "name": "Relational Database",
        //     "type": "Technology",
        //     "mentionedBy": "Adam Cowley",
        //     "sentiment": 0.976
        // }}, {{
        //     "name": "Neo4j",
        //     "type": "Company",
        //     "mentionedBy": "Adam Cowley",
        //     "sentiment": 0.976
        // }}]


        // Text:
        // {text}
        // `
        `
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
                "sentiment": 0.498
            }},
            {{
                "name": Wes Bos",
                "mentionedBy": "Scott Tolinski",
                "type": "Person",
                "sentiment": 0.59
            }}
        ]

        Episode ID: {episodeId}
        Episode Title: {episodeTitle}
        Topic ID: {topicId}
        Topic Title: {topicTitle}
        Text: {text}
`)

    const chain = RunnableSequence.from([
        prompt,
        llm,
        // new StringOutputParser()
        new JSONOutputParser()
    ])

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
    `, { id })


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
