export interface ShutdownQueue {
	close(timeoutMs: number): Promise<boolean | void>
}

const shutdownQueues = new Map<string, ShutdownQueue>()

export function registerShutdownQueue(
	name: string,
	queue: ShutdownQueue,
): () => void {
	shutdownQueues.set(name, queue)
	return () => {
		if (shutdownQueues.get(name) === queue) shutdownQueues.delete(name)
	}
}

export function getRegisteredShutdownQueues(): readonly ShutdownQueue[] {
	return [...shutdownQueues.values()]
}

export function clearShutdownQueueRegistryForTests(): void {
	shutdownQueues.clear()
}
