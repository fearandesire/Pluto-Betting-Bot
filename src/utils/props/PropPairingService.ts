import type { ProcessedPropDto } from "@kh-openapi";

export interface PropPair {
	event_id: string;
	commence_time: string;
	home_team: string;
	away_team: string;
	sport_title: string;
	market_key: string;
	outcome_name: string;
	description?: string;
	point?: number;
	over: {
		outcome_uuid: string;
		price: number;
	};
	under: {
		outcome_uuid: string;
		price: number;
	};
}

export class PropPairingService {
	/**
	 * Groups flat ProcessedPropDto[] into PropPair[] by matching over/under
	 * @param props - Flat array of props from Khronos
	 * @returns Array of paired props
	 */
	groupIntoPairs(props: ProcessedPropDto[]): PropPair[] {
		const grouped = new Map<string, ProcessedPropDto[]>();

		// Group by unique prop identifier
		for (const prop of props) {
			const key = `${prop.event_id}_${prop.market_key}_${prop.outcome_name}_${prop.point}`;
			if (!grouped.has(key)) {
				grouped.set(key, []);
			}
			grouped.get(key)!.push(prop);
		}

		const pairs: PropPair[] = [];

		for (const [_, propGroup] of grouped) {
			const overProp = propGroup.find((p) => p.position === "over");
			const underProp = propGroup.find((p) => p.position === "under");

			if (overProp && underProp) {
				pairs.push({
					event_id: overProp.event_id,
					commence_time: overProp.commence_time,
					home_team: overProp.home_team,
					away_team: overProp.away_team,
					sport_title: overProp.sport_title,
					market_key: overProp.market_key,
					outcome_name: overProp.outcome_name,
					description: overProp.description,
					point: overProp.point,
					over: {
						outcome_uuid: overProp.outcome_uuid,
						price: overProp.price,
					},
					under: {
						outcome_uuid: underProp.outcome_uuid,
						price: underProp.price,
					},
				});
			}
		}

		return pairs;
	}
}

