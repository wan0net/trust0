/*
Copyright 2023 Yarmo Mackenbach

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

import { asp, Profile } from '../src/index.js'

const asp25519Uri = "aspe:domain.tld:QPRGVPJNWDXH4ESK2RYDTZJLTE"
const asp25519ProfileName = "test"
const asp25519ProfileClaims = ["https://domain.tld/user/test", "https://another.tld/test"]
const asp25519ProfileJws = "eyJ0eXAiOiJKV1QiLCJraWQiOiJRUFJHVlBKTldEWEg0RVNLMlJZRFRaSkxURSIsImp3ayI6eyJrdHkiOiJPS1AiLCJ1c2UiOiJzaWciLCJjcnYiOiJFZDI1NTE5IiwieCI6Il9fcG9TUXdOZWRvcGZMS1AzWmdNNkZYejlMSUpzekRaaDV3S2NvUUY3MVUifSwiYWxnIjoiRWREU0EifQ.eyJodHRwOi8vYXJpYWRuZS5pZC92ZXJzaW9uIjowLCJodHRwOi8vYXJpYWRuZS5pZC90eXBlIjoicHJvZmlsZSIsImh0dHA6Ly9hcmlhZG5lLmlkL25hbWUiOiJ0ZXN0IiwiaHR0cDovL2FyaWFkbmUuaWQvY2xhaW1zIjpbImh0dHBzOi8vZG9tYWluLnRsZC91c2VyL3Rlc3QiLCJodHRwczovL2Fub3RoZXIudGxkL3Rlc3QiXX0.yiBJbaB2oyprfRzYcmP-iz3C-5PGwV1Yc5iDSLW_2JFKVPKH3BKL2mUHE62VvyH1EiXDfWjpGae7jT1bM8PSAQ"
const asp25519ProfileJwk = {
  "kty": "OKP",
  "use": "sig",
  "crv": "Ed25519",
  "x": "__poSQwNedopfLKP3ZgM6FXz9LIJszDZh5wKcoQF71U"
}

describe('asp.fetchASPE', () => {
  it('should be a function (1 argument)', () => {
    expect(asp.fetchASPE).to.be.a('function')
    expect(asp.fetchASPE).to.have.length(1)
  })
})

describe('asp.parseProfileJws', () => {
  it('should be a function (2 arguments)', () => {
    expect(asp.parseProfileJws).to.be.a('function')
    expect(asp.parseProfileJws).to.have.length(2)
  })
  it('should return a valid Profile object when provided a valid JWS', async () => {
    let profile = await asp.parseProfileJws(asp25519ProfileJws, asp25519Uri)

    expect(profile).to.be.instanceOf(Profile)
    expect(profile.personas).to.be.length(1)
    expect(profile.personas[0].name).to.be.equal(asp25519ProfileName)
    expect(profile.personas[0].claims).to.be.length(2)

    expect(profile.personas[0].claims[0].uri).to.be.equal(asp25519ProfileClaims[0])
    expect(profile.personas[0].claims[0].fingerprint).to.be.equal(asp25519Uri)

    expect(profile.personas[0].claims[1].uri).to.be.equal(asp25519ProfileClaims[1])
    expect(profile.personas[0].claims[1].fingerprint).to.be.equal(asp25519Uri)
  })
})
