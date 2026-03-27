import * as doip from '../src/index.js'

const main = async () => {
    // Fetch the profile using ASPE
    const profile = await doip.asp.fetchASPE("aspe:keyoxide.org:6WJK26YKF6WUVPIZTS2I2BIT64")

    // Process every claim for every persona
    profile.personas[0].claims.forEach(async claim => {
        // Match the claim
        claim.match()

        // Verify the claim
        await claim.verify()
        console.log(claim)
    })
}

main()