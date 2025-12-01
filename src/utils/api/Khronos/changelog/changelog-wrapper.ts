import { GetLatestChangelogAppEnum } from '../../../../openapi/khronos/index.js'
import type { Changelog } from '../../../../openapi/khronos/models/index.js'
import { ChangelogsInstance } from '../KhronosInstances.js'

export class ChangelogWrapper {
	private changelogsApi = ChangelogsInstance

	/**
	 * Fetches the latest published changelog for Pluto.
	 * @returns The latest Pluto changelog entry, or null if none exists
	 */
	async getLatestPlutoChangelog(): Promise<Changelog | null> {
		return await this.changelogsApi.getLatestChangelog({
			app: GetLatestChangelogAppEnum.Pluto,
		})
	}
}
