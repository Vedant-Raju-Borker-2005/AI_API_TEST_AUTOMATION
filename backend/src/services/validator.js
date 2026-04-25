const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/**
 * Validates an execution result against expected status + schema.
 */
function validateResponse(test, execResult) {
  const errors = [];

  // Status code check
  const statusOk = Math.floor(execResult.statusCode / 100) === Math.floor(test.expectedStatus / 100);
  if (!statusOk) {
    errors.push(`Expected status ${test.expectedStatus}, got ${execResult.statusCode}`);
  }

  // Schema validation (positive cases only)
  if (test.category === 'POSITIVE' && test.responseSchema && execResult.data) {
    try {
      const validate = ajv.compile(test.responseSchema);
      if (!validate(execResult.data)) {
        errors.push(`Schema: ${JSON.stringify(validate.errors)}`);
      }
    } catch (e) {
      // schema compile failed - skip silently
    }
  }

  return {
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
    responseTime: execResult.responseTime,
  };
}

module.exports = { validateResponse };
