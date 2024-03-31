import monitor from 'pg-monitor'
import pgPromise from 'pg-promise'
import { packageDirectory } from 'pkg-dir'

const rootDir = await packageDirectory()
const initOptions = {
	// options for PG promise using initPromise
	connect: true,
	disconnect: true,
	query: true,
	error: true,
	task: true,
	transact: true,
}

const pgp = pgPromise(initOptions) // initialises options

monitor.attach(initOptions) // monitor to log

const { SQLStr } = process.env

const sslrootcert = `${rootDir}/ca-certificate.crt`

const cnString = `${SQLStr}sslrootcert=${sslrootcert}`

const db = pgp({
	connectionString: cnString,
	idleTimeoutMillis: 60000,
	max: 4,
})

export default db
