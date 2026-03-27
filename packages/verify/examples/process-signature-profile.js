import * as doip from '../src/index.js'

const signature = `-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

Hey there! Here's a signature profile with doip-related proofs.

openpgp4fpr:3637202523e7c1309ab79e99ef2dc5827b445f4b
key=hkp:test@doip.rocks
proof=dns:doip.rocks
-----BEGIN PGP SIGNATURE-----

iQHEBAEBCgAuFiEENjcgJSPnwTCat56Z7y3FgntEX0sFAl/3JBMQHHRlc3RAZG9p
cC5yb2NrcwAKCRDvLcWCe0RfS7XvC/wN9F/0ef/w1yXJqApgSNfc8WJxKS232g7L
prb3EMhNI9JV13yfZObb664WahkrMOiiIeN2vyofpU1h80cucQwmTcsBav/TX7HI
aBtXYtC6XvAhNUsctfA7C/uTSL3+St8G6ahbP7RLmal0r8vfIRgLMco1LtNpQM1v
gjkjNpceKkl10cJgx7UiT1RWIIvisnEGNgK31XaN8oRwAMSySjl2n4fRjDRlJPVd
cK+WvS4GJS24jRqGqZASTusPVRAOxtY+uEwX0HepUicgaHdFSFZ4iHByyrKEMi9L
sS5Z7/ZvHXgmS1BUV9++vtChi6zaFwMJZnkMci3C0xwoQ3MECNN2OrPExFFcqk/z
CgC81QrXNjGMZrBmSzPDgsibGe5G1VlQ73h1VhMjdcBZ1EjN0trEm3Ka8TDhJysS
cXbjvHSGniZ7M3S9S8knAfIquPvTp7+L7wWgSSB5VObPp1r+96n87hyFZUp7PCvl
3XkJV2l34fePSR73Ka7jmX86ARn4+HM=
=ADl+
-----END PGP SIGNATURE-----`

const main = async () => {
    // Process the OpenPGP signature
    const profile = await doip.signatures.process(signature)

    // Log the claims of the first persona
    console.log(profile.users[0].claims)
}

main()