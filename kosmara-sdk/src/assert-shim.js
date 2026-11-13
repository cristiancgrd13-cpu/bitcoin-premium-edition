// Sustituto de "assert" de Node para el navegador.
function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}
assert.ok = assert;
export default assert;
export { assert };
