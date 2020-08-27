let Randomx = require('../node-randomx/build/Release/addon')

export const mineRandomxInitLight = async (key: Uint8Array) => {
	/*
		init_light(Key) ->
			{ok, LightState} = init_light_nif(Key, jit(), large_pages()),
			LightState.
	*/

	let vm: Object
	console.log("Starting RandomX virtual machine...");
	try{
		vm = await Randomx.RandomxVM(key.buffer, ["jit"/*, "largepages"*/]);
	}
	catch(e){
		console.log(e);
		throw new Error("Error creating RandomX VM.");
	}
	return vm
}

export const mineRandomxHashLight = async (vm: Object, data: Uint8Array) => {
	console.log("Start hashing...");
	return new Uint8Array( await Randomx.hash(vm, data.buffer) )
}