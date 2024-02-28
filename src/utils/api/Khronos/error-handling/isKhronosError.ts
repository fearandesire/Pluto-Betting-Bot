export default async function isKhronosError(error: any) {
	return 'statusCode' in error
}
