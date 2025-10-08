
/**
 * @deprecated This interface is no longer needed. Khronos now returns pre-paired props.
 * Use ProcessedPropDto directly from @kh-openapi instead.
 */
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
