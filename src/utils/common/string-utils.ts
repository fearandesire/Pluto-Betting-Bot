import _ from 'lodash'

export default class StringUtils {
	getShortName(name: string): string {
		if (name.includes(' ')) {
			return _.last(_.split(name, ' ')) || name
		} else {
			return name
		}
	}
}
