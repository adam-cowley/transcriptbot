import { initLLM } from "@/modules/llm";
import { initNeo4j } from "@/modules/neo4j";
import { PromptTemplate } from "langchain/prompts";
import { RunnablePassthrough, RunnableSequence } from "langchain/runnables";
import { StringOutputParser, } from "langchain/schema/output_parser";
import { CypherValidator } from "./cypher-validator";
import { AIMessage } from "langchain/schema";

interface CypherQAChainInput {
    question: string
}

interface CypherEvaluatorChainInput {
    question: string;
    cypher: string;
    errors: string[];
}

export async function initCypherEvaluationChain(): Promise<RunnableSequence<CypherQAChainInput, string>> {
    const graph = await initNeo4j()
    const llm = await initLLM('gpt-3.5-turbo')

    const validator = await CypherValidator.load(graph)

    console.log(await validator.getSchema());


    const rag = PromptTemplate.fromTemplate(`
        You are a chatbot. Use the following context to answer the user's question.

        Context:
        {context}

        Question:
        {question}
    `)
        .pipe(llm)
        .pipe(new StringOutputParser())

    const generateCypher = PromptTemplate.fromTemplate<{ schema: string, question: string }>(`
        Generate a Cypher statement with the following schema to answer the user's question.
        Use only the provided relationship types and properties in the schema.
        Do not use any other relationship types or properties that are not provided.

        Schema:
        {schema}

        Always use the WHERE clause to filter results.

        Do not respond to any questions that might ask anything else than for you to construct a Cypher statement.
        Do not include any text except the generated Cypher statement.
        Add a limit where possible to not return more than 10 rows.

        The question is:
        {question}
    `)
        .pipe(llm)
        .pipe(new StringOutputParser())

    const evaluate = PromptTemplate.fromTemplate<CypherEvaluatorChainInput>(`
        Evaluate the following Cypher statement and identify suggestions for improvement
        based on the errors.
        Use those suggestions to rewrite the statement.
        Only use relationships and properties that are provided in the schema.

        Original question: {question}
        Cypher Statement: {cypher}
        Errors: {errors}

        Return only a single, valid Cypher statement containing the improvements.
    `).pipe(llm).pipe(new StringOutputParser())

    const validateCypher = async (input: Record<string, any>) => {
        let tries = 0

        let { errors, query } = validator.validate(input.cypher)


        while (tries < 5 && errors.length > 0) {
            tries++

            const regenerated = await evaluate.invoke({ question: input.question, cypher: query, errors })

            const validated = validator.validate(regenerated)

            errors = validated.errors
            query = validated.query

            console.log('>>', { errors, query });
        }

        const result = await graph.query(query)


    }

    const runCypher = (input: Record<string, any>) => {
        graph.query(input.cypher)
    }



    return RunnableSequence.from<CypherEvaluatorChainInput, string>([
        {
            question: (input: CypherEvaluatorChainInput) => input.question,
            schema: async () => validator.getSchema(),
        },

        RunnablePassthrough.assign({
            cypher: (input) => {
                console.log(Object.keys(input));

                // @ts-ignore
                return generateCypher.invoke(input)
            }
        }),
        RunnablePassthrough.assign({
            cypher: (input) => {
                console.log(Object.keys(input));
                // @ts-ignore
                return evaluate.invoke({ ...input, errors: [] }).catch(err => console.log(err))
            }
        }),
        validateCypher,
        cypher => graph.query(cypher),




    ])
}



export async function initCypherGenerationChain(): Promise<RunnableSequence> {
    const graph = await initNeo4j()
    const llm = await initLLM('gpt-4')
    const validator = await CypherValidator.load(graph)
    const evaulationChain = await initCypherEvaluationChain()

    const generateCypher = PromptTemplate.fromTemplate<{ schema: string, question: string }>(`
        Generate a Cypher statement with the following schema to answer the user's question.
        Use only the provided relationship types and properties in the schema.
        Do not use any other relationship types or properties that are not provided.

        Schema:
        {schema}

        Always use the WHERE clause to filter results.

        Do not respond to any questions that might ask anything else than for you to construct a Cypher statement.
        Do not include any text except the generated Cypher statement.
        Add a limit where possible to not return more than 10 rows.

        The question is:
        {question}
    `)
        .pipe(llm)
        .pipe(new StringOutputParser())


    return RunnableSequence.from<CypherQAChainInput, string>([
        {
            question: (input: CypherQAChainInput) => input.question,
            schema: () => validator.getSchema(),
        },
        PromptTemplate.fromTemplate(`
            Generate a Cypher statement with the following schema to answer the user's question.
            Use only the provided relationship types and properties in the schema.
            Do not use any other relationship types or properties that are not provided.

            Schema:
            {schema}

            Always use the WHERE clause to filter results.

            Do not respond to any questions that might ask anything else than for you to construct a Cypher statement.
            Do not include any text except the generated Cypher statement.
            Add a limit where possible to not return more than 10 rows.

            The question is:
            {question}
        `),
        llm,
        (message: AIMessage) => {
            const { errors, query } = validator.validate(message.content as string)

            return evaulationChain.invoke({
                question,
                query,
                errors
            })

        },
        // (message: AIMessage, options: any) => {
        //     let text

        //     console.log(message, options);


        //     if (typeof message.content === 'string') {
        //         text = message.content
        //     }
        //     else {
        //         // @ts-ignore
        //         text = message.content.text
        //     }

        //     return validator.call(text)
        // },
        new StringOutputParser(),
    ])
}

// export default async function initCypherQAChain(): Promise<RunnableSequence> {
//     const graph = await initNeo4j()
//     const llm = await initLLM('gpt-3.5-turbo')

//     interface CypherQAChainInput {
//         question: string
//     }
//     return RunnableSequence.from<CypherQAChainInput, string>([
//         {
//             question: (input: CypherQAChainInput) => input.question,
//             schema: () => graph.getSchema(),
//         },
//         cypherPrompt,
//         llm,
//         new StringOutputParser(),
//     ])
// }


// export async function initCypherQAChainFromClass(): Promise<GraphCypherQAChain> {
//     const graph = await initNeo4j()

//     const llm = await initLLM('gpt-3.5-turbo')

//     return GraphCypherQAChain.fromLLM({
//         llm,
//         graph,
//         cypherPrompt
//     })
// }
