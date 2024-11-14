export class ValidationError extends Error {
	constructor(
		message: string,
		public readonly details: unknown,
		public readonly source: string,
	) {
		super(message);
		this.name = 'ValidationError';
	}
}
