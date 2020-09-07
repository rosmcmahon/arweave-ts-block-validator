# arweave-ts-block-validator
an arweave block validator, nothing more

## Installation

First clone the repo & enter the root folder

- To build on Windows you will need the infamously tricky to install node-gyp toolchain, although it has greatly improved lately, try this:

- `npm install --global --production windows-build-tools`

Maybe you'll get lucky ;-)


### To build node-randomx addon

*this is a bit hacky, but please follow along

`rmdir node-randomx`

`git clone -b binaries https://github.com/mcmonkeys1/node-randomx.git`

`cd node-randomx`

`node-gyp clean`

`node-gyp configure`

`node-gyp build`

### Then build the block validator

`cd ..`

`npm install`


## Now you can run the tests 

`npm run test` to run most unit tests

`npm run start:pow` to run separate RandomX unit test

`npm run test:e2e` for complete end to end testing

