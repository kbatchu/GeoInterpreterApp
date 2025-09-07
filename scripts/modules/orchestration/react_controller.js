import MemoryManager from "./memory_manager.js";
import PromptManager from "./prompt_manager.js";
import config from "../../config.js";
import { z } from "zod";

const MAX_SCRATCHPAD_ENTRIES_FOR_PROMPT = 10;

class ReActController {
  constructor(
    stateManager,
    communicationBus,
    aiCore,
    toolExecutor,
    memoryManager
  ) {
    this.stateManager = stateManager;
    this.communicationBus = communicationBus;
    this.aiCore = aiCore;
    this.toolExecutor = toolExecutor;
    this.memoryManager = memoryManager;
    this.scratchpad = [];
    this.userQuery = "";
    this.isPlanningMode = false;
    this.currentPlanStepIndex = 0;
    this.currentToolLevels = [1];
    this.isCancelled = false;
    this._findPlacesRetryCount = 0;
    this.sessionId = `session-${Date.now()}`;
    this.needsReplan = false;
    this.isDiagnosticMode = false; // New state variable
    this.planStack = [];

    this.placeholderConceptEmbedding = null;

    this.communicationBus.addEventListener(
      "userQuerySubmitted",
      this._handleUserQuery.bind(this)
    );
    this.communicationBus.addEventListener(
      "userInputProvided",
      this._handleUserInput.bind(this)
    );
    this.communicationBus.addEventListener(
      "cancelProcessing",
      this._handleCancel.bind(this)
    );
    this.communicationBus.addEventListener(
      "newSessionRequested",
      this._handleNewSession.bind(this)
    );

    this.toolRegistry = null;
    this.promptManager = null;
  }

  async _performConceptualGrounding() {
    console.log("Performing conceptual grounding...");
    const query = this.userQuery.toLowerCase();
    const requiredOntologies = ['core']; // Core is always needed

    if (query.includes('crime') || query.includes('assault') || query.includes('theft')) {
      requiredOntologies.push('crime');
    }
    if (query.includes('route') || query.includes('road') || query.includes('transportation') || query.includes('fastest')) {
      requiredOntologies.push('transportation');
    }

    if (requiredOntologies.length > 1) {
      console.log(`Required ontologies: ${requiredOntologies.join(', ')}`);
      await this.memoryManager.loadOntologies(requiredOntologies);

      // Example of a conceptual query
      if (query.includes('fastest route')) {
        const conceptQuery = "MATCH (c:Concept {name: 'FastestRoute'}) RETURN c.definition, c.parameters";
        try {
          const conceptResult = await this.memoryManager.queryKuzu(conceptQuery);
          if (conceptResult && conceptResult.length > 0) {
            const observation = `Conceptual knowledge for 'Fastest Route': ${JSON.stringify(conceptResult[0])}`;
            this.scratchpad.push({ type: "observation", content: observation });
            this._dispatchScratchpadUpdate();
          }
        } catch (e) {
          console.error("Could not query Kuzu for conceptual grounding:", e);
        }
      }
    }
  }

  async _handleUserQuery(event) {
    this.userQuery = event.detail.query;
    this.isCancelled = false;
    this.scratchpad = [];
    this.isPlanningMode = true;
    this.currentPlanStepIndex = 0;
    this.currentToolLevels = [1];
    this._findPlacesRetryCount = 0;
    this.isDiagnosticMode = false; // Reset diagnostic mode

    await this.memoryManager.initialize();
    await this._performConceptualGrounding();

    // Generate and cache the placeholder concept embedding once per session
    if (!this.placeholderConceptEmbedding) {
      const placeholderText =
        "a placeholder for a missing value like a name, address, distance, or other unknown information";
      this.placeholderConceptEmbedding =
        await this.memoryManager.generateEmbedding(placeholderText);
    }

    // Populate toolRegistry before initializing PromptManager
    const allAvailableTools = await this._getRelevantTools(
      this.userQuery,
      999,
      [1, 2, 3]
    ); // Get all tools
    this.toolRegistry = {};
    for (const tool of allAvailableTools) {
      this.toolRegistry[tool.name] = tool;
    }

    if (config.USE_DYNAMIC_PROMPTS) {
      this.promptManager = new PromptManager(
        this._getBaseSystemPrompt(),
        this.toolRegistry
      );
    }

    const conversationHistory = [
      ...this.stateManager.getState().conversationHistory,
      { role: "user", content: this.userQuery },
    ];

    this.stateManager.updateState({
      agentStatus: "planning",
      conversationHistory,
      activePlan: null,
    });

    await this.memoryManager.addConversationTurn({
      speaker: "user",
      content: this.userQuery,
      turn: conversationHistory.length,
      sessionId: this.sessionId,
    });

    console.log(
      "ReActController: Starting ReAct cycle for query:",
      this.userQuery
    );
    await this.run();
  }

  _getPlanCriticPrompt() {
    return `You are a meticulous and logical AI plan reviewer. Your task is to analyze a given plan and determine if it is sound. A sound plan is logical, efficient, and directly addresses the user's query.

## INSTRUCTIONS
1.  **Review the Plan:** Carefully examine the provided plan for the following flaws:
    *   **Logical Inconsistencies:** Does a later step contradict an earlier one?
    *   **Dependency Errors:** Does a step rely on information that has not yet been generated?
    *   **Inefficiency:** Could two or more steps be combined for better performance? Is there a more direct tool or approach to achieve the goal?
    *   **Hallucinations:** Does the plan reference tools, parameters, or concepts that don't exist or are irrelevant to the user's query?
2.  **Provide Feedback:** Based on your review, you have two options:
    *   **If the plan is sound:** Respond with a simple JSON object: {"status": "OK"}
    *   **If the plan is flawed:** Respond with a JSON object containing a revised plan: {"status": "revised", "plan": [...]}

Your response MUST be ONLY the JSON object, with no other text before or after it.`;
  }

