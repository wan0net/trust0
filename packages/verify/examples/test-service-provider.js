import * as doip from '../src/index.js'

const main = async () => {
  const sp = doip.ServiceProviderDefinitions.data.sourcehut.processURI('https://git.sr.ht/~alice/keyoxide_proof')
  console.log(sp)
}

main()