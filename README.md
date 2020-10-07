# Arweave Typescript Block Validator
an arweave block validator, nothing more

** (Under development, not for production) **

## Installation

Clone the repo, then run installation scripts

```
npm install
```

## Run the simple polling validator

```
npm start
```

## Running unit tests 

`npm run test` - to run most unit tests

`npm run start:pow` - to run separate RandomX unit test

`npm run test:e2e` - for complete end to end testing


## Troubleshooting

If you are having trouble installing on any version of Windows apart from Windows 10 x64, you may need to install node-gyp for compiling the node-randomx library first:

```
npm install --global --production windows-build-tools
```
For all other OSes take a look at the rest of the [node-gyp installion instructions](https://github.com/nodejs/node-gyp#installation) for node-gyp for prerequisites.

## Companion repos

- [arweave-cacher](https://github.com/mcmonkeys1/arweave-cacher)
- [ar-node-randomx](https://github.com/mcmonkeys1/node-randomx)
