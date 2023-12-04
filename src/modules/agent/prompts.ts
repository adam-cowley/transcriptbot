import { readFileSync } from "fs";
import { PromptTemplate } from "langchain/prompts";
import { join, resolve } from "path";

export function loadPromptText(filename: string): string {
    const filepath = join('@', 'prompts', filename)

    // console.log('>', resolve(__dirname, filepath))
    console.log('>', filepath)

    // console.log(__dirname, filepath);


    return readFileSync(filepath).toString()
}

export function loadPrompt(filename: string): PromptTemplate {
    const template = loadPromptText(filename)

    return PromptTemplate.fromTemplate(template)
}
