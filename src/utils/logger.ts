import col from 'ansi-colors'



export const consoleVerbose = (...args: any[]) => {
	if(process.env.VERBOSE === 'true'){
		console.log(...args)
	}
}

