const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SYSTEM_PROMPT,
  getInitialGreeting,
  getFallbackResponse,
  validateLLMResponse,
} = require('../src/llm/agentPrompt');

const ACTION_TYPES = ['NONE', 'SAVE_ORDER', 'SAVE_CALLBACK', 'NOT_AVAILABLE', 'END_CALL', 'NEXT_CUSTOMER'];

test('the system prompt documents every action type the controller handles', () => {
  for (const type of ACTION_TYPES) {
    assert.ok(SYSTEM_PROMPT.includes(type), `prompt should mention ${type}`);
  }
  assert.ok(SYSTEM_PROMPT.includes('"assistant_speech"'));
  assert.ok(SYSTEM_PROMPT.includes('"agent_action"'));
});

test('the opening greeting is Tamil, names the customer, and takes no action', () => {
  const greeting = getInitialGreeting('ரவி');
  assert.ok(greeting.assistant_speech.startsWith('வணக்கம் ரவி'));
  assert.equal(greeting.agent_action.type, 'NONE');
  assert.equal(greeting.agent_action.customer_status, 'contacted');
  assert.ok(getInitialGreeting().assistant_speech.startsWith('வணக்கம்.'));
});

test('the fallback asks the customer to repeat, in Tamil, without taking an action', () => {
  const fallback = getFallbackResponse();
  assert.equal(fallback.agent_action.type, 'NONE');
  assert.match(fallback.assistant_speech, /[஀-௿]/);
});

test('well-formed model output passes validation', () => {
  assert.equal(validateLLMResponse({
    assistant_speech: 'சரி.',
    agent_action: { type: 'SAVE_ORDER', order_details: { items: [], notes: '' } },
  }), true);
});

test('malformed model output is rejected so the fallback can take over', () => {
  assert.equal(validateLLMResponse(null), false);
  assert.equal(validateLLMResponse({ agent_action: { type: 'NONE' } }), false);
  assert.equal(validateLLMResponse({ assistant_speech: 'x' }), false);
  assert.equal(validateLLMResponse({ assistant_speech: 'x', agent_action: { type: 'DELETE_DB' } }), false);
  assert.equal(validateLLMResponse({ assistant_speech: 42, agent_action: { type: 'NONE' } }), false);
});