  _getBaseSystemPrompt() {
    return `You are GeoInterpreter, a world-class AI assistant for geospatial analysis. Your goal is to help the user by executing a pre-defined plan ONE STEP AT A TIME.

## CRITICAL: RESPONSE FORMAT
You MUST respond with EXACTLY ONE Thought and ONE Action. Your entire response must follow this exact format:

Thought: [Your reasoning about the current step, what tool to use, and why. Be concise.]
Action: { "name": "tool_name", "parameters": { "param1": "value1" } }

<!-- DYNAMIC_TOOL_INSTRUCTIONS -->

## CRITICAL THINKING & ADAPTATION
1.  **Analyze the last Observation:** Before deciding your next action, you MUST carefully analyze the most recent Observation in the scratchpad.
2.  **Tool Usage:** You MUST use the provided tools to get the information you need. Do NOT make up answers or skip steps in the plan. If you need to geocode an address, you MUST use the 'geocode_address' tool.
3.  **Entity-Attribute Integrity:** When you identify an entity (e.g., a restaurant name) from an 'Observation', you MUST use other attributes (like its address) from that *same* 'Observation'. Do NOT combine an entity from an 'Observation' with an address from the user's original query in '<CONVERSATION_HISTORY>'. If an attribute like an address is missing for a found entity, your action should be to use a tool to find it.
4.  **Assess Success:** Did the last action succeed? Did it return the expected information? For example, if you searched for something, did the observation indicate that items were found?
5.  **Adapt Your Plan:**
    - If the observation is unexpected (e.g., "Found 0 places", an error message, or "Tool not implemented"), DO NOT blindly proceed with the original plan.
    - Your 'Thought' must explain how you are adapting to the new information.
    - Your next 'Action' should be a direct attempt to recover.
        - **If a tool is not implemented:** Your thought must be to try a different, more suitable tool from the available list to achieve the same goal.
        - **If you need to geocode an address that appears incomplete:** Do not immediately use 'ask_user'. First, attempt to use the 'find_places_nearby' tool with the partial address in the 'amenity' parameter. The results may contain a complete, geocodable address. If so, use that address in a subsequent 'geocode_address' action. Only ask the user for clarification if this approach fails.
        - **If you are truly stuck on a step for other reasons:** Use the 'ask_user' tool for clarification.
    - Only if the last observation was successful and expected should you proceed to the next step of the plan.

## FINISHING THE TASK
When all steps are complete and you have gathered all necessary information, you MUST use the 'finish' tool.
- **Thought:** Your thought should summarize the key findings from the scratchpad.
- **Action:** The 'answer' parameter in the 'finish' tool MUST contain the complete, final answer for the user, synthesized from the observations.
- **Example:**
  Thought: The scratchpad shows that the geocoding was successful and the subsequent search found three restaurants. I will now format these results into a final answer for the user.
  Action: { "name": "finish", "parameters": { "answer": "I found 3 Indian restaurants near your location: [List of restaurants and their details]." } }

## AVAILABLE ACTIONS
- Use one of the provided tools.
- Use the 'finish(answer=...)' tool when you have the final answer.
- Use the 'escalate_tool_level' tool if the current tools are insufficient.
- Use the 'ask_user' tool if you need clarification from the user.`;
  }

  _getStaticSystemPrompt() {
    return `You are GeoInterpreter, a world-class AI assistant for geospatial analysis. Your goal is to help the user by executing a pre-defined plan ONE STEP AT A TIME.

## CRITICAL: RESPONSE FORMAT
You MUST respond with EXACTLY ONE Thought and ONE Action. Your entire response must follow this exact format:

Thought: [Your reasoning about the current step, what tool to use, and why. Be concise.]
Action: { "name": "tool_name", "parameters": { "param1": "value1" } }

## CRITICAL THINKING & ADAPTATION
1.  **Analyze the last Observation:** Before deciding your next action, you MUST carefully analyze the most recent Observation in the scratchpad.
2.  **Entity-Attribute Integrity:** When you identify an entity (e.g., a restaurant name) from an 'Observation', you MUST use other attributes (like its address) from that *same* 'Observation'. Do NOT combine an entity from an 'Observation' with an address from the user's original query in '<CONVERSATION_HISTORY>'. If an attribute like an address is missing for a found entity, your action should be to use a tool to find it.
3.  **Assess Success:** Did the last action succeed? Did it return the expected information? For example, if you searched for something, did the observation indicate that items were found?

4.  **Adapt Your Plan:**
    - If the observation is unexpected (e.g., "Found 0 places", an error message, or "Tool not implemented"), DO NOT blindly proceed with the original plan.
    - Your 'Thought' must explain how you are adapting to the new information.
    - Your next 'Action' should be a direct attempt to recover.
        - **If you get "Found 0 places":** Your primary strategy is to expand the search. The system will track your attempts. If the observation says you MUST try again, then you must call the *same tool* but with a *larger search radius*. Look at the previous action in the scratchpad to see what the last radius was and increase it significantly (e.g., double it).
        - **If a tool is not implemented:** Your thought must be to try a different, more suitable tool from the available list to achieve the same goal.
        - **If you need to geocode an address that appears incomplete:** Do not immediately use 'ask_user'. First, attempt to use the 'find_places_nearby' tool with the partial address in the 'amenity' parameter. The results may contain a complete, geocodable address. If so, use that address in a subsequent 'geocode_address' action. Only ask the user for clarification if this approach fails.
        - **If you are truly stuck on a step for other reasons:** Use the 'ask_user' tool for clarification.
    - Only if the last observation was successful and expected should you proceed to the next step of the plan.

## FINISHING THE TASK
When all steps are complete and you have gathered all necessary information, you MUST use the 'finish' tool.
- **Thought:** Your thought should summarize the key findings from the scratchpad.
- **Action:** The 'answer' parameter in the 'finish' tool MUST contain the complete, final answer for the user, synthesized from the observations.
- **Example:**
  Thought: The scratchpad shows that the geocoding was successful and the subsequent search found three restaurants. I will now format these results into a final answer for the user.
  Action: { "name": "finish", "parameters": { "answer": "I found 3 Indian restaurants near your location: [List of restaurants and their details]." } }

## AVAILABLE ACTIONS
- Use one of the provided tools.
- Use the 'finish(answer=...)' tool when you have the final answer.
- Use the 'escalate_tool_level' tool if the current tools are insufficient.
- Use the 'ask_user' tool if you need clarification from the user.`;
  }

