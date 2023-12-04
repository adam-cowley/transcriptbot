import { BaseTransformOutputParser } from "langchain/schema/output_parser";

export class JSONOutputParser extends BaseTransformOutputParser<string> {
    static lc_name() {
        return "JSONOutputParser";
    }

    lc_namespace = ["langchain_core", "output_parsers", "json"];

    lc_serializable = true;

    /**
     * Parses a string output from an LLM call. This method is meant to be
     * implemented by subclasses to define how a string output from an LLM
     * should be parsed.
     * @param text The string output from an LLM call.
     * @param callbacks Optional callbacks.
     * @returns A promise of the parsed output.
     */
    parse(text: string): Promise<any> {
        // Extract JSON from inside backticks
        const regex = /```json\n([\s\S]*?)\n```/;

        const match = text.match(regex);

        if (match) {
            text = match[1];
        }

        try {
            const json = JSON.parse(text)

            return Promise.resolve(json);
        }
        catch (e: any) {
            console.log(text);

            return Promise.resolve({ text, error: e.message })
        }
    }

    getFormatInstructions(): string {
        return "";
    }
}