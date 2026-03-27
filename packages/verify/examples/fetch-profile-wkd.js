import * as doip from '../src/index.js'

const main = async () => {
    // Fetch the profile using WKD
    const profile = await doip.openpgp.fetchWKD("test@doip.rocks")

    // Log the claims of the first persona
    console.log(profile.personas[0].claims)
}

main()