  async run() {
    let finished = false;
    let loopCount = 0;
    const MAX_LOOP_ITERATIONS = 25;
    const REPETITION_LIMIT = 3;
    let lastActionHistory = [];

    while (!finished && loopCount < MAX_LOOP_ITERATIONS) {
      if (this.isCancelled) {
        console.log(
          "ReActController: Run loop terminated due to cancellation."
        );
        this.isCancelled = false;
        return;
      }

      if (this.needsReplan) {
        console.log(
          "ReActController: Critical failure detected. Initiating re-plan."
        );
        this.stateManager.updateState({ activePlan: null });
        this.scratchpad.push({
          type: "observation",
          content:
            "Observation: The previous plan failed. A new approach is required.",
        });
        this.isPlanningMode = true;
        this.needsReplan = false; // Reset the flag
      }

      if (this.needsReplan) {
        console.log(
          "ReActController: Critical failure detected. Initiating re-plan."
        );
        this.stateManager.updateState({ activePlan: null });
        this.scratchpad.push({
          type: "observation",
          content:
            "Observation: The previous plan failed. A new approach is required.",
        });
        this.isPlanningMode = true;
        this.needsReplan = false; // Reset the flag
      }

      loopCount++;
      this.communicationBus.dispatchEvent("agentLoopUpdate", {
        loopCount,
        maxLoops: MAX_LOOP_ITERATIONS,
      });
      this.stateManager.updateState({ agentStatus: "thinking" });
      console.log(`ReActController: Loop iteration ${loopCount}`);

      try {
        let currentGoal = this.userQuery;
        let currentStep = null;
        if (!this.isPlanningMode && this.stateManager.getState().activePlan) {
          const activePlan = this.stateManager.getState().activePlan;
          if (this.currentPlanStepIndex < activePlan.steps.length) {
            currentStep = activePlan.steps[this.currentPlanStepIndex];
            if (currentStep.decomposable) {
              console.log(
                `ReActController: Decomposing step ${this.currentPlanStepIndex + 1}: ${currentStep.description}`
              );
              this.planStack.push({
                plan: activePlan,
                stepIndex: this.currentPlanStepIndex,
              });
              this.isPlanningMode = true;
              this.userQuery = currentStep.description; // Set the new goal
              this.currentPlanStepIndex = 0; // Reset for the new sub-plan
              this.stateManager.updateState({ activePlan: null }); // Clear the active plan
              continue; // Restart the loop to create a sub-plan
            }
            currentGoal =
              activePlan.steps[this.currentPlanStepIndex].description;
            this.stateManager.updateState({
              activePlan: {
                ...activePlan,
                currentStepIndex: this.currentPlanStepIndex,
              },
            });
            console.log(
              `ReActController: Executing plan step ${this.currentPlanStepIndex + 1}: ${currentGoal}`
            );
          } else {
            currentGoal = `All plan steps have been executed. Review the scratchpad and provide a final, comprehensive answer to the user's original query: "${this.userQuery}". Use the 'finish' tool to provide the answer.`;
            currentStep = null;
            console.log(
              "ReActController: All planned steps completed. Now generating final answer."
            );
          }
        }

        const { messages, availableTools } = await this._assembleContext(
          currentGoal,
          currentStep,
          this.isDiagnosticMode
        );
        console.log(
          "ReActController: Assembled context for AI invocation:",
          messages
        );

        let reply;
        let aiResponse;
        try {
          console.log("ReActController: Invoking AI core with messages...");
          const startTime = Date.now();
          reply = await this.aiCore.chat.completions.create({
            messages,
            temperature: 0.1,
            max_gen_len: 1024,
          });
          const endTime = Date.now();
          const turnTime = endTime - startTime;
          console.log(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              turnId: this.sessionId + "-" + loopCount,
              promptChars: messages.map((m) => m.content).join("").length,
              activeToolPrompts: Array.from(
                this.promptManager.activeToolPrompts.keys()
              ),
              processingTimeMs: turnTime,
            })
          );
          console.log(
            "ReActController: AI core responded. Full reply object:",
            reply
          );

          if (
            reply &&
            reply.choices &&
            reply.choices.length > 0 &&
            reply.choices[0].message
          ) {
            aiResponse = reply.choices[0].message.content;
            console.log(
              "ReActController: Extracted AI response content:",
              aiResponse
            );
          } else {
            throw new Error("AI response structure is unexpected or empty.");
          }
        } catch (aiError) {
          console.error(
            "ReActController: Error during AI invocation:",
            aiError
          );
          throw new Error(`AI invocation failed: ${aiError.message}`);
        }

        const { thought, action } = this._parseAIResponse(aiResponse);
        this.scratchpad.push({ type: "thought", content: thought });
        console.log("ReActController: AI Thought:", thought);
        this._dispatchScratchpadUpdate();
        console.log("ReActController: AI Action:", action);

        // --- NEW LOGIC START ---
        if (
          action.name === "ai_thinking" ||
          action.name === "ai_thinking_only_thought"
        ) {
          console.log(
            "ReActController: AI is still thinking. Continuing loop."
          );
          // No observation is added for 'ai_thinking' as it's not an action that produces an observable outcome.
          // The loop will simply continue, allowing the AI to generate a proper action next.
          continue;
        }
        // --- NEW LOGIC END ---

        if (action.name !== "continue" && action.name !== "parse_error") {
          const actionSignature = JSON.stringify({
            name: action.name,
            params: action.params,
          });
          lastActionHistory.push(actionSignature);
          if (lastActionHistory.length > REPETITION_LIMIT) {
            lastActionHistory.shift();
          }

          if (
            lastActionHistory.length === REPETITION_LIMIT &&
            new Set(lastActionHistory).size === 1
          ) {
            const errorMsg = `Error: The agent appears to be stuck in a loop, repeating the action '${action.name}'. Halting execution.`;
            console.error(`ReActController: ${errorMsg}`);
            const currentState = this.stateManager.getState();
            this.stateManager.updateState({
              agentStatus: "idle",
              conversationHistory: [
                ...currentState.conversationHistory,
                { role: "assistant", content: errorMsg },
              ],
            });
            this.communicationBus.dispatchEvent("finalAnswerReady", {
              answer: errorMsg,
            });
            finished = true;
            continue;
          }
        } else {
          lastActionHistory = [];
        }

        if (action.name === "continue") {
          this.scratchpad.push({
            type: "observation",
            content:
              "No valid action was taken. Please provide an action in the correct format.",
          });
          continue;
        }

        if (this.isPlanningMode) {
          if (action.name === "parse_error") {
            // Handle parse_error specifically in planning mode
            const observation = `Parse error occurred. The AI response format was incorrect. Error: ${action.params.error}`;
            this.scratchpad.push({ type: "action", content: action });
            this.scratchpad.push({ type: "observation", content: observation });
            this._dispatchScratchpadUpdate();
            console.log(
              "ReActController: Parse error in planning mode, prompting AI to correct format."
            );
            continue; // Continue the loop to give AI another chance
          } else if (action.name === "create_plan" && action.params.plan) {
            const refinedPlan = await this._reviewAndRefinePlan(
              action.params.plan
            );
            const correctedPlan = await this._correctPlanStepTypes(refinedPlan);
            this.stateManager.updateState({
              activePlan: { steps: correctedPlan, currentStepIndex: 0 },
            });
            this.isPlanningMode = false;
            this.scratchpad.push({
              type: "action",
              content: { name: "plan_created", plan: correctedPlan },
            });
            this._dispatchScratchpadUpdate();
            console.log("ReActController: Plan created and stored.");
          } else {
            throw new Error("AI did not return a valid plan in planning mode.");
          }
        } else {
                    if (action.name === "finish") {
            if (this.planStack.length > 0) {
              const parentPlanState = this.planStack.pop();
              this.stateManager.updateState({
                activePlan: parentPlanState.plan,
              });
              this.currentPlanStepIndex = parentPlanState.stepIndex + 1;
              this.isPlanningMode = false;
              console.log(
                "ReActController: Sub-plan finished. Resuming parent plan."
              );
              continue;
            }

            if (
              !action.params.answer ||
              typeof action.params.answer !== "string" ||
              action.params.answer.trim() === ""
            ) {
              const errorMsg =
                "Invalid action: 'finish' tool was called without a valid 'answer' parameter.";
              console.error(`ReActController: ${errorMsg}`);
              this.scratchpad.push({ type: "action", content: action });
              this.scratchpad.push({ type: "observation", content: errorMsg });
              this._dispatchScratchpadUpdate();
              continue;
            }

            // Use embedding similarity to detect if bracketed content is a placeholder.
            const placeholderRegex = /\[(.*?)\]/g; // Use g for matchAll
            let hasInvalidPlaceholder = false;
            const answerText = action.params.answer;
            const matches = [...answerText.matchAll(placeholderRegex)];

            if (matches.length > 0) {
              const placeholderChecks = matches.map((match) =>
                this._isInvalidPlaceholder(match[1])
              );
              const results = await Promise.all(placeholderChecks);
              if (results.some((isInvalid) => isInvalid)) {
                hasInvalidPlaceholder = true;
              }
            }

            if (hasInvalidPlaceholder) {
              const errorMsg =
                "Invalid action: 'finish' tool was called with an answer containing placeholders like '[address]'. The answer must be complete and based on facts from the scratchpad. You MUST find the missing information using a tool or ask the user for help.";
              console.error(`ReActController: ${errorMsg}`);
              this.scratchpad.push({ type: "action", content: action });
              this.scratchpad.push({
                type: "observation",
                content: errorMsg,
              });
              this._dispatchScratchpadUpdate();
              continue; // Force the agent to re-think and correct itself
            }

            finished = true;
            this.scratchpad.push({ type: "action", content: action });
            this._dispatchScratchpadUpdate();
            const currentState = this.stateManager.getState();
            const conversationHistory = [
              ...currentState.conversationHistory,
              { role: "assistant", content: action.params.answer },
            ];
            this.stateManager.updateState({
              agentStatus: "idle",
              conversationHistory,
            });
            await this.memoryManager.addConversationTurn({
              speaker: "assistant",
              content: action.params.answer,
              turn: conversationHistory.length,
              sessionId: this.sessionId,
            });
            this.communicationBus.dispatchEvent("finalAnswerReady", {
              answer: action.params.answer,
            });
            console.log(
              "ReActController: AI finished with answer:",
              action.params.answer
            );
          } else if (action.name === "escalate_tool_level") {
            this.currentToolLevels = [2, 3];
            const observation =
              "High-level tools were not sufficient. Providing a more granular set of tools.";
            this.scratchpad.push({ type: "action", content: action });
            this.scratchpad.push({ type: "observation", content: observation });
            this._dispatchScratchpadUpdate();
            console.log("ReActController: Escalating to lower-level tools.");
            continue;
          } else {
            if (action.name === "ask_user") {
              const questionText =
                action.params.question || action.params.prompt;

              if (
                !questionText ||
                typeof questionText !== "string" ||
                questionText.trim() === ""
              ) {
                const errorMsg =
                  "Invalid action: 'ask_user' tool was called without a valid 'question' or 'prompt' parameter.";
                console.error(`ReActController: ${errorMsg}`);
                this.scratchpad.push({ type: "action", content: action });
                this.scratchpad.push({
                  type: "observation",
                  content: errorMsg,
                });
                this._dispatchScratchpadUpdate();
                continue;
              }

              const standardizedAction = {
                name: "ask_user",
                params: {
                  question: questionText,
                  options: action.params.options || [],
                },
              };
              this.scratchpad.push({
                type: "action",
                content: standardizedAction,
              });
              this._dispatchScratchpadUpdate();
              const currentState = this.stateManager.getState();
              this.stateManager.updateState({
                agentStatus: "waiting_for_user",
                conversationHistory: [
                  ...currentState.conversationHistory,
                  { role: "assistant", content: questionText },
                ],
              });
              this.communicationBus.dispatchEvent("promptUserForInput", {
                question: questionText,
                options: standardizedAction.params.options,
              });
              return;
            }
            if (action.name === "parse_error") {
              const observation = `Parse error occurred. The AI response format was incorrect. Error: ${action.params.error}`;
              this.scratchpad.push({ type: "action", content: action });
              this.scratchpad.push({
                type: "observation",
                content: observation,
              });
              this._dispatchScratchpadUpdate();
              console.log(
                "ReActController: Parse error, prompting AI to correct format."
              );
              continue;
            }
            const chosenTool = availableTools.find(
              (t) => t.name === action.name
            );
            const currentStepType = currentStep ? currentStep.step_type : null;

            if (
              currentStepType === "geospatial" &&
              chosenTool &&
              !["geospatial", "data_retrieval"].includes(
                chosenTool.category.toLowerCase()
              )
            ) {
              console.warn(
                `ReActController: Mismatch detected! Step type is 'geospatial' but chosen tool '${action.name}' is category '${chosenTool.category}'.`
              );
              const observation = `Correction: The current step was labeled 'geospatial', but you chose the tool '${action.name}' which is a '${chosenTool.category}' tool. Please reconsider.`;
              this.scratchpad.push({ type: "thought", content: thought });
              this.scratchpad.push({ type: "action", content: action });
              this.scratchpad.push({
                type: "observation",
                content: observation,
              });
              this._dispatchScratchpadUpdate();
              continue;
            }

            this.scratchpad.push({ type: "action", content: action });
            this._dispatchScratchpadUpdate();
            this.stateManager.updateState({ agentStatus: "executing_tool" });
            this.communicationBus.dispatchEvent("toolExecutionStarted", {
              toolName: action.name,
              params: action.params,
            });

            let executionParams = action.params;
            if (action.name === "find_places_nearby") {
              executionParams = action.params;
            }

            const observation = await this.toolExecutor.execute(
              action.name,
              executionParams,
              this.stateManager.getState()
            );
            let finalObservation = observation;

            // Regex to match the specific error message from geocodeAddress for coordinates
            const geocodeCoordErrorRegex =
              /^Invalid input: \"(-?\d+\.\d+),\s*(-?\d+\.\d+)\" looks like coordinates\. To convert coordinates to a text address, you MUST use the 'reverse_geocode' tool\.$/;
            const match =
              typeof observation === "string"
                ? observation.match(geocodeCoordErrorRegex)
                : null;

            if (match) {
              const lat = parseFloat(match[1]);
              const lon = parseFloat(match[2]);
              finalObservation = `Correction: The previous action to geocode an address failed because the input was coordinates (${lat}, ${lon}). You MUST use the 'reverse_geocode' tool with these coordinates to get a text address.`;
              console.log(
                "ReActController: Correcting geocode_address misuse with reverse_geocode instruction."
              );
            } else if (
              action.name === "find_places_nearby" &&
              typeof observation === "string" &&
              observation.startsWith("Found 0 places")
            ) {
              this._findPlacesRetryCount++;
              const MAX_RETRIES = 3;
              if (this._findPlacesRetryCount <= MAX_RETRIES) {
                finalObservation = `${observation}. Search attempt ${this._findPlacesRetryCount} of ${MAX_RETRIES}. You MUST try again with a larger radius.`;
              } else {
                finalObservation = `${observation}. Multiple search attempts have failed. Consider a different strategy.`;
                this._findPlacesRetryCount = 0;
              }
            } else if (action.name === "find_places_nearby") {
              this._findPlacesRetryCount = 0;
            }

            if (
              typeof observation === "string" &&
              observation.startsWith("Tool '") &&
              observation.endsWith("' not implemented in ToolExecutor.")
            ) {
              console.log(
                "ReActController: Tool not found, re-evaluating current step."
              );
              this.scratchpad.push({
                type: "observation",
                content: observation,
              });
              console.log("ReActController: Tool Observation:", observation);
            } else {
              this.scratchpad.push({
                type: "observation",
                content: finalObservation,
              });
              console.log(
                "ReActController: Tool Observation:",
                finalObservation
              );
              if (this._isCriticalFailure(finalObservation)) {
                this.needsReplan = true;
              }
              await this._extractAndStoreEntities(action, finalObservation);
              this.currentPlanStepIndex++;
            }
            this._dispatchScratchpadUpdate();
          }
        }
      } catch (error) {
        console.error("ReActController: Error during ReAct cycle:", error);
        this.scratchpad.push({
          type: "observation",
          content: `Error: ${error.message}`,
        });
        this._dispatchScratchpadUpdate();
        this.stateManager.updateState({ agentStatus: "error" });
        if (loopCount >= MAX_LOOP_ITERATIONS) {
          const finalErrorMessage = `An error occurred: ${error.message}. Max iterations reached.`;
          const currentState = this.stateManager.getState();
          this.stateManager.updateState({
            agentStatus: "idle",
            conversationHistory: [
              ...currentState.conversationHistory,
              { role: "assistant", content: finalErrorMessage },
            ],
          });
          this.communicationBus.dispatchEvent("finalAnswerReady", {
            answer: finalErrorMessage,
          });
          finished = true;
        }
      }
    }

    if (!finished) {
      const reason =
        loopCount >= MAX_LOOP_ITERATIONS
          ? "the maximum number of steps"
          : "an unrecoverable state";
      const finalMessage = `I could not complete the task within ${reason}.`;
      console.warn(
        `ReActController: Task ended without finishing. Reason: ${reason}.`
      );
      const currentState = this.stateManager.getState();
      this.stateManager.updateState({
        agentStatus: "idle",
        conversationHistory: [
          ...currentState.conversationHistory,
          { role: "assistant", content: finalMessage },
        ],
      });
      this.communicationBus.dispatchEvent("finalAnswerReady", {
        answer: finalMessage,
      });
    }
  }

  _isCriticalFailure(observation) {
    if (
      typeof observation === "string" &&
      observation.includes("Multiple search attempts have failed")
    ) {
      this.isDiagnosticMode = true; // Activate diagnostic mode
      return true;
    }
    return false;
  }

  async _reviewAndRefinePlan(plan) {
    if (plan.length <= 5) {
      return plan;
    }
    console.log("ReActController: Reviewing and refining plan...");
    const criticSystemPrompt = this._getPlanCriticPrompt();
    const criticUserPrompt = `Here is the user's query and the proposed plan. Please review it.

<USER_QUERY>
${this.userQuery}
</USER_QUERY>

<PROPOSED_PLAN>
${JSON.stringify(
      plan,
      null,
      2
    )}
</PROPOSED_PLAN>

Your JSON response:`;

    const messages = [
      { role: "system", content: criticSystemPrompt },
      { role: "user", content: criticUserPrompt },
    ];

    try {
      const reply = await this.aiCore.chat.completions.create({
        messages,
        temperature: 0.0,
        max_gen_len: 1024, // Allow for longer, revised plans
      });

      if (
        !reply ||
        !reply.choices ||
        !reply.choices.length > 0 ||
        !reply.choices[0].message
      ) {
        throw new Error("Critic AI response structure is unexpected or empty.");
      }

      const criticResponse = reply.choices[0].message.content;
      console.log("ReActController: Critic AI response:", criticResponse);

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(criticResponse);
      } catch (e) {
        console.error(
          "ReActController: Failed to parse critic AI JSON response. Defaulting to original plan.",
          e
        );
        return plan; // Return original plan if critic fails to produce valid JSON
      }

      if (parsedResponse.status === "revised" && parsedResponse.plan) {
        console.log("ReActController: Plan has been revised by the critic.");
        return parsedResponse.plan;
      } else if (parsedResponse.status === "OK") {
        console.log("ReActController: Plan approved by the critic.");
        return plan;
      } else {
        console.warn(
          "ReActController: Critic response was not 'OK' or 'revised'. Defaulting to original plan."
        );
        return plan;
      }
    } catch (error) {
      console.error(
        `ReActController: Error during plan review and refinement: ${error.message}. Defaulting to original plan.`
      );
      return plan; // In case of any error, fall back to the original plan
    }
  }

  async _extractAndStoreEntities(action, observation) {
    // This is a simplified implementation. A real implementation would use a more sophisticated method to extract entities.
    if (action.name === "find_places_nearby" && Array.isArray(observation)) {
      for (const place of observation) {
        const entity = await this.memoryManager.addEntity({
          entityName: place.name,
          entityType: "Restaurant",
        });
        await this.memoryManager.addAttribute({
          entityId: entity.entity_id,
          attributeKey: "address",
          attributeValue: place.address,
        });

        // Fix: Pass latitude and longitude correctly
        await this.memoryManager.addGeospatialAttribute({
          entityId: entity.entity_id,
          entityType: "Restaurant",
          latitude: place.lat,
          longitude: place.lon,
          address: place.address.replace(place.name + ", ", ""),
          sessionId: this.sessionId,
        });
      }
    } else if (
      action.name === "geocode_address" &&
      observation.lat &&
      observation.lon
    ) {
      const entity = await this.memoryManager.addEntity({
        entityName: action.params.address,
        entityType: "Address",
      });

      // Fix: Pass latitude and longitude correctly
      await this.memoryManager.addGeospatialAttribute({
        entityId: entity.entity_id,
        entityType: "Address",
        latitude: observation.lat,
        longitude: observation.lon,
        address: action.params.address,
        sessionId: this.sessionId,
      });
    } else if (action.name === "reverse_geocode" && observation.address) {
      const entity = await this.memoryManager.addEntity({
        entityName: observation.address,
        entityType: "Address",
      });

      // Fix: Pass latitude and longitude correctly
      await this.memoryManager.addGeospatialAttribute({
        entityId: entity.entity_id,
        entityType: "Address",
        latitude: action.params.latitude,
        longitude: action.params.longitude,
        address: observation.address,
        sessionId: this.sessionId,
      });
    }
  }

  async _handleUserInput(event) {
    const userResponse = event.detail.response;
    console.log("ReActController: Received user input:", userResponse);
    const currentState = this.stateManager.getState();
    const conversationHistory = [
      ...currentState.conversationHistory,
      { role: "user", content: userResponse },
    ];
    this.scratchpad.push({
      type: "observation",
      content: `User provided the following information: "${userResponse}"`,
    });
    this._dispatchScratchpadUpdate();
    this.stateManager.updateState({
      agentStatus: "thinking",
      conversationHistory,
    });
    await this.memoryManager.addConversationTurn({
      speaker: "user",
      content: userResponse,
      turn: conversationHistory.length,
      sessionId: this.sessionId,
    });
    await this.run();
  }

  _handleCancel() {
    console.log("ReActController: Cancellation requested by user.");
    this.isCancelled = true;
    this.stateManager.updateState({ agentStatus: "idle" });
  }

  _handleNewSession() {
    this.isCancelled = true;
    this.scratchpad = [];
    this._dispatchScratchpadUpdate();
    this.userQuery = "";
    this.isPlanningMode = false;
    this.currentPlanStepIndex = 0;
    this.currentToolLevels = [1];
    this._findPlacesRetryCount = 0;
    this.sessionId = `session-${Date.now()}`;
    this.isDiagnosticMode = false; // Reset diagnostic mode
    this.stateManager.reset();
    this.memoryManager.reset();
  }

  async _assembleContext(currentGoal, currentStep = null, isDiagnosticMode) {
    const state = this.stateManager.getState();
    let toolQuery = currentGoal;
    if (currentStep && currentStep.step_type) {
      toolQuery = `${currentStep.step_type}: ${currentGoal}`;
    }
    console.log("Getting tools for the query:", toolQuery);
    const availableTools = await this._getRelevantTools(
      toolQuery,
      15,
      this.currentToolLevels
    );
    const toolNames = availableTools.map((t) => t.name);
    console.log(
      `ReActController: Retrieved available tools: [${toolNames.join(", ")}]`
    );

    const formattedHistory = state.conversationHistory
      .map(
        (msg) =>
          `${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}: ${msg.content}`
      )
      .join("\n");

    const conversationalContext =
      await this.memoryManager.getRelevantConversation(this.userQuery, 3);
    const factualContext = []; // In a real implementation, we would extract entities and get their facts

    const messages = [];
    if (this.isPlanningMode) {
      const planningTools = availableTools.filter(
        (t) => t.name === "create_plan"
      );
      const systemPrompt = `You are GeoInterpreter, a world-class AI assistant for geospatial analysis. Your primary goal is to help the user by breaking down complex requests into a logical, step-by-step plan.

## CRITICAL: YOU ARE IN PLANNING MODE
You MUST create a plan using the create_plan tool. Do NOT attempt to execute any other actions.

## RESPONSE FORMAT
You MUST respond in the following format, with no other text before or after. Your entire response must start with "Thought:".

Thought: [Your reasoning for the plan you are about to create.]
Action: { "name": "create_plan", "parameters": { "plan": [ { "step": 1, "description": "...", "step_type": "..." }, ... ] } }

## PLAN REQUIREMENTS
- Each step in the plan should be a discrete, self-contained analytical task.
- For each step, you must provide a 'step_type' from this exact list: [geospatial, aggregation, filter, data_retrieval, calculation, visualization].

## CRITICAL PLANNING INSTRUCTIONS
- **Use Conceptual Knowledge:** The scratchpad may contain "Conceptual knowledge" observations from the knowledge graph. You MUST use this information to create a more accurate and efficient plan. For example, if the conceptual knowledge defines 'fastest route' as using 'road_length / speed_limit', your plan should include steps to ensure 'speed_limit' is available.
- **Prioritize User-Provided Information:** If the user's query contains specific details like a street address, a location name, or a dataset, your plan MUST start by using that information.
- **Entity Integrity:** Do not invent information. If you need the address of a place you found, your plan must include a step to find that address. Do not assume it's the same as another address mentioned in the conversation.
- **Example:** If a street address is given, the first step of your plan MUST be to convert this address into geographic coordinates. After getting the coordinates, I can search for the restaurants.
      - **Entity Integrity:** Do not invent information. If you need the address of a place you found, your plan must include a step to find that address. Do not assume it's the same as another address mentioned in the conversation.
      - **Leverage Existing Coordinates:** If the scratchpad or conversation history contains the latitude and longitude for an entity whose address is requested, your plan MUST use the 'reverse_geocode' tool with those existing coordinates. Do NOT re-geocode an address or re-search for the entity if its coordinates are already known.
      - **Example:** If a street address is given, the first step of your plan MUST be to convert this address into geographic coordinates. After getting the coordinates, I can search for the restaurants.
Action: { "name": "create_plan", "parameters": { "plan": [ { "step": 1, "description": "Geocode the address '1600 Pennsylvania Avenue NW, Washington, DC'", "step_type": "geospatial" }, { "step": 2, "description": "Search for Indian restaurants near the geocoded location", "step_type": "data_retrieval" } ] } }`;
      const userPrompt = `You have access to a single tool to help you. Use this tool to output your plan as a JSON array of steps.

<TOOL_DEFINITIONS_JSON>
${JSON.stringify(planningTools, null, 2)}
</TOOL_DEFINITIONS_JSON>

Here is the full conversation history for context:
<CONVERSATION_HISTORY>
${formattedHistory || "No previous conversation history."} 
</CONVERSATION_HISTORY>

Here is the user's request:
<USER_QUERY>
${this.userQuery}
</USER_QUERY>

Here is the history of your work on this request so far (Thought/Action/Observation):
${this.scratchpad
  .slice(-MAX_SCRATCHPAD_ENTRIES_FOR_PROMPT)
  .map(
    (entry) =>
      `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}: ${typeof entry.content === "object" ? JSON.stringify(entry.content) : entry.content}`
  )
  .join("\n")}

Thought:`;
      messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: userPrompt });
    } else {
      let systemPrompt;
      if (config.USE_DYNAMIC_PROMPTS) {
        const toolNames = availableTools.map((t) => t.name);
        this.promptManager.setDiagnosticMode(this.isDiagnosticMode); // Set diagnostic mode
        this.promptManager.updatePrompts(toolNames);
        systemPrompt = this.promptManager.getFinalPrompt();
      } else {
        systemPrompt = this._getStaticSystemPrompt();
      }
      const userPrompt = `You have access to the following tools to help you. Select ONE tool to achieve the current goal.

<TOOL_DEFINITIONS_JSON>
${JSON.stringify(availableTools, null, 2)}
</TOOL_DEFINITIONS_JSON>

### Conversation History
${conversationalContext.map((c) => c.content).join("\n") || "No relevant conversation history."} 

### Known Facts from Knowledge Base
${factualContext.length > 0 ? JSON.stringify(factualContext, null, 2) : "No relevant facts found in knowledge base."} 

Here is the full conversation history for context:
<CONVERSATION_HISTORY>
${formattedHistory || "No previous conversation history."} 
</CONVERSATION_HISTORY>

Here is the user's original request for context:
<USER_QUERY>
${this.userQuery}
</USER_QUERY>

Here is the current goal for this step:
<CURRENT_GOAL>
${currentGoal}
</CURRENT_GOAL>

Here is the history of your work on this request so far (Thought/Action/Observation):
${this.scratchpad
  .slice(-MAX_SCRATCHPAD_ENTRIES_FOR_PROMPT)
  .map(
    (entry) =>
      `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}: ${typeof entry.content === "object" ? JSON.stringify(entry.content) : entry.content}`
  )
  .join("\n")}

Thought:`;
      messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: userPrompt });
    }

    return { messages, availableTools };
  }

  async _getRelevantTools(query, topN = 15, levels = [1, 2, 3]) {
    const dbToolsRaw = await this.memoryManager.getRelevantTools(
      query,
      topN,
      levels
    );

    const dbTools = dbToolsRaw.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      category: tool.category,
      level: tool.level,
      system_prompt: tool.system_prompt,
    }));

    if (dbTools.length > 0) {
      console.log(
        `ReActController: Tools retrieved from Worker: [${dbTools.map((t) => t.name).join(", ")}]`
      );
    } else {
      console.log(
        `ReActController: No tools retrieved from Worker for query: "${query}"`
      );
    }

    const internalTools = [];
    internalTools.push({
      name: "create_plan",
      description:
        "Breaks down a complex user request into a logical, step-by-step plan.",
      parameters: {
        type: "object",
        properties: {
          plan: {
            type: "array",
            description: "A JSON array representing the multi-step plan.",
            items: {
              type: "object",
              properties: {
                step: { type: "number" },
                description: { type: "string" },
                step_type: {
                  type: "string",
                  enum: [
                    "geospatial",
                    "aggregation",
                    "filter",
                    "data_retrieval",
                    "calculation",
                    "visualization",
                  ],
                },
                decomposable: { type: "boolean" },
              },
              required: ["step", "description", "step_type"],
            },
          },
        },
        required: ["plan"],
      },
    });
    internalTools.push({
      name: "finish",
      description:
        "Call this tool when you have fully answered the user's request.",
      parameters: {
        type: "object",
        properties: {
          answer: {
            type: "string",
            description: "The final answer to the user's question.",
          },
        },
        required: ["answer"],
      },
    });
    internalTools.push({
      name: "escalate_tool_level",
      description:
        "If you cannot solve the current goal with the available tools, use this to request a more granular set of tools.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description:
              "A brief reason why the current tools are insufficient.",
          },
        },
        required: ["reason"],
      },
    });
    internalTools.push({
      name: "ask_user",
      description: "Asks the user for clarification or additional information.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The clear, specific question to ask the user.",
          },
          options: {
            type: "array",
            description:
              "Optional. A list of suggested response options for the user.",
            items: { type: "string" },
          },
        },
        required: ["question"],
      },
    });

    internalTools.push({
      name: "execute_hybrid_analysis",
      description: "Performs a complex analysis that requires a hybrid approach, using both the relational (DuckDB) and graph (Kuzu) databases. Use this for tasks like network routing.",
      parameters: {
        type: "object",
        properties: {
          analysisType: {
            type: "string",
            description: "The type of analysis to perform. Currently, only 'routing' is supported.",
            enum: ["routing"]
          },
          sourceTableName: {
            type: "string",
            description: "The name of the table in DuckDB containing the source data (e.g., road network)."
          },
          filterClause: {
            type: "string",
            description: "An optional SQL WHERE clause to filter the data in the source table."
          },
          startNode: {
            type: "number",
            description: "The ID of the starting node for the routing analysis."
          },
          endNode: {
            type: "number",
            description: "The ID of the ending node for the routing analysis."
          }
        },
        required: ["analysisType", "sourceTableName", "startNode", "endNode"]
      }
    });

    const uniqueTools = new Map();
    for (const tool of dbTools) {
      uniqueTools.set(tool.name, tool);
    }
    for (const tool of internalTools) {
      uniqueTools.set(tool.name, tool);
    }

    return Array.from(uniqueTools.values());
  }

  _parseAIResponse(aiResponse) {
    console.log("ReActController: Parsing AI response:", `"${aiResponse}"`);
    const cleanResponse = aiResponse.trim();
    let thought = "No thought provided.";
    let action = { name: "continue", params: {} };
    const actionPrefix = "Action:";
    const actionIndex = cleanResponse.lastIndexOf(actionPrefix);

    if (actionIndex !== -1) {
      let rawThought = cleanResponse.substring(0, actionIndex).trim();
      const thoughtPrefix = "Thought:";
      if (rawThought.startsWith(thoughtPrefix)) {
        rawThought = rawThought.substring(thoughtPrefix.length).trim();
      }
      if (rawThought) {
        thought = rawThought;
      }

      const actionString = cleanResponse
        .substring(actionIndex + actionPrefix.length)
        .trim();
      let parsedAction;
      let parseError = null;

      // Helper function to extract valid JSON from a string
      const extractValidJSON = (str) => {
        // Find the first '{' and the matching closing '}'
        const firstBraceIndex = str.indexOf("{");
        if (firstBraceIndex === -1) return null;

        let braceCount = 0;
        let endIndex = firstBraceIndex;

        for (let i = firstBraceIndex; i < str.length; i++) {
          if (str[i] === "{") {
            braceCount++;
          } else if (str[i] === "}") {
            braceCount--;
            if (braceCount === 0) {
              endIndex = i;
              break;
            }
          }
        }

        if (braceCount === 0) {
          return str.substring(firstBraceIndex, endIndex + 1);
        }
        return null;
      };

      try {
        // Attempt 1: Try parsing the actionString directly
        parsedAction = JSON.parse(actionString);
      } catch (e1) {
        parseError = e1;
        // Attempt 2: Check for JSON wrapped in markdown code block
        const jsonBlockMatch = actionString.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch && jsonBlockMatch[1]) {
          try {
            const extractedJSON = extractValidJSON(jsonBlockMatch[1]);
            if (extractedJSON) {
              try {
                parsedAction = JSON.parse(extractedJSON);
                parseError = null;
              } catch (e2) {
                parseError = e2;
              }
            }
          } catch (e2) {
            parseError = e2;
          }
        }

        // Attempt 3: Extract valid JSON using brace matching
        if (parseError) {
          const extractedJSON = extractValidJSON(actionString);
          if (extractedJSON) {
            try {
              parsedAction = JSON.parse(extractedJSON);
              parseError = null;
            } catch (e3) {
              parseError = e3;
              // If parsing fails, and the string looks like a double-escaped JSON string, try unescaping it
              if (
                extractedJSON.startsWith('"') &&
                extractedJSON.endsWith('"')
              ) {
                try {
                  // Remove outer quotes and unescape inner quotes
                  const unescapedString = extractedJSON
                    .substring(1, extractedJSON.length - 1)
                    .replace(/\"/g, '"');
                  parsedAction = JSON.parse(unescapedString);
                  parseError = null;
                } catch (e4) {
                  parseError = e4;
                }
              }
            }
          }
        }
      }

      if (parseError) {
        console.error(
          `ReActController: Failed to parse action JSON. Error: ${parseError.message}. Raw string: "${actionString}"`
        );
        action = {
          name: "parse_error",
          params: { error: parseError.message, response: actionString },
        };
      } else {
        // The AI sometimes double-encodes the JSON by wrapping it in a string.
        // If the parsed result is a string, we need to parse it again.
        if (typeof parsedAction === "string") {
          try {
            parsedAction = JSON.parse(parsedAction);
          } catch (e) {
            console.error(
              `ReActController: Failed to double-parse action JSON. Error: ${e.message}. Raw string: "${parsedAction}"`
            );
            parseError = e; // Set parseError for this case too
          }
        }

        if (parseError) {
          // Check again if double-parsing failed
          action = {
            name: "parse_error",
            params: { error: parseError.message, response: actionString },
          };
        } else {
          console.log("ReActController: Debug - parsedAction:", parsedAction);
          console.log(
            "ReActController: Debug - typeof parsedAction:",
            typeof parsedAction
          );
          if (parsedAction) {
            console.log(
              "ReActController: Debug - parsedAction.name:",
              parsedAction.name
            );
            console.log(
              "ReActController: Debug - typeof parsedAction.name:",
              typeof parsedAction.name
            );
          }

          if (
            parsedAction &&
            typeof parsedAction === "object" &&
            typeof parsedAction.name === "string"
          ) {
            // Remap 'geocode' to 'geocode_address' as a temporary workaround for AI hallucination
            if (parsedAction.name === "geocode") {
              console.warn(
                "ReActController: Remapping 'geocode' tool to 'geocode_address'. AI hallucinated tool name."
              );
              parsedAction.name = "geocode_address";
            }
            if (parsedAction.name === "search_places_nearby") {
              console.warn(
                "ReActController: Remapping 'search_places_nearby' tool to 'find_places_nearby'. AI hallucinated tool name."
              );
              parsedAction.name = "find_places_nearby";
            }
            action = {
              name: parsedAction.name,
              params: parsedAction.parameters || parsedAction.params || {},
            };
          } else {
            const errorMessage =
              "Parsed JSON is not a valid action object or missing 'name'.";
            console.error(
              `ReActController: ${errorMessage} Parsed object:`,
              parsedAction
            );
            action = {
              name: "parse_error",
              params: { error: errorMessage, response: actionString },
            };
          }
        }
      }
    } else {
      // actionIndex === -1, meaning "Action:" prefix was not found
      const thoughtPrefix = "Thought:";
      if (cleanResponse.startsWith(thoughtPrefix)) {
        thought = cleanResponse.substring(thoughtPrefix.length).trim();
      } else {
        thought = cleanResponse;
      }

      const thinkingPrefix = "THINKING:"; // New prefix for AI's internal thoughts

      if (cleanResponse.startsWith(thinkingPrefix)) {
        thought = cleanResponse.substring(thinkingPrefix.length).trim();
        action = { name: "ai_thinking", params: { message: thought } };
      } else {
        // If "Action:" is not found and it's not a "THINKING:" response,
        // assume the entire response is a thought.
        if (cleanResponse.startsWith(thoughtPrefix)) {
          thought = cleanResponse.substring(thoughtPrefix.length).trim();
        } else {
          thought = cleanResponse; // Assume the entire response is the thought
        }
        action = {
          name: "ai_thinking_only_thought",
          params: { message: thought },
        };
      }
    }

    // Log the parsed thought and action for debugging
    console.log("ReActController: Successfully parsed - Thought:", thought);
    console.log("ReActController: Successfully parsed - Action:", action);

    return { thought, action };
  }

  async _correctPlanStepTypes(plan) {
    const SIMILARITY_THRESHOLD = 0.6;
    const correctedPlanPromises = plan.map(async (step) => {
      if (
        !["data_retrieval", "calculation", "filter", "aggregation"].includes(
          step.step_type
        )
      ) {
        return step;
      }
      console.log(
        `ReActController: Evaluating step ${step.step} for geospatial correction.`
      );
      try {
        const descriptionEmbedding = await this.memoryManager.generateEmbedding(
          step.description
        );
        const descriptionEmbeddingString = JSON.stringify(
          Array.from(descriptionEmbedding)
        );
        const querySql = `
        SELECT
          array_cosine_distance(
              embedding,
              CAST('${descriptionEmbeddingString}' AS DOUBLE[384])
          ) AS distance
        FROM
          tool_registry_db.geospatial_term_embeddings
        ORDER BY
          distance ASC
        LIMIT 1;
      `;
        const result = await this.memoryManager.query(querySql);
        if (result && result.length > 0) {
          const similarity = 1 - result[0].distance;
          console.log(
            `ReActController: Step ${step.step} similarity to geospatial terms: ${similarity.toFixed(4)}`
          );
          if (similarity >= SIMILARITY_THRESHOLD) {
            console.log(
              `ReActController: Correcting step ${step.step} to 'geospatial'.`
            );
            return { ...step, step_type: "geospatial" };
          }
        }
      } catch (e) {
        console.error(
          `ReActController: Could not query geospatial term embeddings. Error: ${e.message}`
        );
        return step;
      }
      return step;
    });
    return Promise.all(correctedPlanPromises);
  }

  /**
   * Calculates the cosine similarity between two vectors.
   * @param {number[]} vecA The first vector.
   * @param {number[]} vecB The second vector.
   * @returns {number} The cosine similarity score.
   * @private
   */
  _cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) {
      return 0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Determines if a string from within brackets is an invalid placeholder.
   * @param {string} bracketContent The text content from inside square brackets.
   * @returns {Promise<boolean>} True if the content is likely a placeholder.
   * @private
   */
  async _isInvalidPlaceholder(bracketContent) {
    const SIMILARITY_THRESHOLD = 0.7;
    const PLACEHOLDER_KEYWORDS = [
      'list', 'details', 'information', 'description', 'insert', 'fill',
      'summary', 'example', 'etc', '...', 'content', 'data', 'value'
    ];

    // Add exceptions for common valid formats like "[source: wiki]" or "[1,2,3]".
    if (
      bracketContent.includes(":") ||
      /^[0-9,\s.-]+$/.test(bracketContent)
    ) {
      return false;
    }

    // New: Keyword-based check for obvious placeholders
    const lowerCaseContent = bracketContent.toLowerCase();
    for (const keyword of PLACEHOLDER_KEYWORDS) {
      if (lowerCaseContent.includes(keyword)) {
        console.log(`ReActController: Placeholder detected by keyword '${keyword}' in "[${bracketContent}]".`);
        return true;
      }
    }

    const contentEmbedding = await this.memoryManager.generateEmbedding(
      bracketContent
    );
    const similarity = this._cosineSimilarity(
      contentEmbedding,
      this.placeholderConceptEmbedding
    );

    console.log(`ReActController: Placeholder check for "[${bracketContent}]". Similarity: ${similarity.toFixed(4)}`);
    return similarity > SIMILARITY_THRESHOLD;
  }

  _dispatchScratchpadUpdate() {
    const thinkingProcess = this.scratchpad
      .map((entry) => {
        const formattedEntry = `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}: ${typeof entry.content === "object" ? JSON.stringify(entry.content, null, 2) : entry.content}`;
        if (entry.type === "observation") {
          return formattedEntry + "\n" + ".".repeat(80);
        }
        return formattedEntry;
      })
      .join("\n\n");
    this.communicationBus.dispatchEvent("aiThinkingStream", {
      content: thinkingProcess,
    });
  }

  // When adding geospatial data, ensure coordinates are passed as numbers or strings
  async addGeospatialData(
    entityId,
    entityType,
    latitude,
    longitude,
    address,
    sessionId
  ) {
    try {
      // Ensure coordinates are valid numbers
      const lat =
        typeof latitude === "string" ? parseFloat(latitude) : latitude;
      const lon =
        typeof longitude === "string" ? parseFloat(longitude) : longitude;

      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(
          `Invalid coordinates for ${entityId}: lat=${latitude}, lon=${longitude}`
        );
      }

      await this.memoryManager.addGeospatialAttribute({
        entityId,
        entityType,
        latitude: lat,
        longitude: lon,
        address,
        sessionId: this.sessionId,
      });
    } catch (error) {
      console.error("ReActController: Error adding geospatial data:", error);
      throw error;
    }
  }
}

export default ReActController;
