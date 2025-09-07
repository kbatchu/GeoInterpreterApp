import PromptManager from '../modules/orchestration/prompt_manager.js';

const mockToolRegistry = {
  tool1: {
    system_prompt: 'Tool 1 instructions.'
  },
  tool2: {
    system_prompt: 'Tool 2 instructions.'
  },
  tool3: {
    system_prompt: 'Tool 3 instructions.'
  }
};

const basePrompt = 'Base system prompt. <!-- DYNAMIC_TOOL_INSTRUCTIONS -->';

function testPromptManager() {
  let allTestsPassed = true;
  console.log('Running tests for PromptManager...');

  // Test case 1: Initialization
  try {
    const promptManager = new PromptManager(basePrompt, mockToolRegistry);
    console.assert(promptManager.baseSystemPrompt === basePrompt, 'Test Case 1 Failed: Initialization - baseSystemPrompt');
    console.assert(promptManager.toolRegistry === mockToolRegistry, 'Test Case 1 Failed: Initialization - toolRegistry');
    console.assert(promptManager.activeToolPrompts.size === 0, 'Test Case 1 Failed: Initialization - activeToolPrompts');
    console.log('Test Case 1 Passed: Initialization');
  } catch (e) {
    console.error('Test Case 1 Failed: Initialization', e);
    allTestsPassed = false;
  }

  // Test case 2: Add new prompts
  try {
    const promptManager = new PromptManager(basePrompt, mockToolRegistry);
    promptManager.updatePrompts(['tool1', 'tool2']);
    console.assert(promptManager.activeToolPrompts.size === 2, 'Test Case 2 Failed: Add new prompts - size');
    console.assert(promptManager.activeToolPrompts.get('tool1') === 'Tool 1 instructions.', 'Test Case 2 Failed: Add new prompts - tool1');
    console.assert(promptManager.activeToolPrompts.get('tool2') === 'Tool 2 instructions.', 'Test Case 2 Failed: Add new prompts - tool2');
    console.log('Test Case 2 Passed: Add new prompts');
  } catch (e) {
    console.error('Test Case 2 Failed: Add new prompts', e);
    allTestsPassed = false;
  }

  // Test case 3: Remove obsolete prompts
  try {
    const promptManager = new PromptManager(basePrompt, mockToolRegistry);
    promptManager.updatePrompts(['tool1', 'tool2']);
    promptManager.updatePrompts(['tool1']);
    console.assert(promptManager.activeToolPrompts.size === 1, 'Test Case 3 Failed: Remove obsolete prompts - size');
    console.assert(!promptManager.activeToolPrompts.has('tool2'), 'Test Case 3 Failed: Remove obsolete prompts - tool2');
    console.log('Test Case 3 Passed: Remove obsolete prompts');
  } catch (e) {
    console.error('Test Case 3 Failed: Remove obsolete prompts', e);
    allTestsPassed = false;
  }

  // Test case 4: Handle mix of new, existing, and obsolete prompts
  try {
    const promptManager = new PromptManager(basePrompt, mockToolRegistry);
    promptManager.updatePrompts(['tool1', 'tool2']);
    promptManager.updatePrompts(['tool1', 'tool3']);
    console.assert(promptManager.activeToolPrompts.size === 2, 'Test Case 4 Failed: Mix of prompts - size');
    console.assert(promptManager.activeToolPrompts.get('tool1') === 'Tool 1 instructions.', 'Test Case 4 Failed: Mix of prompts - tool1');
    console.assert(promptManager.activeToolPrompts.get('tool3') === 'Tool 3 instructions.', 'Test Case 4 Failed: Mix of prompts - tool3');
    console.assert(!promptManager.activeToolPrompts.has('tool2'), 'Test Case 4 Failed: Mix of prompts - tool2');
    console.log('Test Case 4 Passed: Handle mix of new, existing, and obsolete prompts');
  } catch (e) {
    console.error('Test Case 4 Failed: Handle mix of new, existing, and obsolete prompts', e);
    allTestsPassed = false;
  }

  // Test case 5: Get final prompt
  try {
    const promptManager = new PromptManager(basePrompt, mockToolRegistry);
    promptManager.updatePrompts(['tool1', 'tool3']);
    const finalPrompt = promptManager.getFinalPrompt();
    const expectedPrompt = 'Base system prompt. Tool 1 instructions.\nTool 3 instructions.';
    console.assert(finalPrompt === expectedPrompt, 'Test Case 5 Failed: Get final prompt');
    console.log('Test Case 5 Passed: Get final prompt');
  } catch (e) {
    console.error('Test Case 5 Failed: Get final prompt', e);
    allTestsPassed = false;
  }

  if (allTestsPassed) {
    console.log('All tests for PromptManager passed!');
  } else {
    console.error('Some tests for PromptManager failed.');
  }
}

testPromptManager();