import fs from 'fs/promises'
import { EOL } from 'os'
import col from 'ansi-colors'


export const consoleVerbose = (...args: any[]) => {
	if(process.env.VERBOSE === 'true'){
		console.log(...args)
	}
}

export const logEntry = async (combinedString: string) => {
	let output = '[' + new Date().toUTCString() + '] ' + combinedString + EOL
	console.log(output)
	await fs.appendFile('logfile.log', output)
}
