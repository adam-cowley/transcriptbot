import { llm } from "@/modules/llm";
import { initNeo4jVectorStore } from "@/modules/neo4j";
import { Document } from "langchain/document";
import { RunnablePassthrough, RunnableSequence } from "langchain/runnables";
import { StringOutputParser } from "langchain/schema/output_parser";
import { loadPrompt } from "../prompts";

const formatDocumentsAsJSON: (documents: Document[], separator?: string) => string =
  (documents: Document[], separator?: string) => documents.map(document => JSON.stringify(document)).join(separator)

const prompt = loadPrompt('rag.txt')

export default async function initNeo4jRagRetrieverChain(): Promise<RunnableSequence<any, any>> {
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
