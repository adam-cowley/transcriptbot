import { llm } from "@/modules/llm";
import { initNeo4jVectorStore } from "@/modules/neo4j";
import { Document } from "langchain/document";
import { PromptTemplate } from "langchain/prompts";
import { RunnablePassthrough, RunnableSequence } from "langchain/runnables";
import { StringOutputParser } from "langchain/schema/output_parser";

const formatDocumentsAsJSON: (documents: Document[], separator?: string) => string =
  (documents: Document[], separator?: string) => documents.map(document => JSON.stringify(document)).join(separator)

const prompt =
  PromptTemplate.fromTemplate(`
You are a helpful chatbot answering questions about the Syntax.fm podcast.

Provide links to the lesson and include the timestamp where possible.
Provide a link when mentioning the title, for example: [#487 - Supper Club × Adam Cowley and Neo4j Database](https://syntax.fm/show/487/supper-club-adam-cowley-and-neo4j-database)

Answer the question based only on the following context:
{context}

Question: {question}`);

export default async function initNeo4jRagRetrieverChain(): Promise<RunnableSequence<any, any> {
  const { retriever } = await initNeo4jVectorStore()

  const chain = RunnableSequence.from([
    {
      context: retriever.pipe(
        formatDocumentsAsJSON
      ),
      question: new RunnablePassthrough(),
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  return chain
}
