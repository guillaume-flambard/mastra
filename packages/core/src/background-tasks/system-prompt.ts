import { isToolBackgroundEligible } from './resolve-config';
import type { AgentBackgroundConfig, ToolBackgroundConfig } from './types';

/**
 * Tool shape accepted by the prompt generator. Callers may pass raw `Tool`s
 * (config on `background`) or converted `CoreTool`s (config on
 * `backgroundConfig`); both are honored.
 */
export interface BackgroundPromptTool {
  background?: ToolBackgroundConfig;
  backgroundConfig?: ToolBackgroundConfig;
  description?: string;
}

/**
 * Generates the system prompt section that tells the LLM about background task capabilities.
 *
 * Only tools that `resolveBackgroundConfig` could actually dispatch to the
 * background are listed (agent-level opt-in, falling back to tool-level
 * config — see `isToolBackgroundEligible`). Returns undefined if no tools are
 * background-eligible (nothing to inject).
 */
export function generateBackgroundTaskSystemPrompt(
  tools: Record<string, BackgroundPromptTool>,
  agentConfig?: AgentBackgroundConfig,
): string | undefined {
  const eligibleToolNames: string[] = [];

  for (const [toolName, tool] of Object.entries(tools)) {
    const toolConfig = tool.backgroundConfig ?? tool.background;
    if (isToolBackgroundEligible({ toolName, toolConfig, agentConfig })) {
      eligibleToolNames.push(toolName);
    }
  }

  if (eligibleToolNames.length === 0) {
    return undefined;
  }

  // Eligibility only makes a tool dispatchable: every call still defaults to
  // foreground, and `_background` is the per-call opt-in that selects a
  // deferred or awaited disposition.
  const toolLines = eligibleToolNames.map(toolName => `- ${toolName} (default: foreground)`).join('\n');

  return `You have the ability to run certain tools in the background while continuing the conversation. The following tools support background execution:
${toolLines}

Background execution is always per-call opt-in. To request it, include a "_background" field in the tool arguments:
  "_background": { "disposition": "deferred" | "awaited", "timeoutMs": number, "maxRetries": number }

Use "foreground" or omit "_background" to run the call in the foreground. All fields in "_background" are optional, but omitting the field never starts background work.

Guidelines:
- Use background execution when the user doesn't need the result immediately, or when you're launching multiple independent tasks.
- Use foreground execution when the user is directly waiting for the result and the conversation can't continue without it.
- When a tool runs in the background, you'll receive a placeholder result with a task ID. You can reference this in your response to the user.

IMPORTANT: "_background" is always an object. Its fields must be inside that object, not outside it.`;
}
