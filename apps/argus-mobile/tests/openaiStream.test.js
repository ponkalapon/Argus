const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readStreamingResponse } = require('../.tmp-test/services/openaiStream.js');

const streamResponse = (chunks) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
};

test('readStreamingResponse handles trailing data event without blank-line terminator', async () => {
  const tokens = [];
  const response = streamResponse([
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" world"}}]}',
  ]);

  const result = await readStreamingResponse(response, (token) => tokens.push(token));

  assert.equal(result?.text, 'Hello world');
  assert.deepEqual(tokens, ['Hello', ' world']);
});

test('readStreamingResponse reports malformed SSE data with chunk preview', async () => {
  const response = streamResponse(['data: {not-json}']);

  await assert.rejects(
    () => readStreamingResponse(response, () => {}),
    /Не удалось разобрать SSE chunk:.*\{not-json\}/,
  );
});
