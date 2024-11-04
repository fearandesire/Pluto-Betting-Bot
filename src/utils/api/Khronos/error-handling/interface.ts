export interface IKhronosErr {
	statusCode: number;
	message: string;
	exception: string;
	details?: any;
	exception_category?: string;
}
