// Workers AI text generation (admin auto-translation). The only module that touches the `AI` binding.
import { z } from 'zod';
import { getBindings } from './env';

/** Free-plan chat models this adapter is typed for. Swapping models = add the id here, then set the var. */
const chatModelSchema = z.enum(['@cf/google/gemma-4-26b-a4b-it', '@cf/zai-org/glm-4.7-flash']);

export interface TextModelRequest {
  model: string;
  system: string;
  user: string;
  json: boolean;
  maxTokens: number;
}

/** Returns the raw provider response; throws on transport, quota or capacity errors. */
export type TextModel = (req: TextModelRequest) => Promise<unknown>;

export function getTextModel(): TextModel {
  const ai = getBindings().AI;
  return async (req) => {
    const model = chatModelSchema.parse(req.model);
    return ai.run(model, {
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      max_completion_tokens: req.maxTokens,
      temperature: 0.2,
      // Reasoning would spend the token budget (and Neurons) before any output.
      chat_template_kwargs: { enable_thinking: false },
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
    });
  };
}
