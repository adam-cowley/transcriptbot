import { ChatOpenAI } from 'langchain/chat_models/openai'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'

export const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-4',
    temperature: 0
})

export const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'text-embedding-ada-002'
})


export const initLLM = (model: string = 'gpt-4'): Promise<ChatOpenAI> => {
    return Promise.resolve(new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: model,
        temperature: 0
    }))
}
