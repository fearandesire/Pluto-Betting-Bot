import { Log } from './../utils/ConsoleLogging.js'
import Router from 'express-promise-router'
import query from './dbindex.js'

//const app = express();
const router = new Router()
//app.use(router);
export function testDB() {
	Log.Yellow(`[testDB.js] LOADING DB`)
	router.get('/:id', async (req, res) => {
		const { id } = req.params
		const { rows } = await query(
			`SELECT * FROM currency WHERE userid = '208016830491525120'`,
			[id],
		)
		res.send(rows[0])
	})
}