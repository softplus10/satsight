/**
 * Minimal browser-safe replacement for the Node assert package used by bc-ur.
 * bc-ur only calls the default truthiness assertion, so pulling Node's complete
 * assert implementation into the client adds dead code and references `process`.
 */
export class AssertionError extends Error {
	readonly code = 'ERR_ASSERTION';

	constructor(message = 'Assertion failed') {
		super(message);
		this.name = 'AssertionError';
	}
}

export default function assert(value: unknown, message?: string | Error): asserts value {
	if (value) return;
	if (message instanceof Error) throw message;
	throw new AssertionError(message);
}
