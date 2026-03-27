import * as doip from '../src/index.js'

const main = async () => {
    // Generate the claim
    const claim = new doip.Claim("dns:doip.rocks", "3637202523e7c1309ab79e99ef2dc5827b445f4b")

    // Match it to candidate service providers
    claim.match()

    // Verify the claim
    await claim.verify()

    // Log the claims of the first UID
    console.log(claim)
}

main()