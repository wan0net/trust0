import * as doip from '../src/index.js'

const main = async () => {
    // Fetch the profile using HKP
    const profile = await doip.openpgp.fetchHKP("test@doip.rocks")

    // Process every claim for every persona
    profile.personas.forEach(async persona => {
        persona.claims.forEach(async claim => {
            // Match the claim
            await claim.match()

            // Verify the claim
            await claim.verify()
            console.log(claim)
        })
    })
}

main()