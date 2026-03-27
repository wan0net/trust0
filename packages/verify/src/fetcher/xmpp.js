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
/**
 * Fetch proofs from XMPP accounts
 * @module fetcher/xmpp
 * @example
 * import { fetcher } from 'doipjs';
 * const data = await fetcher.xmpp.fn({ id: 'alice@domain.example' });
 */

import { client, xml } from '@xmpp/client'
import debug from '@xmpp/debug'
import isFQDN from 'validator/lib/isFQDN.js'
import isAscii from 'validator/lib/isAscii.js'

/**
 * Default timeout after which the fetch is aborted
 * @constant
 * @type {number}
 * @default 5000
 */
export const timeout = 5000

let xmpp = null
let iqCaller = null

/**
 * Start the XMPP client
 * @ignore
 * @function
 * @param {import('../types').XmppClaimVerificationConfig} params - XMPP claim verification config
 * @returns {Promise<object>} The fetched proofs from an XMPP account
 */
const xmppStart = async (params) => {
  return new Promise((resolve, reject) => {
    const xmpp = client({ ...params })
    if (process.env.NODE_ENV !== 'production') {
      debug(xmpp, true)
    }
    const { iqCaller } = xmpp
    xmpp.start()
    xmpp.on('online', _ => {
      resolve({ xmpp, iqCaller })
    })
    xmpp.on('error', error => {
      reject(error)
    })
  })
}

/**
 * Execute a fetch request
 * @function
 * @param {object} data - Data used in the request
 * @param {string} data.id - The identifier of the targeted account
 * @param {number} [data.fetcherTimeout] - Optional timeout for the fetcher
 * @param {import('../types').VerificationConfig} [opts] - Options used to enable the request
 * @returns {Promise<Array<string>>} The fetched proofs from an XMPP account
 */
export async function fn (data, opts) {
  try {
    isFQDN(opts.claims.xmpp.service)
    isAscii(opts.claims.xmpp.username)
    isAscii(opts.claims.xmpp.password)
  } catch (err) {
    throw new Error(`XMPP fetcher was not set up properly (${err.message})`)
  }

  if (!xmpp || xmpp.status !== 'online') {
    const xmppStartRes = await xmppStart(opts.claims.xmpp)
    xmpp = xmppStartRes.xmpp
    iqCaller = xmppStartRes.iqCaller
  }

  let timeoutHandle
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Request was timed out')),
      data.fetcherTimeout ? data.fetcherTimeout : timeout
    )
  })

  const fetchPromise = new Promise((resolve, reject) => {
    (async () => {
      let completed = false
      const proofs = []

      // Try the ariadne-id pubsub request
      if (!completed) {
        try {
          const response = await iqCaller.request(
            xml('iq', { type: 'get', to: data.id }, xml('pubsub', 'http://jabber.org/protocol/pubsub', xml('items', { node: 'http://ariadne.id/protocol/proof' }))),
            30 * 1000
          )

          // Traverse the XML response
          response.getChild('pubsub').getChildren('items').forEach(items => {
            if (items.attrs.node === 'http://ariadne.id/protocol/proof') {
              items.getChildren('item').forEach(item => {
                proofs.push(item.getChildText('value'))
              })
            }
          })

          resolve(proofs)
          completed = true
        } catch (_) {}
      }

      // Try the vcard4 pubsub request [backward compatibility]
      if (!completed) {
        try {
          const response = await iqCaller.request(
            xml('iq', { type: 'get', to: data.id }, xml('pubsub', 'http://jabber.org/protocol/pubsub', xml('items', { node: 'urn:xmpp:vcard4', max_items: '1' }))),
            30 * 1000
          )

          // Traverse the XML response
          response.getChild('pubsub').getChildren('items').forEach(items => {
            if (items.attrs.node === 'urn:xmpp:vcard4') {
              items.getChildren('item').forEach(item => {
                if (item.attrs.id === 'current') {
                  const itemVcard = item.getChild('vcard', 'urn:ietf:params:xml:ns:vcard-4.0')
                  // Find the vCard URLs
                  itemVcard.getChildren('url').forEach(url => {
                    proofs.push(url.getChildText('uri'))
                  })
                  // Find the vCard notes
                  itemVcard.getChildren('note').forEach(note => {
                    proofs.push(note.getChildText('text'))
                  })
                }
              })
            }
          })

          resolve(proofs)
          completed = true
        } catch (_) {}
      }

      // Try the vcard-temp IQ request [backward compatibility]
      if (!completed) {
        try {
          const response = await iqCaller.request(
            xml('iq', { type: 'get', to: data.id }, xml('vCard', 'vcard-temp')),
            30 * 1000
          )

          // Find the vCard URLs
          response.getChild('vCard', 'vcard-temp').getChildren('URL').forEach(url => {
            proofs.push(url.children[0])
          })
          // Find the vCard notes
          response.getChild('vCard', 'vcard-temp').getChildren('NOTE').forEach(note => {
            proofs.push(note.children[0])
          })
          response.getChild('vCard', 'vcard-temp').getChildren('DESC').forEach(note => {
            proofs.push(note.children[0])
          })

          resolve(proofs)
          completed = true
        } catch (error) {
          reject(error)
        }
      }

      xmpp.stop()
    })()
  })

  return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle)
  })
}
