
class PromptManager {
    constructor(baseSystemPrompt, toolRegistry) {
        this.baseSystemPrompt = baseSystemPrompt;
        this.toolRegistry = toolRegistry;
        this.activeToolPrompts = new Map();
        this.isDiagnosticMode = false; // New state variable
    }

    setDiagnosticMode(isDiagnostic) {
        this.isDiagnosticMode = isDiagnostic;
    }

    updatePrompts(relevantToolNames) {
        const newActiveToolPrompts = new Map();
        for (const toolName of relevantToolNames) {
            if (this.toolRegistry[toolName] && this.toolRegistry[toolName].system_prompt) {
                newActiveToolPrompts.set(toolName, this.toolRegistry[toolName].system_prompt);
            }
        }
        this.activeToolPrompts = newActiveToolPrompts;
    }

    /**
     * Constructs the final system prompt.
     * In normal mode, it injects tool-specific prompts based on relevance.
     * In diagnostic mode, it injects a special set of instructions to guide the AI
     * through a suspicion-driven diagnosis workflow. This involves validating the tool
     * and, for `find_places_nearby`, using `getOsmTagInfo` to discover alternative
     * search tags if the initial ones fail.
     * @returns {string} The complete system prompt for the LLM.
     */
    getFinalPrompt() {
        let dynamicInstructions = Array.from(this.activeToolPrompts.values()).join('\n');

        if (this.isDiagnosticMode) {
            let diagnosticPrompt = `
## DIAGNOSTIC MODE: TOOL/DATA ISSUE DETECTED
You have failed to find a result. Your tool may be failing or the parameters may be incorrect.

**Step 1: Validate the tool.** Try a known-good, simple search with the same tool (e.g., for find_places_nearby, search for amenity='restaurant').
`;

            // Check if find_places_nearby is the tool being diagnosed.
            if (this.activeToolPrompts.has('find_places_nearby')) {
                // Dynamically get the system prompt for the getOsmTagInfo tool.
                const taginfoPrompt = this.toolRegistry['getOsmTagInfo'] ? this.toolRegistry['getOsmTagInfo'].system_prompt : '';
                
                diagnosticPrompt += `
**Step 2: Discover alternative tags using Taginfo.** If the validation step was successful, the original tag was likely incorrect. Use the getOsmTagInfo tool to discover valid or alternative tags.
${taginfoPrompt}
`;
            } else {
                diagnosticPrompt += `
**Step 2: Try an alternative category.** If the tool works for the validation step, the original category may be wrong. Try a related category.
`;
            }

            diagnosticPrompt += `
**Step 3: Report failure.** If all diagnostic steps fail, inform the user that you cannot retrieve the requested data at this time.
`;
            dynamicInstructions = diagnosticPrompt + dynamicInstructions;
        }

        return this.baseSystemPrompt.replace('<!-- DYNAMIC_TOOL_INSTRUCTIONS -->', dynamicInstructions);
    }
}

export default PromptManager;
