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
Task: Identify the names of the speakers from the following podcast transcript.
Each utterance by a speaker appears on a new line with either a name or "Guest [number]".

For example, the following text is spoken by three speakers, Wes Bos, Scott Tolinski and Foo Barington.

Guest 1: Hello, and welcome to the podcast.  With me as always is Scott Tolinski. Hey, Scott.
Guest 2: Hey, Wes. How you doing?
Guest 1: I'm excited to be here. And we have a special guest today, Foo Barington. Hey, Foo.
Guest 3: Hey, thanks for having me.

If the speaker doesn't mention their name they will be either Scott Tolinski or Wes Bos.


Return a JSON map where the key is the name of the speaker in the transcript and the value is their actual name. For example:

{{
    "Guest 1": "Wes Bos",
    "Guest 2": "Foo Barington",
    "Guest 3": "Scott Tolinski",
}}

Title: {title}
Description: {description}
Text: {text}
    `)

    const llm = await initLLM(req.query.model as string)
    const graph = await initNeo4j()

    const rows = await graph.query(`
        MATCH (e:Episode)-[:HAS_TOPIC]->(t)
        WHERE e.id = toInteger($id)
        WITH e, t ORDER BY t.id ASC
        WITH e, collect(t) AS topics

        RETURN e.id AS id, e.title AS title, e.description AS description, reduce(s = '', t in topics | s + t.title + ":\n"+ t.text + "\n") AS text
    `, { id: req.query.id })


    const chain = RunnableSequence.from([
        ([row]) => ({ ...row, text: row.text.substring(0, 5000) }),
        prompt,
        llm,
        new JSONOutputParser(),
    ])





    if (rows) {
        const response = await chain.invoke(rows)

        console.log(Object.entries(response));


        await graph.query(`
            MATCH (e:Episode)-[:HAS_TOPIC]->(t)-[:HAS_UTTERANCE]->(u)
            WHERE e.id = toInteger($id)

            WITH e, collect(u) AS utterances

            UNWIND $speakers AS row

            MERGE (p:Entity { name: row[1] })
            SET p:Person
            MERGE (e)-[:HAS_SPEAKER]->(p)

            FOREACH (u IN [ u IN utterances WHERE u.speaker = row[0] | u ] |
                MERGE (u)-[:SPEAKER]->(p)
                SET u.originalSpeaker = row[0], u.speaker = row[1]
            )



        `, { id: req.query.id, speakers: Object.entries(response) })

        return res.json({
            ...rows[0],
            text: rows[0].text.substring(0, 5000),
            response
        })
    }

    return res.json([])
}
