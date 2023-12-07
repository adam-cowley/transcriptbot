import initAgent from "@/modules/agent/agent";
import { initCypherEvaluationChain, initCypherGenerationChain } from "@/modules/agent/tools/cypher";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === "POST") {
    const body = JSON.parse(req.body);
    const message = body.message;

    try {
      // TODO: Replace with a call to the agent
      //   setTimeout(() => {
      //     res.status(201).json({
      //       message,
      //     });
      //   }, 1000);

      // const chain = await initNeo4jRagRetrieverChain()
      // const response = await chain.invoke(message)

      // const agent = await initAgent()
      // const response = await agent.invoke({ input: message })

      console.log(message);


      const chain = await initCypherEvaluationChain()
      const response = await chain.invoke({ question: message })


      return res.status(201).json({
        // @ts-ignore
        message: response
      })
    } catch (e: any) {
      res.status(500).json({
        message: `I'm suffering from brain fog...\n\n${e.message}`,
      });
    }
  } else {
    res.status(404).send({ message: "Route not found" });
  }
}
