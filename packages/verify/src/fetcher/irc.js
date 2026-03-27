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
 * Fetch proofs using IRC
 * @module fetcher/irc
 * @example
 * import { fetcher } from 'doipjs';
 * const data = await fetcher.irc.fn({ nick: 'alice', domain: 'domain.example' });
 */

import irc from 'irc-upd'
import isAscii from 'validator/lib/isAscii.js'

/**
 * Default timeout after which the fetch is aborted
 * @constant
 * @type {number}
 * @default 20000
 */
export const timeout = 20000

/**
 * Execute a fetch request
 * @function
 * @param {object} data - Data used in the request
 * @param {string} data.nick - The nick of the targeted account
 * @param {string} data.domain - The domain on which the targeted account is registered
 * @param {number} [data.fetcherTimeout] - Optional timeout for the fetcher
 * @param {import('../types').VerificationConfig} [opts] - Options used to enable the request
 * @returns {Promise<Array<string>>} The fetched proofs from an IRC account
 */
export async function fn (data, opts) {
  let timeoutHandle
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Request was timed out')),
      data.fetcherTimeout ? data.fetcherTimeout : timeout
    )
  })

  const fetchPromise = new Promise((resolve, reject) => {
    try {
      isAscii(opts.claims.irc.nick)
    } catch (err) {
      throw new Error(`IRC fetcher was not set up properly (${err.message})`)
    }

    try {
      const client = new irc.Client(data.domain, opts.claims.irc.nick, {
        port: 6697,
        secure: true,
        channels: [],
        showErrors: false,
        debug: false
      })
      const reKey = /[a-zA-Z0-9\-_]+\s+:\s((?:openpgp4fpr|aspe):.*)/
      const reEnd = /End\sof\s.*\staxonomy./
      const keys = []

      // @ts-ignore
      client.addListener('registered', (message) => {
        client.send(`PRIVMSG NickServ TAXONOMY ${data.nick}`)
      })
      // @ts-ignore
      client.addListener('notice', (nick, to, text, message) => {
        if (reKey.test(text)) {
          const match = text.match(reKey)
          keys.push(match[1])
        }
        if (reEnd.test(text)) {
          client.disconnect()
          resolve(keys)
        }
      })
    } catch (error) {
      reject(error)
    }
  })

  return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle)
  })
}
