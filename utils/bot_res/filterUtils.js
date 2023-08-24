import _ from 'lodash'
import { spinner } from '#config'
import IsoBuilder from '../time/IsoBuilder.js'

export class FilterGames {
    constructor(events) {
        this.events = events
    }

    async today() {
        spinner.start({
            text: `Filtering games..`,
            color: `yellow`,
            mark: `🕒`,
        })
        // # Use Lodash to filter games that are within today
        const eventsFiltered = _.filter(
            this.events,
            async (e) => {
                const time = e.date
                const isoBuilder = new IsoBuilder(time)
                const matches = isoBuilder.isToday()
                if (matches) {
                    return matches
                }
            },
        )
        spinner.update({
            text: `Filtered games for today!`,
            mark: `✅`,
        })
        return eventsFiltered
    }

    async thisWeek() {
        spinner.start({
            text: `Filtering games..`,
            color: `yellow`,
            mark: `🕒`,
        })
        // # Use Lodash to filter games that are within this week
        const eventsFiltered = _.filter(
            this.events,
            async (e) => {
                const time = e.date
                const isoBuilder = new IsoBuilder(time)
                const matches = isoBuilder.withinThisWeek()
                if (matches) {
                    return matches
                }
            },
        )
        spinner.update({
            text: `Filtered games for this week!`,
            mark: `✅`,
            color: `blue`,
        })
        return eventsFiltered
    }
}
