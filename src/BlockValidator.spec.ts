import { Block, ReturnCode } from "./types"
import axios from 'axios'
import { validateBlock } from "./BlockValidator"


describe('BlockValidator', () => {
  let blockA: Block
  let res: ReturnCode

  beforeEach(async () => {
    blockA = (await axios.get('https://arweave.net/block/height/506358')).data
    // blockA = (await axios.get('https://arweave.net/block/current')).data
  })

  it('should return true for an old valid block', async () => {
    expect(1)
    res = await validateBlock(blockA)
    expect(res.code).toEqual(200)
  })
})