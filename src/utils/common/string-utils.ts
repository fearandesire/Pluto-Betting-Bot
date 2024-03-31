import _ from 'lodash'

export default class StringUtils {
	getShortName(name: string) {
		if (name.includes(' ')) {
			return _.last(_.split(name, ' '))
		}
		return name
	}
}
