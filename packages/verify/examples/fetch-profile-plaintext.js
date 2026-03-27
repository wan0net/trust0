import * as doip from '../src/index.js'

const main = async () => {
    // Obtain the plaintext public key
    const pubKeyPlaintext = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mQGNBF+036UBDACoxWRdp7rBAFB2l/+dxX0XA50NJC92EEacB5L0TnC0lP/MsNHv
fAv/A9vgTwrPudvcHdE/urAjQswfIU3LpFxbBOWNYWOv6ssrzBH4vVGMyxfu2GGu
b2mxjWj0eWXnWXnzkO5fscX2y0HqNjBZjDSkYohHZJTbz91NnxK3a8+Erpk+sgEH
hQH1h75SfaW6GZucuhenxgjwEiGz84UEVS0AEWD9yNgfWCsK/6HuIRnv5Jv5V9z9
bx9Ik7QNGBks3tpNmdbeaaadkHYZpF3Fm8mCoIt2+Xx9OvyuLssZnVkuQdj8C2/z
E45If4+pHRnRcCWXpDrHUWoJaeyGuTq5triePI6h/4lgr/m/du0O/lhOrr6MUhAe
7xc0B+X+bTF/balZmmlbk5bnDoZMzdH8caui5XrkuRif/I0nYPRnc9zrqWJDDO/p
nltpMPrUMTjoiXZ8DbJ4WMK7QPdsbG8Tz/Vl3wigEmwPLfEGifLpec5RXrti5Zd9
FiSOIOetP8p8MSMAEQEAAbRBWWFybW8gTWFja2VuYmFjaCAobWF0ZXJpYWwgZm9y
IHRlc3QgZnJhbWV3b3JrcykgPHRlc3RAZG9pcC5yb2Nrcz6JAhAEEwEKAHoCGwMF
CwkIBwIGFQoJCAsCBBYCAwECHgECF4AZGGh0dHBzOi8va2V5cy5vcGVucGdwLm9y
ZxYhBDY3ICUj58Ewmreeme8txYJ7RF9LBQJhhrogJxSAAAAAABAADnByb29mQGFy
aWFkbmUuaWRkbnM6ZG9pcC5yb2NrcwAKCRDvLcWCe0RfS6LbC/9mdVWS8qiZcM0b
tcekjGXXDKWggdeYVxHMcSCypvuI7Rha8vRKGnfvtY6Wy36YsW40u6vdaw4UIFGy
6Y/8RhaT6eN0EZ8t4VQv8HXyHeWqqQSfBpyU77spcxv27Wo24OhrI9ErmxXHAjqk
Hp46lA1nJjGRkzQs09KFRPd4nL4NInV1me1G8szxzowlLbRIZ3bNqhnPTeVOa779
j8aupCr0W08W0f6FxcDxGgQBT1ytLcc1nQdhgkXppTlso+JvOr2sjff4suSXY3gC
GcTGwRX15q3YDTv36KtlBlus2f4oGk1mjqZAESklrTHCfifZW102mkKBzZ+Y0EwN
B9ODBwJNrsbqBqXMs1wQkP81O3ihONwhz5XuykJF3G0VeoOy1zSL4ghZQ4/XkWyp
fCRSXrr7SZxIu7I8jfQrxc0k9XhpPI/gdlgRqoEG2lMyqFaWzyoI9dyoVwji78rg
8t7V+BjcvC8fJHgXUZxljqi2ZfcismJE6Hyn6qsdlNF9SKWOIIg=
=Csr+
-----END PGP PUBLIC KEY BLOCK-----`

    // Use the plaintext key to get a profile
    const profile = await doip.openpgp.fetchPlaintext(pubKeyPlaintext)

    // Log the claims of the first UID
    console.log(profile.personas[0].claims)
}

main()