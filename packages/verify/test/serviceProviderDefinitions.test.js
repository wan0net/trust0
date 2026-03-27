/*
Copyright 2021 Yarmo Mackenbach

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

import { ServiceProviderDefinitions, ServiceProvider } from '../src/index.js'

ServiceProviderDefinitions.list.forEach((spDefName, i) => {
  const spDef = ServiceProviderDefinitions.data[spDefName]

  describe(`ServiceProviderDefinitions.${spDefName}`, () => {
    it('should be an object', () => {
      expect(typeof spDef).to.equal('object')
    })
    it('should have a RegExp instance named "reURI"', () => {
      expect(spDef.reURI).to.be.instanceof(RegExp)
    })
    it('should have a function named "processURI" (1 argument)', () => {
      expect(spDef.processURI).to.be.a('function')
      expect(spDef.processURI).to.have.length(1)
    })
    it('should have an array named "tests"', () => {
      expect(spDef.tests).to.be.instanceof(Array)
    })

    spDef.tests.forEach((test, j) => {
      if (test.shouldMatch) {
        it(`should match "${test.uri}"`, () => {
          expect(spDef.reURI.test(test.uri)).to.be.true
        })
        it(`should return a valid object for "${test.uri}"`, async () => {
          const obj = spDef.processURI(spDef.tests[0].uri)
          expect(obj).to.be.instanceOf(ServiceProvider)
        })
      } else {
        it(`should not match "${test.uri}"`, () => {
          expect(spDef.reURI.test(test.uri)).to.be.false
        })
      }
    })
  })
})
